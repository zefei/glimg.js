!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.glimg=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
module.exports = Buffer

var utils = _dereq_('./utils')

function Buffer(gl, array) {
  this.gl = gl
  this.buffer = gl.createBuffer()
  this.bind()
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STATIC_DRAW)
}

Buffer.prototype.bind = function() {
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer)
}

Buffer.prototype.destroy = function() {
  this.gl.deleteBuffer(this.buffer)
  this.buffer = null
  this.gl = null
}

},{"./utils":7}],2:[function(_dereq_,module,exports){
module.exports = Glimg

var Shader = _dereq_('./shader')
var Buffer = _dereq_('./buffer')
var Texture = _dereq_('./texture')
var Spline = _dereq_('./spline')
var shaders = _dereq_('./shaders')
var utils = _dereq_('./utils')
var whiteBalance = _dereq_('./whiteBalance')

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

// getpixels([unit])
// returns pixel data (RGBA) in Uint8Array
//
// unit can be
// number: the specified image unit
// null: the canvas
// 'source': source image
// 'target': target image
// default to 'target'
//
Glimg.prototype.getPixels = function(unit) {
  if (unit === 'source') unit = this.sourceUnit
  if (unit === 'target' || typeof unit === 'undefined') unit = this.targetUnit

  var source = this.sourceUnit
  var target = this.targetUnit

  if (unit !== target) {
    if (unit === null || this._textures[unit].framebuffer) {
      this.setTarget(unit)
    } else {
      this._holdChain = true
      this.setSource(unit).setTarget(this._unit[2]).copy()
      this._holdChain = false
    }
  }

  var image = this.getTarget()
  var size = image.width * image.height * 4
  var pixels = new Uint8Array(size)
  this.gl.readPixels(0, 0, image.width, image.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels)

  this.setSource(source).setTarget(target)
  return pixels
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

Glimg.prototype.transform = function(matrix, cropCoord) {
  if (matrix.length == 4) {
    matrix = [
      matrix[0], matrix[1], 0,
      matrix[2], matrix[3], 0,
      0, 0, 1
    ]
  }

  var c = cropCoord || {left: 0, top: 0, right : 1, bottom: 1}
  var width = (c.right - c.left) * this.getSource().width
  var height = (c.bottom - c.top) * this.getSource().height

  this.setSize(width, height)
  .useShader(shaders.core.transform)
  .set('transform', matrix)
  .set('aSourceCoord', c.left, c.top, c.right, c.bottom)
  .run()

  return this
}

Glimg.prototype.rotate = function(degree) {
  // source dimension
  var width = this.getSource().width
  var height = this.getSource().height

  // rotation matrix
  var theta = Math.PI / 180 * degree
  var sint = Math.sin(theta)
  var cost = Math.cos(theta)
  var r = width / height
  var mat = [
    cost, -sint / r, 0.5 * (1 - cost + sint / r),
    sint * r, cost, 0.5 * (1 - sint * r - cost),
    0, 0, 1
  ]

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

  // crop coordinates
  var l, t, r, b;
  l = (width - w) / (2 * width)
  r = (width + w) / (2 * width)
  t = (height - h) / (2 * height)
  b = (height + h) / (2 * height)

  this.transform(mat, {left: l, top: t, right: r, bottom: b})
  return this
}

Glimg.prototype.replaceColor = function(lookUpTable) {
  this.useTexture(this._unit[2], utils.flatten(lookUpTable), 256, 1)
  .useShader(shaders.core.lut)
  .set('lut', this._unit[2], null)
  .run()

  return this
}

Glimg.prototype.curves = function(points) {
  spline = new Spline(points)

  var lut = []
  for (var x = 0; x <= 255; x++) {
    var y = utils.clamp(Math.round(spline.interpolate(x / 255) * 255), 0, 255)
    lut[x] = [y, y, y, 255]
  }

  this.replaceColor(lut)
  return this
}

Glimg.prototype.levels = function(black, midpoint, white) {
  this.useShader(shaders.adjustments.levels)
  .set('black', black)
  .set('midpoint', midpoint)
  .set('white', white)
  .run()

  return this
}

Glimg.prototype.convolve = function(matrix, divisor) {
  matrix = matrix.map(function(i) { return [i] })
  divisor = divisor || 1

  var dim = Math.sqrt(matrix.length)
  var radius = (dim - 1) / 2
  var convolve = '#define dim ' + dim + '\n' +
                 '#define radius ' + radius + '\n\n' +
                 shaders.core.convolve

  this.useShader(convolve)
  .set('matrix', matrix)
  .set('divisor', divisor)
  .run()

  return this
}

// histogram([unit])
// returns histogram array
//
// unit can be
// number: the specified image unit
// null: the canvas
// 'source': source image
// 'target': target image
// default to 'target'
//
Glimg.prototype.histogram = function(unit) {
  var pixels = this.getPixels(unit)

  var histogram = [[], [], []]
  for (var channel = 0; channel < 3; channel++) {
    for (var value = 0; value < 256; value++) {
      histogram[channel][value] = 0
    }
  }

  for (var i = 0; i < pixels.length; i += 4) {
    for (var channel = 0; channel < 3; channel++) {
      var value = pixels[i + channel]
      histogram[channel][value] += 1
    }
  }

  return histogram
}

// whiteBalance(red, green, blue)
// whiteBalance(temperature, tint)
// whiteBalance()
// returns this object
//
// White balance image based on neutral color (red/green/blue), 
// temperature/tint, or automatically
//
Glimg.prototype.whiteBalance = function() {
  var white
  if (arguments.length === 0) {
    var pixels = this.getPixels('source')
    white = whiteBalance.getWhiteColor(pixels)
  } else if (arguments.length === 3) {
    white = [arguments[0], arguments[1], arguments[2]]
  } else {
    white = whiteBalance.t2rgb(arguments[0], arguments[1])
  }

  var l = 0.299 * white[0] + 0.587 * white[1] + 0.114 * white[2]
  white[0] /= l
  white[1] /= l
  white[2] /= l

  var lut = []
  for (var x = 0; x < 256; x++) {
    var r = utils.clamp(Math.round(x / white[0]), 0, 255)
    var g = utils.clamp(Math.round(x / white[1]), 0, 255)
    var b = utils.clamp(Math.round(x / white[2]), 0, 255)
    lut[x] = [r, g, b, 255]
  }

  this.replaceColor(lut)
  return this
}

Glimg.prototype.blend = function(node, options) {
  options = options || {}
  var mode = utils.camelCase(options.mode || 'normal')
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

Glimg.prototype.gaussianBlur = function(radius) {
  if (radius <= 0) return this

  for (var r = 2; r < 256; r *= 2) {
    if (radius <= r) break
  }

  var gaussian = '#define radius ' + r + '.0\n\n' + shaders.core.gaussian

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

Glimg.prototype.brightnessContrast = function(brightness, contrast) {
  var mid = 0.5 + brightness / 2;
  var spline = new Spline([[0, 0], [0.5, mid], [1, 1]])

  var shadow = spline.interpolate(0.25) - contrast / 4;
  var highlight = spline.interpolate(0.75) + contrast / 4;

  this.curves([[0, 0], [0.25, shadow], [0.5, mid], [0.75, highlight], [1, 1]])

  return this
}

Glimg.prototype.recover = function(highlight, shadow, radius) {
  radius = radius || 5

  var source = this.sourceUnit
  var target = this.targetUnit

  this.setTarget(this._unit[2])
  .copy()
  .setSource(this._unit[2]).setTarget(this._unit[3])
  .blur(radius)
  .setSource(this._unit[2]).setTarget(target)
  .useShader(shaders.adjustments.recover)
  .set('highlight', highlight)
  .set('shadow', shadow)
  .set('background', this._unit[3], null)
  .run()
  .setSource(source)

  return this
}

Glimg.prototype.hueSaturation = function(hue, saturation, lightness) {
  hue = hue || 0
  saturation = saturation || 0
  lightness = lightness || 0

  this.useShader(shaders.adjustments.hueSaturation)
  .set('hue', hue)
  .set('saturation', saturation)
  .set('lightness', lightness)
  .run()

  return this
}

Glimg.prototype.splitTone = function(highlight, shadow) {
  highlight = highlight || [0.5, 0.5, 0.5]
  shadow = shadow || [0.5, 0.5, 0.5]

  this.useShader(shaders.effects.splitTone)
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
// returns current target image, this glimg object if target unit is null
//
Glimg.prototype.getTarget = function() {
  return utils.isNothing(this.targetUnit) ? this : this._textures[this.targetUnit]
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
// useTexture(unit, data, width, height)
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

},{"./buffer":1,"./shader":3,"./shaders":4,"./spline":5,"./texture":6,"./utils":7,"./whiteBalance":8}],3:[function(_dereq_,module,exports){
module.exports = Shader

var utils = _dereq_('./utils')

function Shader(glimg, source) {
  this.glimg = glimg
  var gl = this.gl = glimg.gl
  var vertex = _dereq_('./shaders').core.vertex
  var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertex)
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, source)
  var program = this.program = gl.createProgram()

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw 'shader link error'
}

Shader.prototype.use = function() {
  this.gl.useProgram(this.program)
  return this
}

Shader.prototype.set = function(name, values) {
  var func

  if (arguments.length == 2) {
    if (utils.isNumber(values)) {
      func = 'setFloat'
    } else if (utils.isArray(values)) {
      if (values.length <= 4 || utils.isArray(values[0])) {
        func = 'setVector'
      } else {
        func = 'setMatrix'
      }
    }
  } else if (arguments.length == 3) {
    func = 'setTexture'
  } else if (arguments.length == 5) {
    func = 'setRect'
  } else {
    throw 'invalid arguments'
  }

  return this[func].apply(this, arguments)
}

Shader.prototype.run = function() {
  this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  this.glimg.step()
  return this.glimg
}

Shader.prototype.setFloat = function(name, value) {
  var gl = this.gl

  var location = gl.getUniformLocation(this.program, name)
  if (location !== null) {
    gl.uniform1f(location, value)
  }

  return this
}

Shader.prototype.setVector = function(name, values) {
  var gl = this.gl

  var location = gl.getUniformLocation(this.program, name)
  if (location !== null) {
    var n = utils.isArray(values[0]) ? values[0].length : values.length
    var func = 'uniform' + n + 'fv'
    gl[func](location, utils.flatten(values))
  }

  return this
}

Shader.prototype.setMatrix = function(name, values) {
  var gl = this.gl

  var location = gl.getUniformLocation(this.program, name)
  if (location !== null) {
    if (values.length === 4) {
      gl.uniformMatrix2fv(location, false, utils.transpose(values))
    } else if (values.length === 9) {
      gl.uniformMatrix3fv(location, false, utils.transpose(values))
    } else if (values.length === 16) {
      gl.uniformMatrix4fv(location, false, utils.transpose(values))
    }
  }

  return this
}

Shader.prototype.setTexture = function(name, unit, node, width, height) {
  var gl = this.gl

  var location = gl.getUniformLocation(this.program, name)
  if (location !== null) {
    if (node) this.glimg.useTexture(unit, node, width, height)
    gl.uniform1i(location, unit)
  }

  return this
}

Shader.prototype.setRect = function(name, left, top, right, bottom) {
  var gl = this.gl

  var location = gl.getAttribLocation(this.program, name)
  if (location !== null) {
    this.glimg.useBuffer(left, top, left, bottom, right, top, right, bottom)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
  }

  return this
}

Shader.prototype.destroy = function() {
  this.gl.deleteProgram(this.program)
  this.program = null
  this.gl = null
  this.glimg = null
}

function createShader(gl, type, source) {
  var shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

},{"./shaders":4,"./utils":7}],4:[function(_dereq_,module,exports){
module.exports = {
  core: {
    vertex: "attribute vec2 aSourceCoord;\nattribute vec2 aTargetCoord;\nattribute vec2 aMaskCoord;\nuniform float flipY;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n   gl_Position = vec4((aTargetCoord * 2.0 - 1.0) * vec2(1, flipY), 0.0, 1.0);\n   coord = aSourceCoord;\n   maskCoord = aMaskCoord;\n}\n",
    copy: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  gl_FragColor = texture2D(source, coord);\n}\n",
    transform: "precision mediump float;\n\nuniform mat3 transform;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec2 c = (transform * vec3(coord, 1.0)).xy;\n  bool outOfRange = any(greaterThan(abs(c - vec2(0.5)), vec2(0.5)));\n  gl_FragColor = outOfRange ? vec4(0.0) : texture2D(source, c);\n}\n",
    lut: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D lut;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  src.r = texture2D(lut, vec2(src.r, 0.0)).r;\n  src.g = texture2D(lut, vec2(src.g, 0.0)).g;\n  src.b = texture2D(lut, vec2(src.b, 0.0)).b;\n\n  gl_FragColor = src;\n}\n",
    convolve: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform float matrix[dim * dim];\nuniform float divisor;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec3 sum = vec3(0.0);\n\n  for (int y = 0; y < dim; y++) {\n    for (int x = 0; x < dim; x++) {\n      vec2 offset = vec2(x - radius, y - radius);\n      sum += texture2D(source, coord + offset * size.xy).rgb * matrix[y * dim + x];\n    }\n  }\n\n  gl_FragColor = vec4(sum / divisor, texture2D(source, coord).a);\n}\n",
    gaussian: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n"
  },
  adjustments: {
    levels: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform float black;\nuniform float midpoint;\nuniform float white;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nfloat interpolate(float value) {\n  return (value - black) / (white - black);\n}\n\nvec3 interpolate(vec3 value) {\n  return (value - black) / (white - black);\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  vec3 streched = interpolate(src.rgb);\n  float m = interpolate(midpoint);\n  float gamma = log(0.5) / log(m);\n  src.rgb = pow(streched, vec3(gamma, gamma, gamma));\n\n  gl_FragColor = src;\n}\n",
    recover: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D background;\nuniform vec4 size;\nuniform float highlight;\nuniform float shadow;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvec3 softlight(vec3 src, vec3 dst) {\n  vec3 color;\n  color.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)\n    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);\n  color.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)\n    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);\n  color.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)\n    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);\n  return color;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  float invl = 1.0 - luma(texture2D(background, coord).rgb);\n  vec3 blend = softlight(vec3(invl, invl, invl), src.rgb);\n\n  src.rgb += clamp(blend - src.rgb, -1.0, 0.0) * highlight +\n    clamp(blend - src.rgb, 0.0, 1.0) * shadow;\n  gl_FragColor = src;\n}\n",
    hueSaturation: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform float hue;\nuniform float saturation;\nuniform float lightness;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  vec3 hcl = rgb2hcl(src.rgb);\n  hcl.x = mod(hcl.x + hue * 6.0, 6.0);\n  hcl.y *= saturation;\n  hcl.z += lightness;\n\n  gl_FragColor = vec4(hcl2rgb(hcl), src.a);\n}\n"
  },
  blend: {
    normal: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src;\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    multiply: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src * dst;\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    screen: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = 1.0 - (1.0 - src) * (1.0 - dst);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    overlay: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = dst.r < 0.5 ? 2.0 * src.r * dst.r : 1.0 - 2.0 * (1.0 - src.r) * (1.0 - dst.r);\n  blend.g = dst.g < 0.5 ? 2.0 * src.g * dst.g : 1.0 - 2.0 * (1.0 - src.g) * (1.0 - dst.g);\n  blend.b = dst.b < 0.5 ? 2.0 * src.b * dst.b : 1.0 - 2.0 * (1.0 - src.b) * (1.0 - dst.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    darken: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = min(src, dst);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    lighten: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = max(src, dst);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    colorDodge: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r == 1.0 ? 1.0 : dst.r / (1.0 - src.r);\n  blend.g = src.g == 1.0 ? 1.0 : dst.g / (1.0 - src.g);\n  blend.b = src.b == 1.0 ? 1.0 : dst.b / (1.0 - src.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    colorBurn: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r == 0.0 ? 0.0 : 1.0 - (1.0 - dst.r) / src.r;\n  blend.g = src.g == 0.0 ? 0.0 : 1.0 - (1.0 - dst.g) / src.g;\n  blend.b = src.b == 0.0 ? 0.0 : 1.0 - (1.0 - dst.b) / src.b;\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    hardLight: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r < 0.5 ? 2.0 * src.r * dst.r : 1.0 - 2.0 * (1.0 - src.r) * (1.0 - dst.r);\n  blend.g = src.g < 0.5 ? 2.0 * src.g * dst.g : 1.0 - 2.0 * (1.0 - src.g) * (1.0 - dst.g);\n  blend.b = src.b < 0.5 ? 2.0 * src.b * dst.b : 1.0 - 2.0 * (1.0 - src.b) * (1.0 - dst.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    softLight: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)\n    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);\n  blend.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)\n    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);\n  blend.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)\n    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    difference: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = abs(dst - src);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    exclusion: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src + dst - 2.0 * src * dst;\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    hue: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(dst.rgb);\n  blend.rgb = hcl2rgb(vec3(rgb2hcl(src.rgb).x, hcl.y, hcl.z));\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    saturation: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(dst.rgb);\n  blend.rgb = hcl2rgb(vec3(hcl.x, rgb2hcl(src.rgb).y, hcl.z));\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    color: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(src.rgb);\n  blend.rgb = hcl2rgb(vec3(hcl.x, hcl.y, rgb2hcl(dst.rgb).z));\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    luminosity: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(dst.rgb);\n  blend.rgb = hcl2rgb(vec3(hcl.x, hcl.y, rgb2hcl(src.rgb).z));\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n"
  },
  effects: {
    splitTone: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform vec3 highlight;\nuniform vec3 shadow;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nvec3 softlight(vec3 src, vec3 dst) {\n  vec3 color;\n  color.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)\n    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);\n  color.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)\n    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);\n  color.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)\n    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);\n  return color;\n}\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  // cast soft light using highlight and shadow\n  vec3 h = softlight(highlight, src.rgb);\n  vec3 s = softlight(shadow, src.rgb);\n\n  // blend based on luminance\n  float l = luma(src.rgb);\n  vec3 c = h * l + s * (1.0 - l);\n  c = c / (luma(c) + e) * l;\n\n  gl_FragColor = vec4(c, src.a);\n}\n",
    duotone: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform vec3 highlight;\nuniform vec3 shadow;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  float l = luma(src.rgb);\n\n  // highlight and shadow color normalized to same luminance\n  vec3 h = (highlight + e) / (luma(highlight) + e) * l;\n  vec3 s = (shadow + e) / (luma(shadow) + e) * l;\n\n  // blend based on luminance\n  vec3 c = h * l + s * (1.0 - l);\n\n  gl_FragColor = vec4(c, src.a);\n}\n",
    sharpen: "precision mediump float;\n\nuniform float strength;\nuniform sampler2D source;\nuniform sampler2D background;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  float lsrc = luma(src.rgb);\n  float l = luma(texture2D(background, coord).rgb);\n\n  src.rgb *= ((lsrc - l) * strength + l) / (lsrc + e);\n  gl_FragColor = src;\n}\n",
    vignette: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform float darken;\nuniform float brighten;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  // distance to each border\n  float a = coord.x < 0.5 ? coord.x : 1.0 - coord.x;\n  float b = coord.y < 0.5 ? coord.y : 1.0 - coord.y;\n\n  // lp norm used as distance, 0.2 seems to be a nice value for p\n  float p = 0.2;\n  float d = pow(a, p) + pow(b, p);\n  float dmax = 2.0 * pow(0.5, p);\n\n  // brighten overall, then darken based on lp distance\n  float l = luma(src.rgb);\n  src.rgb *= (l + brighten - darken * (1.0 - d / dmax)) / (l + e);\n\n  gl_FragColor = src;\n}\n"
  }
}

},{}],5:[function(_dereq_,module,exports){
module.exports = Spline

// taken directly from https://github.com/evanw/glfx.js
// in turn from SplineInterpolator.cs in the Paint.NET source code

function Spline(points) {
  var n = points.length
  this.xa = []
  this.ya = []
  this.u = []
  this.y2 = []

  points.sort(function(a, b) {
    return a[0] - b[0]
  })
  for (var i = 0; i < n; i++) {
    this.xa.push(points[i][0])
    this.ya.push(points[i][1])
  }

  this.u[0] = 0
  this.y2[0] = 0

  for (var i = 1; i < n - 1; ++i) {
    // This is the decomposition loop of the tridiagonal algorithm. 
    // y2 and u are used for temporary storage of the decomposed factors.
    var wx = this.xa[i + 1] - this.xa[i - 1]
    var sig = (this.xa[i] - this.xa[i - 1]) / wx
    var p = sig * this.y2[i - 1] + 2.0

    this.y2[i] = (sig - 1.0) / p

    var ddydx = 
    (this.ya[i + 1] - this.ya[i]) / (this.xa[i + 1] - this.xa[i]) -
    (this.ya[i] - this.ya[i - 1]) / (this.xa[i] - this.xa[i - 1])

    this.u[i] = (6.0 * ddydx /
      wx - sig * this.u[i - 1]) / p
  }

  this.y2[n - 1] = 0

  // This is the backsubstitution loop of the tridiagonal algorithm
  for (var i = n - 2; i >= 0; --i) {
    this.y2[i] = this.y2[i] * this.y2[i + 1] + this.u[i]
  }
}

Spline.prototype.interpolate = function(x) {
  var n = this.ya.length
  var klo = 0
  var khi = n - 1

  // We will find the right place in the table by means of
  // bisection. This is optimal if sequential calls to this
  // routine are at random values of x. If sequential calls
  // are in order, and closely spaced, one would do better
  // to store previous values of klo and khi.
  while (khi - klo > 1) {
    var k = (khi + klo) >> 1

    if (this.xa[k] > x) {
      khi = k
    } else {
      klo = k
    }
  }

  var h = this.xa[khi] - this.xa[klo]
  var a = (this.xa[khi] - x) / h
  var b = (x - this.xa[klo]) / h

  // Cubic spline polynomial is now evaluated.
  return a * this.ya[klo] + b * this.ya[khi] + 
         ((a * a * a - a) * this.y2[klo] + (b * b * b - b) * this.y2[khi]) * (h * h) / 6.0
}

},{}],6:[function(_dereq_,module,exports){
module.exports = Texture

var utils = _dereq_('./utils')

function Texture(gl, unit, nodeOrData, width, height, options) {
  this.gl = gl
  this.unit = unit
  this.width = width
  this.height = height

  this.texture = gl.createTexture()
  this.bind()
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  if (utils.isArray(nodeOrData)) {
    var data = new Uint8Array(nodeOrData)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)

  } else if (utils.isNothing(nodeOrData)) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    this.framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)

  } else {
    var node = utils.getNode(nodeOrData)

    var maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    if (utils.isNumber(options.resize)) {
      maxSize = Math.min(maxSize, options.resize)
    }

    node = resize(node, maxSize)
    this.width = node.width
    this.height = node.height

    if (utils.isWebgl(node) && utils.isWebkit()) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    }

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, node)
  }
}

