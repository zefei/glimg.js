module.exports = Glimg

var Shader = require('./shader')
var Buffer = require('./buffer')
var Texture = require('./texture')
var shaders = require('./shaders')
var utils = require('./utils')

// new Glimg([canvas, [options]])
//
// Create an empty Glimg object.
//
// If canvas is provided, either node or selector, Glimg will use that canvas 
// node instead of creating a new one.
//
// Notice that you cannot use a canvas that has called getContext('2d').
//
// Options:
//
// resize (default 2048): loaded image will be downsized to this value if its 
// width or height exceeds it; 'max' means the limit is the maximal value 
// browser supports.
//
function Glimg(canvas, options) {
  if (canvas) {
    canvas = utils.getNode(canvas)
  } else {
    canvas = document.createElement('canvas')
  }

  var glopts = {
    preserveDrawingBuffer: true,
    premultipliedAlpha: true
  }

  var gl = canvas.getContext('webgl', glopts) ||
           canvas.getContext('experimental-webgl', glopts)

  if (!gl) throw 'WebGL is not supported'

  this.isGlimg = true
  this.canvas = canvas
  this.gl = gl
  this.options = options || {}
  this.options.resize = this.options.resize || 2048
  this._buffers = {}
  this._textures = {}
  this._shaders = {}
  var maxUnit = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) - 1
  this._unit = [maxUnit, maxUnit - 1, maxUnit - 2, maxUnit - 3]
  this._chain = {count: 0}
  this.setSource(0)
  this.setTarget(null)
  this.setZoom(null)
}

// load(node[, nocopy])
// returns this object
//
// Load image from a node (canvas, image or video) as source image. Then copy it 
// to the target image unless nocopy is set.
//
Glimg.prototype.load = function(node, nocopy) {
  node = utils.getNode(node)
  this.setSource(this.sourceUnit, node).setTarget(this.targetUnit)
  if (!nocopy) this.copy()
  return this
}

// loadFromUrl(url[, callback[, nocopy]])
// returns this object
//
// Load remote image as source image. Callback is fired when image is loaded.  
// Then copy it to the target image unless nocopy is set.
//
Glimg.prototype.loadFromUrl = function(url, callback, nocopy) {
  var self = this
  var image = new Image()
  image.onload = function() {
    self.load(image, nocopy)
    if (callback) callback()
  }
  image.src = url
  return this
}

// setSize(width, height)
// returns this object
//
// Set target image size.
//
Glimg.prototype.setSize = function(width, height) {
  if (this.targetUnit === null) {
    this.width = this.canvas.width = width
    this.height = this.canvas.height = height
    this.zoom(this._zoomLevel)
  } else {
    this.useTexture(this.targetUnit, null, width, height)
  }

  this.gl.viewport(0, 0, width, height)
  return this
}

// setZoom(zoomLevel)
// returns this object
//
// Set css size of the canvas according to actual image size. This persists 
// through resizes.
//
// Zoom level can be a number: zoom ratio, or 'fit': 100% parent width, or null: 
// not zooming on resizes.
//
Glimg.prototype.setZoom = function(zoomLevel) {
  this._zoomLevel = zoomLevel
  this.zoom(zoomLevel)
  return this
}

// zoom(zoomLevel)
// returns this object
//
// Zoom the canvas once. See 'setZoom' for more details.
//
Glimg.prototype.zoom = function(zoomLevel) {
  if (utils.isNothing(zoomLevel)) {
    return this
  } else if (zoomLevel === 'fit') {
    this.canvas.style.width = '100%'
  } else {
    this.canvas.style.width = '' + (this.width * zoomLevel) + 'px'
  }
  this.canvas.style.height = 'auto'

  return this
}

// apply()
// returns this object
//
// Apply rendered result back to source image.
//
Glimg.prototype.apply = function() {
  this.setSource(this.sourceUnit, this)
  return this
}

// clear([red, green, blue, alpha])
// returns this object
//
// Clear canvas with specified color, default (0, 0, 0, 0).
//
Glimg.prototype.clear = function(red, green, blue, alpha) {
  this.gl.clearColor(red || 0, green || 0, blue || 0, alpha || 0)
  this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  return this
}

