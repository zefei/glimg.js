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

Glimg.prototype.curves = function(points) {
  spline = new Spline(points)

  var lut = []
  for (var x = 0; x <= 255; x++) {
    var y = utils.clamp(Math.round(spline.interpolate(x / 255) * 255), 0, 255)
    lut[x] = [y, y, y, 255]
  }

  this.useTexture(this._unit[2], utils.flatten(lut), 256, 1)
  .useShader(shaders.core.lut)
  .set('lut', this._unit[2], null)
  .run()

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

},{"./buffer":1,"./shader":3,"./shaders":4,"./spline":5,"./texture":6,"./utils":7}],3:[function(_dereq_,module,exports){
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
      gl.uniformMatrix2fv(location, false, values)
    } else if (values.length === 9) {
      gl.uniformMatrix3fv(location, false, values)
    } else if (values.length === 16) {
      gl.uniformMatrix4fv(location, false, values)
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
    transform: "precision mediump float;\n\nuniform mat2 transform;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  // first -0.5 is applied to center image\n  // then width:height ratio is applied to keep aspect\n  // then transform is applied\n  // then pre-transforms are reversed\n  //\n  vec2 r = vec2(size.p / size.q, 1.0);\n  gl_FragColor = texture2D(source, transform * ((coord - 0.5) * r) / r + 0.5);\n}\n",
    lut: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D lut;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  src.r = texture2D(lut, vec2(src.r, 0.0)).r;\n  src.g = texture2D(lut, vec2(src.g, 0.0)).g;\n  src.b = texture2D(lut, vec2(src.b, 0.0)).b;\n\n  gl_FragColor = src;\n}\n"
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
  blur: {
    gaussian2: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 2.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
    gaussian4: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 4.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
    gaussian8: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 8.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
    gaussian16: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 16.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
    gaussian32: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 32.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
    gaussian64: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 64.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
    gaussian128: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 128.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
    gaussian256: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\nconst float pi = 3.14159265;\nconst float radius = 256.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n"
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

},{"./core/glimg":2,"./core/shaders":4}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xvY2FsL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9jb3JlL2J1ZmZlci5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS9nbGltZy5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS9zaGFkZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL2NvcmUvc2hhZGVycy5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS9zcGxpbmUuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL2NvcmUvdGV4dHVyZS5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvY29yZS91dGlscy5qcyIsIi9Vc2Vycy96ZWZlaS9Qcm9qZWN0cy9nbGltZy5qcy9zcmMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6b0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlclxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gQnVmZmVyKGdsLCBhcnJheSkge1xuICB0aGlzLmdsID0gZ2xcbiAgdGhpcy5idWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKVxuICB0aGlzLmJpbmQoKVxuICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgbmV3IEZsb2F0MzJBcnJheShhcnJheSksIGdsLlNUQVRJQ19EUkFXKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5nbC5iaW5kQnVmZmVyKHRoaXMuZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLmJ1ZmZlcilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZGVsZXRlQnVmZmVyKHRoaXMuYnVmZmVyKVxuICB0aGlzLmJ1ZmZlciA9IG51bGxcbiAgdGhpcy5nbCA9IG51bGxcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gR2xpbWdcblxudmFyIFNoYWRlciA9IHJlcXVpcmUoJy4vc2hhZGVyJylcbnZhciBCdWZmZXIgPSByZXF1aXJlKCcuL2J1ZmZlcicpXG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4vdGV4dHVyZScpXG52YXIgU3BsaW5lID0gcmVxdWlyZSgnLi9zcGxpbmUnKVxudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKVxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbi8vIG5ldyBHbGltZyhbY2FudmFzLCBbb3B0aW9uc11dKVxuLy9cbi8vIENyZWF0ZSBhbiBlbXB0eSBHbGltZyBvYmplY3QuXG4vL1xuLy8gSWYgY2FudmFzIGlzIHByb3ZpZGVkLCBlaXRoZXIgbm9kZSBvciBzZWxlY3RvciwgR2xpbWcgd2lsbCB1c2UgdGhhdCBjYW52YXMgXG4vLyBub2RlIGluc3RlYWQgb2YgY3JlYXRpbmcgYSBuZXcgb25lLlxuLy9cbi8vIE5vdGljZSB0aGF0IHlvdSBjYW5ub3QgdXNlIGEgY2FudmFzIHRoYXQgaGFzIGNhbGxlZCBnZXRDb250ZXh0KCcyZCcpLlxuLy9cbi8vIE9wdGlvbnM6XG4vL1xuLy8gcmVzaXplIChkZWZhdWx0IDIwNDgpOiBsb2FkZWQgaW1hZ2Ugd2lsbCBiZSBkb3duc2l6ZWQgdG8gdGhpcyB2YWx1ZSBpZiBpdHMgXG4vLyB3aWR0aCBvciBoZWlnaHQgZXhjZWVkcyBpdDsgJ21heCcgbWVhbnMgdGhlIGxpbWl0IGlzIHRoZSBtYXhpbWFsIHZhbHVlIFxuLy8gYnJvd3NlciBzdXBwb3J0cy5cbi8vXG5mdW5jdGlvbiBHbGltZyhjYW52YXMsIG9wdGlvbnMpIHtcbiAgaWYgKGNhbnZhcykge1xuICAgIGNhbnZhcyA9IHV0aWxzLmdldE5vZGUoY2FudmFzKVxuICB9IGVsc2Uge1xuICAgIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpXG4gIH1cblxuICB2YXIgZ2xvcHRzID0ge1xuICAgIHByZXNlcnZlRHJhd2luZ0J1ZmZlcjogdHJ1ZSxcbiAgICBwcmVtdWx0aXBsaWVkQWxwaGE6IHRydWVcbiAgfVxuXG4gIHZhciBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KCd3ZWJnbCcsIGdsb3B0cykgfHxcbiAgICAgICAgICAgY2FudmFzLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcsIGdsb3B0cylcblxuICBpZiAoIWdsKSB0aHJvdyAnV2ViR0wgaXMgbm90IHN1cHBvcnRlZCdcblxuICB0aGlzLmlzR2xpbWcgPSB0cnVlXG4gIHRoaXMuY2FudmFzID0gY2FudmFzXG4gIHRoaXMuZ2wgPSBnbFxuICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gIHRoaXMub3B0aW9ucy5yZXNpemUgPSB0aGlzLm9wdGlvbnMucmVzaXplIHx8IDIwNDhcbiAgdGhpcy5fYnVmZmVycyA9IHt9XG4gIHRoaXMuX3RleHR1cmVzID0ge31cbiAgdGhpcy5fc2hhZGVycyA9IHt9XG4gIHZhciBtYXhVbml0ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX0lNQUdFX1VOSVRTKSAtIDFcbiAgdGhpcy5fdW5pdCA9IFttYXhVbml0LCBtYXhVbml0IC0gMSwgbWF4VW5pdCAtIDIsIG1heFVuaXQgLSAzXVxuICB0aGlzLl9jaGFpbiA9IHtjb3VudDogMH1cbiAgdGhpcy5zZXRTb3VyY2UoMClcbiAgdGhpcy5zZXRUYXJnZXQobnVsbClcbiAgdGhpcy5zZXRab29tKG51bGwpXG59XG5cbi8vIGxvYWQobm9kZVssIG5vY29weV0pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gTG9hZCBpbWFnZSBmcm9tIGEgbm9kZSAoY2FudmFzLCBpbWFnZSBvciB2aWRlbykgYXMgc291cmNlIGltYWdlLiBUaGVuIGNvcHkgaXQgXG4vLyB0byB0aGUgdGFyZ2V0IGltYWdlIHVubGVzcyBub2NvcHkgaXMgc2V0LlxuLy9cbkdsaW1nLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24obm9kZSwgbm9jb3B5KSB7XG4gIG5vZGUgPSB1dGlscy5nZXROb2RlKG5vZGUpXG4gIHRoaXMuc2V0U291cmNlKHRoaXMuc291cmNlVW5pdCwgbm9kZSkuc2V0VGFyZ2V0KHRoaXMudGFyZ2V0VW5pdClcbiAgaWYgKCFub2NvcHkpIHRoaXMuY29weSgpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIGxvYWRGcm9tVXJsKHVybFssIGNhbGxiYWNrWywgbm9jb3B5XV0pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gTG9hZCByZW1vdGUgaW1hZ2UgYXMgc291cmNlIGltYWdlLiBDYWxsYmFjayBpcyBmaXJlZCB3aGVuIGltYWdlIGlzIGxvYWRlZC4gIFxuLy8gVGhlbiBjb3B5IGl0IHRvIHRoZSB0YXJnZXQgaW1hZ2UgdW5sZXNzIG5vY29weSBpcyBzZXQuXG4vL1xuR2xpbWcucHJvdG90eXBlLmxvYWRGcm9tVXJsID0gZnVuY3Rpb24odXJsLCBjYWxsYmFjaywgbm9jb3B5KSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICB2YXIgaW1hZ2UgPSBuZXcgSW1hZ2UoKVxuICBpbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICBzZWxmLmxvYWQoaW1hZ2UsIG5vY29weSlcbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKClcbiAgfVxuICBpbWFnZS5zcmMgPSB1cmxcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gc2V0U2l6ZSh3aWR0aCwgaGVpZ2h0KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCB0YXJnZXQgaW1hZ2Ugc2l6ZS5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0U2l6ZSA9IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQpIHtcbiAgaWYgKHRoaXMudGFyZ2V0VW5pdCA9PT0gbnVsbCkge1xuICAgIHRoaXMud2lkdGggPSB0aGlzLmNhbnZhcy53aWR0aCA9IHdpZHRoXG4gICAgdGhpcy5oZWlnaHQgPSB0aGlzLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHRcbiAgICB0aGlzLnpvb20odGhpcy5fem9vbUxldmVsKVxuICB9IGVsc2Uge1xuICAgIHRoaXMudXNlVGV4dHVyZSh0aGlzLnRhcmdldFVuaXQsIG51bGwsIHdpZHRoLCBoZWlnaHQpXG4gIH1cblxuICB0aGlzLmdsLnZpZXdwb3J0KDAsIDAsIHdpZHRoLCBoZWlnaHQpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHNldFpvb20oem9vbUxldmVsKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCBjc3Mgc2l6ZSBvZiB0aGUgY2FudmFzIGFjY29yZGluZyB0byBhY3R1YWwgaW1hZ2Ugc2l6ZS4gVGhpcyBwZXJzaXN0cyBcbi8vIHRocm91Z2ggcmVzaXplcy5cbi8vXG4vLyBab29tIGxldmVsIGNhbiBiZSBhIG51bWJlcjogem9vbSByYXRpbywgb3IgJ2ZpdCc6IDEwMCUgcGFyZW50IHdpZHRoLCBvciBudWxsOiBcbi8vIG5vdCB6b29taW5nIG9uIHJlc2l6ZXMuXG4vL1xuR2xpbWcucHJvdG90eXBlLnNldFpvb20gPSBmdW5jdGlvbih6b29tTGV2ZWwpIHtcbiAgdGhpcy5fem9vbUxldmVsID0gem9vbUxldmVsXG4gIHRoaXMuem9vbSh6b29tTGV2ZWwpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHpvb20oem9vbUxldmVsKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFpvb20gdGhlIGNhbnZhcyBvbmNlLiBTZWUgJ3NldFpvb20nIGZvciBtb3JlIGRldGFpbHMuXG4vL1xuR2xpbWcucHJvdG90eXBlLnpvb20gPSBmdW5jdGlvbih6b29tTGV2ZWwpIHtcbiAgaWYgKHV0aWxzLmlzTm90aGluZyh6b29tTGV2ZWwpKSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfSBlbHNlIGlmICh6b29tTGV2ZWwgPT09ICdmaXQnKSB7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUud2lkdGggPSAnMTAwJSdcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS53aWR0aCA9ICcnICsgKHRoaXMud2lkdGggKiB6b29tTGV2ZWwpICsgJ3B4J1xuICB9XG4gIHRoaXMuY2FudmFzLnN0eWxlLmhlaWdodCA9ICdhdXRvJ1xuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIGFwcGx5KClcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBBcHBseSByZW5kZXJlZCByZXN1bHQgYmFjayB0byBzb3VyY2UgaW1hZ2UuXG4vL1xuR2xpbWcucHJvdG90eXBlLmFwcGx5ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2V0U291cmNlKHRoaXMuc291cmNlVW5pdCwgdGhpcylcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gY2xlYXIoW3JlZCwgZ3JlZW4sIGJsdWUsIGFscGhhXSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBDbGVhciBjYW52YXMgd2l0aCBzcGVjaWZpZWQgY29sb3IsIGRlZmF1bHQgKDAsIDAsIDAsIDApLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKHJlZCwgZ3JlZW4sIGJsdWUsIGFscGhhKSB7XG4gIHRoaXMuZ2wuY2xlYXJDb2xvcihyZWQgfHwgMCwgZ3JlZW4gfHwgMCwgYmx1ZSB8fCAwLCBhbHBoYSB8fCAwKVxuICB0aGlzLmdsLmNsZWFyKHRoaXMuZ2wuQ09MT1JfQlVGRkVSX0JJVClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gdG9EYXRhVXJsKFtmb3JtYXRdKVxuLy8gcmV0dXJucyBhIGJhc2U2NCB1cmwgU3RyaW5nXG4vL1xuLy8gU2F2ZSBpbWFnZSBkYXRhIHRvIGJhc2U2NCB1cmwuIEZvcm1hdCBjYW4gYmUgJ2pwZWcnIChkZWZhdWx0KSBvciAncG5nJy5cbi8vIFRoaXMgY2FuIGJlIHVzZWQgYXMgPGE+IGhyZWYgb3Igd2luZG93LmxvY2F0aW9uLlxuLy9cbkdsaW1nLnByb3RvdHlwZS50b0RhdGFVUkwgPSBmdW5jdGlvbihmb3JtYXQpIHtcbiAgZm9ybWF0ID0gZm9ybWF0IHx8ICdqcGVnJ1xuICByZXR1cm4gdGhpcy5jYW52YXMudG9EYXRhVVJMKCdpbWFnZS8nICsgZm9ybWF0KVxufVxuXG4vLyBkZXN0cm95KClcbi8vIHJldHVybnMgbm90aGluZ1xuLy9cbi8vIERlc3Ryb3kgdGhlIG9iamVjdCwgZnJlZSBhbGxvY2F0ZWQgbWVtb3JpZXMuXG4vL1xuR2xpbWcucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuZ2wpIHtcbiAgICB2YXIga2V5XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fYnVmZmVycykge1xuICAgICAgdGhpcy5fYnVmZmVyc1trZXldLmRlc3Ryb3koKVxuICAgIH1cblxuICAgIGZvciAoa2V5IGluIHRoaXMuX3RleHR1cmVzKSB7XG4gICAgICB0aGlzLl90ZXh0dXJlc1trZXldLmRlc3Ryb3koKVxuICAgIH1cblxuICAgIGZvciAoa2V5IGluIHRoaXMuX3NoYWRlcnMpIHtcbiAgICAgIHRoaXMuX3NoYWRlcnNba2V5XS5kZXN0cm95KClcbiAgICB9XG5cbiAgICB0aGlzLmNhbnZhcyA9IG51bGxcbiAgICB0aGlzLmdsID0gbnVsbFxuICAgIHRoaXMuX2J1ZmZlcnMgPSBudWxsXG4gICAgdGhpcy5fdGV4dHVyZXMgPSBudWxsXG4gICAgdGhpcy5fc2hhZGVycyA9IG51bGxcbiAgfVxufVxuXG5HbGltZy5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKHNvdXJjZUNvb3JkLCB0YXJnZXRDb29yZCkge1xuICB2YXIgcyA9IHNvdXJjZUNvb3JkIHx8IHtsZWZ0OiAwLCB0b3A6IDAsIHJpZ2h0IDogMSwgYm90dG9tOiAxfVxuICB2YXIgdCA9IHRhcmdldENvb3JkIHx8IHtsZWZ0OiAwLCB0b3A6IDAsIHJpZ2h0IDogMSwgYm90dG9tOiAxfVxuXG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuY29yZS5jb3B5KVxuICAuc2V0KCdhU291cmNlQ29vcmQnLCBzLmxlZnQsIHMudG9wLCBzLnJpZ2h0LCBzLmJvdHRvbSlcbiAgLnNldCgnYVRhcmdldENvb3JkJywgdC5sZWZ0LCB0LnRvcCwgdC5yaWdodCwgdC5ib3R0b20pXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIGNyb3AobGVmdCwgdG9wLCByaWdodCwgYm90dG9tKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIENyb3AgdGhlIGltYWdlLiBDb29yZGluYXRlcyBhcmUgaW4gcGVyY2VudGFnZSwgbm90IHBpeGVscy4gVGhleSBzaG91bGQgYmUgaW4gXG4vLyB0aGUgcmFuZ2Ugb2YgWzAsIDFdLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5jcm9wID0gZnVuY3Rpb24obGVmdCwgdG9wLCByaWdodCwgYm90dG9tKSB7XG4gIHZhciB3aWR0aCA9IChyaWdodCAtIGxlZnQpICogdGhpcy5fdGV4dHVyZXNbMF0ud2lkdGhcbiAgdmFyIGhlaWdodCA9IChib3R0b20gLSB0b3ApICogdGhpcy5fdGV4dHVyZXNbMF0uaGVpZ2h0XG5cbiAgdGhpcy5zZXRTaXplKHdpZHRoLCBoZWlnaHQpXG4gIC5jb3B5KHtsZWZ0OiBsZWZ0LCB0b3A6IHRvcCwgcmlnaHQ6IHJpZ2h0LCBib3R0b206IGJvdHRvbX0pXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLnJvdGF0ZSA9IGZ1bmN0aW9uKGRlZ3JlZSkge1xuICAvLyByb3RhdGlvbiBtYXRyaXhcbiAgdmFyIHRoZXRhID0gTWF0aC5QSSAvIDE4MCAqIGRlZ3JlZVxuICB2YXIgbWF0ID0gW01hdGguY29zKHRoZXRhKSwgLU1hdGguc2luKHRoZXRhKSwgTWF0aC5zaW4odGhldGEpLCBNYXRoLmNvcyh0aGV0YSldXG5cbiAgLy8gc291cmNlIGRpbWVuc2lvblxuICB2YXIgd2lkdGggPSB0aGlzLmdldFNvdXJjZSgpLndpZHRoXG4gIHZhciBoZWlnaHQgPSB0aGlzLmdldFNvdXJjZSgpLmhlaWdodFxuXG4gIC8vIG1heGltYWwgZml0dGluZyByZWN0YW5nbGVcbiAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy81Nzg5MjM5L2NhbGN1bGF0ZS1sYXJnZXN0LXJlY3RhbmdsZS1pbi1hLXJvdGF0ZWQtcmVjdGFuZ2xlXG4gIHZhciB3MCwgaDBcbiAgaWYgKHdpZHRoIDw9IGhlaWdodCkge1xuICAgIHcwID0gd2lkdGhcbiAgICBoMCA9IGhlaWdodFxuICB9IGVsc2Uge1xuICAgIHcwID0gaGVpZ2h0XG4gICAgaDAgPSB3aWR0aFxuICB9XG5cbiAgdmFyIGFscGhhID0gdGhldGEgLSBNYXRoLmZsb29yKCh0aGV0YSArIE1hdGguUEkpIC8gKDIgKiBNYXRoLlBJKSkgKiAoMiAqIE1hdGguUEkpXG4gIGFscGhhID0gTWF0aC5hYnMoYWxwaGEpXG4gIGlmIChhbHBoYSA+IE1hdGguUEkgLyAyKSBhbHBoYSA9IE1hdGguUEkgLSBhbHBoYVxuXG4gIHZhciBzaW5hID0gTWF0aC5zaW4oYWxwaGEpXG4gIHZhciBjb3NhID0gTWF0aC5jb3MoYWxwaGEpXG4gIHZhciB3MSA9IHcwICogY29zYSArIGgwICogc2luYVxuICB2YXIgaDEgPSB3MCAqIHNpbmEgKyBoMCAqIGNvc2FcbiAgdmFyIGMgPSBoMCAqIChzaW5hICogY29zYSkgLyAoMiAqIGgwICogKHNpbmEgKiBjb3NhKSArIHcwKVxuICB2YXIgeCA9IHcxICogY1xuICB2YXIgeSA9IGgxICogY1xuICB2YXIgdywgaFxuICBpZiAod2lkdGggPD0gaGVpZ2h0KSB7XG4gICAgdyA9IHcxIC0gMiAqIHhcbiAgICBoID0gaDEgLSAyICogeVxuICB9XG4gIGVsc2Uge1xuICAgIHcgPSBoMSAtIDIgKiB5XG4gICAgaCA9IHcxIC0gMiAqIHhcbiAgfVxuXG4gIC8vIGRpbWVuc2lvbiB0cmFuc2Zvcm1cbiAgdmFyIGwsIHQsIHIsIGI7XG4gIGwgPSAod2lkdGggLSB3KSAvICgyICogd2lkdGgpXG4gIHIgPSAod2lkdGggKyB3KSAvICgyICogd2lkdGgpXG4gIHQgPSAoaGVpZ2h0IC0gaCkgLyAoMiAqIGhlaWdodClcbiAgYiA9IChoZWlnaHQgKyBoKSAvICgyICogaGVpZ2h0KVxuXG4gIHRoaXMuc2V0U2l6ZSh3LCBoKVxuICAudXNlU2hhZGVyKHNoYWRlcnMuY29yZS50cmFuc2Zvcm0pXG4gIC5zZXRNYXRyaXgoJ3RyYW5zZm9ybScsIG1hdClcbiAgLnNldCgnYVNvdXJjZUNvb3JkJywgbCwgdCwgciwgYilcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmN1cnZlcyA9IGZ1bmN0aW9uKHBvaW50cykge1xuICBzcGxpbmUgPSBuZXcgU3BsaW5lKHBvaW50cylcblxuICB2YXIgbHV0ID0gW11cbiAgZm9yICh2YXIgeCA9IDA7IHggPD0gMjU1OyB4KyspIHtcbiAgICB2YXIgeSA9IHV0aWxzLmNsYW1wKE1hdGgucm91bmQoc3BsaW5lLmludGVycG9sYXRlKHggLyAyNTUpICogMjU1KSwgMCwgMjU1KVxuICAgIGx1dFt4XSA9IFt5LCB5LCB5LCAyNTVdXG4gIH1cblxuICB0aGlzLnVzZVRleHR1cmUodGhpcy5fdW5pdFsyXSwgdXRpbHMuZmxhdHRlbihsdXQpLCAyNTYsIDEpXG4gIC51c2VTaGFkZXIoc2hhZGVycy5jb3JlLmx1dClcbiAgLnNldCgnbHV0JywgdGhpcy5fdW5pdFsyXSwgbnVsbClcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmxldmVscyA9IGZ1bmN0aW9uKGJsYWNrLCBtaWRwb2ludCwgd2hpdGUpIHtcbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5hZGp1c3RtZW50cy5sZXZlbHMpXG4gIC5zZXQoJ2JsYWNrJywgYmxhY2spXG4gIC5zZXQoJ21pZHBvaW50JywgbWlkcG9pbnQpXG4gIC5zZXQoJ3doaXRlJywgd2hpdGUpXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5ibGVuZCA9IGZ1bmN0aW9uKG5vZGUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgdmFyIG1vZGUgPSB1dGlscy5jYW1lbENhc2Uob3B0aW9ucy5tb2RlIHx8ICdub3JtYWwnKVxuICB2YXIgb3BhY2l0eSA9IHV0aWxzLmlzTm90aGluZyhvcHRpb25zLm9wYWNpdHkpID8gMSA6IG9wdGlvbnMub3BhY2l0eVxuICB2YXIgY29vcmQgPSBvcHRpb25zLmNvb3JkIHx8IHtsZWZ0OiAwLCB0b3A6IDAsIHJpZ2h0OiAxLCBib3R0b206IDF9XG4gIHZhciBtYXNrID0gb3B0aW9ucy5tYXNrIHx8IFsyNTUsIDI1NSwgMjU1LCAyNTVdXG5cbiAgdmFyIGZvcmVncm91bmRVbml0LCBmb3JlZ3JvdW5kTm9kZSwgbWFza1VuaXQsIG1hc2tOb2RlXG5cbiAgaWYgKHV0aWxzLmlzTnVtYmVyKG5vZGUpKSB7XG4gICAgZm9yZWdyb3VuZFVuaXQgPSBub2RlXG4gICAgZm9yZWdyb3VuZE5vZGUgPSBudWxsXG4gIH0gZWxzZSB7XG4gICAgZm9yZWdyb3VuZFVuaXQgPSB0aGlzLl91bml0WzJdXG4gICAgZm9yZWdyb3VuZE5vZGUgPSBub2RlXG4gIH1cblxuICBpZiAodXRpbHMuaXNOdW1iZXIobWFzaykpIHtcbiAgICBtYXNrVW5pdCA9IG1hc2tcbiAgICBtYXNrTm9kZSA9IG51bGxcbiAgfSBlbHNlIHtcbiAgICBtYXNrVW5pdCA9IHRoaXMuX3VuaXRbM11cbiAgICBtYXNrTm9kZSA9IG1hc2tcbiAgfVxuXG4gIHRoaXMuX2hvbGRDaGFpbiA9IHRydWVcbiAgdGhpcy5jb3B5KClcbiAgdGhpcy5faG9sZENoYWluID0gZmFsc2VcblxuICB0aGlzLnVzZVNoYWRlcihzaGFkZXJzLmJsZW5kW21vZGVdKVxuICAuc2V0KCdhU291cmNlQ29vcmQnLCBjb29yZC5sZWZ0LCBjb29yZC50b3AsIGNvb3JkLnJpZ2h0LCBjb29yZC5ib3R0b20pXG4gIC5zZXQoJ2FUYXJnZXRDb29yZCcsIGNvb3JkLmxlZnQsIGNvb3JkLnRvcCwgY29vcmQucmlnaHQsIGNvb3JkLmJvdHRvbSlcbiAgLnNldCgnZm9yZWdyb3VuZCcsIGZvcmVncm91bmRVbml0LCBmb3JlZ3JvdW5kTm9kZSlcbiAgLnNldCgnb3BhY2l0eScsIG9wYWNpdHkpXG4gIC5zZXRUZXh0dXJlKCdtYXNrJywgbWFza1VuaXQsIG1hc2tOb2RlLCAxLCAxKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuYmx1ciA9IGZ1bmN0aW9uKHJhZGl1cykge1xuICBpZiAocmFkaXVzIDw9IDApIHJldHVybiB0aGlzXG4gIGlmIChyYWRpdXMgPD0gNCkgcmV0dXJuIHRoaXMuZ2F1c3NpYW5CbHVyKHJhZGl1cylcblxuICB2YXIgdyA9IHRoaXMuZ2V0U291cmNlKCkud2lkdGhcbiAgdmFyIGggPSB0aGlzLmdldFNvdXJjZSgpLmhlaWdodFxuICB2YXIgciA9IE1hdGguc3FydChyYWRpdXMpXG5cbiAgdGhpcy5jaGFpbigpXG4gIC5nYXVzc2lhbkJsdXIocilcbiAgLnNldFNpemUodyAvIHIsIGggLyByKVxuICAuY29weSgpXG4gIC5nYXVzc2lhbkJsdXIocilcbiAgLnNldFNpemUodywgaClcbiAgLmNvcHkoKVxuICAuZG9uZSgpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmdhdXNzaWFuQmx1ciA9IGZ1bmN0aW9uKHJhZGl1cykge1xuICBpZiAocmFkaXVzIDw9IDApIHJldHVybiB0aGlzXG5cbiAgdmFyIGdhdXNzaWFuID0gc2hhZGVycy5ibHVyLmdhdXNzaWFuMjU2XG4gIGZvciAodmFyIGkgPSAyOyBpIDwgMjU2OyBpICo9IDIpIHtcbiAgICBpZiAocmFkaXVzIDw9IGkpIHtcbiAgICAgIGdhdXNzaWFuID0gc2hhZGVycy5ibHVyWydnYXVzc2lhbicgKyBpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICB0aGlzLmNoYWluKClcbiAgLnVzZVNoYWRlcihnYXVzc2lhbilcbiAgLnNldCgnc2lnbWEnLCByYWRpdXMgLyAzKVxuICAuc2V0KCdheGlzJywgWzEsIDBdKVxuICAucnVuKClcbiAgLnVzZVNoYWRlcihnYXVzc2lhbilcbiAgLnNldCgnc2lnbWEnLCByYWRpdXMgLyAzKVxuICAuc2V0KCdheGlzJywgWzAsIDFdKVxuICAucnVuKClcbiAgLmRvbmUoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5icmlnaHRuZXNzQ29udHJhc3QgPSBmdW5jdGlvbihicmlnaHRuZXNzLCBjb250cmFzdCkge1xuICB2YXIgbWlkID0gMC41ICsgYnJpZ2h0bmVzcyAvIDI7XG4gIHZhciBzcGxpbmUgPSBuZXcgU3BsaW5lKFtbMCwgMF0sIFswLjUsIG1pZF0sIFsxLCAxXV0pXG5cbiAgdmFyIHNoYWRvdyA9IHNwbGluZS5pbnRlcnBvbGF0ZSgwLjI1KSAtIGNvbnRyYXN0IC8gNDtcbiAgdmFyIGhpZ2hsaWdodCA9IHNwbGluZS5pbnRlcnBvbGF0ZSgwLjc1KSArIGNvbnRyYXN0IC8gNDtcblxuICB0aGlzLmN1cnZlcyhbWzAsIDBdLCBbMC4yNSwgc2hhZG93XSwgWzAuNSwgbWlkXSwgWzAuNzUsIGhpZ2hsaWdodF0sIFsxLCAxXV0pXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLnJlY292ZXIgPSBmdW5jdGlvbihoaWdobGlnaHQsIHNoYWRvdywgcmFkaXVzKSB7XG4gIHJhZGl1cyA9IHJhZGl1cyB8fCA1XG5cbiAgdmFyIHNvdXJjZSA9IHRoaXMuc291cmNlVW5pdFxuICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXRVbml0XG5cbiAgdGhpcy5zZXRUYXJnZXQodGhpcy5fdW5pdFsyXSlcbiAgLmNvcHkoKVxuICAuc2V0U291cmNlKHRoaXMuX3VuaXRbMl0pLnNldFRhcmdldCh0aGlzLl91bml0WzNdKVxuICAuYmx1cihyYWRpdXMpXG4gIC5zZXRTb3VyY2UodGhpcy5fdW5pdFsyXSkuc2V0VGFyZ2V0KHRhcmdldClcbiAgLnVzZVNoYWRlcihzaGFkZXJzLmFkanVzdG1lbnRzLnJlY292ZXIpXG4gIC5zZXQoJ2hpZ2hsaWdodCcsIGhpZ2hsaWdodClcbiAgLnNldCgnc2hhZG93Jywgc2hhZG93KVxuICAuc2V0KCdiYWNrZ3JvdW5kJywgdGhpcy5fdW5pdFszXSwgbnVsbClcbiAgLnJ1bigpXG4gIC5zZXRTb3VyY2Uoc291cmNlKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5odWVTYXR1cmF0aW9uID0gZnVuY3Rpb24oaHVlLCBzYXR1cmF0aW9uLCBsaWdodG5lc3MpIHtcbiAgaHVlID0gaHVlIHx8IDBcbiAgc2F0dXJhdGlvbiA9IHNhdHVyYXRpb24gfHwgMFxuICBsaWdodG5lc3MgPSBsaWdodG5lc3MgfHwgMFxuXG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuYWRqdXN0bWVudHMuaHVlU2F0dXJhdGlvbilcbiAgLnNldCgnaHVlJywgaHVlKVxuICAuc2V0KCdzYXR1cmF0aW9uJywgc2F0dXJhdGlvbilcbiAgLnNldCgnbGlnaHRuZXNzJywgbGlnaHRuZXNzKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuc3BsaXRUb25lID0gZnVuY3Rpb24oaGlnaGxpZ2h0LCBzaGFkb3cpIHtcbiAgaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0IHx8IFswLjUsIDAuNSwgMC41XVxuICBzaGFkb3cgPSBzaGFkb3cgfHwgWzAuNSwgMC41LCAwLjVdXG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5lZmZlY3RzLnNwbGl0VG9uZSlcbiAgLnNldCgnaGlnaGxpZ2h0JywgaGlnaGxpZ2h0KVxuICAuc2V0KCdzaGFkb3cnLCBzaGFkb3cpXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5kdW90b25lID0gZnVuY3Rpb24oaGlnaGxpZ2h0LCBzaGFkb3cpIHtcbiAgaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0IHx8IFsxLCAxLCAxXVxuICBzaGFkb3cgPSBzaGFkb3cgfHwgWzEsIDEsIDFdXG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5lZmZlY3RzLmR1b3RvbmUpXG4gIC5zZXQoJ2hpZ2hsaWdodCcsIGhpZ2hsaWdodClcbiAgLnNldCgnc2hhZG93Jywgc2hhZG93KVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuc2hhcnBlbiA9IGZ1bmN0aW9uKHN0cmVuZ3RoLCByYWRpdXMpIHtcbiAgcmFkaXVzID0gcmFkaXVzIHx8IDVcblxuICB2YXIgc291cmNlID0gdGhpcy5zb3VyY2VVbml0XG4gIHZhciB0YXJnZXQgPSB0aGlzLnRhcmdldFVuaXRcblxuICB0aGlzLnNldFRhcmdldCh0aGlzLl91bml0WzJdKVxuICAuY29weSgpXG4gIC5zZXRTb3VyY2UodGhpcy5fdW5pdFsyXSkuc2V0VGFyZ2V0KHRoaXMuX3VuaXRbM10pXG4gIC5ibHVyKHJhZGl1cylcbiAgLnNldFNvdXJjZSh0aGlzLl91bml0WzJdKS5zZXRUYXJnZXQodGFyZ2V0KVxuICAudXNlU2hhZGVyKHNoYWRlcnMuZWZmZWN0cy5zaGFycGVuKVxuICAuc2V0KCdzdHJlbmd0aCcsIHN0cmVuZ3RoKVxuICAuc2V0KCdiYWNrZ3JvdW5kJywgdGhpcy5fdW5pdFszXSwgbnVsbClcbiAgLnJ1bigpXG4gIC5zZXRTb3VyY2Uoc291cmNlKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS52aWduZXR0ZSA9IGZ1bmN0aW9uKGRhcmtlbiwgYnJpZ2h0ZW4pIHtcbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5lZmZlY3RzLnZpZ25ldHRlKVxuICAuc2V0KCdkYXJrZW4nLCBkYXJrZW4pXG4gIC5zZXQoJ2JyaWdodGVuJywgYnJpZ2h0ZW4pXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHNldFN0YWdlKHNvdXJjZVVuaXQsIHRhcmdldFVuaXRbLCBub2RlXSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBTZXQgc291cmNlIHVuaXQgYW5kIHRhcmdldCB1bml0LCBhbmQgb3B0aW9uYWxseSBsb2FkIGltYWdlIGZyb20gbm9kZSB0byBcbi8vIHNvdXJjZSB1bml0LiBJdCByZXNpemVzIHRhcmdldCB1bml0IHRvIG1hdGNoIHNvdXJjZSB1bml0IGFmdGVyd2FyZHMuXG4vL1xuR2xpbWcucHJvdG90eXBlLnNldFN0YWdlID0gZnVuY3Rpb24oc291cmNlVW5pdCwgdGFyZ2V0VW5pdCwgbm9kZSkge1xuICB0aGlzLnNldFNvdXJjZShzb3VyY2VVbml0LCBub2RlKS5zZXRUYXJnZXQodGFyZ2V0VW5pdClcbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmNoYWluID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA+IDApIHtcbiAgICB0aGlzLl9jaGFpbi5jb3VudCArPSAxXG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fY2hhaW4gPSB7c291cmNlOiB0aGlzLnNvdXJjZVVuaXQsIHRhcmdldDogdGhpcy50YXJnZXRVbml0LCB1bml0OiAwLCBjb3VudDogMX1cbiAgICB0aGlzLnNldFRhcmdldCh0aGlzLl91bml0WzBdKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5kb25lID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA8PSAwKSByZXR1cm4gdGhpc1xuICB0aGlzLl9jaGFpbi5jb3VudCAtPSAxXG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA9PT0gMCkge1xuICAgIHRoaXMuc2V0VGFyZ2V0KHRoaXMuX2NoYWluLnRhcmdldCkuY29weSgpLnNldFNvdXJjZSh0aGlzLl9jaGFpbi5zb3VyY2UpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gZ2V0U291cmNlKClcbi8vIHJldHVybnMgY3VycmVudCBzb3VyY2UgaW1hZ2Vcbi8vXG5HbGltZy5wcm90b3R5cGUuZ2V0U291cmNlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl90ZXh0dXJlc1t0aGlzLnNvdXJjZVVuaXRdXG59XG5cbi8vIHNldFNvdXJjZSh1bml0Wywgbm9kZV0pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHNvdXJjZSB1bml0LCBhbmQgb3B0aW9uYWxseSBsb2FkIGltYWdlIGZyb20gbm9kZSB0byBzb3VyY2UgdW5pdC5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0U291cmNlID0gZnVuY3Rpb24odW5pdCwgbm9kZSkge1xuICB0aGlzLnNvdXJjZVVuaXQgPSB1bml0XG4gIGlmIChub2RlKSB0aGlzLnVzZVRleHR1cmUodW5pdCwgbm9kZSlcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gZ2V0VGFyZ2V0KClcbi8vIHJldHVybnMgY3VycmVudCB0YXJnZXQgaW1hZ2UsIG51bGwgaWYgdGFyZ2V0IGlzIHRoZSBjYW52YXNcbi8vXG5HbGltZy5wcm90b3R5cGUuZ2V0VGFyZ2V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl90ZXh0dXJlc1t0aGlzLnRhcmdldFVuaXRdXG59XG5cbi8vIHNldFRhcmdldCh1bml0KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCB0YXJnZXQgdW5pdC4gSXQgcmVzaXplcyB0YXJnZXQgdW5pdCB0byBtYXRjaCBzb3VyY2UgdW5pdCBhZnRlcndhcmRzLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRUYXJnZXQgPSBmdW5jdGlvbih1bml0KSB7XG4gIHRoaXMudGFyZ2V0VW5pdCA9IHVuaXRcblxuICBpZiAodXRpbHMuaXNOb3RoaW5nKHVuaXQpKSB7XG4gICAgdGhpcy5nbC5iaW5kRnJhbWVidWZmZXIodGhpcy5nbC5GUkFNRUJVRkZFUiwgbnVsbClcbiAgfVxuXG4gIHZhciBzb3VyY2UgPSB0aGlzLmdldFNvdXJjZSgpXG4gIGlmIChzb3VyY2UpIHRoaXMuc2V0U2l6ZShzb3VyY2Uud2lkdGgsIHNvdXJjZS5oZWlnaHQpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gdXNlU2hhZGVyKHNvdXJjZSlcbi8vIHJldHVybnMgYSBTaGFkZXIgb2JqZWN0XG4vL1xuLy8gQ3JlYXRlIGFuZCBjYWNoZSBhIFdlYkdMIHNoYWRlciBwcm9ncmFtIGZyb20gc291cmNlIGFuZCByZXR1cm4gaXQuIFVzZSBjYWNoZWQgXG4vLyBzaGFkZXIgaWYgcG9zc2libGUuXG4vL1xuLy8gVGhlIHNvdXJjZSBzaG91bGQgYmUgYSBmcmFnbWVudCBzaGFkZXIgYmFzZWQgb24gZ2xpbWcuc2hhZGVycy5jb3B5LiBJdCB3aWxsIFxuLy8gYmUgY29tcGlsZWQgYW5kIGxpbmtlZCB3aXRoIGdsaW1nLnNoYWRlcnMudmVydGV4LlxuLy9cbi8vIEdsaW1nIHNoYWRlcnMgYXJlIGxvYWRlZCBpbiBnbGltZy5zaGFkZXJzLCB0aGVpciBzb3VyY2UgZmlsZXMgYXJlIGxvY2F0ZWQgYXQgXG4vLyBzcmMvc2hhZGVycy4gVGFrZSBhIGxvb2sgYXQgdGhlIHNvdXJjZXMgdG8gc2VlIGhvdyB0aGV5IGFyZSBvcmdhbml6ZWQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnVzZVNoYWRlciA9IGZ1bmN0aW9uKHNvdXJjZSkge1xuICBpZiAoIXRoaXMuX3NoYWRlcnNbc291cmNlXSkge1xuICAgIHRoaXMuX3NoYWRlcnNbc291cmNlXSA9IG5ldyBTaGFkZXIodGhpcywgc291cmNlKVxuICB9XG5cbiAgdmFyIHRleHR1cmUgPSB0aGlzLmdldFNvdXJjZSgpXG4gIHRoaXMuX3NoYWRlcnNbc291cmNlXVxuICAudXNlKClcbiAgLnNldCgnYVNvdXJjZUNvb3JkJywgMCwgMCwgMSwgMSlcbiAgLnNldCgnYVRhcmdldENvb3JkJywgMCwgMCwgMSwgMSlcbiAgLnNldCgnYU1hc2tDb29yZCcsIDAsIDAsIDEsIDEpXG4gIC5zZXQoJ2ZsaXBZJywgdGhpcy50YXJnZXRVbml0ID09PSBudWxsID8gLTEgOiAxKVxuICAuc2V0KCdzb3VyY2UnLCB0aGlzLnNvdXJjZVVuaXQsIG51bGwpXG4gIC5zZXQoJ3NpemUnLCBbMSAvIHRleHR1cmUud2lkdGgsIDEgLyB0ZXh0dXJlLmhlaWdodCwgdGV4dHVyZS53aWR0aCwgdGV4dHVyZS5oZWlnaHRdKVxuXG4gIHJldHVybiB0aGlzLl9zaGFkZXJzW3NvdXJjZV1cbn1cblxuR2xpbWcucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuX2NoYWluLmNvdW50IDw9IDAgfHwgdGhpcy5faG9sZENoYWluKSByZXR1cm4gdGhpc1xuICB2YXIgdW5pdCA9IHRoaXMuX2NoYWluLnVuaXQgPT09IDAgPyAxIDogMFxuICB0aGlzLnNldFNvdXJjZSh0aGlzLnRhcmdldFVuaXQpLnNldFRhcmdldCh0aGlzLl91bml0W3VuaXRdKVxuICB0aGlzLl9jaGFpbi51bml0ID0gdW5pdFxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBwcml2YXRlXG4vLyB1c2VCdWZmZXIoYXJyYXkpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQ3JlYXRlIGFuZCBjYWNoZSBhIFdlYkdMIGJ1ZmZlciBmcm9tIGFycmF5LiBVc2UgY2FjaGVkIGJ1ZmZlciBpZiBwb3NzaWJsZS5cbi8vXG4vLyBUbyBjcmVhdGUvcGFzcyB2ZXJ0aWNlcyB0byBzaGFkZXIsIHVzZSBzaGFkZXIuc2V0KCkgaW5zdGVhZC5cbi8vXG5HbGltZy5wcm90b3R5cGUudXNlQnVmZmVyID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgaWYgKCF1dGlscy5pc0FycmF5KGFycmF5KSkgYXJyYXkgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgdmFyIGtleSA9IGFycmF5LmpvaW4oKVxuXG4gIGlmICghdGhpcy5fYnVmZmVyc1trZXldKSB7XG4gICAgdGhpcy5fYnVmZmVyc1trZXldID0gbmV3IEJ1ZmZlcih0aGlzLmdsLCBhcnJheSlcbiAgfVxuICB0aGlzLl9idWZmZXJzW2tleV0uYmluZCgpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gcHJpdmF0ZVxuLy8gdXNlVGV4dHVyZSh1bml0LCBub2RlKVxuLy8gdXNlVGV4dHVyZSh1bml0LCB3aWR0aCwgaGVpZ2h0KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIENyZWF0ZSBhbmQgY2FjaGUgYSBXZWJHTCB0ZXh0dXJlIHVuaXQgZnJvbSBub2RlLCBvciBjcmVhdGUgYSBmcmFtZWJ1ZmZlciBcbi8vIHRleHV0cmUgaWYgd2lkdGggYW5kIGhlaWdodCBhcmUgcHJvdmlkZWQuIFVzZSBjYWNoZWQgdGV4dHVyZSBpZiBwb3NzaWJsZS5cbi8vXG4vLyBUbyBjcmVhdGUvcGFzcyB0ZXh0dXJlcyB0byBzaGFkZXIsIHVzZSBzaGFkZXIuc2V0KCkgaW5zdGVhZC5cbi8vXG5HbGltZy5wcm90b3R5cGUudXNlVGV4dHVyZSA9IGZ1bmN0aW9uKHVuaXQsIG5vZGVPckRhdGEsIHdpZHRoLCBoZWlnaHQpIHtcbiAgdmFyIHRleHR1cmUgPSB0aGlzLl90ZXh0dXJlc1t1bml0XVxuICB2YXIgcmV1c2UgPSAhbm9kZU9yRGF0YSAmJiB0ZXh0dXJlICYmIHRleHR1cmUuZnJhbWVidWZmZXIgJiZcbiAgICAgICAgICAgICAgdGV4dHVyZS53aWR0aCA9PT0gd2lkdGggJiYgdGV4dHVyZS5oZWlnaHQgPT09IGhlaWdodFxuXG4gIGlmICghcmV1c2UpIHtcbiAgICBpZiAodGhpcy5fdGV4dHVyZXNbdW5pdF0pIHRoaXMuX3RleHR1cmVzW3VuaXRdLmRlc3Ryb3koKVxuICAgIHRoaXMuX3RleHR1cmVzW3VuaXRdID0gbmV3IFRleHR1cmUodGhpcy5nbCwgdW5pdCwgbm9kZU9yRGF0YSwgd2lkdGgsIGhlaWdodCwgdGhpcy5vcHRpb25zKVxuICB9XG5cbiAgdGhpcy5fdGV4dHVyZXNbdW5pdF0uYmluZCgpXG4gIHJldHVybiB0aGlzXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFNoYWRlclxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gU2hhZGVyKGdsaW1nLCBzb3VyY2UpIHtcbiAgdGhpcy5nbGltZyA9IGdsaW1nXG4gIHZhciBnbCA9IHRoaXMuZ2wgPSBnbGltZy5nbFxuICB2YXIgdmVydGV4ID0gcmVxdWlyZSgnLi9zaGFkZXJzJykuY29yZS52ZXJ0ZXhcbiAgdmFyIHZlcnRleFNoYWRlciA9IGNyZWF0ZVNoYWRlcihnbCwgZ2wuVkVSVEVYX1NIQURFUiwgdmVydGV4KVxuICB2YXIgZnJhZ21lbnRTaGFkZXIgPSBjcmVhdGVTaGFkZXIoZ2wsIGdsLkZSQUdNRU5UX1NIQURFUiwgc291cmNlKVxuICB2YXIgcHJvZ3JhbSA9IHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKVxuXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCBmcmFnbWVudFNoYWRlcilcbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSlcblxuICBnbC5kZWxldGVTaGFkZXIodmVydGV4U2hhZGVyKVxuICBnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpXG5cbiAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkgdGhyb3cgJ3NoYWRlciBsaW5rIGVycm9yJ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKVxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZnVuY1xuXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDIpIHtcbiAgICBpZiAodXRpbHMuaXNOdW1iZXIodmFsdWVzKSkge1xuICAgICAgZnVuYyA9ICdzZXRGbG9hdCdcbiAgICB9IGVsc2UgaWYgKHV0aWxzLmlzQXJyYXkodmFsdWVzKSkge1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPD0gNCB8fCB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkpIHtcbiAgICAgICAgZnVuYyA9ICdzZXRWZWN0b3InXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmdW5jID0gJ3NldE1hdHJpeCdcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAzKSB7XG4gICAgZnVuYyA9ICdzZXRUZXh0dXJlJ1xuICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gNSkge1xuICAgIGZ1bmMgPSAnc2V0UmVjdCdcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyAnaW52YWxpZCBhcmd1bWVudHMnXG4gIH1cblxuICByZXR1cm4gdGhpc1tmdW5jXS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cblNoYWRlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZHJhd0FycmF5cyh0aGlzLmdsLlRSSUFOR0xFX1NUUklQLCAwLCA0KVxuICB0aGlzLmdsaW1nLnN0ZXAoKVxuICByZXR1cm4gdGhpcy5nbGltZ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldEZsb2F0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGdsLnVuaWZvcm0xZihsb2NhdGlvbiwgdmFsdWUpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldFZlY3RvciA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgdmFyIG4gPSB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkgPyB2YWx1ZXNbMF0ubGVuZ3RoIDogdmFsdWVzLmxlbmd0aFxuICAgIHZhciBmdW5jID0gJ3VuaWZvcm0nICsgbiArICdmdidcbiAgICBnbFtmdW5jXShsb2NhdGlvbiwgdXRpbHMuZmxhdHRlbih2YWx1ZXMpKVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5zZXRNYXRyaXggPSBmdW5jdGlvbihuYW1lLCB2YWx1ZXMpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSA0KSB7XG4gICAgICBnbC51bmlmb3JtTWF0cml4MmZ2KGxvY2F0aW9uLCBmYWxzZSwgdmFsdWVzKVxuICAgIH0gZWxzZSBpZiAodmFsdWVzLmxlbmd0aCA9PT0gOSkge1xuICAgICAgZ2wudW5pZm9ybU1hdHJpeDNmdihsb2NhdGlvbiwgZmFsc2UsIHZhbHVlcylcbiAgICB9IGVsc2UgaWYgKHZhbHVlcy5sZW5ndGggPT09IDE2KSB7XG4gICAgICBnbC51bmlmb3JtTWF0cml4NGZ2KGxvY2F0aW9uLCBmYWxzZSwgdmFsdWVzKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0VGV4dHVyZSA9IGZ1bmN0aW9uKG5hbWUsIHVuaXQsIG5vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGlmIChub2RlKSB0aGlzLmdsaW1nLnVzZVRleHR1cmUodW5pdCwgbm9kZSwgd2lkdGgsIGhlaWdodClcbiAgICBnbC51bmlmb3JtMWkobG9jYXRpb24sIHVuaXQpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldFJlY3QgPSBmdW5jdGlvbihuYW1lLCBsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20pIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgdGhpcy5nbGltZy51c2VCdWZmZXIobGVmdCwgdG9wLCBsZWZ0LCBib3R0b20sIHJpZ2h0LCB0b3AsIHJpZ2h0LCBib3R0b20pXG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jYXRpb24pXG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2NhdGlvbiwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZGVsZXRlUHJvZ3JhbSh0aGlzLnByb2dyYW0pXG4gIHRoaXMucHJvZ3JhbSA9IG51bGxcbiAgdGhpcy5nbCA9IG51bGxcbiAgdGhpcy5nbGltZyA9IG51bGxcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2hhZGVyKGdsLCB0eXBlLCBzb3VyY2UpIHtcbiAgdmFyIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcih0eXBlKVxuICBnbC5zaGFkZXJTb3VyY2Uoc2hhZGVyLCBzb3VyY2UpXG4gIGdsLmNvbXBpbGVTaGFkZXIoc2hhZGVyKVxuICByZXR1cm4gc2hhZGVyXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgY29yZToge1xuICAgIHZlcnRleDogXCJhdHRyaWJ1dGUgdmVjMiBhU291cmNlQ29vcmQ7XFxuYXR0cmlidXRlIHZlYzIgYVRhcmdldENvb3JkO1xcbmF0dHJpYnV0ZSB2ZWMyIGFNYXNrQ29vcmQ7XFxudW5pZm9ybSBmbG9hdCBmbGlwWTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAgZ2xfUG9zaXRpb24gPSB2ZWM0KChhVGFyZ2V0Q29vcmQgKiAyLjAgLSAxLjApICogdmVjMigxLCBmbGlwWSksIDAuMCwgMS4wKTtcXG4gICBjb29yZCA9IGFTb3VyY2VDb29yZDtcXG4gICBtYXNrQ29vcmQgPSBhTWFza0Nvb3JkO1xcbn1cXG5cIixcbiAgICBjb3B5OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxufVxcblwiLFxuICAgIHRyYW5zZm9ybTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIG1hdDIgdHJhbnNmb3JtO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBmaXJzdCAtMC41IGlzIGFwcGxpZWQgdG8gY2VudGVyIGltYWdlXFxuICAvLyB0aGVuIHdpZHRoOmhlaWdodCByYXRpbyBpcyBhcHBsaWVkIHRvIGtlZXAgYXNwZWN0XFxuICAvLyB0aGVuIHRyYW5zZm9ybSBpcyBhcHBsaWVkXFxuICAvLyB0aGVuIHByZS10cmFuc2Zvcm1zIGFyZSByZXZlcnNlZFxcbiAgLy9cXG4gIHZlYzIgciA9IHZlYzIoc2l6ZS5wIC8gc2l6ZS5xLCAxLjApO1xcbiAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgdHJhbnNmb3JtICogKChjb29yZCAtIDAuNSkgKiByKSAvIHIgKyAwLjUpO1xcbn1cXG5cIixcbiAgICBsdXQ6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGx1dDtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG5cXG4gIHNyYy5yID0gdGV4dHVyZTJEKGx1dCwgdmVjMihzcmMuciwgMC4wKSkucjtcXG4gIHNyYy5nID0gdGV4dHVyZTJEKGx1dCwgdmVjMihzcmMuZywgMC4wKSkuZztcXG4gIHNyYy5iID0gdGV4dHVyZTJEKGx1dCwgdmVjMihzcmMuYiwgMC4wKSkuYjtcXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHNyYztcXG59XFxuXCJcbiAgfSxcbiAgYWRqdXN0bWVudHM6IHtcbiAgICBsZXZlbHM6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgYmxhY2s7XFxudW5pZm9ybSBmbG9hdCBtaWRwb2ludDtcXG51bmlmb3JtIGZsb2F0IHdoaXRlO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbmZsb2F0IGludGVycG9sYXRlKGZsb2F0IHZhbHVlKSB7XFxuICByZXR1cm4gKHZhbHVlIC0gYmxhY2spIC8gKHdoaXRlIC0gYmxhY2spO1xcbn1cXG5cXG52ZWMzIGludGVycG9sYXRlKHZlYzMgdmFsdWUpIHtcXG4gIHJldHVybiAodmFsdWUgLSBibGFjaykgLyAod2hpdGUgLSBibGFjayk7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgdmVjMyBzdHJlY2hlZCA9IGludGVycG9sYXRlKHNyYy5yZ2IpO1xcbiAgZmxvYXQgbSA9IGludGVycG9sYXRlKG1pZHBvaW50KTtcXG4gIGZsb2F0IGdhbW1hID0gbG9nKDAuNSkgLyBsb2cobSk7XFxuICBzcmMucmdiID0gcG93KHN0cmVjaGVkLCB2ZWMzKGdhbW1hLCBnYW1tYSwgZ2FtbWEpKTtcXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHNyYztcXG59XFxuXCIsXG4gICAgcmVjb3ZlcjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgYmFja2dyb3VuZDtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IGhpZ2hsaWdodDtcXG51bmlmb3JtIGZsb2F0IHNoYWRvdztcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG5jb25zdCBmbG9hdCBlID0gMTBlLTEwO1xcblxcbmZsb2F0IGx1bWEodmVjMyBjKSB7XFxuICByZXR1cm4gMC4yOTkgKiBjLnIgKyAwLjU4NyAqIGMuZyArIDAuMTE0ICogYy5iO1xcbn1cXG5cXG52ZWMzIHNvZnRsaWdodCh2ZWMzIHNyYywgdmVjMyBkc3QpIHtcXG4gIHZlYzMgY29sb3I7XFxuICBjb2xvci5yID0gc3JjLnIgPCAwLjUgPyAyLjAgKiBzcmMuciAqIGRzdC5yICsgZHN0LnIgKiBkc3QuciAqICgxLjAgLSAyLjAgKiBzcmMucilcXG4gICAgOiBzcXJ0KGRzdC5yKSAqICgyLjAgKiBzcmMuciAtIDEuMCkgKyAyLjAgKiBkc3QuciAqICgxLjAgLSBzcmMucik7XFxuICBjb2xvci5nID0gc3JjLmcgPCAwLjUgPyAyLjAgKiBzcmMuZyAqIGRzdC5nICsgZHN0LmcgKiBkc3QuZyAqICgxLjAgLSAyLjAgKiBzcmMuZylcXG4gICAgOiBzcXJ0KGRzdC5nKSAqICgyLjAgKiBzcmMuZyAtIDEuMCkgKyAyLjAgKiBkc3QuZyAqICgxLjAgLSBzcmMuZyk7XFxuICBjb2xvci5iID0gc3JjLmIgPCAwLjUgPyAyLjAgKiBzcmMuYiAqIGRzdC5iICsgZHN0LmIgKiBkc3QuYiAqICgxLjAgLSAyLjAgKiBzcmMuYilcXG4gICAgOiBzcXJ0KGRzdC5iKSAqICgyLjAgKiBzcmMuYiAtIDEuMCkgKyAyLjAgKiBkc3QuYiAqICgxLjAgLSBzcmMuYik7XFxuICByZXR1cm4gY29sb3I7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgZmxvYXQgaW52bCA9IDEuMCAtIGx1bWEodGV4dHVyZTJEKGJhY2tncm91bmQsIGNvb3JkKS5yZ2IpO1xcbiAgdmVjMyBibGVuZCA9IHNvZnRsaWdodCh2ZWMzKGludmwsIGludmwsIGludmwpLCBzcmMucmdiKTtcXG5cXG4gIHNyYy5yZ2IgKz0gY2xhbXAoYmxlbmQgLSBzcmMucmdiLCAtMS4wLCAwLjApICogaGlnaGxpZ2h0ICtcXG4gICAgY2xhbXAoYmxlbmQgLSBzcmMucmdiLCAwLjAsIDEuMCkgKiBzaGFkb3c7XFxuICBnbF9GcmFnQ29sb3IgPSBzcmM7XFxufVxcblwiLFxuICAgIGh1ZVNhdHVyYXRpb246IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgaHVlO1xcbnVuaWZvcm0gZmxvYXQgc2F0dXJhdGlvbjtcXG51bmlmb3JtIGZsb2F0IGxpZ2h0bmVzcztcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52ZWMzIHJnYjJoY2wodmVjMyBjKSB7XFxuICB2ZWM0IHAgPSBjLnIgPiBjLmcgPyB2ZWM0KGMucmdiLCAwLjApIDogdmVjNChjLmdiciwgMi4wKTtcXG4gIHZlYzQgcSA9IGMuYiA+IHAueCA/IHZlYzQoYy5icmcsIDQuMCkgOiBwO1xcblxcbiAgZmxvYXQgTSA9IHEueDtcXG4gIGZsb2F0IG0gPSBtaW4ocS55LCBxLnopO1xcbiAgZmxvYXQgQyA9IE0gLSBtO1xcblxcbiAgZmxvYXQgSCA9IEMgPT0gMC4wID8gMC4wIDogbW9kKChxLnkgLSBxLnopIC8gQyArIHEudywgNi4wKTtcXG4gIGZsb2F0IEwgPSAwLjUgKiAoTSArIG0pO1xcblxcbiAgcmV0dXJuIHZlYzMoSCwgQywgTCk7XFxufVxcblxcbnZlYzMgaGNsMnJnYih2ZWMzIGMpIHtcXG4gIGZsb2F0IEggPSBjLng7XFxuXFxuICBmbG9hdCBSID0gYWJzKEggLSAzLjApIC0gMS4wO1xcbiAgZmxvYXQgRyA9IDIuMCAtIGFicyhIIC0gMi4wKTtcXG4gIGZsb2F0IEIgPSAyLjAgLSBhYnMoSCAtIDQuMCk7XFxuICB2ZWMzIHJnYiA9IGNsYW1wKHZlYzMoUiwgRywgQiksIDAuMCwgMS4wKTtcXG5cXG4gIHJldHVybiAocmdiIC0gMC41KSAqIGMueSArIGMuejtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woc3JjLnJnYik7XFxuICBoY2wueCA9IG1vZChoY2wueCArIGh1ZSAqIDYuMCwgNi4wKTtcXG4gIGhjbC55ICo9IHNhdHVyYXRpb247XFxuICBoY2wueiArPSBsaWdodG5lc3M7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGhjbDJyZ2IoaGNsKSwgc3JjLmEpO1xcbn1cXG5cIlxuICB9LFxuICBibGVuZDoge1xuICAgIG5vcm1hbDogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBzcmM7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBtdWx0aXBseTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBzcmMgKiBkc3Q7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBzY3JlZW46IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kID0gMS4wIC0gKDEuMCAtIHNyYykgKiAoMS4wIC0gZHN0KTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIG92ZXJsYXk6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kLnIgPSBkc3QuciA8IDAuNSA/IDIuMCAqIHNyYy5yICogZHN0LnIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLnIpICogKDEuMCAtIGRzdC5yKTtcXG4gIGJsZW5kLmcgPSBkc3QuZyA8IDAuNSA/IDIuMCAqIHNyYy5nICogZHN0LmcgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmcpICogKDEuMCAtIGRzdC5nKTtcXG4gIGJsZW5kLmIgPSBkc3QuYiA8IDAuNSA/IDIuMCAqIHNyYy5iICogZHN0LmIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmIpICogKDEuMCAtIGRzdC5iKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGRhcmtlbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBtaW4oc3JjLCBkc3QpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgbGlnaHRlbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBtYXgoc3JjLCBkc3QpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgY29sb3JEb2RnZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQuciA9IHNyYy5yID09IDEuMCA/IDEuMCA6IGRzdC5yIC8gKDEuMCAtIHNyYy5yKTtcXG4gIGJsZW5kLmcgPSBzcmMuZyA9PSAxLjAgPyAxLjAgOiBkc3QuZyAvICgxLjAgLSBzcmMuZyk7XFxuICBibGVuZC5iID0gc3JjLmIgPT0gMS4wID8gMS4wIDogZHN0LmIgLyAoMS4wIC0gc3JjLmIpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgY29sb3JCdXJuOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZC5yID0gc3JjLnIgPT0gMC4wID8gMC4wIDogMS4wIC0gKDEuMCAtIGRzdC5yKSAvIHNyYy5yO1xcbiAgYmxlbmQuZyA9IHNyYy5nID09IDAuMCA/IDAuMCA6IDEuMCAtICgxLjAgLSBkc3QuZykgLyBzcmMuZztcXG4gIGJsZW5kLmIgPSBzcmMuYiA9PSAwLjAgPyAwLjAgOiAxLjAgLSAoMS4wIC0gZHN0LmIpIC8gc3JjLmI7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBoYXJkTGlnaHQ6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kLnIgPSBzcmMuciA8IDAuNSA/IDIuMCAqIHNyYy5yICogZHN0LnIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLnIpICogKDEuMCAtIGRzdC5yKTtcXG4gIGJsZW5kLmcgPSBzcmMuZyA8IDAuNSA/IDIuMCAqIHNyYy5nICogZHN0LmcgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmcpICogKDEuMCAtIGRzdC5nKTtcXG4gIGJsZW5kLmIgPSBzcmMuYiA8IDAuNSA/IDIuMCAqIHNyYy5iICogZHN0LmIgOiAxLjAgLSAyLjAgKiAoMS4wIC0gc3JjLmIpICogKDEuMCAtIGRzdC5iKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIHNvZnRMaWdodDogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQuciA9IHNyYy5yIDwgMC41ID8gMi4wICogc3JjLnIgKiBkc3QuciArIGRzdC5yICogZHN0LnIgKiAoMS4wIC0gMi4wICogc3JjLnIpXFxuICAgIDogc3FydChkc3QucikgKiAoMi4wICogc3JjLnIgLSAxLjApICsgMi4wICogZHN0LnIgKiAoMS4wIC0gc3JjLnIpO1xcbiAgYmxlbmQuZyA9IHNyYy5nIDwgMC41ID8gMi4wICogc3JjLmcgKiBkc3QuZyArIGRzdC5nICogZHN0LmcgKiAoMS4wIC0gMi4wICogc3JjLmcpXFxuICAgIDogc3FydChkc3QuZykgKiAoMi4wICogc3JjLmcgLSAxLjApICsgMi4wICogZHN0LmcgKiAoMS4wIC0gc3JjLmcpO1xcbiAgYmxlbmQuYiA9IHNyYy5iIDwgMC41ID8gMi4wICogc3JjLmIgKiBkc3QuYiArIGRzdC5iICogZHN0LmIgKiAoMS4wIC0gMi4wICogc3JjLmIpXFxuICAgIDogc3FydChkc3QuYikgKiAoMi4wICogc3JjLmIgLSAxLjApICsgMi4wICogZHN0LmIgKiAoMS4wIC0gc3JjLmIpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgZGlmZmVyZW5jZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBhYnMoZHN0IC0gc3JjKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGV4Y2x1c2lvbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBzcmMgKyBkc3QgLSAyLjAgKiBzcmMgKiBkc3Q7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBodWU6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woZHN0LnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMocmdiMmhjbChzcmMucmdiKS54LCBoY2wueSwgaGNsLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIHNhdHVyYXRpb246IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woZHN0LnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMoaGNsLngsIHJnYjJoY2woc3JjLnJnYikueSwgaGNsLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGNvbG9yOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZlYzMgcmdiMmhjbCh2ZWMzIGMpIHtcXG4gIHZlYzQgcCA9IGMuciA+IGMuZyA/IHZlYzQoYy5yZ2IsIDAuMCkgOiB2ZWM0KGMuZ2JyLCAyLjApO1xcbiAgdmVjNCBxID0gYy5iID4gcC54ID8gdmVjNChjLmJyZywgNC4wKSA6IHA7XFxuXFxuICBmbG9hdCBNID0gcS54O1xcbiAgZmxvYXQgbSA9IG1pbihxLnksIHEueik7XFxuICBmbG9hdCBDID0gTSAtIG07XFxuXFxuICBmbG9hdCBIID0gQyA9PSAwLjAgPyAwLjAgOiBtb2QoKHEueSAtIHEueikgLyBDICsgcS53LCA2LjApO1xcbiAgZmxvYXQgTCA9IDAuNSAqIChNICsgbSk7XFxuXFxuICByZXR1cm4gdmVjMyhILCBDLCBMKTtcXG59XFxuXFxudmVjMyBoY2wycmdiKHZlYzMgYykge1xcbiAgZmxvYXQgSCA9IGMueDtcXG5cXG4gIGZsb2F0IFIgPSBhYnMoSCAtIDMuMCkgLSAxLjA7XFxuICBmbG9hdCBHID0gMi4wIC0gYWJzKEggLSAyLjApO1xcbiAgZmxvYXQgQiA9IDIuMCAtIGFicyhIIC0gNC4wKTtcXG4gIHZlYzMgcmdiID0gY2xhbXAodmVjMyhSLCBHLCBCKSwgMC4wLCAxLjApO1xcblxcbiAgcmV0dXJuIChyZ2IgLSAwLjUpICogYy55ICsgYy56O1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgdmVjMyBoY2wgPSByZ2IyaGNsKHNyYy5yZ2IpO1xcbiAgYmxlbmQucmdiID0gaGNsMnJnYih2ZWMzKGhjbC54LCBoY2wueSwgcmdiMmhjbChkc3QucmdiKS56KSk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBsdW1pbm9zaXR5OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZlYzMgcmdiMmhjbCh2ZWMzIGMpIHtcXG4gIHZlYzQgcCA9IGMuciA+IGMuZyA/IHZlYzQoYy5yZ2IsIDAuMCkgOiB2ZWM0KGMuZ2JyLCAyLjApO1xcbiAgdmVjNCBxID0gYy5iID4gcC54ID8gdmVjNChjLmJyZywgNC4wKSA6IHA7XFxuXFxuICBmbG9hdCBNID0gcS54O1xcbiAgZmxvYXQgbSA9IG1pbihxLnksIHEueik7XFxuICBmbG9hdCBDID0gTSAtIG07XFxuXFxuICBmbG9hdCBIID0gQyA9PSAwLjAgPyAwLjAgOiBtb2QoKHEueSAtIHEueikgLyBDICsgcS53LCA2LjApO1xcbiAgZmxvYXQgTCA9IDAuNSAqIChNICsgbSk7XFxuXFxuICByZXR1cm4gdmVjMyhILCBDLCBMKTtcXG59XFxuXFxudmVjMyBoY2wycmdiKHZlYzMgYykge1xcbiAgZmxvYXQgSCA9IGMueDtcXG5cXG4gIGZsb2F0IFIgPSBhYnMoSCAtIDMuMCkgLSAxLjA7XFxuICBmbG9hdCBHID0gMi4wIC0gYWJzKEggLSAyLjApO1xcbiAgZmxvYXQgQiA9IDIuMCAtIGFicyhIIC0gNC4wKTtcXG4gIHZlYzMgcmdiID0gY2xhbXAodmVjMyhSLCBHLCBCKSwgMC4wLCAxLjApO1xcblxcbiAgcmV0dXJuIChyZ2IgLSAwLjUpICogYy55ICsgYy56O1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgdmVjMyBoY2wgPSByZ2IyaGNsKGRzdC5yZ2IpO1xcbiAgYmxlbmQucmdiID0gaGNsMnJnYih2ZWMzKGhjbC54LCBoY2wueSwgcmdiMmhjbChzcmMucmdiKS56KSk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIlxuICB9LFxuICBibHVyOiB7XG4gICAgZ2F1c3NpYW4yOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAyLjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgICBnYXVzc2lhbjQ6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDQuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICAgIGdhdXNzaWFuODogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gOC4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW4xNjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gMTYuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICAgIGdhdXNzaWFuMzI6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDMyLjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgICBnYXVzc2lhbjY0OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSA2NC4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW4xMjg6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDEyOC4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW4yNTY6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDI1Ni4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCJcbiAgfSxcbiAgZWZmZWN0czoge1xuICAgIHNwbGl0VG9uZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSB2ZWMzIGhpZ2hsaWdodDtcXG51bmlmb3JtIHZlYzMgc2hhZG93O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbmNvbnN0IGZsb2F0IGUgPSAxMGUtMTA7XFxuXFxudmVjMyBzb2Z0bGlnaHQodmVjMyBzcmMsIHZlYzMgZHN0KSB7XFxuICB2ZWMzIGNvbG9yO1xcbiAgY29sb3IuciA9IHNyYy5yIDwgMC41ID8gMi4wICogc3JjLnIgKiBkc3QuciArIGRzdC5yICogZHN0LnIgKiAoMS4wIC0gMi4wICogc3JjLnIpXFxuICAgIDogc3FydChkc3QucikgKiAoMi4wICogc3JjLnIgLSAxLjApICsgMi4wICogZHN0LnIgKiAoMS4wIC0gc3JjLnIpO1xcbiAgY29sb3IuZyA9IHNyYy5nIDwgMC41ID8gMi4wICogc3JjLmcgKiBkc3QuZyArIGRzdC5nICogZHN0LmcgKiAoMS4wIC0gMi4wICogc3JjLmcpXFxuICAgIDogc3FydChkc3QuZykgKiAoMi4wICogc3JjLmcgLSAxLjApICsgMi4wICogZHN0LmcgKiAoMS4wIC0gc3JjLmcpO1xcbiAgY29sb3IuYiA9IHNyYy5iIDwgMC41ID8gMi4wICogc3JjLmIgKiBkc3QuYiArIGRzdC5iICogZHN0LmIgKiAoMS4wIC0gMi4wICogc3JjLmIpXFxuICAgIDogc3FydChkc3QuYikgKiAoMi4wICogc3JjLmIgLSAxLjApICsgMi4wICogZHN0LmIgKiAoMS4wIC0gc3JjLmIpO1xcbiAgcmV0dXJuIGNvbG9yO1xcbn1cXG5cXG5mbG9hdCBsdW1hKHZlYzMgYykge1xcbiAgcmV0dXJuIDAuMjk5ICogYy5yICsgMC41ODcgKiBjLmcgKyAwLjExNCAqIGMuYjtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICAvLyBjYXN0IHNvZnQgbGlnaHQgdXNpbmcgaGlnaGxpZ2h0IGFuZCBzaGFkb3dcXG4gIHZlYzMgaCA9IHNvZnRsaWdodChoaWdobGlnaHQsIHNyYy5yZ2IpO1xcbiAgdmVjMyBzID0gc29mdGxpZ2h0KHNoYWRvdywgc3JjLnJnYik7XFxuXFxuICAvLyBibGVuZCBiYXNlZCBvbiBsdW1pbmFuY2VcXG4gIGZsb2F0IGwgPSBsdW1hKHNyYy5yZ2IpO1xcbiAgdmVjMyBjID0gaCAqIGwgKyBzICogKDEuMCAtIGwpO1xcbiAgYyA9IGMgLyAobHVtYShjKSArIGUpICogbDtcXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHZlYzQoYywgc3JjLmEpO1xcbn1cXG5cIixcbiAgICBkdW90b25lOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIHZlYzMgaGlnaGxpZ2h0O1xcbnVuaWZvcm0gdmVjMyBzaGFkb3c7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxuY29uc3QgZmxvYXQgZSA9IDEwZS0xMDtcXG5cXG5mbG9hdCBsdW1hKHZlYzMgYykge1xcbiAgcmV0dXJuIDAuMjk5ICogYy5yICsgMC41ODcgKiBjLmcgKyAwLjExNCAqIGMuYjtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICBmbG9hdCBsID0gbHVtYShzcmMucmdiKTtcXG5cXG4gIC8vIGhpZ2hsaWdodCBhbmQgc2hhZG93IGNvbG9yIG5vcm1hbGl6ZWQgdG8gc2FtZSBsdW1pbmFuY2VcXG4gIHZlYzMgaCA9IChoaWdobGlnaHQgKyBlKSAvIChsdW1hKGhpZ2hsaWdodCkgKyBlKSAqIGw7XFxuICB2ZWMzIHMgPSAoc2hhZG93ICsgZSkgLyAobHVtYShzaGFkb3cpICsgZSkgKiBsO1xcblxcbiAgLy8gYmxlbmQgYmFzZWQgb24gbHVtaW5hbmNlXFxuICB2ZWMzIGMgPSBoICogbCArIHMgKiAoMS4wIC0gbCk7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGMsIHNyYy5hKTtcXG59XFxuXCIsXG4gICAgc2hhcnBlbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHN0cmVuZ3RoO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBiYWNrZ3JvdW5kO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbmNvbnN0IGZsb2F0IGUgPSAxMGUtMTA7XFxuXFxuZmxvYXQgbHVtYSh2ZWMzIGMpIHtcXG4gIHJldHVybiAwLjI5OSAqIGMuciArIDAuNTg3ICogYy5nICsgMC4xMTQgKiBjLmI7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgZmxvYXQgbHNyYyA9IGx1bWEoc3JjLnJnYik7XFxuICBmbG9hdCBsID0gbHVtYSh0ZXh0dXJlMkQoYmFja2dyb3VuZCwgY29vcmQpLnJnYik7XFxuXFxuICBzcmMucmdiICo9ICgobHNyYyAtIGwpICogc3RyZW5ndGggKyBsKSAvIChsc3JjICsgZSk7XFxuICBnbF9GcmFnQ29sb3IgPSBzcmM7XFxufVxcblwiLFxuICAgIHZpZ25ldHRlOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IGRhcmtlbjtcXG51bmlmb3JtIGZsb2F0IGJyaWdodGVuO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbmNvbnN0IGZsb2F0IGUgPSAxMGUtMTA7XFxuXFxuZmxvYXQgbHVtYSh2ZWMzIGMpIHtcXG4gIHJldHVybiAwLjI5OSAqIGMuciArIDAuNTg3ICogYy5nICsgMC4xMTQgKiBjLmI7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgLy8gZGlzdGFuY2UgdG8gZWFjaCBib3JkZXJcXG4gIGZsb2F0IGEgPSBjb29yZC54IDwgMC41ID8gY29vcmQueCA6IDEuMCAtIGNvb3JkLng7XFxuICBmbG9hdCBiID0gY29vcmQueSA8IDAuNSA/IGNvb3JkLnkgOiAxLjAgLSBjb29yZC55O1xcblxcbiAgLy8gbHAgbm9ybSB1c2VkIGFzIGRpc3RhbmNlLCAwLjIgc2VlbXMgdG8gYmUgYSBuaWNlIHZhbHVlIGZvciBwXFxuICBmbG9hdCBwID0gMC4yO1xcbiAgZmxvYXQgZCA9IHBvdyhhLCBwKSArIHBvdyhiLCBwKTtcXG4gIGZsb2F0IGRtYXggPSAyLjAgKiBwb3coMC41LCBwKTtcXG5cXG4gIC8vIGJyaWdodGVuIG92ZXJhbGwsIHRoZW4gZGFya2VuIGJhc2VkIG9uIGxwIGRpc3RhbmNlXFxuICBmbG9hdCBsID0gbHVtYShzcmMucmdiKTtcXG4gIHNyYy5yZ2IgKj0gKGwgKyBicmlnaHRlbiAtIGRhcmtlbiAqICgxLjAgLSBkIC8gZG1heCkpIC8gKGwgKyBlKTtcXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHNyYztcXG59XFxuXCJcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBTcGxpbmVcblxuLy8gdGFrZW4gZGlyZWN0bHkgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vZXZhbncvZ2xmeC5qc1xuLy8gaW4gdHVybiBmcm9tIFNwbGluZUludGVycG9sYXRvci5jcyBpbiB0aGUgUGFpbnQuTkVUIHNvdXJjZSBjb2RlXG5cbmZ1bmN0aW9uIFNwbGluZShwb2ludHMpIHtcbiAgdmFyIG4gPSBwb2ludHMubGVuZ3RoXG4gIHRoaXMueGEgPSBbXVxuICB0aGlzLnlhID0gW11cbiAgdGhpcy51ID0gW11cbiAgdGhpcy55MiA9IFtdXG5cbiAgcG9pbnRzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBhWzBdIC0gYlswXVxuICB9KVxuICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xuICAgIHRoaXMueGEucHVzaChwb2ludHNbaV1bMF0pXG4gICAgdGhpcy55YS5wdXNoKHBvaW50c1tpXVsxXSlcbiAgfVxuXG4gIHRoaXMudVswXSA9IDBcbiAgdGhpcy55MlswXSA9IDBcblxuICBmb3IgKHZhciBpID0gMTsgaSA8IG4gLSAxOyArK2kpIHtcbiAgICAvLyBUaGlzIGlzIHRoZSBkZWNvbXBvc2l0aW9uIGxvb3Agb2YgdGhlIHRyaWRpYWdvbmFsIGFsZ29yaXRobS4gXG4gICAgLy8geTIgYW5kIHUgYXJlIHVzZWQgZm9yIHRlbXBvcmFyeSBzdG9yYWdlIG9mIHRoZSBkZWNvbXBvc2VkIGZhY3RvcnMuXG4gICAgdmFyIHd4ID0gdGhpcy54YVtpICsgMV0gLSB0aGlzLnhhW2kgLSAxXVxuICAgIHZhciBzaWcgPSAodGhpcy54YVtpXSAtIHRoaXMueGFbaSAtIDFdKSAvIHd4XG4gICAgdmFyIHAgPSBzaWcgKiB0aGlzLnkyW2kgLSAxXSArIDIuMFxuXG4gICAgdGhpcy55MltpXSA9IChzaWcgLSAxLjApIC8gcFxuXG4gICAgdmFyIGRkeWR4ID0gXG4gICAgKHRoaXMueWFbaSArIDFdIC0gdGhpcy55YVtpXSkgLyAodGhpcy54YVtpICsgMV0gLSB0aGlzLnhhW2ldKSAtXG4gICAgKHRoaXMueWFbaV0gLSB0aGlzLnlhW2kgLSAxXSkgLyAodGhpcy54YVtpXSAtIHRoaXMueGFbaSAtIDFdKVxuXG4gICAgdGhpcy51W2ldID0gKDYuMCAqIGRkeWR4IC9cbiAgICAgIHd4IC0gc2lnICogdGhpcy51W2kgLSAxXSkgLyBwXG4gIH1cblxuICB0aGlzLnkyW24gLSAxXSA9IDBcblxuICAvLyBUaGlzIGlzIHRoZSBiYWNrc3Vic3RpdHV0aW9uIGxvb3Agb2YgdGhlIHRyaWRpYWdvbmFsIGFsZ29yaXRobVxuICBmb3IgKHZhciBpID0gbiAtIDI7IGkgPj0gMDsgLS1pKSB7XG4gICAgdGhpcy55MltpXSA9IHRoaXMueTJbaV0gKiB0aGlzLnkyW2kgKyAxXSArIHRoaXMudVtpXVxuICB9XG59XG5cblNwbGluZS5wcm90b3R5cGUuaW50ZXJwb2xhdGUgPSBmdW5jdGlvbih4KSB7XG4gIHZhciBuID0gdGhpcy55YS5sZW5ndGhcbiAgdmFyIGtsbyA9IDBcbiAgdmFyIGtoaSA9IG4gLSAxXG5cbiAgLy8gV2Ugd2lsbCBmaW5kIHRoZSByaWdodCBwbGFjZSBpbiB0aGUgdGFibGUgYnkgbWVhbnMgb2ZcbiAgLy8gYmlzZWN0aW9uLiBUaGlzIGlzIG9wdGltYWwgaWYgc2VxdWVudGlhbCBjYWxscyB0byB0aGlzXG4gIC8vIHJvdXRpbmUgYXJlIGF0IHJhbmRvbSB2YWx1ZXMgb2YgeC4gSWYgc2VxdWVudGlhbCBjYWxsc1xuICAvLyBhcmUgaW4gb3JkZXIsIGFuZCBjbG9zZWx5IHNwYWNlZCwgb25lIHdvdWxkIGRvIGJldHRlclxuICAvLyB0byBzdG9yZSBwcmV2aW91cyB2YWx1ZXMgb2Yga2xvIGFuZCBraGkuXG4gIHdoaWxlIChraGkgLSBrbG8gPiAxKSB7XG4gICAgdmFyIGsgPSAoa2hpICsga2xvKSA+PiAxXG5cbiAgICBpZiAodGhpcy54YVtrXSA+IHgpIHtcbiAgICAgIGtoaSA9IGtcbiAgICB9IGVsc2Uge1xuICAgICAga2xvID0ga1xuICAgIH1cbiAgfVxuXG4gIHZhciBoID0gdGhpcy54YVtraGldIC0gdGhpcy54YVtrbG9dXG4gIHZhciBhID0gKHRoaXMueGFba2hpXSAtIHgpIC8gaFxuICB2YXIgYiA9ICh4IC0gdGhpcy54YVtrbG9dKSAvIGhcblxuICAvLyBDdWJpYyBzcGxpbmUgcG9seW5vbWlhbCBpcyBub3cgZXZhbHVhdGVkLlxuICByZXR1cm4gYSAqIHRoaXMueWFba2xvXSArIGIgKiB0aGlzLnlhW2toaV0gKyBcbiAgICAgICAgICgoYSAqIGEgKiBhIC0gYSkgKiB0aGlzLnkyW2tsb10gKyAoYiAqIGIgKiBiIC0gYikgKiB0aGlzLnkyW2toaV0pICogKGggKiBoKSAvIDYuMFxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBUZXh0dXJlXG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuXG5mdW5jdGlvbiBUZXh0dXJlKGdsLCB1bml0LCBub2RlT3JEYXRhLCB3aWR0aCwgaGVpZ2h0LCBvcHRpb25zKSB7XG4gIHRoaXMuZ2wgPSBnbFxuICB0aGlzLnVuaXQgPSB1bml0XG4gIHRoaXMud2lkdGggPSB3aWR0aFxuICB0aGlzLmhlaWdodCA9IGhlaWdodFxuXG4gIHRoaXMudGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKVxuICB0aGlzLmJpbmQoKVxuICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIHRydWUpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5MSU5FQVIpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpXG5cbiAgaWYgKHV0aWxzLmlzQXJyYXkobm9kZU9yRGF0YSkpIHtcbiAgICB2YXIgZGF0YSA9IG5ldyBVaW50OEFycmF5KG5vZGVPckRhdGEpXG4gICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCBmYWxzZSlcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIHdpZHRoLCBoZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIGRhdGEpXG5cbiAgfSBlbHNlIGlmICh1dGlscy5pc05vdGhpbmcobm9kZU9yRGF0YSkpIHtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIHdpZHRoLCBoZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG51bGwpXG4gICAgdGhpcy5mcmFtZWJ1ZmZlciA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKClcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZnJhbWVidWZmZXIpXG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUsIDApXG5cbiAgfSBlbHNlIHtcbiAgICB2YXIgbm9kZSA9IHV0aWxzLmdldE5vZGUobm9kZU9yRGF0YSlcblxuICAgIHZhciBtYXhTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX1NJWkUpXG4gICAgaWYgKHV0aWxzLmlzTnVtYmVyKG9wdGlvbnMucmVzaXplKSkge1xuICAgICAgbWF4U2l6ZSA9IE1hdGgubWluKG1heFNpemUsIG9wdGlvbnMucmVzaXplKVxuICAgIH1cblxuICAgIG5vZGUgPSByZXNpemUobm9kZSwgbWF4U2l6ZSlcbiAgICB0aGlzLndpZHRoID0gbm9kZS53aWR0aFxuICAgIHRoaXMuaGVpZ2h0ID0gbm9kZS5oZWlnaHRcblxuICAgIGlmICh1dGlscy5pc1dlYmdsKG5vZGUpICYmIHV0aWxzLmlzV2Via2l0KCkpIHtcbiAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIHRydWUpXG4gICAgfVxuXG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBub2RlKVxuICB9XG59XG5cblRleHR1cmUucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuICBnbC5hY3RpdmVUZXh0dXJlKGdsWydURVhUVVJFJyArIHRoaXMudW5pdF0pXG4gIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZSlcbiAgaWYgKHRoaXMuZnJhbWVidWZmZXIpIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5mcmFtZWJ1ZmZlcilcbiAgcmV0dXJuIHRoaXNcbn1cblxuVGV4dHVyZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLmRlbGV0ZVRleHR1cmUodGhpcy50ZXh0dXJlKVxuICBpZiAodGhpcy5mcmFtZWJ1ZmZlcikge1xuICAgIHRoaXMuZ2wuZGVsZXRlRnJhbWVidWZmZXIodGhpcy5mcmFtZWJ1ZmZlcilcbiAgICB0aGlzLmZyYW1lYnVmZmVyID0gbnVsbFxuICB9XG4gIHRoaXMudGV4dHVyZSA9IG51bGxcbiAgdGhpcy5nbCA9IG51bGxcbn1cblxuZnVuY3Rpb24gcmVzaXplKG5vZGUsIG1heFNpemUpIHtcbiAgaWYgKG5vZGUud2lkdGggPD0gbWF4U2l6ZSAmJiBub2RlLmhlaWdodCA8PSBtYXhTaXplKSB7XG4gICAgcmV0dXJuIG5vZGVcbiAgfSBlbHNlIGlmIChub2RlLndpZHRoID4gbWF4U2l6ZSAqIDIgfHwgbm9kZS5oZWlnaHQgPiBtYXhTaXplICogMikge1xuICAgIHJldHVybiByZXNpemUocmVzaXplKG5vZGUsIG1heFNpemUgKiAyKSwgbWF4U2l6ZSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgd2lkdGgsIGhlaWdodFxuICAgIGlmIChub2RlLndpZHRoID4gbm9kZS5oZWlnaHQpIHtcbiAgICAgIHdpZHRoID0gbWF4U2l6ZVxuICAgICAgaGVpZ2h0ID0gTWF0aC5mbG9vcihtYXhTaXplIC8gbm9kZS53aWR0aCAqIG5vZGUuaGVpZ2h0KVxuICAgIH0gZWxzZSB7XG4gICAgICBoZWlnaHQgPSBtYXhTaXplXG4gICAgICB3aWR0aCA9IE1hdGguZmxvb3IobWF4U2l6ZSAvIG5vZGUuaGVpZ2h0ICogbm9kZS53aWR0aClcbiAgICB9XG5cbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgICBjYW52YXMud2lkdGggPSB3aWR0aFxuICAgIGNhbnZhcy5oZWlnaHQgPSBoZWlnaHRcbiAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJylcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpXG4gICAgY3R4LmRyYXdJbWFnZShub2RlLCAwLCAwLCB3aWR0aCwgaGVpZ2h0KVxuXG4gICAgcmV0dXJuIGNhbnZhc1xuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNTdHJpbmc6IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgU3RyaW5nXSdcbiAgfSxcblxuICBpc051bWJlcjogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBOdW1iZXJdJ1xuICB9LFxuXG4gIGlzQXJyYXk6IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9LFxuXG4gIGlzTm90aGluZzogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJ1xuICB9LFxuXG4gIGlzV2ViZ2w6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS5nZXRDb250ZXh0ICYmXG4gICAgICAgICAgIChub2RlLmdldENvbnRleHQoJ3dlYmdsJykgfHwgbm9kZS5nZXRDb250ZXh0KCdleHBlcmltZW50YWwtd2ViZ2wnKSlcbiAgfSxcblxuICBpc1dlYmtpdDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGVcbiAgfSxcblxuICBnZXROb2RlOiBmdW5jdGlvbihub2RlKSB7XG4gICAgaWYgKHRoaXMuaXNTdHJpbmcobm9kZSkpIHtcbiAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKG5vZGUpXG4gICAgfSBlbHNlIGlmIChub2RlLmlzR2xpbWcpIHtcbiAgICAgIHJldHVybiBub2RlLmNhbnZhc1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZVxuICAgIH1cbiAgfSxcblxuICBjbGFtcDogZnVuY3Rpb24odmFsdWUsIG1pbiwgbWF4KSB7XG4gICAgcmV0dXJuIHZhbHVlIDwgbWluID8gbWluIDogKHZhbHVlID4gbWF4ID8gbWF4IDogdmFsdWUpXG4gIH0sXG5cbiAgZmxhdHRlbjogZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5hcHBseShbXSwgYXJyYXkpXG4gIH0sXG5cbiAgY2FtZWxDYXNlOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvLSguKS9nLCBmdW5jdGlvbihfLCB3b3JkKSB7XG4gICAgICByZXR1cm4gd29yZC50b1VwcGVyQ2FzZSgpXG4gICAgfSlcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBnbGltZ1xuXG52YXIgR2xpbWcgPSByZXF1aXJlKCcuL2NvcmUvZ2xpbWcnKVxuXG5mdW5jdGlvbiBnbGltZyhjYW52YXMsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBHbGltZyhjYW52YXMsIG9wdGlvbnMpXG59XG5cbmluaXQoZ2xpbWcpXG5cbmZ1bmN0aW9uIGluaXQoZ2xpbWcpIHtcbiAgZ2xpbWcuaW5mbyA9IHt9XG4gIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICB2YXIgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ2wnKSB8fCBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJylcbiAgaWYgKGdsKSB7XG4gICAgZ2xpbWcuaW5mby5zdXBwb3J0ZWQgPSB0cnVlXG4gICAgZ2xpbWcuaW5mby5tYXhTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX1NJWkUpXG4gICAgZ2xpbWcuaW5mby5tYXhVbml0ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX0lNQUdFX1VOSVRTKSAtIDRcbiAgfSBlbHNlIHtcbiAgICBnbGltZy5pbmZvLnN1cHBvcnRlZCA9IGZhbHNlXG4gIH1cblxuICBnbGltZy5zaGFkZXJzID0gcmVxdWlyZSgnLi9jb3JlL3NoYWRlcnMnKVxufVxuIl19
(8)
});