Texture.prototype.bind = function() {
  var gl = this.gl
  gl.activeTexture(gl['TEXTURE' + this.unit])
  gl.bindTexture(gl.TEXTURE_2D, this.texture)
  if (this.framebuffer) gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
  return this
}

Texture.prototype.destroy = function() {
  this.gl.deleteTexture(this.texture)
  if (this.framebuffer) {
    this.gl.deleteFramebuffer(this.framebuffer)
    this.framebuffer = null
  }
  this.texture = null
  this.gl = null
}

function resize(node, maxSize) {
  if (node.width <= maxSize && node.height <= maxSize) {
    return node
  } else if (node.width > maxSize * 2 || node.height > maxSize * 2) {
    return resize(resize(node, maxSize * 2), maxSize)
  } else {
    var width, height
    if (node.width > node.height) {
      width = maxSize
      height = Math.floor(maxSize / node.width * node.height)
    } else {
      height = maxSize
      width = Math.floor(maxSize / node.height * node.width)
    }

    var canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    var ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(node, 0, 0, width, height)

    return canvas
  }
}

},{"./utils":7}],7:[function(_dereq_,module,exports){
module.exports = {
  isString: function(obj) {
    return Object.prototype.toString.call(obj) === '[object String]'
  },

  isNumber: function(obj) {
    return Object.prototype.toString.call(obj) === '[object Number]'
  },

  isArray: function(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]'
  },

  isNothing: function(obj) {
    return obj === null || typeof obj === 'undefined'
  },

  isWebgl: function(node) {
    return node.getContext &&
           (node.getContext('webgl') || node.getContext('experimental-webgl'))
  },

  isWebkit: function() {
    return 'WebkitAppearance' in document.documentElement.style
  },

  getNode: function(node) {
    if (this.isString(node)) {
      return document.querySelector(node)
    } else if (node.isGlimg) {
      return node.canvas
    } else {
      return node
    }
  },

  clamp: function(value, min, max) {
    return value < min ? min : (value > max ? max : value)
  },

  transpose: function(matrix) {
    var m = this.flatten(matrix)
    if (m.length === 4) {
      return [
        m[0], m[2],
        m[1], m[3]
      ]
    } else if (m.length === 9) {
      return [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8]
      ]
    } else {
      return [
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15]
      ]
    }
  },

  flatten: function(array) {
    return Array.prototype.concat.apply([], array)
  },

  camelCase: function(string) {
    return string.toLowerCase().replace(/-(.)/g, function(_, word) {
      return word.toUpperCase()
    })
  }
}

},{}],8:[function(_dereq_,module,exports){
module.exports = {
  getWhiteColor: function(pixels) {
    var size = pixels.length
    var clipping = size / 4 * 0.001
    var luma = []

    var i, luma = []
    for (i = 0; i < 256; i++) luma[i] = 0

    for (i = 0; i < size; i += 4) {
      pixels[i + 3] = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])
      luma[pixels[i + 3]] += 1
    }

    var t = 0, lWhite = 0
    for (i = 255; i >= 0; i--) {
      if (t + luma[i] > clipping) {
        lWhite = i
        break
      } else {
        t += luma[i]
      }
    }

    var count = 0, rWhite = 0, gWhite = 0, bWhite = 0
    for (i = 0; i < size; i += 4) {
      if (pixels[i + 3] == lWhite) {
        count++
        rWhite += pixels[i]
        gWhite += pixels[i + 1]
        bWhite += pixels[i + 2]
      }
    }

    rWhite /= count
    gWhite /= count
    bWhite /= count
    return [rWhite, gWhite, bWhite]
  },

  t2rgb: function(temperature, green) {
    var t = temperature > 12000 ? 12000 : temperature
    var t2 = t * t, t3 = t2 * t

    var xD, yD
    if (t <= 4000) {
      xD = 0.27475e9 / t3 - 0.98598e6 / t2 + 1.17444e3 / t + 0.145986
    } else if (t <= 7000) {
      xD = -4.6070e9 / t3 + 2.9678e6 / t2 + 0.09911e3 / t + 0.244063
    } else {
      xD = -2.0064e9 / t3 + 1.9018e6 / t2 + 0.24748e3/ t + 0.237040
    }
    yD = -3 * xD * xD + 2.87 * xD - 0.275

    var x = xD / yD
    var y = 1
    var z = (1 - xD - yD) / yD
    var r = 3.24071 * x - 1.53726 * y - 0.498571 * z
    var g = -0.969258 * x + 1.87599 * y + 0.0415557 * z
    var b = 0.0556352 * x - 0.203996 * y + 1.05707 * z

    g = g / (green + 0.000001)
    var l = 0.299 * r + 0.587 * g + 0.114 * b
    r = r / l * 0.5
    g = g / l * 0.5
    b = b / l * 0.5

    return [r, g, b]
  },

  rgb2t: function(r, g, b) {
    var t, rgb
    var green = 1
    var tmin = 2000
    var tmax = 12000
    var br = b / r

    for (t = (tmin + tmax) / 2; tmax - tmin > 10; t = (tmin + tmax) / 2) {
      rgb = this.t2rgb(t, green)
      if (rgb[2] / rgb[0] > br) {
        tmax = t
      } else {
        tmin = t
      }
    }

    green = (rgb[1] / rgb[0]) / (g / r)
    return [t, green]
  }
}

},{}],9:[function(_dereq_,module,exports){
module.exports = glimg

var Glimg = _dereq_('./core/glimg')

function glimg(canvas, options) {
  return new Glimg(canvas, options)
}

init(glimg)

function init(glimg) {
  glimg.info = {}
  var canvas = document.createElement('canvas')
  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
  if (gl) {
    glimg.info.supported = true
    glimg.info.maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    glimg.info.maxUnit = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) - 4
  } else {
    glimg.info.supported = false
  }

  glimg.shaders = _dereq_('./core/shaders')
}

},{"./core/glimg":2,"./core/shaders":4}]},{},[9])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xvY2FsL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9jb3JlL2J1ZmZlci5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS9nbGltZy5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS9zaGFkZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL2NvcmUvc2hhZGVycy5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS9zcGxpbmUuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL2NvcmUvdGV4dHVyZS5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS91dGlscy5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS93aGl0ZUJhbGFuY2UuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL21haW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3eEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIEJ1ZmZlcihnbCwgYXJyYXkpIHtcbiAgdGhpcy5nbCA9IGdsXG4gIHRoaXMuYnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKClcbiAgdGhpcy5iaW5kKClcbiAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIG5ldyBGbG9hdDMyQXJyYXkoYXJyYXkpLCBnbC5TVEFUSUNfRFJBVylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuYmluZEJ1ZmZlcih0aGlzLmdsLkFSUkFZX0JVRkZFUiwgdGhpcy5idWZmZXIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLmRlbGV0ZUJ1ZmZlcih0aGlzLmJ1ZmZlcilcbiAgdGhpcy5idWZmZXIgPSBudWxsXG4gIHRoaXMuZ2wgPSBudWxsXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEdsaW1nXG5cbnZhciBTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcicpXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnLi9idWZmZXInKVxudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuL3RleHR1cmUnKVxudmFyIFNwbGluZSA9IHJlcXVpcmUoJy4vc3BsaW5lJylcbnZhciBzaGFkZXJzID0gcmVxdWlyZSgnLi9zaGFkZXJzJylcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKVxudmFyIHdoaXRlQmFsYW5jZSA9IHJlcXVpcmUoJy4vd2hpdGVCYWxhbmNlJylcblxuLy8gbmV3IEdsaW1nKFtjYW52YXMsIFtvcHRpb25zXV0pXG4vL1xuLy8gQ3JlYXRlIGFuIGVtcHR5IEdsaW1nIG9iamVjdC5cbi8vXG4vLyBJZiBjYW52YXMgaXMgcHJvdmlkZWQsIGVpdGhlciBub2RlIG9yIHNlbGVjdG9yLCBHbGltZyB3aWxsIHVzZSB0aGF0IGNhbnZhcyBcbi8vIG5vZGUgaW5zdGVhZCBvZiBjcmVhdGluZyBhIG5ldyBvbmUuXG4vL1xuLy8gTm90aWNlIHRoYXQgeW91IGNhbm5vdCB1c2UgYSBjYW52YXMgdGhhdCBoYXMgY2FsbGVkIGdldENvbnRleHQoJzJkJykuXG4vL1xuLy8gT3B0aW9uczpcbi8vXG4vLyByZXNpemUgKGRlZmF1bHQgMjA0OCk6IGxvYWRlZCBpbWFnZSB3aWxsIGJlIGRvd25zaXplZCB0byB0aGlzIHZhbHVlIGlmIGl0cyBcbi8vIHdpZHRoIG9yIGhlaWdodCBleGNlZWRzIGl0OyAnbWF4JyBtZWFucyB0aGUgbGltaXQgaXMgdGhlIG1heGltYWwgdmFsdWUgXG4vLyBicm93c2VyIHN1cHBvcnRzLlxuLy9cbmZ1bmN0aW9uIEdsaW1nKGNhbnZhcywgb3B0aW9ucykge1xuICBpZiAoY2FudmFzKSB7XG4gICAgY2FudmFzID0gdXRpbHMuZ2V0Tm9kZShjYW52YXMpXG4gIH0gZWxzZSB7XG4gICAgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgfVxuXG4gIHZhciBnbG9wdHMgPSB7XG4gICAgcHJlc2VydmVEcmF3aW5nQnVmZmVyOiB0cnVlLFxuICAgIHByZW11bHRpcGxpZWRBbHBoYTogdHJ1ZVxuICB9XG5cbiAgdmFyIGdsID0gY2FudmFzLmdldENvbnRleHQoJ3dlYmdsJywgZ2xvcHRzKSB8fFxuICAgICAgICAgICBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJywgZ2xvcHRzKVxuXG4gIGlmICghZ2wpIHRocm93ICdXZWJHTCBpcyBub3Qgc3VwcG9ydGVkJ1xuXG4gIHRoaXMuaXNHbGltZyA9IHRydWVcbiAgdGhpcy5jYW52YXMgPSBjYW52YXNcbiAgdGhpcy5nbCA9IGdsXG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgdGhpcy5vcHRpb25zLnJlc2l6ZSA9IHRoaXMub3B0aW9ucy5yZXNpemUgfHwgMjA0OFxuICB0aGlzLl9idWZmZXJzID0ge31cbiAgdGhpcy5fdGV4dHVyZXMgPSB7fVxuICB0aGlzLl9zaGFkZXJzID0ge31cbiAgdmFyIG1heFVuaXQgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpIC0gMVxuICB0aGlzLl91bml0ID0gW21heFVuaXQsIG1heFVuaXQgLSAxLCBtYXhVbml0IC0gMiwgbWF4VW5pdCAtIDNdXG4gIHRoaXMuX2NoYWluID0ge2NvdW50OiAwfVxuICB0aGlzLnNldFNvdXJjZSgwKVxuICB0aGlzLnNldFRhcmdldChudWxsKVxuICB0aGlzLnNldFpvb20obnVsbClcbn1cblxuLy8gbG9hZChub2RlWywgbm9jb3B5XSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBMb2FkIGltYWdlIGZyb20gYSBub2RlIChjYW52YXMsIGltYWdlIG9yIHZpZGVvKSBhcyBzb3VyY2UgaW1hZ2UuIFRoZW4gY29weSBpdCBcbi8vIHRvIHRoZSB0YXJnZXQgaW1hZ2UgdW5sZXNzIG5vY29weSBpcyBzZXQuXG4vL1xuR2xpbWcucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihub2RlLCBub2NvcHkpIHtcbiAgbm9kZSA9IHV0aWxzLmdldE5vZGUobm9kZSlcbiAgdGhpcy5zZXRTb3VyY2UodGhpcy5zb3VyY2VVbml0LCBub2RlKS5zZXRUYXJnZXQodGhpcy50YXJnZXRVbml0KVxuICBpZiAoIW5vY29weSkgdGhpcy5jb3B5KClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gbG9hZEZyb21VcmwodXJsWywgY2FsbGJhY2tbLCBub2NvcHldXSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBMb2FkIHJlbW90ZSBpbWFnZSBhcyBzb3VyY2UgaW1hZ2UuIENhbGxiYWNrIGlzIGZpcmVkIHdoZW4gaW1hZ2UgaXMgbG9hZGVkLiAgXG4vLyBUaGVuIGNvcHkgaXQgdG8gdGhlIHRhcmdldCBpbWFnZSB1bmxlc3Mgbm9jb3B5IGlzIHNldC5cbi8vXG5HbGltZy5wcm90b3R5cGUubG9hZEZyb21VcmwgPSBmdW5jdGlvbih1cmwsIGNhbGxiYWNrLCBub2NvcHkpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBpbWFnZSA9IG5ldyBJbWFnZSgpXG4gIGltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIHNlbGYubG9hZChpbWFnZSwgbm9jb3B5KVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKVxuICB9XG4gIGltYWdlLnNyYyA9IHVybFxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBzZXRTaXplKHdpZHRoLCBoZWlnaHQpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHRhcmdldCBpbWFnZSBzaXplLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRTaXplID0gZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuICBpZiAodGhpcy50YXJnZXRVbml0ID09PSBudWxsKSB7XG4gICAgdGhpcy53aWR0aCA9IHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGhcbiAgICB0aGlzLmhlaWdodCA9IHRoaXMuY2FudmFzLmhlaWdodCA9IGhlaWdodFxuICAgIHRoaXMuem9vbSh0aGlzLl96b29tTGV2ZWwpXG4gIH0gZWxzZSB7XG4gICAgdGhpcy51c2VUZXh0dXJlKHRoaXMudGFyZ2V0VW5pdCwgbnVsbCwgd2lkdGgsIGhlaWdodClcbiAgfVxuXG4gIHRoaXMuZ2wudmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gc2V0Wm9vbSh6b29tTGV2ZWwpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IGNzcyBzaXplIG9mIHRoZSBjYW52YXMgYWNjb3JkaW5nIHRvIGFjdHVhbCBpbWFnZSBzaXplLiBUaGlzIHBlcnNpc3RzIFxuLy8gdGhyb3VnaCByZXNpemVzLlxuLy9cbi8vIFpvb20gbGV2ZWwgY2FuIGJlIGEgbnVtYmVyOiB6b29tIHJhdGlvLCBvciAnZml0JzogMTAwJSBwYXJlbnQgd2lkdGgsIG9yIG51bGw6IFxuLy8gbm90IHpvb21pbmcgb24gcmVzaXplcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0Wm9vbSA9IGZ1bmN0aW9uKHpvb21MZXZlbCkge1xuICB0aGlzLl96b29tTGV2ZWwgPSB6b29tTGV2ZWxcbiAgdGhpcy56b29tKHpvb21MZXZlbClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gem9vbSh6b29tTGV2ZWwpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gWm9vbSB0aGUgY2FudmFzIG9uY2UuIFNlZSAnc2V0Wm9vbScgZm9yIG1vcmUgZGV0YWlscy5cbi8vXG5HbGltZy5wcm90b3R5cGUuem9vbSA9IGZ1bmN0aW9uKHpvb21MZXZlbCkge1xuICBpZiAodXRpbHMuaXNOb3RoaW5nKHpvb21MZXZlbCkpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9IGVsc2UgaWYgKHpvb21MZXZlbCA9PT0gJ2ZpdCcpIHtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS53aWR0aCA9ICcxMDAlJ1xuICB9IGVsc2Uge1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLndpZHRoID0gJycgKyAodGhpcy53aWR0aCAqIHpvb21MZXZlbCkgKyAncHgnXG4gIH1cbiAgdGhpcy5jYW52YXMuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gYXBwbHkoKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIEFwcGx5IHJlbmRlcmVkIHJlc3VsdCBiYWNrIHRvIHNvdXJjZSBpbWFnZS5cbi8vXG5HbGltZy5wcm90b3R5cGUuYXBwbHkgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZXRTb3VyY2UodGhpcy5zb3VyY2VVbml0LCB0aGlzKVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBjbGVhcihbcmVkLCBncmVlbiwgYmx1ZSwgYWxwaGFdKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIENsZWFyIGNhbnZhcyB3aXRoIHNwZWNpZmllZCBjb2xvciwgZGVmYXVsdCAoMCwgMCwgMCwgMCkuXG4vL1xuR2xpbWcucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24ocmVkLCBncmVlbiwgYmx1ZSwgYWxwaGEpIHtcbiAgdGhpcy5nbC5jbGVhckNvbG9yKHJlZCB8fCAwLCBncmVlbiB8fCAwLCBibHVlIHx8IDAsIGFscGhhIHx8IDApXG4gIHRoaXMuZ2wuY2xlYXIodGhpcy5nbC5DT0xPUl9CVUZGRVJfQklUKVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyB0b0RhdGFVcmwoW2Zvcm1hdF0pXG4vLyByZXR1cm5zIGEgYmFzZTY0IHVybCBTdHJpbmdcbi8vXG4vLyBTYXZlIGltYWdlIGRhdGEgdG8gYmFzZTY0IHVybC4gRm9ybWF0IGNhbiBiZSAnanBlZycgKGRlZmF1bHQpIG9yICdwbmcnLlxuLy8gVGhpcyBjYW4gYmUgdXNlZCBhcyA8YT4gaHJlZiBvciB3aW5kb3cubG9jYXRpb24uXG4vL1xuR2xpbWcucHJvdG90eXBlLnRvRGF0YVVSTCA9IGZ1bmN0aW9uKGZvcm1hdCkge1xuICBmb3JtYXQgPSBmb3JtYXQgfHwgJ2pwZWcnXG4gIHJldHVybiB0aGlzLmNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlLycgKyBmb3JtYXQpXG59XG5cbi8vIGRlc3Ryb3koKVxuLy8gcmV0dXJucyBub3RoaW5nXG4vL1xuLy8gRGVzdHJveSB0aGUgb2JqZWN0LCBmcmVlIGFsbG9jYXRlZCBtZW1vcmllcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5nbCkge1xuICAgIHZhciBrZXlcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9idWZmZXJzKSB7XG4gICAgICB0aGlzLl9idWZmZXJzW2tleV0uZGVzdHJveSgpXG4gICAgfVxuXG4gICAgZm9yIChrZXkgaW4gdGhpcy5fdGV4dHVyZXMpIHtcbiAgICAgIHRoaXMuX3RleHR1cmVzW2tleV0uZGVzdHJveSgpXG4gICAgfVxuXG4gICAgZm9yIChrZXkgaW4gdGhpcy5fc2hhZGVycykge1xuICAgICAgdGhpcy5fc2hhZGVyc1trZXldLmRlc3Ryb3koKVxuICAgIH1cblxuICAgIHRoaXMuY2FudmFzID0gbnVsbFxuICAgIHRoaXMuZ2wgPSBudWxsXG4gICAgdGhpcy5fYnVmZmVycyA9IG51bGxcbiAgICB0aGlzLl90ZXh0dXJlcyA9IG51bGxcbiAgICB0aGlzLl9zaGFkZXJzID0gbnVsbFxuICB9XG59XG5cbi8vIGdldHBpeGVscyhbdW5pdF0pXG4vLyByZXR1cm5zIHBpeGVsIGRhdGEgKFJHQkEpIGluIFVpbnQ4QXJyYXlcbi8vXG4vLyB1bml0IGNhbiBiZVxuLy8gbnVtYmVyOiB0aGUgc3BlY2lmaWVkIGltYWdlIHVuaXRcbi8vIG51bGw6IHRoZSBjYW52YXNcbi8vICdzb3VyY2UnOiBzb3VyY2UgaW1hZ2Vcbi8vICd0YXJnZXQnOiB0YXJnZXQgaW1hZ2Vcbi8vIGRlZmF1bHQgdG8gJ3RhcmdldCdcbi8vXG5HbGltZy5wcm90b3R5cGUuZ2V0UGl4ZWxzID0gZnVuY3Rpb24odW5pdCkge1xuICBpZiAodW5pdCA9PT0gJ3NvdXJjZScpIHVuaXQgPSB0aGlzLnNvdXJjZVVuaXRcbiAgaWYgKHVuaXQgPT09ICd0YXJnZXQnIHx8IHR5cGVvZiB1bml0ID09PSAndW5kZWZpbmVkJykgdW5pdCA9IHRoaXMudGFyZ2V0VW5pdFxuXG4gIHZhciBzb3VyY2UgPSB0aGlzLnNvdXJjZVVuaXRcbiAgdmFyIHRhcmdldCA9IHRoaXMudGFyZ2V0VW5pdFxuXG4gIGlmICh1bml0ICE9PSB0YXJnZXQpIHtcbiAgICBpZiAodW5pdCA9PT0gbnVsbCB8fCB0aGlzLl90ZXh0dXJlc1t1bml0XS5mcmFtZWJ1ZmZlcikge1xuICAgICAgdGhpcy5zZXRUYXJnZXQodW5pdClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5faG9sZENoYWluID0gdHJ1ZVxuICAgICAgdGhpcy5zZXRTb3VyY2UodW5pdCkuc2V0VGFyZ2V0KHRoaXMuX3VuaXRbMl0pLmNvcHkoKVxuICAgICAgdGhpcy5faG9sZENoYWluID0gZmFsc2VcbiAgICB9XG4gIH1cblxuICB2YXIgaW1hZ2UgPSB0aGlzLmdldFRhcmdldCgpXG4gIHZhciBzaXplID0gaW1hZ2Uud2lkdGggKiBpbWFnZS5oZWlnaHQgKiA0XG4gIHZhciBwaXhlbHMgPSBuZXcgVWludDhBcnJheShzaXplKVxuICB0aGlzLmdsLnJlYWRQaXhlbHMoMCwgMCwgaW1hZ2Uud2lkdGgsIGltYWdlLmhlaWdodCwgdGhpcy5nbC5SR0JBLCB0aGlzLmdsLlVOU0lHTkVEX0JZVEUsIHBpeGVscylcblxuICB0aGlzLnNldFNvdXJjZShzb3VyY2UpLnNldFRhcmdldCh0YXJnZXQpXG4gIHJldHVybiBwaXhlbHNcbn1cblxuR2xpbWcucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbihzb3VyY2VDb29yZCwgdGFyZ2V0Q29vcmQpIHtcbiAgdmFyIHMgPSBzb3VyY2VDb29yZCB8fCB7bGVmdDogMCwgdG9wOiAwLCByaWdodCA6IDEsIGJvdHRvbTogMX1cbiAgdmFyIHQgPSB0YXJnZXRDb29yZCB8fCB7bGVmdDogMCwgdG9wOiAwLCByaWdodCA6IDEsIGJvdHRvbTogMX1cblxuICB0aGlzLnVzZVNoYWRlcihzaGFkZXJzLmNvcmUuY29weSlcbiAgLnNldCgnYVNvdXJjZUNvb3JkJywgcy5sZWZ0LCBzLnRvcCwgcy5yaWdodCwgcy5ib3R0b20pXG4gIC5zZXQoJ2FUYXJnZXRDb29yZCcsIHQubGVmdCwgdC50b3AsIHQucmlnaHQsIHQuYm90dG9tKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBjcm9wKGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBDcm9wIHRoZSBpbWFnZS4gQ29vcmRpbmF0ZXMgYXJlIGluIHBlcmNlbnRhZ2UsIG5vdCBwaXhlbHMuIFRoZXkgc2hvdWxkIGJlIGluIFxuLy8gdGhlIHJhbmdlIG9mIFswLCAxXS5cbi8vXG5HbGltZy5wcm90b3R5cGUuY3JvcCA9IGZ1bmN0aW9uKGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSkge1xuICB2YXIgd2lkdGggPSAocmlnaHQgLSBsZWZ0KSAqIHRoaXMuX3RleHR1cmVzWzBdLndpZHRoXG4gIHZhciBoZWlnaHQgPSAoYm90dG9tIC0gdG9wKSAqIHRoaXMuX3RleHR1cmVzWzBdLmhlaWdodFxuXG4gIHRoaXMuc2V0U2l6ZSh3aWR0aCwgaGVpZ2h0KVxuICAuY29weSh7bGVmdDogbGVmdCwgdG9wOiB0b3AsIHJpZ2h0OiByaWdodCwgYm90dG9tOiBib3R0b219KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS50cmFuc2Zvcm0gPSBmdW5jdGlvbihtYXRyaXgsIGNyb3BDb29yZCkge1xuICBpZiAobWF0cml4Lmxlbmd0aCA9PSA0KSB7XG4gICAgbWF0cml4ID0gW1xuICAgICAgbWF0cml4WzBdLCBtYXRyaXhbMV0sIDAsXG4gICAgICBtYXRyaXhbMl0sIG1hdHJpeFszXSwgMCxcbiAgICAgIDAsIDAsIDFcbiAgICBdXG4gIH1cblxuICB2YXIgYyA9IGNyb3BDb29yZCB8fCB7bGVmdDogMCwgdG9wOiAwLCByaWdodCA6IDEsIGJvdHRvbTogMX1cbiAgdmFyIHdpZHRoID0gKGMucmlnaHQgLSBjLmxlZnQpICogdGhpcy5nZXRTb3VyY2UoKS53aWR0aFxuICB2YXIgaGVpZ2h0ID0gKGMuYm90dG9tIC0gYy50b3ApICogdGhpcy5nZXRTb3VyY2UoKS5oZWlnaHRcblxuICB0aGlzLnNldFNpemUod2lkdGgsIGhlaWdodClcbiAgLnVzZVNoYWRlcihzaGFkZXJzLmNvcmUudHJhbnNmb3JtKVxuICAuc2V0KCd0cmFuc2Zvcm0nLCBtYXRyaXgpXG4gIC5zZXQoJ2FTb3VyY2VDb29yZCcsIGMubGVmdCwgYy50b3AsIGMucmlnaHQsIGMuYm90dG9tKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUucm90YXRlID0gZnVuY3Rpb24oZGVncmVlKSB7XG4gIC8vIHNvdXJjZSBkaW1lbnNpb25cbiAgdmFyIHdpZHRoID0gdGhpcy5nZXRTb3VyY2UoKS53aWR0aFxuICB2YXIgaGVpZ2h0ID0gdGhpcy5nZXRTb3VyY2UoKS5oZWlnaHRcblxuICAvLyByb3RhdGlvbiBtYXRyaXhcbiAgdmFyIHRoZXRhID0gTWF0aC5QSSAvIDE4MCAqIGRlZ3JlZVxuICB2YXIgc2ludCA9IE1hdGguc2luKHRoZXRhKVxuICB2YXIgY29zdCA9IE1hdGguY29zKHRoZXRhKVxuICB2YXIgciA9IHdpZHRoIC8gaGVpZ2h0XG4gIHZhciBtYXQgPSBbXG4gICAgY29zdCwgLXNpbnQgLyByLCAwLjUgKiAoMSAtIGNvc3QgKyBzaW50IC8gciksXG4gICAgc2ludCAqIHIsIGNvc3QsIDAuNSAqICgxIC0gc2ludCAqIHIgLSBjb3N0KSxcbiAgICAwLCAwLCAxXG4gIF1cblxuICAvLyBtYXhpbWFsIGZpdHRpbmcgcmVjdGFuZ2xlXG4gIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTc4OTIzOS9jYWxjdWxhdGUtbGFyZ2VzdC1yZWN0YW5nbGUtaW4tYS1yb3RhdGVkLXJlY3RhbmdsZVxuICB2YXIgdzAsIGgwXG4gIGlmICh3aWR0aCA8PSBoZWlnaHQpIHtcbiAgICB3MCA9IHdpZHRoXG4gICAgaDAgPSBoZWlnaHRcbiAgfSBlbHNlIHtcbiAgICB3MCA9IGhlaWdodFxuICAgIGgwID0gd2lkdGhcbiAgfVxuXG4gIHZhciBhbHBoYSA9IHRoZXRhIC0gTWF0aC5mbG9vcigodGhldGEgKyBNYXRoLlBJKSAvICgyICogTWF0aC5QSSkpICogKDIgKiBNYXRoLlBJKVxuICBhbHBoYSA9IE1hdGguYWJzKGFscGhhKVxuICBpZiAoYWxwaGEgPiBNYXRoLlBJIC8gMikgYWxwaGEgPSBNYXRoLlBJIC0gYWxwaGFcblxuICB2YXIgc2luYSA9IE1hdGguc2luKGFscGhhKVxuICB2YXIgY29zYSA9IE1hdGguY29zKGFscGhhKVxuICB2YXIgdzEgPSB3MCAqIGNvc2EgKyBoMCAqIHNpbmFcbiAgdmFyIGgxID0gdzAgKiBzaW5hICsgaDAgKiBjb3NhXG4gIHZhciBjID0gaDAgKiAoc2luYSAqIGNvc2EpIC8gKDIgKiBoMCAqIChzaW5hICogY29zYSkgKyB3MClcbiAgdmFyIHggPSB3MSAqIGNcbiAgdmFyIHkgPSBoMSAqIGNcbiAgdmFyIHcsIGhcbiAgaWYgKHdpZHRoIDw9IGhlaWdodCkge1xuICAgIHcgPSB3MSAtIDIgKiB4XG4gICAgaCA9IGgxIC0gMiAqIHlcbiAgfVxuICBlbHNlIHtcbiAgICB3ID0gaDEgLSAyICogeVxuICAgIGggPSB3MSAtIDIgKiB4XG4gIH1cblxuICAvLyBjcm9wIGNvb3JkaW5hdGVzXG4gIHZhciBsLCB0LCByLCBiO1xuICBsID0gKHdpZHRoIC0gdykgLyAoMiAqIHdpZHRoKVxuICByID0gKHdpZHRoICsgdykgLyAoMiAqIHdpZHRoKVxuICB0ID0gKGhlaWdodCAtIGgpIC8gKDIgKiBoZWlnaHQpXG4gIGIgPSAoaGVpZ2h0ICsgaCkgLyAoMiAqIGhlaWdodClcblxuICB0aGlzLnRyYW5zZm9ybShtYXQsIHtsZWZ0OiBsLCB0b3A6IHQsIHJpZ2h0OiByLCBib3R0b206IGJ9KVxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUucmVwbGFjZUNvbG9yID0gZnVuY3Rpb24obG9va1VwVGFibGUpIHtcbiAgdGhpcy51c2VUZXh0dXJlKHRoaXMuX3VuaXRbMl0sIHV0aWxzLmZsYXR0ZW4obG9va1VwVGFibGUpLCAyNTYsIDEpXG4gIC51c2VTaGFkZXIoc2hhZGVycy5jb3JlLmx1dClcbiAgLnNldCgnbHV0JywgdGhpcy5fdW5pdFsyXSwgbnVsbClcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmN1cnZlcyA9IGZ1bmN0aW9uKHBvaW50cykge1xuICBzcGxpbmUgPSBuZXcgU3BsaW5lKHBvaW50cylcblxuICB2YXIgbHV0ID0gW11cbiAgZm9yICh2YXIgeCA9IDA7IHggPD0gMjU1OyB4KyspIHtcbiAgICB2YXIgeSA9IHV0aWxzLmNsYW1wKE1hdGgucm91bmQoc3BsaW5lLmludGVycG9sYXRlKHggLyAyNTUpICogMjU1KSwgMCwgMjU1KVxuICAgIGx1dFt4XSA9IFt5LCB5LCB5LCAyNTVdXG4gIH1cblxuICB0aGlzLnJlcGxhY2VDb2xvcihsdXQpXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5sZXZlbHMgPSBmdW5jdGlvbihibGFjaywgbWlkcG9pbnQsIHdoaXRlKSB7XG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuYWRqdXN0bWVudHMubGV2ZWxzKVxuICAuc2V0KCdibGFjaycsIGJsYWNrKVxuICAuc2V0KCdtaWRwb2ludCcsIG1pZHBvaW50KVxuICAuc2V0KCd3aGl0ZScsIHdoaXRlKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuY29udm9sdmUgPSBmdW5jdGlvbihtYXRyaXgsIGRpdmlzb3IpIHtcbiAgbWF0cml4ID0gbWF0cml4Lm1hcChmdW5jdGlvbihpKSB7IHJldHVybiBbaV0gfSlcbiAgZGl2aXNvciA9IGRpdmlzb3IgfHwgMVxuXG4gIHZhciBkaW0gPSBNYXRoLnNxcnQobWF0cml4Lmxlbmd0aClcbiAgdmFyIHJhZGl1cyA9IChkaW0gLSAxKSAvIDJcbiAgdmFyIGNvbnZvbHZlID0gJyNkZWZpbmUgZGltICcgKyBkaW0gKyAnXFxuJyArXG4gICAgICAgICAgICAgICAgICcjZGVmaW5lIHJhZGl1cyAnICsgcmFkaXVzICsgJ1xcblxcbicgK1xuICAgICAgICAgICAgICAgICBzaGFkZXJzLmNvcmUuY29udm9sdmVcblxuICB0aGlzLnVzZVNoYWRlcihjb252b2x2ZSlcbiAgLnNldCgnbWF0cml4JywgbWF0cml4KVxuICAuc2V0KCdkaXZpc29yJywgZGl2aXNvcilcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gaGlzdG9ncmFtKFt1bml0XSlcbi8vIHJldHVybnMgaGlzdG9ncmFtIGFycmF5XG4vL1xuLy8gdW5pdCBjYW4gYmVcbi8vIG51bWJlcjogdGhlIHNwZWNpZmllZCBpbWFnZSB1bml0XG4vLyBudWxsOiB0aGUgY2FudmFzXG4vLyAnc291cmNlJzogc291cmNlIGltYWdlXG4vLyAndGFyZ2V0JzogdGFyZ2V0IGltYWdlXG4vLyBkZWZhdWx0IHRvICd0YXJnZXQnXG4vL1xuR2xpbWcucHJvdG90eXBlLmhpc3RvZ3JhbSA9IGZ1bmN0aW9uKHVuaXQpIHtcbiAgdmFyIHBpeGVscyA9IHRoaXMuZ2V0UGl4ZWxzKHVuaXQpXG5cbiAgdmFyIGhpc3RvZ3JhbSA9IFtbXSwgW10sIFtdXVxuICBmb3IgKHZhciBjaGFubmVsID0gMDsgY2hhbm5lbCA8IDM7IGNoYW5uZWwrKykge1xuICAgIGZvciAodmFyIHZhbHVlID0gMDsgdmFsdWUgPCAyNTY7IHZhbHVlKyspIHtcbiAgICAgIGhpc3RvZ3JhbVtjaGFubmVsXVt2YWx1ZV0gPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwaXhlbHMubGVuZ3RoOyBpICs9IDQpIHtcbiAgICBmb3IgKHZhciBjaGFubmVsID0gMDsgY2hhbm5lbCA8IDM7IGNoYW5uZWwrKykge1xuICAgICAgdmFyIHZhbHVlID0gcGl4ZWxzW2kgKyBjaGFubmVsXVxuICAgICAgaGlzdG9ncmFtW2NoYW5uZWxdW3ZhbHVlXSArPSAxXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGhpc3RvZ3JhbVxufVxuXG4vLyB3aGl0ZUJhbGFuY2UocmVkLCBncmVlbiwgYmx1ZSlcbi8vIHdoaXRlQmFsYW5jZSh0ZW1wZXJhdHVyZSwgdGludClcbi8vIHdoaXRlQmFsYW5jZSgpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gV2hpdGUgYmFsYW5jZSBpbWFnZSBiYXNlZCBvbiBuZXV0cmFsIGNvbG9yIChyZWQvZ3JlZW4vYmx1ZSksIFxuLy8gdGVtcGVyYXR1cmUvdGludCwgb3IgYXV0b21hdGljYWxseVxuLy9cbkdsaW1nLnByb3RvdHlwZS53aGl0ZUJhbGFuY2UgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHdoaXRlXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgdmFyIHBpeGVscyA9IHRoaXMuZ2V0UGl4ZWxzKCdzb3VyY2UnKVxuICAgIHdoaXRlID0gd2hpdGVCYWxhbmNlLmdldFdoaXRlQ29sb3IocGl4ZWxzKVxuICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICB3aGl0ZSA9IFthcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdXVxuICB9IGVsc2Uge1xuICAgIHdoaXRlID0gd2hpdGVCYWxhbmNlLnQycmdiKGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdKVxuICB9XG5cbiAgdmFyIGwgPSAwLjI5OSAqIHdoaXRlWzBdICsgMC41ODcgKiB3aGl0ZVsxXSArIDAuMTE0ICogd2hpdGVbMl1cbiAgd2hpdGVbMF0gLz0gbFxuICB3aGl0ZVsxXSAvPSBsXG4gIHdoaXRlWzJdIC89IGxcblxuICB2YXIgbHV0ID0gW11cbiAgZm9yICh2YXIgeCA9IDA7IHggPCAyNTY7IHgrKykge1xuICAgIHZhciByID0gdXRpbHMuY2xhbXAoTWF0aC5yb3VuZCh4IC8gd2hpdGVbMF0pLCAwLCAyNTUpXG4gICAgdmFyIGcgPSB1dGlscy5jbGFtcChNYXRoLnJvdW5kKHggLyB3aGl0ZVsxXSksIDAsIDI1NSlcbiAgICB2YXIgYiA9IHV0aWxzLmNsYW1wKE1hdGgucm91bmQoeCAvIHdoaXRlWzJdKSwgMCwgMjU1KVxuICAgIGx1dFt4XSA9IFtyLCBnLCBiLCAyNTVdXG4gIH1cblxuICB0aGlzLnJlcGxhY2VDb2xvcihsdXQpXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5ibGVuZCA9IGZ1bmN0aW9uKG5vZGUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgdmFyIG1vZGUgPSB1dGlscy5jYW1lbENhc2Uob3B0aW9ucy5tb2RlIHx8ICdub3JtYWwnKVxuICB2YXIgb3BhY2l0eSA9IHV0aWxzLmlzTm90aGluZyhvcHRpb25zLm9wYWNpdHkpID8gMSA6IG9wdGlvbnMub3BhY2l0eVxuICB2YXIgY29vcmQgPSBvcHRpb25zLmNvb3JkIHx8IHtsZWZ0OiAwLCB0b3A6IDAsIHJpZ2h0OiAxLCBib3R0b206IDF9XG4gIHZhciBtYXNrID0gb3B0aW9ucy5tYXNrIHx8IFsyNTUsIDI1NSwgMjU1LCAyNTVdXG5cbiAgdmFyIGZvcmVncm91bmRVbml0LCBmb3JlZ3JvdW5kTm9kZSwgbWFza1VuaXQsIG1hc2tOb2RlXG5cbiAgaWYgKHV0aWxzLmlzTnVtYmVyKG5vZGUpKSB7XG4gICAgZm9yZWdyb3VuZFVuaXQgPSBub2RlXG4gICAgZm9yZWdyb3VuZE5vZGUgPSBudWxsXG4gIH0gZWxzZSB7XG4gICAgZm9yZWdyb3VuZFVuaXQgPSB0aGlzLl91bml0WzJdXG4gICAgZm9yZWdyb3VuZE5vZGUgPSBub2RlXG4gIH1cblxuICBpZiAodXRpbHMuaXNOdW1iZXIobWFzaykpIHtcbiAgICBtYXNrVW5pdCA9IG1hc2tcbiAgICBtYXNrTm9kZSA9IG51bGxcbiAgfSBlbHNlIHtcbiAgICBtYXNrVW5pdCA9IHRoaXMuX3VuaXRbM11cbiAgICBtYXNrTm9kZSA9IG1hc2tcbiAgfVxuXG4gIHRoaXMuX2hvbGRDaGFpbiA9IHRydWVcbiAgdGhpcy5jb3B5KClcbiAgdGhpcy5faG9sZENoYWluID0gZmFsc2VcblxuICB0aGlzLnVzZVNoYWRlcihzaGFkZXJzLmJsZW5kW21vZGVdKVxuICAuc2V0KCdhU291cmNlQ29vcmQnLCBjb29yZC5sZWZ0LCBjb29yZC50b3AsIGNvb3JkLnJpZ2h0LCBjb29yZC5ib3R0b20pXG4gIC5zZXQoJ2FUYXJnZXRDb29yZCcsIGNvb3JkLmxlZnQsIGNvb3JkLnRvcCwgY29vcmQucmlnaHQsIGNvb3JkLmJvdHRvbSlcbiAgLnNldCgnZm9yZWdyb3VuZCcsIGZvcmVncm91bmRVbml0LCBmb3JlZ3JvdW5kTm9kZSlcbiAgLnNldCgnb3BhY2l0eScsIG9wYWNpdHkpXG4gIC5zZXRUZXh0dXJlKCdtYXNrJywgbWFza1VuaXQsIG1hc2tOb2RlLCAxLCAxKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuZ2F1c3NpYW5CbHVyID0gZnVuY3Rpb24ocmFkaXVzKSB7XG4gIGlmIChyYWRpdXMgPD0gMCkgcmV0dXJuIHRoaXNcblxuICBmb3IgKHZhciByID0gMjsgciA8IDI1NjsgciAqPSAyKSB7XG4gICAgaWYgKHJhZGl1cyA8PSByKSBicmVha1xuICB9XG5cbiAgdmFyIGdhdXNzaWFuID0gJyNkZWZpbmUgcmFkaXVzICcgKyByICsgJy4wXFxuXFxuJyArIHNoYWRlcnMuY29yZS5nYXVzc2lhblxuXG4gIHRoaXMuY2hhaW4oKVxuICAudXNlU2hhZGVyKGdhdXNzaWFuKVxuICAuc2V0KCdzaWdtYScsIHJhZGl1cyAvIDMpXG4gIC5zZXQoJ2F4aXMnLCBbMSwgMF0pXG4gIC5ydW4oKVxuICAudXNlU2hhZGVyKGdhdXNzaWFuKVxuICAuc2V0KCdzaWdtYScsIHJhZGl1cyAvIDMpXG4gIC5zZXQoJ2F4aXMnLCBbMCwgMV0pXG4gIC5ydW4oKVxuICAuZG9uZSgpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmJsdXIgPSBmdW5jdGlvbihyYWRpdXMpIHtcbiAgaWYgKHJhZGl1cyA8PSAwKSByZXR1cm4gdGhpc1xuICBpZiAocmFkaXVzIDw9IDQpIHJldHVybiB0aGlzLmdhdXNzaWFuQmx1cihyYWRpdXMpXG5cbiAgdmFyIHcgPSB0aGlzLmdldFNvdXJjZSgpLndpZHRoXG4gIHZhciBoID0gdGhpcy5nZXRTb3VyY2UoKS5oZWlnaHRcbiAgdmFyIHIgPSBNYXRoLnNxcnQocmFkaXVzKVxuXG4gIHRoaXMuY2hhaW4oKVxuICAuZ2F1c3NpYW5CbHVyKHIpXG4gIC5zZXRTaXplKHcgLyByLCBoIC8gcilcbiAgLmNvcHkoKVxuICAuZ2F1c3NpYW5CbHVyKHIpXG4gIC5zZXRTaXplKHcsIGgpXG4gIC5jb3B5KClcbiAgLmRvbmUoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5icmlnaHRuZXNzQ29udHJhc3QgPSBmdW5jdGlvbihicmlnaHRuZXNzLCBjb250cmFzdCkge1xuICB2YXIgbWlkID0gMC41ICsgYnJpZ2h0bmVzcyAvIDI7XG4gIHZhciBzcGxpbmUgPSBuZXcgU3BsaW5lKFtbMCwgMF0sIFswLjUsIG1pZF0sIFsxLCAxXV0pXG5cbiAgdmFyIHNoYWRvdyA9IHNwbGluZS5pbnRlcnBvbGF0ZSgwLjI1KSAtIGNvbnRyYXN0IC8gNDtcbiAgdmFyIGhpZ2hsaWdodCA9IHNwbGluZS5pbnRlcnBvbGF0ZSgwLjc1KSArIGNvbnRyYXN0IC8gNDtcblxuICB0aGlzLmN1cnZlcyhbWzAsIDBdLCBbMC4yNSwgc2hhZG93XSwgWzAuNSwgbWlkXSwgWzAuNzUsIGhpZ2hsaWdodF0sIFsxLCAxXV0pXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLnJlY292ZXIgPSBmdW5jdGlvbihoaWdobGlnaHQsIHNoYWRvdywgcmFkaXVzKSB7XG4gIHJhZGl1cyA9IHJhZGl1cyB8fCA1XG5cbiAgdmFyIHNvdXJjZSA9IHRoaXMuc291cmNlVW5pdFxuICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXRVbml0XG5cbiAgdGhpcy5zZXRUYXJnZXQodGhpcy5fdW5pdFsyXSlcbiAgLmNvcHkoKVxuICAuc2V0U291cmNlKHRoaXMuX3VuaXRbMl0pLnNldFRhcmdldCh0aGlzLl91bml0WzNdKVxuICAuYmx1cihyYWRpdXMpXG4gIC5zZXRTb3VyY2UodGhpcy5fdW5pdFsyXSkuc2V0VGFyZ2V0KHRhcmdldClcbiAgLnVzZVNoYWRlcihzaGFkZXJzLmFkanVzdG1lbnRzLnJlY292ZXIpXG4gIC5zZXQoJ2hpZ2hsaWdodCcsIGhpZ2hsaWdodClcbiAgLnNldCgnc2hhZG93Jywgc2hhZG93KVxuICAuc2V0KCdiYWNrZ3JvdW5kJywgdGhpcy5fdW5pdFszXSwgbnVsbClcbiAgLnJ1bigpXG4gIC5zZXRTb3VyY2Uoc291cmNlKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5odWVTYXR1cmF0aW9uID0gZnVuY3Rpb24oaHVlLCBzYXR1cmF0aW9uLCBsaWdodG5lc3MpIHtcbiAgaHVlID0gaHVlIHx8IDBcbiAgc2F0dXJhdGlvbiA9IHNhdHVyYXRpb24gfHwgMFxuICBsaWdodG5lc3MgPSBsaWdodG5lc3MgfHwgMFxuXG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuYWRqdXN0bWVudHMuaHVlU2F0dXJhdGlvbilcbiAgLnNldCgnaHVlJywgaHVlKVxuICAuc2V0KCdzYXR1cmF0aW9uJywgc2F0dXJhdGlvbilcbiAgLnNldCgnbGlnaHRuZXNzJywgbGlnaHRuZXNzKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuc3BsaXRUb25lID0gZnVuY3Rpb24oaGlnaGxpZ2h0LCBzaGFkb3cpIHtcbiAgaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0IHx8IFswLjUsIDAuNSwgMC41XVxuICBzaGFkb3cgPSBzaGFkb3cgfHwgWzAuNSwgMC41LCAwLjVdXG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5lZmZlY3RzLnNwbGl0VG9uZSlcbiAgLnNldCgnaGlnaGxpZ2h0JywgaGlnaGxpZ2h0KVxuICAuc2V0KCdzaGFkb3cnLCBzaGFkb3cpXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5kdW90b25lID0gZnVuY3Rpb24oaGlnaGxpZ2h0LCBzaGFkb3cpIHtcbiAgaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0IHx8IFsxLCAxLCAxXVxuICBzaGFkb3cgPSBzaGFkb3cgfHwgWzEsIDEsIDFdXG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5lZmZlY3RzLmR1b3RvbmUpXG4gIC5zZXQoJ2hpZ2hsaWdodCcsIGhpZ2hsaWdodClcbiAgLnNldCgnc2hhZG93Jywgc2hhZG93KVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuc2hhcnBlbiA9IGZ1bmN0aW9uKHN0cmVuZ3RoLCByYWRpdXMpIHtcbiAgcmFkaXVzID0gcmFkaXVzIHx8IDVcblxuICB2YXIgc291cmNlID0gdGhpcy5zb3VyY2VVbml0XG4gIHZhciB0YXJnZXQgPSB0aGlzLnRhcmdldFVuaXRcblxuICB0aGlzLnNldFRhcmdldCh0aGlzLl91bml0WzJdKVxuICAuY29weSgpXG4gIC5zZXRTb3VyY2UodGhpcy5fdW5pdFsyXSkuc2V0VGFyZ2V0KHRoaXMuX3VuaXRbM10pXG4gIC5ibHVyKHJhZGl1cylcbiAgLnNldFNvdXJjZSh0aGlzLl91bml0WzJdKS5zZXRUYXJnZXQodGFyZ2V0KVxuICAudXNlU2hhZGVyKHNoYWRlcnMuZWZmZWN0cy5zaGFycGVuKVxuICAuc2V0KCdzdHJlbmd0aCcsIHN0cmVuZ3RoKVxuICAuc2V0KCdiYWNrZ3JvdW5kJywgdGhpcy5fdW5pdFszXSwgbnVsbClcbiAgLnJ1bigpXG4gIC5zZXRTb3VyY2Uoc291cmNlKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS52aWduZXR0ZSA9IGZ1bmN0aW9uKGRhcmtlbiwgYnJpZ2h0ZW4pIHtcbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5lZmZlY3RzLnZpZ25ldHRlKVxuICAuc2V0KCdkYXJrZW4nLCBkYXJrZW4pXG4gIC5zZXQoJ2JyaWdodGVuJywgYnJpZ2h0ZW4pXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHNldFN0YWdlKHNvdXJjZVVuaXQsIHRhcmdldFVuaXRbLCBub2RlXSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBTZXQgc291cmNlIHVuaXQgYW5kIHRhcmdldCB1bml0LCBhbmQgb3B0aW9uYWxseSBsb2FkIGltYWdlIGZyb20gbm9kZSB0byBcbi8vIHNvdXJjZSB1bml0LiBJdCByZXNpemVzIHRhcmdldCB1bml0IHRvIG1hdGNoIHNvdXJjZSB1bml0IGFmdGVyd2FyZHMuXG4vL1xuR2xpbWcucHJvdG90eXBlLnNldFN0YWdlID0gZnVuY3Rpb24oc291cmNlVW5pdCwgdGFyZ2V0VW5pdCwgbm9kZSkge1xuICB0aGlzLnNldFNvdXJjZShzb3VyY2VVbml0LCBub2RlKS5zZXRUYXJnZXQodGFyZ2V0VW5pdClcbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmNoYWluID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA+IDApIHtcbiAgICB0aGlzLl9jaGFpbi5jb3VudCArPSAxXG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fY2hhaW4gPSB7c291cmNlOiB0aGlzLnNvdXJjZVVuaXQsIHRhcmdldDogdGhpcy50YXJnZXRVbml0LCB1bml0OiAwLCBjb3VudDogMX1cbiAgICB0aGlzLnNldFRhcmdldCh0aGlzLl91bml0WzBdKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5kb25lID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA8PSAwKSByZXR1cm4gdGhpc1xuICB0aGlzLl9jaGFpbi5jb3VudCAtPSAxXG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA9PT0gMCkge1xuICAgIHRoaXMuc2V0VGFyZ2V0KHRoaXMuX2NoYWluLnRhcmdldCkuY29weSgpLnNldFNvdXJjZSh0aGlzLl9jaGFpbi5zb3VyY2UpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gZ2V0U291cmNlKClcbi8vIHJldHVybnMgY3VycmVudCBzb3VyY2UgaW1hZ2Vcbi8vXG5HbGltZy5wcm90b3R5cGUuZ2V0U291cmNlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl90ZXh0dXJlc1t0aGlzLnNvdXJjZVVuaXRdXG59XG5cbi8vIHNldFNvdXJjZSh1bml0Wywgbm9kZV0pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHNvdXJjZSB1bml0LCBhbmQgb3B0aW9uYWxseSBsb2FkIGltYWdlIGZyb20gbm9kZSB0byBzb3VyY2UgdW5pdC5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0U291cmNlID0gZnVuY3Rpb24odW5pdCwgbm9kZSkge1xuICB0aGlzLnNvdXJjZVVuaXQgPSB1bml0XG4gIGlmIChub2RlKSB0aGlzLnVzZVRleHR1cmUodW5pdCwgbm9kZSlcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gZ2V0VGFyZ2V0KClcbi8vIHJldHVybnMgY3VycmVudCB0YXJnZXQgaW1hZ2UsIHRoaXMgZ2xpbWcgb2JqZWN0IGlmIHRhcmdldCB1bml0IGlzIG51bGxcbi8vXG5HbGltZy5wcm90b3R5cGUuZ2V0VGFyZ2V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB1dGlscy5pc05vdGhpbmcodGhpcy50YXJnZXRVbml0KSA/IHRoaXMgOiB0aGlzLl90ZXh0dXJlc1t0aGlzLnRhcmdldFVuaXRdXG59XG5cbi8vIHNldFRhcmdldCh1bml0KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCB0YXJnZXQgdW5pdC4gSXQgcmVzaXplcyB0YXJnZXQgdW5pdCB0byBtYXRjaCBzb3VyY2UgdW5pdCBhZnRlcndhcmRzLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRUYXJnZXQgPSBmdW5jdGlvbih1bml0KSB7XG4gIHRoaXMudGFyZ2V0VW5pdCA9IHVuaXRcblxuICBpZiAodXRpbHMuaXNOb3RoaW5nKHVuaXQpKSB7XG4gICAgdGhpcy5nbC5iaW5kRnJhbWVidWZmZXIodGhpcy5nbC5GUkFNRUJVRkZFUiwgbnVsbClcbiAgfVxuXG4gIHZhciBzb3VyY2UgPSB0aGlzLmdldFNvdXJjZSgpXG4gIGlmIChzb3VyY2UpIHRoaXMuc2V0U2l6ZShzb3VyY2Uud2lkdGgsIHNvdXJjZS5oZWlnaHQpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gdXNlU2hhZGVyKHNvdXJjZSlcbi8vIHJldHVybnMgYSBTaGFkZXIgb2JqZWN0XG4vL1xuLy8gQ3JlYXRlIGFuZCBjYWNoZSBhIFdlYkdMIHNoYWRlciBwcm9ncmFtIGZyb20gc291cmNlIGFuZCByZXR1cm4gaXQuIFVzZSBjYWNoZWQgXG4vLyBzaGFkZXIgaWYgcG9zc2libGUuXG4vL1xuLy8gVGhlIHNvdXJjZSBzaG91bGQgYmUgYSBmcmFnbWVudCBzaGFkZXIgYmFzZWQgb24gZ2xpbWcuc2hhZGVycy5jb3B5LiBJdCB3aWxsIFxuLy8gYmUgY29tcGlsZWQgYW5kIGxpbmtlZCB3aXRoIGdsaW1nLnNoYWRlcnMudmVydGV4LlxuLy9cbi8vIEdsaW1nIHNoYWRlcnMgYXJlIGxvYWRlZCBpbiBnbGltZy5zaGFkZXJzLCB0aGVpciBzb3VyY2UgZmlsZXMgYXJlIGxvY2F0ZWQgYXQgXG4vLyBzcmMvc2hhZGVycy4gVGFrZSBhIGxvb2sgYXQgdGhlIHNvdXJjZXMgdG8gc2VlIGhvdyB0aGV5IGFyZSBvcmdhbml6ZWQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnVzZVNoYWRlciA9IGZ1bmN0aW9uKHNvdXJjZSkge1xuICBpZiAoIXRoaXMuX3NoYWRlcnNbc291cmNlXSkge1xuICAgIHRoaXMuX3NoYWRlcnNbc291cmNlXSA9IG5ldyBTaGFkZXIodGhpcywgc291cmNlKVxuICB9XG5cbiAgdmFyIHRleHR1cmUgPSB0aGlzLmdldFNvdXJjZSgpXG4gIHRoaXMuX3NoYWRlcnNbc291cmNlXVxuICAudXNlKClcbiAgLnNldCgnYVNvdXJjZUNvb3JkJywgMCwgMCwgMSwgMSlcbiAgLnNldCgnYVRhcmdldENvb3JkJywgMCwgMCwgMSwgMSlcbiAgLnNldCgnYU1hc2tDb29yZCcsIDAsIDAsIDEsIDEpXG4gIC5zZXQoJ2ZsaXBZJywgdGhpcy50YXJnZXRVbml0ID09PSBudWxsID8gLTEgOiAxKVxuICAuc2V0KCdzb3VyY2UnLCB0aGlzLnNvdXJjZVVuaXQsIG51bGwpXG4gIC5zZXQoJ3NpemUnLCBbMSAvIHRleHR1cmUud2lkdGgsIDEgLyB0ZXh0dXJlLmhlaWdodCwgdGV4dHVyZS53aWR0aCwgdGV4dHVyZS5oZWlnaHRdKVxuXG4gIHJldHVybiB0aGlzLl9zaGFkZXJzW3NvdXJjZV1cbn1cblxuR2xpbWcucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuX2NoYWluLmNvdW50IDw9IDAgfHwgdGhpcy5faG9sZENoYWluKSByZXR1cm4gdGhpc1xuICB2YXIgdW5pdCA9IHRoaXMuX2NoYWluLnVuaXQgPT09IDAgPyAxIDogMFxuICB0aGlzLnNldFNvdXJjZSh0aGlzLnRhcmdldFVuaXQpLnNldFRhcmdldCh0aGlzLl91bml0W3VuaXRdKVxuICB0aGlzLl9jaGFpbi51bml0ID0gdW5pdFxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBwcml2YXRlXG4vLyB1c2VCdWZmZXIoYXJyYXkpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQ3JlYXRlIGFuZCBjYWNoZSBhIFdlYkdMIGJ1ZmZlciBmcm9tIGFycmF5LiBVc2UgY2FjaGVkIGJ1ZmZlciBpZiBwb3NzaWJsZS5cbi8vXG4vLyBUbyBjcmVhdGUvcGFzcyB2ZXJ0aWNlcyB0byBzaGFkZXIsIHVzZSBzaGFkZXIuc2V0KCkgaW5zdGVhZC5cbi8vXG5HbGltZy5wcm90b3R5cGUudXNlQnVmZmVyID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgaWYgKCF1dGlscy5pc0FycmF5KGFycmF5KSkgYXJyYXkgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgdmFyIGtleSA9IGFycmF5LmpvaW4oKVxuXG4gIGlmICghdGhpcy5fYnVmZmVyc1trZXldKSB7XG4gICAgdGhpcy5fYnVmZmVyc1trZXldID0gbmV3IEJ1ZmZlcih0aGlzLmdsLCBhcnJheSlcbiAgfVxuICB0aGlzLl9idWZmZXJzW2tleV0uYmluZCgpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gcHJpdmF0ZVxuLy8gdXNlVGV4dHVyZSh1bml0LCBub2RlKVxuLy8gdXNlVGV4dHVyZSh1bml0LCBkYXRhLCB3aWR0aCwgaGVpZ2h0KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIENyZWF0ZSBhbmQgY2FjaGUgYSBXZWJHTCB0ZXh0dXJlIHVuaXQgZnJvbSBub2RlLCBvciBjcmVhdGUgYSBmcmFtZWJ1ZmZlciBcbi8vIHRleHV0cmUgaWYgd2lkdGggYW5kIGhlaWdodCBhcmUgcHJvdmlkZWQuIFVzZSBjYWNoZWQgdGV4dHVyZSBpZiBwb3NzaWJsZS5cbi8vXG4vLyBUbyBjcmVhdGUvcGFzcyB0ZXh0dXJlcyB0byBzaGFkZXIsIHVzZSBzaGFkZXIuc2V0KCkgaW5zdGVhZC5cbi8vXG5HbGltZy5wcm90b3R5cGUudXNlVGV4dHVyZSA9IGZ1bmN0aW9uKHVuaXQsIG5vZGVPckRhdGEsIHdpZHRoLCBoZWlnaHQpIHtcbiAgdmFyIHRleHR1cmUgPSB0aGlzLl90ZXh0dXJlc1t1bml0XVxuICB2YXIgcmV1c2UgPSAhbm9kZU9yRGF0YSAmJiB0ZXh0dXJlICYmIHRleHR1cmUuZnJhbWVidWZmZXIgJiZcbiAgICAgICAgICAgICAgdGV4dHVyZS53aWR0aCA9PT0gd2lkdGggJiYgdGV4dHVyZS5oZWlnaHQgPT09IGhlaWdodFxuXG4gIGlmICghcmV1c2UpIHtcbiAgICBpZiAodGhpcy5fdGV4dHVyZXNbdW5pdF0pIHRoaXMuX3RleHR1cmVzW3VuaXRdLmRlc3Ryb3koKVxuICAgIHRoaXMuX3RleHR1cmVzW3VuaXRdID0gbmV3IFRleHR1cmUodGhpcy5nbCwgdW5pdCwgbm9kZU9yRGF0YSwgd2lkdGgsIGhlaWdodCwgdGhpcy5vcHRpb25zKVxuICB9XG5cbiAgdGhpcy5fdGV4dHVyZXNbdW5pdF0uYmluZCgpXG4gIHJldHVybiB0aGlzXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFNoYWRlclxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gU2hhZGVyKGdsaW1nLCBzb3VyY2UpIHtcbiAgdGhpcy5nbGltZyA9IGdsaW1nXG4gIHZhciBnbCA9IHRoaXMuZ2wgPSBnbGltZy5nbFxuICB2YXIgdmVydGV4ID0gcmVxdWlyZSgnLi9zaGFkZXJzJykuY29yZS52ZXJ0ZXhcbiAgdmFyIHZlcnRleFNoYWRlciA9IGNyZWF0ZVNoYWRlcihnbCwgZ2wuVkVSVEVYX1NIQURFUiwgdmVydGV4KVxuICB2YXIgZnJhZ21lbnRTaGFkZXIgPSBjcmVhdGVTaGFkZXIoZ2wsIGdsLkZSQUdNRU5UX1NIQURFUiwgc291cmNlKVxuICB2YXIgcHJvZ3JhbSA9IHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKVxuXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCBmcmFnbWVudFNoYWRlcilcbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSlcblxuICBnbC5kZWxldGVTaGFkZXIodmVydGV4U2hhZGVyKVxuICBnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpXG5cbiAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkgdGhyb3cgJ3NoYWRlciBsaW5rIGVycm9yJ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKVxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZnVuY1xuXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDIpIHtcbiAgICBpZiAodXRpbHMuaXNOdW1iZXIodmFsdWVzKSkge1xuICAgICAgZnVuYyA9ICdzZXRGbG9hdCdcbiAgICB9IGVsc2UgaWYgKHV0aWxzLmlzQXJyYXkodmFsdWVzKSkge1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPD0gNCB8fCB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkpIHtcbiAgICAgICAgZnVuYyA9ICdzZXRWZWN0b3InXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmdW5jID0gJ3NldE1hdHJpeCdcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAzKSB7XG4gICAgZnVuYyA9ICdzZXRUZXh0dXJlJ1xuICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gNSkge1xuICAgIGZ1bmMgPSAnc2V0UmVjdCdcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyAnaW52YWxpZCBhcmd1bWVudHMnXG4gIH1cblxuICByZXR1cm4gdGhpc1tmdW5jXS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cblNoYWRlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZHJhd0FycmF5cyh0aGlzLmdsLlRSSUFOR0xFX1NUUklQLCAwLCA0KVxuICB0aGlzLmdsaW1nLnN0ZXAoKVxuICByZXR1cm4gdGhpcy5nbGltZ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldEZsb2F0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGdsLnVuaWZvcm0xZihsb2NhdGlvbiwgdmFsdWUpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldFZlY3RvciA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgdmFyIG4gPSB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkgPyB2YWx1ZXNbMF0ubGVuZ3RoIDogdmFsdWVzLmxlbmd0aFxuICAgIHZhciBmdW5jID0gJ3VuaWZvcm0nICsgbiArICdmdidcbiAgICBnbFtmdW5jXShsb2NhdGlvbiwgdXRpbHMuZmxhdHRlbih2YWx1ZXMpKVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5zZXRNYXRyaXggPSBmdW5jdGlvbihuYW1lLCB2YWx1ZXMpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSA0KSB7XG4gICAgICBnbC51bmlmb3JtTWF0cml4MmZ2KGxvY2F0aW9uLCBmYWxzZSwgdXRpbHMudHJhbnNwb3NlKHZhbHVlcykpXG4gICAgfSBlbHNlIGlmICh2YWx1ZXMubGVuZ3RoID09PSA5KSB7XG4gICAgICBnbC51bmlmb3JtTWF0cml4M2Z2KGxvY2F0aW9uLCBmYWxzZSwgdXRpbHMudHJhbnNwb3NlKHZhbHVlcykpXG4gICAgfSBlbHNlIGlmICh2YWx1ZXMubGVuZ3RoID09PSAxNikge1xuICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdihsb2NhdGlvbiwgZmFsc2UsIHV0aWxzLnRyYW5zcG9zZSh2YWx1ZXMpKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0VGV4dHVyZSA9IGZ1bmN0aW9uKG5hbWUsIHVuaXQsIG5vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGlmIChub2RlKSB0aGlzLmdsaW1nLnVzZVRleHR1cmUodW5pdCwgbm9kZSwgd2lkdGgsIGhlaWdodClcbiAgICBnbC51bmlmb3JtMWkobG9jYXRpb24sIHVuaXQpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldFJlY3QgPSBmdW5jdGlvbihuYW1lLCBsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20pIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgdGhpcy5nbGltZy51c2VCdWZmZXIobGVmdCwgdG9wLCBsZWZ0LCBib3R0b20sIHJpZ2h0LCB0b3AsIHJpZ2h0LCBib3R0b20pXG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jYXRpb24pXG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2NhdGlvbiwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZGVsZXRlUHJvZ3JhbSh0aGlzLnByb2dyYW0pXG4gIHRoaXMucHJvZ3JhbSA9IG51bGxcbiAgdGhpcy5nbCA9IG51bGxcbiAgdGhpcy5nbGltZyA9IG51bGxcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2hhZGVyKGdsLCB0eXBlLCBzb3VyY2UpIHtcbiAgdmFyIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcih0eXBlKVxuICBnbC5zaGFkZXJTb3VyY2Uoc2hhZGVyLCBzb3VyY2UpXG4gIGdsLmNvbXBpbGVTaGFkZXIoc2hhZGVyKVxuICByZXR1cm4gc2hhZGVyXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgY29yZToge1xuICAgIHZlcnRleDogXCJhdHRyaWJ1dGUgdmVjMiBhU291cmNlQ29vcmQ7XFxuYXR0cmlidXRlIHZlYzIgYVRhcmdldENvb3JkO1xcbmF0dHJpYnV0ZSB2ZWMyIGFNYXNrQ29vcmQ7XFxudW5pZm9ybSBmbG9hdCBmbGlwWTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAgZ2xfUG9zaXRpb24gPSB2ZWM0KChhVGFyZ2V0Q29vcmQgKiAyLjAgLSAxLjApICogdmVjMigxLCBmbGlwWSksIDAuMCwgMS4wKTtcXG4gICBjb29yZCA9IGFTb3VyY2VDb29yZDtcXG4gICBtYXNrQ29vcmQgPSBhTWFza0Nvb3JkO1xcbn1cXG5cIixcbiAgICBjb3B5OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxufVxcblwiLFxuICAgIHRyYW5zZm9ybTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIG1hdDMgdHJhbnNmb3JtO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWMyIGMgPSAodHJhbnNmb3JtICogdmVjMyhjb29yZCwgMS4wKSkueHk7XFxuICBib29sIG91dE9mUmFuZ2UgPSBhbnkoZ3JlYXRlclRoYW4oYWJzKGMgLSB2ZWMyKDAuNSkpLCB2ZWMyKDAuNSkpKTtcXG4gIGdsX0ZyYWdDb2xvciA9IG91dE9mUmFuZ2UgPyB2ZWM0KDAuMCkgOiB0ZXh0dXJlMkQoc291cmNlLCBjKTtcXG59XFxuXCIsXG4gICAgbHV0OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBsdXQ7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICBzcmMuciA9IHRleHR1cmUyRChsdXQsIHZlYzIoc3JjLnIsIDAuMCkpLnI7XFxuICBzcmMuZyA9IHRleHR1cmUyRChsdXQsIHZlYzIoc3JjLmcsIDAuMCkpLmc7XFxuICBzcmMuYiA9IHRleHR1cmUyRChsdXQsIHZlYzIoc3JjLmIsIDAuMCkpLmI7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzcmM7XFxufVxcblwiLFxuICAgIGNvbnZvbHZlOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG1hdHJpeFtkaW0gKiBkaW1dO1xcbnVuaWZvcm0gZmxvYXQgZGl2aXNvcjtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWMzIHN1bSA9IHZlYzMoMC4wKTtcXG5cXG4gIGZvciAoaW50IHkgPSAwOyB5IDwgZGltOyB5KyspIHtcXG4gICAgZm9yIChpbnQgeCA9IDA7IHggPCBkaW07IHgrKykge1xcbiAgICAgIHZlYzIgb2Zmc2V0ID0gdmVjMih4IC0gcmFkaXVzLCB5IC0gcmFkaXVzKTtcXG4gICAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBvZmZzZXQgKiBzaXplLnh5KS5yZ2IgKiBtYXRyaXhbeSAqIGRpbSArIHhdO1xcbiAgICB9XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSB2ZWM0KHN1bSAvIGRpdmlzb3IsIHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKS5hKTtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW46IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCJcbiAgfSxcbiAgYWRqdXN0bWVudHM6IHtcbiAgICBsZXZlbHM6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgYmxhY2s7XFxudW5pZm9ybSBmbG9hdCBtaWRwb2ludDtcXG51bmlmb3JtIGZsb2F0IHdoaXRlO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbmZsb2F0IGludGVycG9sYXRlKGZsb2F0IHZhbHVlKSB7XFxuICByZXR1cm4gKHZhbHVlIC0gYmxhY2spIC8gKHdoaXRlIC0gYmxhY2spO1xcbn1cXG5cXG52ZWMzIGludGVycG9sYXRlKHZlYzMgdmFsdWUpIHtcXG4gIHJldHVybiAodmFsdWUgLSBibGFjaykgLyAod2hpdGUgLSBibGFjayk7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgdmVjMyBzdHJlY2hlZCA9IGludGVycG9sYXRlKHNyYy5yZ2IpO1xcbiAgZmxvYXQgbSA9IGludGVycG9sYXRlKG1pZHBvaW50KTtcXG4gIGZsb2F0IGdhbW1hID0gbG9nKDAuNSkgLyBsb2cobSk7XFxuICBzcmMucmdiID0gcG93KHN0cmVjaGVkLCB2ZWMzKGdhbW1hLCBnYW1tYSwgZ2FtbWEpKTtcXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHNyYztcXG59XFxuXCIsXG4gICAgcmVjb3ZlcjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgYmFja2dyb3VuZDtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IGhpZ2hsaWdodDtcXG51bmlmb3JtIGZsb2F0IHNoYWRvdztcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG5jb25zdCBmbG9hdCBlID0gMTBlLTEwO1xcblxcbmZsb2F0IGx1bWEodmVjMyBjKSB7XFxuICByZXR1cm4gMC4yOTkgKiBjLnIgKyAwLjU4NyAqIGMuZyArIDAuMTE0ICogYy5iO1xcbn1cXG5cXG52ZWMzIHNvZnRsaWdodCh2ZWMzIHNyYywgdmVjMyBkc3QpIHtcXG4gIHZlYzMgY29sb3I7XFxuICBjb2xvci5yID0gc3JjLnIgPCAwLjUgPyAyLjAgKiBzcmMuciAqIGRzdC5yICsgZHN0LnIgKiBkc3QuciAqICgxLjAgLSAyLjAgKiBzcmMucilcXG4gICAgOiBzcXJ0KGRzdC5yKSAqICgyLjAgKiBzcmMuciAtIDEuMCkgKyAyLjAgKiBkc3QuciAqICgxLjAgLSBzcmMucik7XFxuICBjb2xvci5nID0gc3JjLmcgPCAwLjUgPyAyLjAgKiBzcmMuZyAqIGRzdC5nICsgZHN0LmcgKiBkc3QuZyAqICgxLjAgLSAyLjAgKiBzcmMuZylcXG4gICAgOiBzcXJ0KGRzdC5nKSAqICgyLjAgKiBzcmMuZyAtIDEuMCkgKyAyLjAgKiBkc3QuZyAqICgxLjAgLSBzcmMuZyk7XFxuICBjb2xvci5iID0gc3JjLmIgPCAwLjUgPyAyLjAgKiBzcmMuYiAqIGRzdC5iICsgZHN0LmIgKiBkc3QuYiAqICgxLjAgLSAyLjAgKiBzcmMuYilcXG4gICAgOiBzcXJ0KGRzdC5iKSAqICgyLjAgKiBzcmMuYiAtIDEuMCkgKyAyLjAgKiBkc3QuYiAqICgxLjAgLSBzcmMuYik7XFxuICByZXR1cm4gY29sb3I7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgZmxvYXQgaW52bCA9IDEuMCAtIGx1bWEodGV4dHVyZTJEKGJhY2tncm91bmQsIGNvb3JkKS5yZ2IpO1xcbiAgdmVjMyBibGVuZCA9IHNvZnRsaWdodCh2ZWMzKGludmwsIGludmwsIGludmwpLCBzcmMucmdiKTtcXG5cXG4gIHNyYy5yZ2IgKz0gY2xhbXAoYmxlbmQgLSBzcmMucmdiLCAtMS4wLCAwLjApICogaGlnaGxpZ2h0ICtcXG4gICAgY2xhbXAoYmxlbmQgLSBzcmMucmdiLCAwLjAsIDEuMCkgKiBzaGFkb3c7XFxuICBnbF9GcmFnQ29sb3IgPSBzcmM7XFxufVxcblwiLFxuICAgIGh1ZVNhdHVyYXRpb246IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgaHVlO1xcbnVuaWZvcm0gZmxvYXQgc2F0dXJhdGlvbjtcXG51bmlmb3JtIGZsb2F0IGxpZ2h0bmVzcztcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52ZWMzIHJnYjJoY2wodmVjMyBjKSB7XFxuICB2ZWM0IHAgPSBjLnIgPiBjLmcgPyB2ZWM0KGMucmdiLCAwLjApIDogdmVjNChjLmdiciwgMi4wKTtcXG4gIHZlYzQgcSA9IGMuYiA+IHAueCA/IHZlYzQoYy5icmcsIDQuMCkgOiBwO1xcblxcbiAgZmxvYXQgTSA9IHEueDtcXG4gIGZsb2F0IG0gPSBtaW4ocS55LCBxLnopO1xcbiAgZmxvYXQgQyA9IE0gLSBtO1xcblxcbiAgZmxvYXQgSCA9IEMgPT0gMC4wID8gMC4wIDogbW9kKChxLnkgLSBxLnopIC8gQyArIHEudywgNi4wKTtcXG4gIGZsb2F0IEwgPSAwLjUgKiAoTSArIG0pO1xcblxcbiAgcmV0dXJuIHZlYzMoSCwgQywgTCk7XFxufVxcblxcbnZlYzMgaGNsMnJnYih2ZWMzIGMpIHtcXG4gIGZsb2F0IEggPSBjLng7XFxuXFxuICBmbG9hdCBSID0gYWJzKEggLSAzLjApIC0gMS4wO1xcbiAgZmxvYXQgRyA9IDIuMCAtIGFicyhIIC0gMi4wKTtcXG4gIGZsb2F0IEIgPSAyLjAgLSBhYnMoSCAtIDQuMCk7XFxuICB2ZWMzIHJnYiA9IGNsYW1wKHZlYzMoUiwgRywgQiksIDAuMCwgMS4wKTtcXG5cXG4gIHJldHVybiAocmdiIC0gMC41KSAqIGMueSArIGMuejtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woc3JjLnJnYik7XFxuICBoY2wueCA9IG1vZChoY2wueCArIGh1ZSAqIDYuMCwgNi4wKTtcXG4gIGhjbC55ICo9IHNhdHVyYXRpb247XFxuICBoY2wueiArPSBsaWdodG5lc3M7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGhjbDJyZ2IoaGNsKSwgc3JjLmEpO1xcbn1cXG5cIlxuICB9LFxuICBibGVuZDoge1xuICAgIG5vcm1hbDogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBzcmM7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBtdWx0aXBseTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBzcmMgKiBkc3Q7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBzY3JlZW46IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kID0gMS4wIC0gKDEuMCAtIHNyYykgKiAoMS4wIC0gZHN0KTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIG92ZXJsYXk6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kLnIgPSBkc3QuciA8IDAuNSA/IDIuMCAqIHNyYy5yICogZHN0LnIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLnIpICogKDEuMCAtIGRzdC5yKTtcXG4gIGJsZW5kLmcgPSBkc3QuZyA8IDAuNSA/IDIuMCAqIHNyYy5nICogZHN0LmcgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmcpICogKDEuMCAtIGRzdC5nKTtcXG4gIGJsZW5kLmIgPSBkc3QuYiA8IDAuNSA/IDIuMCAqIHNyYy5iICogZHN0LmIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmIpICogKDEuMCAtIGRzdC5iKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGRhcmtlbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBtaW4oc3JjLCBkc3QpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgbGlnaHRlbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBtYXgoc3JjLCBkc3QpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgY29sb3JEb2RnZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQuciA9IHNyYy5yID09IDEuMCA/IDEuMCA6IGRzdC5yIC8gKDEuMCAtIHNyYy5yKTtcXG4gIGJsZW5kLmcgPSBzcmMuZyA9PSAxLjAgPyAxLjAgOiBkc3QuZyAvICgxLjAgLSBzcmMuZyk7XFxuICBibGVuZC5iID0gc3JjLmIgPT0gMS4wID8gMS4wIDogZHN0LmIgLyAoMS4wIC0gc3JjLmIpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgY29sb3JCdXJuOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZC5yID0gc3JjLnIgPT0gMC4wID8gMC4wIDogMS4wIC0gKDEuMCAtIGRzdC5yKSAvIHNyYy5yO1xcbiAgYmxlbmQuZyA9IHNyYy5nID09IDAuMCA/IDAuMCA6IDEuMCAtICgxLjAgLSBkc3QuZykgLyBzcmMuZztcXG4gIGJsZW5kLmIgPSBzcmMuYiA9PSAwLjAgPyAwLjAgOiAxLjAgLSAoMS4wIC0gZHN0LmIpIC8gc3JjLmI7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBoYXJkTGlnaHQ6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kLnIgPSBzcmMuciA8IDAuNSA/IDIuMCAqIHNyYy5yICogZHN0LnIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLnIpICogKDEuMCAtIGRzdC5yKTtcXG4gIGJsZW5kLmcgPSBzcmMuZyA8IDAuNSA/IDIuMCAqIHNyYy5nICogZHN0LmcgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmcpICogKDEuMCAtIGRzdC5nKTtcXG4gIGJsZW5kLmIgPSBzcmMuYiA8IDAuNSA/IDIuMCAqIHNyYy5iICogZHN0LmIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmIpICogKDEuMCAtIGRzdC5iKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIHNvZnRMaWdodDogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQuciA9IHNyYy5yIDwgMC41ID8gMi4wICogc3JjLnIgKiBkc3QuciArIGRzdC5yICogZHN0LnIgKiAoMS4wIC0gMi4wICogc3JjLnIpXFxuICAgIDogc3FydChkc3QucikgKiAoMi4wICogc3JjLnIgLSAxLjApICsgMi4wICogZHN0LnIgKiAoMS4wIC0gc3JjLnIpO1xcbiAgYmxlbmQuZyA9IHNyYy5nIDwgMC41ID8gMi4wICogc3JjLmcgKiBkc3QuZyArIGRzdC5nICogZHN0LmcgKiAoMS4wIC0gMi4wICogc3JjLmcpXFxuICAgIDogc3FydChkc3QuZykgKiAoMi4wICogc3JjLmcgLSAxLjApICsgMi4wICogZHN0LmcgKiAoMS4wIC0gc3JjLmcpO1xcbiAgYmxlbmQuYiA9IHNyYy5iIDwgMC41ID8gMi4wICogc3JjLmIgKiBkc3QuYiArIGRzdC5iICogZHN0LmIgKiAoMS4wIC0gMi4wICogc3JjLmIpXFxuICAgIDogc3FydChkc3QuYikgKiAoMi4wICogc3JjLmIgLSAxLjApICsgMi4wICogZHN0LmIgKiAoMS4wIC0gc3JjLmIpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgZGlmZmVyZW5jZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBhYnMoZHN0IC0gc3JjKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGV4Y2x1c2lvbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBzcmMgKyBkc3QgLSAyLjAgKiBzcmMgKiBkc3Q7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBodWU6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woZHN0LnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMocmdiMmhjbChzcmMucmdiKS54LCBoY2wueSwgaGNsLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIHNhdHVyYXRpb246IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woZHN0LnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMoaGNsLngsIHJnYjJoY2woc3JjLnJnYikueSwgaGNsLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGNvbG9yOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZlYzMgcmdiMmhjbCh2ZWMzIGMpIHtcXG4gIHZlYzQgcCA9IGMuciA+IGMuZyA/IHZlYzQoYy5yZ2IsIDAuMCkgOiB2ZWM0KGMuZ2JyLCAyLjApO1xcbiAgdmVjNCBxID0gYy5iID4gcC54ID8gdmVjNChjLmJyZywgNC4wKSA6IHA7XFxuXFxuICBmbG9hdCBNID0gcS54O1xcbiAgZmxvYXQgbSA9IG1pbihxLnksIHEueik7XFxuICBmbG9hdCBDID0gTSAtIG07XFxuXFxuICBmbG9hdCBIID0gQyA9PSAwLjAgPyAwLjAgOiBtb2QoKHEueSAtIHEueikgLyBDICsgcS53LCA2LjApO1xcbiAgZmxvYXQgTCA9IDAuNSAqIChNICsgbSk7XFxuXFxuICByZXR1cm4gdmVjMyhILCBDLCBMKTtcXG59XFxuXFxudmVjMyBoY2wycmdiKHZlYzMgYykge1xcbiAgZmxvYXQgSCA9IGMueDtcXG5cXG4gIGZsb2F0IFIgPSBhYnMoSCAtIDMuMCkgLSAxLjA7XFxuICBmbG9hdCBHID0gMi4wIC0gYWJzKEggLSAyLjApO1xcbiAgZmxvYXQgQiA9IDIuMCAtIGFicyhIIC0gNC4wKTtcXG4gIHZlYzMgcmdiID0gY2xhbXAodmVjMyhSLCBHLCBCKSwgMC4wLCAxLjApO1xcblxcbiAgcmV0dXJuIChyZ2IgLSAwLjUpICogYy55ICsgYy56O1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgdmVjMyBoY2wgPSByZ2IyaGNsKHNyYy5yZ2IpO1xcbiAgYmxlbmQucmdiID0gaGNsMnJnYih2ZWMzKGhjbC54LCBoY2wueSwgcmdiMmhjbChkc3QucmdiKS56KSk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBsdW1pbm9zaXR5OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZlYzMgcmdiMmhjbCh2ZWMzIGMpIHtcXG4gIHZlYzQgcCA9IGMuciA+IGMuZyA/IHZlYzQoYy5yZ2IsIDAuMCkgOiB2ZWM0KGMuZ2JyLCAyLjApO1xcbiAgdmVjNCBxID0gYy5iID4gcC54ID8gdmVjNChjLmJyZywgNC4wKSA6IHA7XFxuXFxuICBmbG9hdCBNID0gcS54O1xcbiAgZmxvYXQgbSA9IG1pbihxLnksIHEueik7XFxuICBmbG9hdCBDID0gTSAtIG07XFxuXFxuICBmbG9hdCBIID0gQyA9PSAwLjAgPyAwLjAgOiBtb2QoKHEueSAtIHEueikgLyBDICsgcS53LCA2LjApO1xcbiAgZmxvYXQgTCA9IDAuNSAqIChNICsgbSk7XFxuXFxuICByZXR1cm4gdmVjMyhILCBDLCBMKTtcXG59XFxuXFxudmVjMyBoY2wycmdiKHZlYzMgYykge1xcbiAgZmxvYXQgSCA9IGMueDtcXG5cXG4gIGZsb2F0IFIgPSBhYnMoSCAtIDMuMCkgLSAxLjA7XFxuICBmbG9hdCBHID0gMi4wIC0gYWJzKEggLSAyLjApO1xcbiAgZmxvYXQgQiA9IDIuMCAtIGFicyhIIC0gNC4wKTtcXG4gIHZlYzMgcmdiID0gY2xhbXAodmVjMyhSLCBHLCBCKSwgMC4wLCAxLjApO1xcblxcbiAgcmV0dXJuIChyZ2IgLSAwLjUpICogYy55ICsgYy56O1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgdmVjMyBoY2wgPSByZ2IyaGNsKGRzdC5yZ2IpO1xcbiAgYmxlbmQucmdiID0gaGNsMnJnYih2ZWMzKGhjbC54LCBoY2wueSwgcmdiMmhjbChzcmMucmdiKS56KSk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIlxuICB9LFxuICBlZmZlY3RzOiB7XG4gICAgc3BsaXRUb25lOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIHZlYzMgaGlnaGxpZ2h0O1xcbnVuaWZvcm0gdmVjMyBzaGFkb3c7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxuY29uc3QgZmxvYXQgZSA9IDEwZS0xMDtcXG5cXG52ZWMzIHNvZnRsaWdodCh2ZWMzIHNyYywgdmVjMyBkc3QpIHtcXG4gIHZlYzMgY29sb3I7XFxuICBjb2xvci5yID0gc3JjLnIgPCAwLjUgPyAyLjAgKiBzcmMuciAqIGRzdC5yICsgZHN0LnIgKiBkc3QuciAqICgxLjAgLSAyLjAgKiBzcmMucilcXG4gICAgOiBzcXJ0KGRzdC5yKSAqICgyLjAgKiBzcmMuciAtIDEuMCkgKyAyLjAgKiBkc3QuciAqICgxLjAgLSBzcmMucik7XFxuICBjb2xvci5nID0gc3JjLmcgPCAwLjUgPyAyLjAgKiBzcmMuZyAqIGRzdC5nICsgZHN0LmcgKiBkc3QuZyAqICgxLjAgLSAyLjAgKiBzcmMuZylcXG4gICAgOiBzcXJ0KGRzdC5nKSAqICgyLjAgKiBzcmMuZyAtIDEuMCkgKyAyLjAgKiBkc3QuZyAqICgxLjAgLSBzcmMuZyk7XFxuICBjb2xvci5iID0gc3JjLmIgPCAwLjUgPyAyLjAgKiBzcmMuYiAqIGRzdC5iICsgZHN0LmIgKiBkc3QuYiAqICgxLjAgLSAyLjAgKiBzcmMuYilcXG4gICAgOiBzcXJ0KGRzdC5iKSAqICgyLjAgKiBzcmMuYiAtIDEuMCkgKyAyLjAgKiBkc3QuYiAqICgxLjAgLSBzcmMuYik7XFxuICByZXR1cm4gY29sb3I7XFxufVxcblxcbmZsb2F0IGx1bWEodmVjMyBjKSB7XFxuICByZXR1cm4gMC4yOTkgKiBjLnIgKyAwLjU4NyAqIGMuZyArIDAuMTE0ICogYy5iO1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG5cXG4gIC8vIGNhc3Qgc29mdCBsaWdodCB1c2luZyBoaWdobGlnaHQgYW5kIHNoYWRvd1xcbiAgdmVjMyBoID0gc29mdGxpZ2h0KGhpZ2hsaWdodCwgc3JjLnJnYik7XFxuICB2ZWMzIHMgPSBzb2Z0bGlnaHQoc2hhZG93LCBzcmMucmdiKTtcXG5cXG4gIC8vIGJsZW5kIGJhc2VkIG9uIGx1bWluYW5jZVxcbiAgZmxvYXQgbCA9IGx1bWEoc3JjLnJnYik7XFxuICB2ZWMzIGMgPSBoICogbCArIHMgKiAoMS4wIC0gbCk7XFxuICBjID0gYyAvIChsdW1hKGMpICsgZSkgKiBsO1xcblxcbiAgZ2xfRnJhZ0NvbG9yID0gdmVjNChjLCBzcmMuYSk7XFxufVxcblwiLFxuICAgIGR1b3RvbmU6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gdmVjMyBoaWdobGlnaHQ7XFxudW5pZm9ybSB2ZWMzIHNoYWRvdztcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG5jb25zdCBmbG9hdCBlID0gMTBlLTEwO1xcblxcbmZsb2F0IGx1bWEodmVjMyBjKSB7XFxuICByZXR1cm4gMC4yOTkgKiBjLnIgKyAwLjU4NyAqIGMuZyArIDAuMTE0ICogYy5iO1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG5cXG4gIGZsb2F0IGwgPSBsdW1hKHNyYy5yZ2IpO1xcblxcbiAgLy8gaGlnaGxpZ2h0IGFuZCBzaGFkb3cgY29sb3Igbm9ybWFsaXplZCB0byBzYW1lIGx1bWluYW5jZVxcbiAgdmVjMyBoID0gKGhpZ2hsaWdodCArIGUpIC8gKGx1bWEoaGlnaGxpZ2h0KSArIGUpICogbDtcXG4gIHZlYzMgcyA9IChzaGFkb3cgKyBlKSAvIChsdW1hKHNoYWRvdykgKyBlKSAqIGw7XFxuXFxuICAvLyBibGVuZCBiYXNlZCBvbiBsdW1pbmFuY2VcXG4gIHZlYzMgYyA9IGggKiBsICsgcyAqICgxLjAgLSBsKTtcXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHZlYzQoYywgc3JjLmEpO1xcbn1cXG5cIixcbiAgICBzaGFycGVuOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc3RyZW5ndGg7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGJhY2tncm91bmQ7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxuY29uc3QgZmxvYXQgZSA9IDEwZS0xMDtcXG5cXG5mbG9hdCBsdW1hKHZlYzMgYykge1xcbiAgcmV0dXJuIDAuMjk5ICogYy5yICsgMC41ODcgKiBjLmcgKyAwLjExNCAqIGMuYjtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICBmbG9hdCBsc3JjID0gbHVtYShzcmMucmdiKTtcXG4gIGZsb2F0IGwgPSBsdW1hKHRleHR1cmUyRChiYWNrZ3JvdW5kLCBjb29yZCkucmdiKTtcXG5cXG4gIHNyYy5yZ2IgKj0gKChsc3JjIC0gbCkgKiBzdHJlbmd0aCArIGwpIC8gKGxzcmMgKyBlKTtcXG4gIGdsX0ZyYWdDb2xvciA9IHNyYztcXG59XFxuXCIsXG4gICAgdmlnbmV0dGU6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgZGFya2VuO1xcbnVuaWZvcm0gZmxvYXQgYnJpZ2h0ZW47XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxuY29uc3QgZmxvYXQgZSA9IDEwZS0xMDtcXG5cXG5mbG9hdCBsdW1hKHZlYzMgYykge1xcbiAgcmV0dXJuIDAuMjk5ICogYy5yICsgMC41ODcgKiBjLmcgKyAwLjExNCAqIGMuYjtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICAvLyBkaXN0YW5jZSB0byBlYWNoIGJvcmRlclxcbiAgZmxvYXQgYSA9IGNvb3JkLnggPCAwLjUgPyBjb29yZC54IDogMS4wIC0gY29vcmQueDtcXG4gIGZsb2F0IGIgPSBjb29yZC55IDwgMC41ID8gY29vcmQueSA6IDEuMCAtIGNvb3JkLnk7XFxuXFxuICAvLyBscCBub3JtIHVzZWQgYXMgZGlzdGFuY2UsIDAuMiBzZWVtcyB0byBiZSBhIG5pY2UgdmFsdWUgZm9yIHBcXG4gIGZsb2F0IHAgPSAwLjI7XFxuICBmbG9hdCBkID0gcG93KGEsIHApICsgcG93KGIsIHApO1xcbiAgZmxvYXQgZG1heCA9IDIuMCAqIHBvdygwLjUsIHApO1xcblxcbiAgLy8gYnJpZ2h0ZW4gb3ZlcmFsbCwgdGhlbiBkYXJrZW4gYmFzZWQgb24gbHAgZGlzdGFuY2VcXG4gIGZsb2F0IGwgPSBsdW1hKHNyYy5yZ2IpO1xcbiAgc3JjLnJnYiAqPSAobCArIGJyaWdodGVuIC0gZGFya2VuICogKDEuMCAtIGQgLyBkbWF4KSkgLyAobCArIGUpO1xcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3JjO1xcbn1cXG5cIlxuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFNwbGluZVxuXG4vLyB0YWtlbiBkaXJlY3RseSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9nbGZ4LmpzXG4vLyBpbiB0dXJuIGZyb20gU3BsaW5lSW50ZXJwb2xhdG9yLmNzIGluIHRoZSBQYWludC5ORVQgc291cmNlIGNvZGVcblxuZnVuY3Rpb24gU3BsaW5lKHBvaW50cykge1xuICB2YXIgbiA9IHBvaW50cy5sZW5ndGhcbiAgdGhpcy54YSA9IFtdXG4gIHRoaXMueWEgPSBbXVxuICB0aGlzLnUgPSBbXVxuICB0aGlzLnkyID0gW11cblxuICBwb2ludHMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGFbMF0gLSBiWzBdXG4gIH0pXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XG4gICAgdGhpcy54YS5wdXNoKHBvaW50c1tpXVswXSlcbiAgICB0aGlzLnlhLnB1c2gocG9pbnRzW2ldWzFdKVxuICB9XG5cbiAgdGhpcy51WzBdID0gMFxuICB0aGlzLnkyWzBdID0gMFxuXG4gIGZvciAodmFyIGkgPSAxOyBpIDwgbiAtIDE7ICsraSkge1xuICAgIC8vIFRoaXMgaXMgdGhlIGRlY29tcG9zaXRpb24gbG9vcCBvZiB0aGUgdHJpZGlhZ29uYWwgYWxnb3JpdGhtLiBcbiAgICAvLyB5MiBhbmQgdSBhcmUgdXNlZCBmb3IgdGVtcG9yYXJ5IHN0b3JhZ2Ugb2YgdGhlIGRlY29tcG9zZWQgZmFjdG9ycy5cbiAgICB2YXIgd3ggPSB0aGlzLnhhW2kgKyAxXSAtIHRoaXMueGFbaSAtIDFdXG4gICAgdmFyIHNpZyA9ICh0aGlzLnhhW2ldIC0gdGhpcy54YVtpIC0gMV0pIC8gd3hcbiAgICB2YXIgcCA9IHNpZyAqIHRoaXMueTJbaSAtIDFdICsgMi4wXG5cbiAgICB0aGlzLnkyW2ldID0gKHNpZyAtIDEuMCkgLyBwXG5cbiAgICB2YXIgZGR5ZHggPSBcbiAgICAodGhpcy55YVtpICsgMV0gLSB0aGlzLnlhW2ldKSAvICh0aGlzLnhhW2kgKyAxXSAtIHRoaXMueGFbaV0pIC1cbiAgICAodGhpcy55YVtpXSAtIHRoaXMueWFbaSAtIDFdKSAvICh0aGlzLnhhW2ldIC0gdGhpcy54YVtpIC0gMV0pXG5cbiAgICB0aGlzLnVbaV0gPSAoNi4wICogZGR5ZHggL1xuICAgICAgd3ggLSBzaWcgKiB0aGlzLnVbaSAtIDFdKSAvIHBcbiAgfVxuXG4gIHRoaXMueTJbbiAtIDFdID0gMFxuXG4gIC8vIFRoaXMgaXMgdGhlIGJhY2tzdWJzdGl0dXRpb24gbG9vcCBvZiB0aGUgdHJpZGlhZ29uYWwgYWxnb3JpdGhtXG4gIGZvciAodmFyIGkgPSBuIC0gMjsgaSA+PSAwOyAtLWkpIHtcbiAgICB0aGlzLnkyW2ldID0gdGhpcy55MltpXSAqIHRoaXMueTJbaSArIDFdICsgdGhpcy51W2ldXG4gIH1cbn1cblxuU3BsaW5lLnByb3RvdHlwZS5pbnRlcnBvbGF0ZSA9IGZ1bmN0aW9uKHgpIHtcbiAgdmFyIG4gPSB0aGlzLnlhLmxlbmd0aFxuICB2YXIga2xvID0gMFxuICB2YXIga2hpID0gbiAtIDFcblxuICAvLyBXZSB3aWxsIGZpbmQgdGhlIHJpZ2h0IHBsYWNlIGluIHRoZSB0YWJsZSBieSBtZWFucyBvZlxuICAvLyBiaXNlY3Rpb24uIFRoaXMgaXMgb3B0aW1hbCBpZiBzZXF1ZW50aWFsIGNhbGxzIHRvIHRoaXNcbiAgLy8gcm91dGluZSBhcmUgYXQgcmFuZG9tIHZhbHVlcyBvZiB4LiBJZiBzZXF1ZW50aWFsIGNhbGxzXG4gIC8vIGFyZSBpbiBvcmRlciwgYW5kIGNsb3NlbHkgc3BhY2VkLCBvbmUgd291bGQgZG8gYmV0dGVyXG4gIC8vIHRvIHN0b3JlIHByZXZpb3VzIHZhbHVlcyBvZiBrbG8gYW5kIGtoaS5cbiAgd2hpbGUgKGtoaSAtIGtsbyA+IDEpIHtcbiAgICB2YXIgayA9IChraGkgKyBrbG8pID4+IDFcblxuICAgIGlmICh0aGlzLnhhW2tdID4geCkge1xuICAgICAga2hpID0ga1xuICAgIH0gZWxzZSB7XG4gICAgICBrbG8gPSBrXG4gICAgfVxuICB9XG5cbiAgdmFyIGggPSB0aGlzLnhhW2toaV0gLSB0aGlzLnhhW2tsb11cbiAgdmFyIGEgPSAodGhpcy54YVtraGldIC0geCkgLyBoXG4gIHZhciBiID0gKHggLSB0aGlzLnhhW2tsb10pIC8gaFxuXG4gIC8vIEN1YmljIHNwbGluZSBwb2x5bm9taWFsIGlzIG5vdyBldmFsdWF0ZWQuXG4gIHJldHVybiBhICogdGhpcy55YVtrbG9dICsgYiAqIHRoaXMueWFba2hpXSArIFxuICAgICAgICAgKChhICogYSAqIGEgLSBhKSAqIHRoaXMueTJba2xvXSArIChiICogYiAqIGIgLSBiKSAqIHRoaXMueTJba2hpXSkgKiAoaCAqIGgpIC8gNi4wXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFRleHR1cmVcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIFRleHR1cmUoZ2wsIHVuaXQsIG5vZGVPckRhdGEsIHdpZHRoLCBoZWlnaHQsIG9wdGlvbnMpIHtcbiAgdGhpcy5nbCA9IGdsXG4gIHRoaXMudW5pdCA9IHVuaXRcbiAgdGhpcy53aWR0aCA9IHdpZHRoXG4gIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0XG5cbiAgdGhpcy50ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpXG4gIHRoaXMuYmluZCgpXG4gIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgdHJ1ZSlcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLkxJTkVBUilcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUilcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSlcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSlcblxuICBpZiAodXRpbHMuaXNBcnJheShub2RlT3JEYXRhKSkge1xuICAgIHZhciBkYXRhID0gbmV3IFVpbnQ4QXJyYXkobm9kZU9yRGF0YSlcbiAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIGZhbHNlKVxuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgd2lkdGgsIGhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgZGF0YSlcblxuICB9IGVsc2UgaWYgKHV0aWxzLmlzTm90aGluZyhub2RlT3JEYXRhKSkge1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgd2lkdGgsIGhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgbnVsbClcbiAgICB0aGlzLmZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKVxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5mcmFtZWJ1ZmZlcilcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZSwgMClcblxuICB9IGVsc2Uge1xuICAgIHZhciBub2RlID0gdXRpbHMuZ2V0Tm9kZShub2RlT3JEYXRhKVxuXG4gICAgdmFyIG1heFNpemUgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfU0laRSlcbiAgICBpZiAodXRpbHMuaXNOdW1iZXIob3B0aW9ucy5yZXNpemUpKSB7XG4gICAgICBtYXhTaXplID0gTWF0aC5taW4obWF4U2l6ZSwgb3B0aW9ucy5yZXNpemUpXG4gICAgfVxuXG4gICAgbm9kZSA9IHJlc2l6ZShub2RlLCBtYXhTaXplKVxuICAgIHRoaXMud2lkdGggPSBub2RlLndpZHRoXG4gICAgdGhpcy5oZWlnaHQgPSBub2RlLmhlaWdodFxuXG4gICAgaWYgKHV0aWxzLmlzV2ViZ2wobm9kZSkgJiYgdXRpbHMuaXNXZWJraXQoKSkge1xuICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0ZMSVBfWV9XRUJHTCwgdHJ1ZSlcbiAgICB9XG5cbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG5vZGUpXG4gIH1cbn1cblxuVGV4dHVyZS5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG4gIGdsLmFjdGl2ZVRleHR1cmUoZ2xbJ1RFWFRVUkUnICsgdGhpcy51bml0XSlcbiAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy50ZXh0dXJlKVxuICBpZiAodGhpcy5mcmFtZWJ1ZmZlcikgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmZyYW1lYnVmZmVyKVxuICByZXR1cm4gdGhpc1xufVxuXG5UZXh0dXJlLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLnRleHR1cmUpXG4gIGlmICh0aGlzLmZyYW1lYnVmZmVyKSB7XG4gICAgdGhpcy5nbC5kZWxldGVGcmFtZWJ1ZmZlcih0aGlzLmZyYW1lYnVmZmVyKVxuICAgIHRoaXMuZnJhbWVidWZmZXIgPSBudWxsXG4gIH1cbiAgdGhpcy50ZXh0dXJlID0gbnVsbFxuICB0aGlzLmdsID0gbnVsbFxufVxuXG5mdW5jdGlvbiByZXNpemUobm9kZSwgbWF4U2l6ZSkge1xuICBpZiAobm9kZS53aWR0aCA8PSBtYXhTaXplICYmIG5vZGUuaGVpZ2h0IDw9IG1heFNpemUpIHtcbiAgICByZXR1cm4gbm9kZVxuICB9IGVsc2UgaWYgKG5vZGUud2lkdGggPiBtYXhTaXplICogMiB8fCBub2RlLmhlaWdodCA+IG1heFNpemUgKiAyKSB7XG4gICAgcmV0dXJuIHJlc2l6ZShyZXNpemUobm9kZSwgbWF4U2l6ZSAqIDIpLCBtYXhTaXplKVxuICB9IGVsc2Uge1xuICAgIHZhciB3aWR0aCwgaGVpZ2h0XG4gICAgaWYgKG5vZGUud2lkdGggPiBub2RlLmhlaWdodCkge1xuICAgICAgd2lkdGggPSBtYXhTaXplXG4gICAgICBoZWlnaHQgPSBNYXRoLmZsb29yKG1heFNpemUgLyBub2RlLndpZHRoICogbm9kZS5oZWlnaHQpXG4gICAgfSBlbHNlIHtcbiAgICAgIGhlaWdodCA9IG1heFNpemVcbiAgICAgIHdpZHRoID0gTWF0aC5mbG9vcihtYXhTaXplIC8gbm9kZS5oZWlnaHQgKiBub2RlLndpZHRoKVxuICAgIH1cblxuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoXG4gICAgY2FudmFzLmhlaWdodCA9IGhlaWdodFxuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgd2lkdGgsIGhlaWdodClcbiAgICBjdHguZHJhd0ltYWdlKG5vZGUsIDAsIDAsIHdpZHRoLCBoZWlnaHQpXG5cbiAgICByZXR1cm4gY2FudmFzXG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBpc1N0cmluZzogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBTdHJpbmddJ1xuICB9LFxuXG4gIGlzTnVtYmVyOiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IE51bWJlcl0nXG4gIH0sXG5cbiAgaXNBcnJheTogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nXG4gIH0sXG5cbiAgaXNOb3RoaW5nOiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsIHx8IHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnXG4gIH0sXG5cbiAgaXNXZWJnbDogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiBub2RlLmdldENvbnRleHQgJiZcbiAgICAgICAgICAgKG5vZGUuZ2V0Q29udGV4dCgnd2ViZ2wnKSB8fCBub2RlLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcpKVxuICB9LFxuXG4gIGlzV2Via2l0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZVxuICB9LFxuXG4gIGdldE5vZGU6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAodGhpcy5pc1N0cmluZyhub2RlKSkge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iobm9kZSlcbiAgICB9IGVsc2UgaWYgKG5vZGUuaXNHbGltZykge1xuICAgICAgcmV0dXJuIG5vZGUuY2FudmFzXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlXG4gICAgfVxuICB9LFxuXG4gIGNsYW1wOiBmdW5jdGlvbih2YWx1ZSwgbWluLCBtYXgpIHtcbiAgICByZXR1cm4gdmFsdWUgPCBtaW4gPyBtaW4gOiAodmFsdWUgPiBtYXggPyBtYXggOiB2YWx1ZSlcbiAgfSxcblxuICB0cmFuc3Bvc2U6IGZ1bmN0aW9uKG1hdHJpeCkge1xuICAgIHZhciBtID0gdGhpcy5mbGF0dGVuKG1hdHJpeClcbiAgICBpZiAobS5sZW5ndGggPT09IDQpIHtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIG1bMF0sIG1bMl0sXG4gICAgICAgIG1bMV0sIG1bM11cbiAgICAgIF1cbiAgICB9IGVsc2UgaWYgKG0ubGVuZ3RoID09PSA5KSB7XG4gICAgICByZXR1cm4gW1xuICAgICAgICBtWzBdLCBtWzNdLCBtWzZdLFxuICAgICAgICBtWzFdLCBtWzRdLCBtWzddLFxuICAgICAgICBtWzJdLCBtWzVdLCBtWzhdXG4gICAgICBdXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIG1bMF0sIG1bNF0sIG1bOF0sIG1bMTJdLFxuICAgICAgICBtWzFdLCBtWzVdLCBtWzldLCBtWzEzXSxcbiAgICAgICAgbVsyXSwgbVs2XSwgbVsxMF0sIG1bMTRdLFxuICAgICAgICBtWzNdLCBtWzddLCBtWzExXSwgbVsxNV1cbiAgICAgIF1cbiAgICB9XG4gIH0sXG5cbiAgZmxhdHRlbjogZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5hcHBseShbXSwgYXJyYXkpXG4gIH0sXG5cbiAgY2FtZWxDYXNlOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvLSguKS9nLCBmdW5jdGlvbihfLCB3b3JkKSB7XG4gICAgICByZXR1cm4gd29yZC50b1VwcGVyQ2FzZSgpXG4gICAgfSlcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdldFdoaXRlQ29sb3I6IGZ1bmN0aW9uKHBpeGVscykge1xuICAgIHZhciBzaXplID0gcGl4ZWxzLmxlbmd0aFxuICAgIHZhciBjbGlwcGluZyA9IHNpemUgLyA0ICogMC4wMDFcbiAgICB2YXIgbHVtYSA9IFtdXG5cbiAgICB2YXIgaSwgbHVtYSA9IFtdXG4gICAgZm9yIChpID0gMDsgaSA8IDI1NjsgaSsrKSBsdW1hW2ldID0gMFxuXG4gICAgZm9yIChpID0gMDsgaSA8IHNpemU7IGkgKz0gNCkge1xuICAgICAgcGl4ZWxzW2kgKyAzXSA9IE1hdGgucm91bmQoMC4yOTkgKiBwaXhlbHNbaV0gKyAwLjU4NyAqIHBpeGVsc1tpICsgMV0gKyAwLjExNCAqIHBpeGVsc1tpICsgMl0pXG4gICAgICBsdW1hW3BpeGVsc1tpICsgM11dICs9IDFcbiAgICB9XG5cbiAgICB2YXIgdCA9IDAsIGxXaGl0ZSA9IDBcbiAgICBmb3IgKGkgPSAyNTU7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodCArIGx1bWFbaV0gPiBjbGlwcGluZykge1xuICAgICAgICBsV2hpdGUgPSBpXG4gICAgICAgIGJyZWFrXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ICs9IGx1bWFbaV1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgY291bnQgPSAwLCByV2hpdGUgPSAwLCBnV2hpdGUgPSAwLCBiV2hpdGUgPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IHNpemU7IGkgKz0gNCkge1xuICAgICAgaWYgKHBpeGVsc1tpICsgM10gPT0gbFdoaXRlKSB7XG4gICAgICAgIGNvdW50KytcbiAgICAgICAgcldoaXRlICs9IHBpeGVsc1tpXVxuICAgICAgICBnV2hpdGUgKz0gcGl4ZWxzW2kgKyAxXVxuICAgICAgICBiV2hpdGUgKz0gcGl4ZWxzW2kgKyAyXVxuICAgICAgfVxuICAgIH1cblxuICAgIHJXaGl0ZSAvPSBjb3VudFxuICAgIGdXaGl0ZSAvPSBjb3VudFxuICAgIGJXaGl0ZSAvPSBjb3VudFxuICAgIHJldHVybiBbcldoaXRlLCBnV2hpdGUsIGJXaGl0ZV1cbiAgfSxcblxuICB0MnJnYjogZnVuY3Rpb24odGVtcGVyYXR1cmUsIGdyZWVuKSB7XG4gICAgdmFyIHQgPSB0ZW1wZXJhdHVyZSA+IDEyMDAwID8gMTIwMDAgOiB0ZW1wZXJhdHVyZVxuICAgIHZhciB0MiA9IHQgKiB0LCB0MyA9IHQyICogdFxuXG4gICAgdmFyIHhELCB5RFxuICAgIGlmICh0IDw9IDQwMDApIHtcbiAgICAgIHhEID0gMC4yNzQ3NWU5IC8gdDMgLSAwLjk4NTk4ZTYgLyB0MiArIDEuMTc0NDRlMyAvIHQgKyAwLjE0NTk4NlxuICAgIH0gZWxzZSBpZiAodCA8PSA3MDAwKSB7XG4gICAgICB4RCA9IC00LjYwNzBlOSAvIHQzICsgMi45Njc4ZTYgLyB0MiArIDAuMDk5MTFlMyAvIHQgKyAwLjI0NDA2M1xuICAgIH0gZWxzZSB7XG4gICAgICB4RCA9IC0yLjAwNjRlOSAvIHQzICsgMS45MDE4ZTYgLyB0MiArIDAuMjQ3NDhlMy8gdCArIDAuMjM3MDQwXG4gICAgfVxuICAgIHlEID0gLTMgKiB4RCAqIHhEICsgMi44NyAqIHhEIC0gMC4yNzVcblxuICAgIHZhciB4ID0geEQgLyB5RFxuICAgIHZhciB5ID0gMVxuICAgIHZhciB6ID0gKDEgLSB4RCAtIHlEKSAvIHlEXG4gICAgdmFyIHIgPSAzLjI0MDcxICogeCAtIDEuNTM3MjYgKiB5IC0gMC40OTg1NzEgKiB6XG4gICAgdmFyIGcgPSAtMC45NjkyNTggKiB4ICsgMS44NzU5OSAqIHkgKyAwLjA0MTU1NTcgKiB6XG4gICAgdmFyIGIgPSAwLjA1NTYzNTIgKiB4IC0gMC4yMDM5OTYgKiB5ICsgMS4wNTcwNyAqIHpcblxuICAgIGcgPSBnIC8gKGdyZWVuICsgMC4wMDAwMDEpXG4gICAgdmFyIGwgPSAwLjI5OSAqIHIgKyAwLjU4NyAqIGcgKyAwLjExNCAqIGJcbiAgICByID0gciAvIGwgKiAwLjVcbiAgICBnID0gZyAvIGwgKiAwLjVcbiAgICBiID0gYiAvIGwgKiAwLjVcblxuICAgIHJldHVybiBbciwgZywgYl1cbiAgfSxcblxuICByZ2IydDogZnVuY3Rpb24ociwgZywgYikge1xuICAgIHZhciB0LCByZ2JcbiAgICB2YXIgZ3JlZW4gPSAxXG4gICAgdmFyIHRtaW4gPSAyMDAwXG4gICAgdmFyIHRtYXggPSAxMjAwMFxuICAgIHZhciBiciA9IGIgLyByXG5cbiAgICBmb3IgKHQgPSAodG1pbiArIHRtYXgpIC8gMjsgdG1heCAtIHRtaW4gPiAxMDsgdCA9ICh0bWluICsgdG1heCkgLyAyKSB7XG4gICAgICByZ2IgPSB0aGlzLnQycmdiKHQsIGdyZWVuKVxuICAgICAgaWYgKHJnYlsyXSAvIHJnYlswXSA+IGJyKSB7XG4gICAgICAgIHRtYXggPSB0XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0bWluID0gdFxuICAgICAgfVxuICAgIH1cblxuICAgIGdyZWVuID0gKHJnYlsxXSAvIHJnYlswXSkgLyAoZyAvIHIpXG4gICAgcmV0dXJuIFt0LCBncmVlbl1cbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBnbGltZ1xuXG52YXIgR2xpbWcgPSByZXF1aXJlKCcuL2NvcmUvZ2xpbWcnKVxuXG5mdW5jdGlvbiBnbGltZyhjYW52YXMsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBHbGltZyhjYW52YXMsIG9wdGlvbnMpXG59XG5cbmluaXQoZ2xpbWcpXG5cbmZ1bmN0aW9uIGluaXQoZ2xpbWcpIHtcbiAgZ2xpbWcuaW5mbyA9IHt9XG4gIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICB2YXIgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ2wnKSB8fCBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJylcbiAgaWYgKGdsKSB7XG4gICAgZ2xpbWcuaW5mby5zdXBwb3J0ZWQgPSB0cnVlXG4gICAgZ2xpbWcuaW5mby5tYXhTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX1NJWkUpXG4gICAgZ2xpbWcuaW5mby5tYXhVbml0ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX0lNQUdFX1VOSVRTKSAtIDRcbiAgfSBlbHNlIHtcbiAgICBnbGltZy5pbmZvLnN1cHBvcnRlZCA9IGZhbHNlXG4gIH1cblxuICBnbGltZy5zaGFkZXJzID0gcmVxdWlyZSgnLi9jb3JlL3NoYWRlcnMnKVxufVxuIl19
(9)
});