// toDataUrl([format])
// returns a base64 url String
//
// Save image data to base64 url. Format can be 'jpeg' (default) or 'png'.
// This can be used as <a> href or window.location.
//
Glimg.prototype.toDataURL = function(format) {
  format = format || 'jpeg'
  return this.canvas.toDataURL('image/' + format)
}

// destroy()
// returns nothing
//
// Destroy the object, free allocated memories.
//
Glimg.prototype.destroy = function() {
  if (this.gl) {
    var key
    for (key in this._buffers) {
      this._buffers[key].destroy()
    }

    for (key in this._textures) {
      this._textures[key].destroy()
    }

    for (key in this._shaders) {
      this._shaders[key].destroy()
    }

    this.canvas = null
    this.gl = null
    this._buffers = null
    this._textures = null
    this._shaders = null
  }
}

Glimg.prototype.copy = function(sourceCoord, targetCoord) {
  var s = sourceCoord || {left: 0, top: 0, right : 1, bottom: 1}
  var t = targetCoord || {left: 0, top: 0, right : 1, bottom: 1}

  this.useShader(shaders.core.copy)
  .set('aSourceCoord', s.left, s.top, s.right, s.bottom)
  .set('aTargetCoord', t.left, t.top, t.right, t.bottom)
  .run()

  return this
}

// crop(left, top, right, bottom)
// returns this object
//
// Crop the image. Coordinates are in percentage, not pixels. They should be in 
// the range of [0, 1].
//
Glimg.prototype.crop = function(left, top, right, bottom) {
  var width = (right - left) * this._textures[0].width
  var height = (bottom - top) * this._textures[0].height

  this.setSize(width, height)
  .copy({left: left, top: top, right: right, bottom: bottom})

  return this
}

Glimg.prototype.rotate = function(degree) {
  // rotation matrix
  var theta = Math.PI / 180 * degree
  var mat = [Math.cos(theta), -Math.sin(theta), Math.sin(theta), Math.cos(theta)]

  // source dimension
  var width = this.getSource().width
  var height = this.getSource().height

  // maximal fitting rectangle
  // http://stackoverflow.com/questions/5789239/calculate-largest-rectangle-in-a-rotated-rectangle
  var w0, h0
  if (width <= height) {
    w0 = width
    h0 = height
  } else {
    w0 = height
    h0 = width
  }

  var alpha = theta - Math.floor((theta + Math.PI) / (2 * Math.PI)) * (2 * Math.PI)
  alpha = Math.abs(alpha)
  if (alpha > Math.PI / 2) alpha = Math.PI - alpha

  var sina = Math.sin(alpha)
  var cosa = Math.cos(alpha)
  var w1 = w0 * cosa + h0 * sina
  var h1 = w0 * sina + h0 * cosa
  var c = h0 * (sina * cosa) / (2 * h0 * (sina * cosa) + w0)
  var x = w1 * c
  var y = h1 * c
  var w, h
  if (width <= height) {
    w = w1 - 2 * x
    h = h1 - 2 * y
  }
  else {
    w = h1 - 2 * y
    h = w1 - 2 * x
  }

  // dimension transform
  var l, t, r, b;
  l = (width - w) / (2 * width)
  r = (width + w) / (2 * width)
  t = (height - h) / (2 * height)
  b = (height + h) / (2 * height)

  this.setSize(w, h)
  .useShader(shaders.core.transform)
  .setMatrix('transform', mat)
  .set('aSourceCoord', l, t, r, b)
  .run()

  return this
}

Glimg.prototype.blend = function(node, options) {
  options = options || {}
  var mode = options.mode || 'normal'
  var opacity = utils.isNothing(options.opacity) ? 1 : options.opacity
  var coord = options.coord || {left: 0, top: 0, right: 1, bottom: 1}
  var mask = options.mask || [255, 255, 255, 255]

  var foregroundUnit, foregroundNode, maskUnit, maskNode

  if (utils.isNumber(node)) {
    foregroundUnit = node
    foregroundNode = null
  } else {
    foregroundUnit = this._unit[2]
    foregroundNode = node
  }

  if (utils.isNumber(mask)) {
    maskUnit = mask
    maskNode = null
  } else {
    maskUnit = this._unit[3]
    maskNode = mask
  }

  this._holdChain = true
  this.copy()
  this._holdChain = false

  this.useShader(shaders.blend[mode])
  .set('aSourceCoord', coord.left, coord.top, coord.right, coord.bottom)
  .set('aTargetCoord', coord.left, coord.top, coord.right, coord.bottom)
  .set('foreground', foregroundUnit, foregroundNode)
  .set('opacity', opacity)
  .setTexture('mask', maskUnit, maskNode, 1, 1)
  .run()

  return this
}

Glimg.prototype.blur = function(radius) {
  if (radius <= 0) return this
  if (radius <= 4) return this.gaussianBlur(radius)

  var w = this.getSource().width
  var h = this.getSource().height
  var r = Math.sqrt(radius)

  this.chain()
  .gaussianBlur(r)
  .setSize(w / r, h / r)
  .copy()
  .gaussianBlur(r)
  .setSize(w, h)
  .copy()
  .done()

  return this
}

Glimg.prototype.gaussianBlur = function(radius) {
  if (radius <= 0) return this

  var gaussian = shaders.blur.gaussian256
  for (var i = 2; i < 256; i *= 2) {
    if (radius <= i) {
      gaussian = shaders.blur['gaussian' + i]
      break
    }
  }

  this.chain()
  .useShader(gaussian)
  .set('sigma', radius / 3)
  .set('axis', [1, 0])
  .run()
  .useShader(gaussian)
  .set('sigma', radius / 3)
  .set('axis', [0, 1])
  .run()
  .done()

  return this
}

Glimg.prototype.brightnessContrast = function(brightness, contrast) {
  brightness = brightness || 0
  contrast = utils.isNothing(contrast) ? 1 : contrast

  this.useShader(shaders.effects['brightness-contrast'])
  .set('brightness', brightness)
  .set('contrast', contrast)
  .run()

  return this
}

Glimg.prototype.hueSaturation = function(hue, saturation, lightness) {
  hue = hue || 0
  saturation = saturation || 0
  lightness = lightness || 0

  this.useShader(shaders.effects['hue-saturation'])
  .set('hue', hue)
  .set('saturation', saturation)
  .set('lightness', lightness)
  .run()

  return this
}

Glimg.prototype.splitTone = function(highlight, shadow) {
  highlight = highlight || [0.5, 0.5, 0.5]
  shadow = shadow || [0.5, 0.5, 0.5]

  this.useShader(shaders.effects['split-tone'])
  .set('highlight', highlight)
  .set('shadow', shadow)
  .run()

  return this
}

Glimg.prototype.duotone = function(highlight, shadow) {
  highlight = highlight || [1, 1, 1]
  shadow = shadow || [1, 1, 1]

  this.useShader(shaders.effects.duotone)
  .set('highlight', highlight)
  .set('shadow', shadow)
  .run()

  return this
}

Glimg.prototype.sharpen = function(strength, radius) {
  radius = radius || 5

  var source = this.sourceUnit
  var target = this.targetUnit

  this.setTarget(this._unit[2])
  .copy()
  .setSource(this._unit[2]).setTarget(this._unit[3])
  .blur(radius)
  .setSource(this._unit[2]).setTarget(target)
  .useShader(shaders.effects.sharpen)
  .set('strength', strength)
  .set('background', this._unit[3], null)
  .run()
  .setSource(source)

  return this
}

Glimg.prototype.vignette = function(darken, brighten) {
  this.useShader(shaders.effects.vignette)
  .set('darken', darken)
  .set('brighten', brighten)
  .run()

  return this
}

// setStage(sourceUnit, targetUnit[, node])
// returns this object
//
// Set source unit and target unit, and optionally load image from node to 
// source unit. It resizes target unit to match source unit afterwards.
//
Glimg.prototype.setStage = function(sourceUnit, targetUnit, node) {
  this.setSource(sourceUnit, node).setTarget(targetUnit)
  return this
}

Glimg.prototype.chain = function() {
  if (this._chain.count > 0) {
    this._chain.count += 1
  } else {
    this._chain = {source: this.sourceUnit, target: this.targetUnit, unit: 0, count: 1}
    this.setTarget(this._unit[0])
  }
  return this
}

Glimg.prototype.done = function() {
  if (this._chain.count <= 0) return this
  this._chain.count -= 1
  if (this._chain.count === 0) {
    this.setTarget(this._chain.target).copy().setSource(this._chain.source)
  }
  return this
}

// getSource()
// returns current source image
//
Glimg.prototype.getSource = function() {
  return this._textures[this.sourceUnit]
}

// setSource(unit[, node])
// returns this object
//
// Set source unit, and optionally load image from node to source unit.
//
Glimg.prototype.setSource = function(unit, node) {
  this.sourceUnit = unit
  if (node) this.useTexture(unit, node)
  return this
}

// getTarget()
// returns current target image, null if target is the canvas
//
Glimg.prototype.getTarget = function() {
  return this._textures[this.targetUnit]
}

// setTarget(unit)
// returns this object
//
// Set target unit. It resizes target unit to match source unit afterwards.
//
Glimg.prototype.setTarget = function(unit) {
  this.targetUnit = unit

  if (utils.isNothing(unit)) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  var source = this.getSource()
  if (source) this.setSize(source.width, source.height)

  return this
}

// useShader(source)
// returns a Shader object
//
// Create and cache a WebGL shader program from source and return it. Use cached 
// shader if possible.
//
// The source should be a fragment shader based on glimg.shaders.copy. It will 
// be compiled and linked with glimg.shaders.vertex.
//
// Glimg shaders are loaded in glimg.shaders, their source files are located at 
// src/shaders. Take a look at the sources to see how they are organized.
//
Glimg.prototype.useShader = function(source) {
  if (!this._shaders[source]) {
    this._shaders[source] = new Shader(this, source)
  }

  var texture = this.getSource()
  this._shaders[source]
  .use()
  .set('aSourceCoord', 0, 0, 1, 1)
  .set('aTargetCoord', 0, 0, 1, 1)
  .set('aMaskCoord', 0, 0, 1, 1)
  .set('flipY', this.targetUnit === null ? -1 : 1)
  .set('source', this.sourceUnit, null)
  .set('size', [1 / texture.width, 1 / texture.height, texture.width, texture.height])

  return this._shaders[source]
}

Glimg.prototype.step = function() {
  if (this._chain.count <= 0 || this._holdChain) return this
  var unit = this._chain.unit === 0 ? 1 : 0
  this.setSource(this.targetUnit).setTarget(this._unit[unit])
  this._chain.unit = unit
  return this
}

// private
// useBuffer(array)
// returns this object
//
// Create and cache a WebGL buffer from array. Use cached buffer if possible.
//
// To create/pass vertices to shader, use shader.set() instead.
//
Glimg.prototype.useBuffer = function(array) {
  if (!utils.isArray(array)) array = [].slice.call(arguments)
  var key = array.join()

  if (!this._buffers[key]) {
    this._buffers[key] = new Buffer(this.gl, array)
  }
  this._buffers[key].bind()

  return this
}

// private
// useTexture(unit, node)
// useTexture(unit, width, height)
// returns this object
//
// Create and cache a WebGL texture unit from node, or create a framebuffer 
// texutre if width and height are provided. Use cached texture if possible.
//
// To create/pass textures to shader, use shader.set() instead.
//
Glimg.prototype.useTexture = function(unit, nodeOrData, width, height) {
  var texture = this._textures[unit]
  var reuse = !nodeOrData && texture && texture.framebuffer &&
              texture.width === width && texture.height === height

  if (!reuse) {
    if (this._textures[unit]) this._textures[unit].destroy()
    this._textures[unit] = new Texture(this.gl, unit, nodeOrData, width, height, this.options)
  }

  this._textures[unit].bind()
  return this
}
