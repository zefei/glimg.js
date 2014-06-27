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

},{"./buffer":1,"./shader":4,"./shaders":5,"./texture":6,"./utils":7}],3:[function(_dereq_,module,exports){
module.exports = glimg

var Glimg = _dereq_('./glimg')

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

  glimg.shaders = _dereq_('./shaders')
}

},{"./glimg":2,"./shaders":5}],4:[function(_dereq_,module,exports){
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
    gl[func](location, [].concat(values))
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

},{"./shaders":5,"./utils":7}],5:[function(_dereq_,module,exports){
module.exports = {
  core: {
    vertex: "attribute vec2 aSourceCoord;\nattribute vec2 aTargetCoord;\nattribute vec2 aMaskCoord;\nuniform float flipY;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n   gl_Position = vec4((aTargetCoord * 2.0 - 1.0) * vec2(1, flipY), 0.0, 1.0);\n   coord = aSourceCoord;\n   maskCoord = aMaskCoord;\n}\n",
    copy: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  gl_FragColor = texture2D(source, coord);\n}\n",
    transform: "precision mediump float;\n\nuniform mat2 transform;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  // first -0.5 is applied to center image\n  // then width:height ratio is applied to keep aspect\n  // then transform is applied\n  // then pre-transforms are reversed\n  //\n  vec2 r = vec2(size.p / size.q, 1.0);\n  gl_FragColor = texture2D(source, transform * ((coord - 0.5) * r) / r + 0.5);\n}\n"
  },
  blend: {
    normal: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src;\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    multiply: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src * dst;\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    screen: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = 1.0 - (1.0 - src) * (1.0 - dst);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    overlay: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = dst.r < 0.5 ? 2.0 * src.r * dst.r : 1.0 - 2.0 * (1.0 - src.r) * (1.0 - dst.r);\n  blend.g = dst.g < 0.5 ? 2.0 * src.g * dst.g : 1.0 - 2.0 * (1.0 - src.g) * (1.0 - dst.g);\n  blend.b = dst.b < 0.5 ? 2.0 * src.b * dst.b : 1.0 - 2.0 * (1.0 - src.b) * (1.0 - dst.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    darken: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = min(src, dst);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    lighten: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = max(src, dst);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'color-dodge': "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r == 1.0 ? 1.0 : dst.r / (1.0 - src.r);\n  blend.g = src.g == 1.0 ? 1.0 : dst.g / (1.0 - src.g);\n  blend.b = src.b == 1.0 ? 1.0 : dst.b / (1.0 - src.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'color-burn': "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r == 0.0 ? 0.0 : 1.0 - (1.0 - dst.r) / src.r;\n  blend.g = src.g == 0.0 ? 0.0 : 1.0 - (1.0 - dst.g) / src.g;\n  blend.b = src.b == 0.0 ? 0.0 : 1.0 - (1.0 - dst.b) / src.b;\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'hard-light': "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r < 0.5 ? 2.0 * src.r * dst.r : 1.0 - 2.0 * (1.0 - src.r) * (1.0 - dst.r);\n  blend.g = src.g < 0.5 ? 2.0 * src.g * dst.g : 1.0 - 2.0 * (1.0 - src.g) * (1.0 - dst.g);\n  blend.b = src.b < 0.5 ? 2.0 * src.b * dst.b : 1.0 - 2.0 * (1.0 - src.b) * (1.0 - dst.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'soft-light': "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nuniform float opacity;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)\n    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);\n  blend.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)\n    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);\n  blend.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)\n    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);\n\n  blend.a = src.a;\n  blend *= opacity * texture2D(mask, maskCoord).a;\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
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
    'brightness-contrast': "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform float brightness;\nuniform float contrast;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  /*\n  float l = luma(src.rgb);\n  src.rgb *= ((l + brightness - 0.5) * contrast + 0.5) / (l + e);\n  */\n\n  src.rgb = (src.rgb + brightness - 0.5) * contrast + 0.5;\n\n  gl_FragColor = src;\n}\n",
    'hue-saturation': "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform float hue;\nuniform float saturation;\nuniform float lightness;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  vec3 hcl = rgb2hcl(src.rgb);\n  hcl.x = mod(hcl.x + hue * 6.0, 6.0);\n  hcl.y *= saturation;\n  hcl.z += lightness;\n\n  gl_FragColor = vec4(hcl2rgb(hcl), src.a);\n}\n",
    'split-tone': "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform vec3 highlight;\nuniform vec3 shadow;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nvec3 softlight(vec3 src, vec3 dst) {\n  vec3 color;\n  color.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)\n    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);\n  color.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)\n    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);\n  color.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)\n    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);\n  return color;\n}\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  // cast soft light using highlight and shadow\n  vec3 h = softlight(highlight, src.rgb);\n  vec3 s = softlight(shadow, src.rgb);\n\n  // blend based on luminance\n  float l = luma(src.rgb);\n  vec3 c = h * l + s * (1.0 - l);\n  c = c / (luma(c) + e) * l;\n\n  gl_FragColor = vec4(c, src.a);\n}\n",
    duotone: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform vec3 highlight;\nuniform vec3 shadow;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  float l = luma(src.rgb);\n\n  // highlight and shadow color normalized to same luminance\n  vec3 h = (highlight + e) / (luma(highlight) + e) * l;\n  vec3 s = (shadow + e) / (luma(shadow) + e) * l;\n\n  // blend based on luminance\n  vec3 c = h * l + s * (1.0 - l);\n\n  gl_FragColor = vec4(c, src.a);\n}\n",
    sharpen: "precision mediump float;\n\nuniform float strength;\nuniform sampler2D source;\nuniform sampler2D background;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  float lsrc = luma(src.rgb);\n  float l = luma(texture2D(background, coord).rgb);\n\n  src.rgb *= ((lsrc - l) * strength + l) / (lsrc + e);\n  gl_FragColor = src;\n}\n",
    vignette: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nuniform float darken;\nuniform float brighten;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nconst float e = 10e-10;\n\nfloat luma(vec3 c) {\n  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;\n}\n\nvoid main() {\n  vec4 src = texture2D(source, coord);\n\n  // distance to each border\n  float a = coord.x < 0.5 ? coord.x : 1.0 - coord.x;\n  float b = coord.y < 0.5 ? coord.y : 1.0 - coord.y;\n\n  // lp norm used as distance, 0.2 seems to be a nice value for p\n  float p = 0.2;\n  float d = pow(a, p) + pow(b, p);\n  float dmax = 2.0 * pow(0.5, p);\n\n  // brighten overall, then darken based on lp distance\n  float l = luma(src.rgb);\n  src.rgb *= (l + brighten - darken * (1.0 - d / dmax)) / (l + e);\n\n  gl_FragColor = src;\n}\n"
  }
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
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
  }
}

},{}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xvY2FsL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9idWZmZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL2dsaW1nLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9tYWluLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9zaGFkZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3NoYWRlcnMuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3RleHR1cmUuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4bEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gQnVmZmVyXG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuXG5mdW5jdGlvbiBCdWZmZXIoZ2wsIGFycmF5KSB7XG4gIHRoaXMuZ2wgPSBnbFxuICB0aGlzLmJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpXG4gIHRoaXMuYmluZCgpXG4gIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KGFycmF5KSwgZ2wuU1RBVElDX0RSQVcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLmJpbmRCdWZmZXIodGhpcy5nbC5BUlJBWV9CVUZGRVIsIHRoaXMuYnVmZmVyKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5nbC5kZWxldGVCdWZmZXIodGhpcy5idWZmZXIpXG4gIHRoaXMuYnVmZmVyID0gbnVsbFxuICB0aGlzLmdsID0gbnVsbFxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBHbGltZ1xuXG52YXIgU2hhZGVyID0gcmVxdWlyZSgnLi9zaGFkZXInKVxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJy4vYnVmZmVyJylcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi90ZXh0dXJlJylcbnZhciBzaGFkZXJzID0gcmVxdWlyZSgnLi9zaGFkZXJzJylcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuXG4vLyBuZXcgR2xpbWcoW2NhbnZhcywgW29wdGlvbnNdXSlcbi8vXG4vLyBDcmVhdGUgYW4gZW1wdHkgR2xpbWcgb2JqZWN0LlxuLy9cbi8vIElmIGNhbnZhcyBpcyBwcm92aWRlZCwgZWl0aGVyIG5vZGUgb3Igc2VsZWN0b3IsIEdsaW1nIHdpbGwgdXNlIHRoYXQgY2FudmFzIFxuLy8gbm9kZSBpbnN0ZWFkIG9mIGNyZWF0aW5nIGEgbmV3IG9uZS5cbi8vXG4vLyBOb3RpY2UgdGhhdCB5b3UgY2Fubm90IHVzZSBhIGNhbnZhcyB0aGF0IGhhcyBjYWxsZWQgZ2V0Q29udGV4dCgnMmQnKS5cbi8vXG4vLyBPcHRpb25zOlxuLy9cbi8vIHJlc2l6ZSAoZGVmYXVsdCAyMDQ4KTogbG9hZGVkIGltYWdlIHdpbGwgYmUgZG93bnNpemVkIHRvIHRoaXMgdmFsdWUgaWYgaXRzIFxuLy8gd2lkdGggb3IgaGVpZ2h0IGV4Y2VlZHMgaXQ7ICdtYXgnIG1lYW5zIHRoZSBsaW1pdCBpcyB0aGUgbWF4aW1hbCB2YWx1ZSBcbi8vIGJyb3dzZXIgc3VwcG9ydHMuXG4vL1xuZnVuY3Rpb24gR2xpbWcoY2FudmFzLCBvcHRpb25zKSB7XG4gIGlmIChjYW52YXMpIHtcbiAgICBjYW52YXMgPSB1dGlscy5nZXROb2RlKGNhbnZhcylcbiAgfSBlbHNlIHtcbiAgICBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICB9XG5cbiAgdmFyIGdsb3B0cyA9IHtcbiAgICBwcmVzZXJ2ZURyYXdpbmdCdWZmZXI6IHRydWUsXG4gICAgcHJlbXVsdGlwbGllZEFscGhhOiB0cnVlXG4gIH1cblxuICB2YXIgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ2wnLCBnbG9wdHMpIHx8XG4gICAgICAgICAgIGNhbnZhcy5nZXRDb250ZXh0KCdleHBlcmltZW50YWwtd2ViZ2wnLCBnbG9wdHMpXG5cbiAgaWYgKCFnbCkgdGhyb3cgJ1dlYkdMIGlzIG5vdCBzdXBwb3J0ZWQnXG5cbiAgdGhpcy5pc0dsaW1nID0gdHJ1ZVxuICB0aGlzLmNhbnZhcyA9IGNhbnZhc1xuICB0aGlzLmdsID0gZ2xcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICB0aGlzLm9wdGlvbnMucmVzaXplID0gdGhpcy5vcHRpb25zLnJlc2l6ZSB8fCAyMDQ4XG4gIHRoaXMuX2J1ZmZlcnMgPSB7fVxuICB0aGlzLl90ZXh0dXJlcyA9IHt9XG4gIHRoaXMuX3NoYWRlcnMgPSB7fVxuICB2YXIgbWF4VW5pdCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9JTUFHRV9VTklUUykgLSAxXG4gIHRoaXMuX3VuaXQgPSBbbWF4VW5pdCwgbWF4VW5pdCAtIDEsIG1heFVuaXQgLSAyLCBtYXhVbml0IC0gM11cbiAgdGhpcy5fY2hhaW4gPSB7Y291bnQ6IDB9XG4gIHRoaXMuc2V0U291cmNlKDApXG4gIHRoaXMuc2V0VGFyZ2V0KG51bGwpXG4gIHRoaXMuc2V0Wm9vbShudWxsKVxufVxuXG4vLyBsb2FkKG5vZGVbLCBub2NvcHldKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIExvYWQgaW1hZ2UgZnJvbSBhIG5vZGUgKGNhbnZhcywgaW1hZ2Ugb3IgdmlkZW8pIGFzIHNvdXJjZSBpbWFnZS4gVGhlbiBjb3B5IGl0IFxuLy8gdG8gdGhlIHRhcmdldCBpbWFnZSB1bmxlc3Mgbm9jb3B5IGlzIHNldC5cbi8vXG5HbGltZy5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKG5vZGUsIG5vY29weSkge1xuICBub2RlID0gdXRpbHMuZ2V0Tm9kZShub2RlKVxuICB0aGlzLnNldFNvdXJjZSh0aGlzLnNvdXJjZVVuaXQsIG5vZGUpLnNldFRhcmdldCh0aGlzLnRhcmdldFVuaXQpXG4gIGlmICghbm9jb3B5KSB0aGlzLmNvcHkoKVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBsb2FkRnJvbVVybCh1cmxbLCBjYWxsYmFja1ssIG5vY29weV1dKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIExvYWQgcmVtb3RlIGltYWdlIGFzIHNvdXJjZSBpbWFnZS4gQ2FsbGJhY2sgaXMgZmlyZWQgd2hlbiBpbWFnZSBpcyBsb2FkZWQuICBcbi8vIFRoZW4gY29weSBpdCB0byB0aGUgdGFyZ2V0IGltYWdlIHVubGVzcyBub2NvcHkgaXMgc2V0LlxuLy9cbkdsaW1nLnByb3RvdHlwZS5sb2FkRnJvbVVybCA9IGZ1bmN0aW9uKHVybCwgY2FsbGJhY2ssIG5vY29weSkge1xuICB2YXIgc2VsZiA9IHRoaXNcbiAgdmFyIGltYWdlID0gbmV3IEltYWdlKClcbiAgaW1hZ2Uub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgc2VsZi5sb2FkKGltYWdlLCBub2NvcHkpXG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpXG4gIH1cbiAgaW1hZ2Uuc3JjID0gdXJsXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHNldFNpemUod2lkdGgsIGhlaWdodClcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBTZXQgdGFyZ2V0IGltYWdlIHNpemUuXG4vL1xuR2xpbWcucHJvdG90eXBlLnNldFNpemUgPSBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0KSB7XG4gIGlmICh0aGlzLnRhcmdldFVuaXQgPT09IG51bGwpIHtcbiAgICB0aGlzLndpZHRoID0gdGhpcy5jYW52YXMud2lkdGggPSB3aWR0aFxuICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5jYW52YXMuaGVpZ2h0ID0gaGVpZ2h0XG4gICAgdGhpcy56b29tKHRoaXMuX3pvb21MZXZlbClcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnVzZVRleHR1cmUodGhpcy50YXJnZXRVbml0LCBudWxsLCB3aWR0aCwgaGVpZ2h0KVxuICB9XG5cbiAgdGhpcy5nbC52aWV3cG9ydCgwLCAwLCB3aWR0aCwgaGVpZ2h0KVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBzZXRab29tKHpvb21MZXZlbClcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBTZXQgY3NzIHNpemUgb2YgdGhlIGNhbnZhcyBhY2NvcmRpbmcgdG8gYWN0dWFsIGltYWdlIHNpemUuIFRoaXMgcGVyc2lzdHMgXG4vLyB0aHJvdWdoIHJlc2l6ZXMuXG4vL1xuLy8gWm9vbSBsZXZlbCBjYW4gYmUgYSBudW1iZXI6IHpvb20gcmF0aW8sIG9yICdmaXQnOiAxMDAlIHBhcmVudCB3aWR0aCwgb3IgbnVsbDogXG4vLyBub3Qgem9vbWluZyBvbiByZXNpemVzLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRab29tID0gZnVuY3Rpb24oem9vbUxldmVsKSB7XG4gIHRoaXMuX3pvb21MZXZlbCA9IHpvb21MZXZlbFxuICB0aGlzLnpvb20oem9vbUxldmVsKVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyB6b29tKHpvb21MZXZlbClcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBab29tIHRoZSBjYW52YXMgb25jZS4gU2VlICdzZXRab29tJyBmb3IgbW9yZSBkZXRhaWxzLlxuLy9cbkdsaW1nLnByb3RvdHlwZS56b29tID0gZnVuY3Rpb24oem9vbUxldmVsKSB7XG4gIGlmICh1dGlscy5pc05vdGhpbmcoem9vbUxldmVsKSkge1xuICAgIHJldHVybiB0aGlzXG4gIH0gZWxzZSBpZiAoem9vbUxldmVsID09PSAnZml0Jykge1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLndpZHRoID0gJzEwMCUnXG4gIH0gZWxzZSB7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUud2lkdGggPSAnJyArICh0aGlzLndpZHRoICogem9vbUxldmVsKSArICdweCdcbiAgfVxuICB0aGlzLmNhbnZhcy5zdHlsZS5oZWlnaHQgPSAnYXV0bydcblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBhcHBseSgpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQXBwbHkgcmVuZGVyZWQgcmVzdWx0IGJhY2sgdG8gc291cmNlIGltYWdlLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5hcHBseSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnNldFNvdXJjZSh0aGlzLnNvdXJjZVVuaXQsIHRoaXMpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIGNsZWFyKFtyZWQsIGdyZWVuLCBibHVlLCBhbHBoYV0pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQ2xlYXIgY2FudmFzIHdpdGggc3BlY2lmaWVkIGNvbG9yLCBkZWZhdWx0ICgwLCAwLCAwLCAwKS5cbi8vXG5HbGltZy5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbihyZWQsIGdyZWVuLCBibHVlLCBhbHBoYSkge1xuICB0aGlzLmdsLmNsZWFyQ29sb3IocmVkIHx8IDAsIGdyZWVuIHx8IDAsIGJsdWUgfHwgMCwgYWxwaGEgfHwgMClcbiAgdGhpcy5nbC5jbGVhcih0aGlzLmdsLkNPTE9SX0JVRkZFUl9CSVQpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHRvRGF0YVVybChbZm9ybWF0XSlcbi8vIHJldHVybnMgYSBiYXNlNjQgdXJsIFN0cmluZ1xuLy9cbi8vIFNhdmUgaW1hZ2UgZGF0YSB0byBiYXNlNjQgdXJsLiBGb3JtYXQgY2FuIGJlICdqcGVnJyAoZGVmYXVsdCkgb3IgJ3BuZycuXG4vLyBUaGlzIGNhbiBiZSB1c2VkIGFzIDxhPiBocmVmIG9yIHdpbmRvdy5sb2NhdGlvbi5cbi8vXG5HbGltZy5wcm90b3R5cGUudG9EYXRhVVJMID0gZnVuY3Rpb24oZm9ybWF0KSB7XG4gIGZvcm1hdCA9IGZvcm1hdCB8fCAnanBlZydcbiAgcmV0dXJuIHRoaXMuY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvJyArIGZvcm1hdClcbn1cblxuLy8gZGVzdHJveSgpXG4vLyByZXR1cm5zIG5vdGhpbmdcbi8vXG4vLyBEZXN0cm95IHRoZSBvYmplY3QsIGZyZWUgYWxsb2NhdGVkIG1lbW9yaWVzLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmdsKSB7XG4gICAgdmFyIGtleVxuICAgIGZvciAoa2V5IGluIHRoaXMuX2J1ZmZlcnMpIHtcbiAgICAgIHRoaXMuX2J1ZmZlcnNba2V5XS5kZXN0cm95KClcbiAgICB9XG5cbiAgICBmb3IgKGtleSBpbiB0aGlzLl90ZXh0dXJlcykge1xuICAgICAgdGhpcy5fdGV4dHVyZXNba2V5XS5kZXN0cm95KClcbiAgICB9XG5cbiAgICBmb3IgKGtleSBpbiB0aGlzLl9zaGFkZXJzKSB7XG4gICAgICB0aGlzLl9zaGFkZXJzW2tleV0uZGVzdHJveSgpXG4gICAgfVxuXG4gICAgdGhpcy5jYW52YXMgPSBudWxsXG4gICAgdGhpcy5nbCA9IG51bGxcbiAgICB0aGlzLl9idWZmZXJzID0gbnVsbFxuICAgIHRoaXMuX3RleHR1cmVzID0gbnVsbFxuICAgIHRoaXMuX3NoYWRlcnMgPSBudWxsXG4gIH1cbn1cblxuR2xpbWcucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbihzb3VyY2VDb29yZCwgdGFyZ2V0Q29vcmQpIHtcbiAgdmFyIHMgPSBzb3VyY2VDb29yZCB8fCB7bGVmdDogMCwgdG9wOiAwLCByaWdodCA6IDEsIGJvdHRvbTogMX1cbiAgdmFyIHQgPSB0YXJnZXRDb29yZCB8fCB7bGVmdDogMCwgdG9wOiAwLCByaWdodCA6IDEsIGJvdHRvbTogMX1cblxuICB0aGlzLnVzZVNoYWRlcihzaGFkZXJzLmNvcmUuY29weSlcbiAgLnNldCgnYVNvdXJjZUNvb3JkJywgcy5sZWZ0LCBzLnRvcCwgcy5yaWdodCwgcy5ib3R0b20pXG4gIC5zZXQoJ2FUYXJnZXRDb29yZCcsIHQubGVmdCwgdC50b3AsIHQucmlnaHQsIHQuYm90dG9tKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBjcm9wKGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBDcm9wIHRoZSBpbWFnZS4gQ29vcmRpbmF0ZXMgYXJlIGluIHBlcmNlbnRhZ2UsIG5vdCBwaXhlbHMuIFRoZXkgc2hvdWxkIGJlIGluIFxuLy8gdGhlIHJhbmdlIG9mIFswLCAxXS5cbi8vXG5HbGltZy5wcm90b3R5cGUuY3JvcCA9IGZ1bmN0aW9uKGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSkge1xuICB2YXIgd2lkdGggPSAocmlnaHQgLSBsZWZ0KSAqIHRoaXMuX3RleHR1cmVzWzBdLndpZHRoXG4gIHZhciBoZWlnaHQgPSAoYm90dG9tIC0gdG9wKSAqIHRoaXMuX3RleHR1cmVzWzBdLmhlaWdodFxuXG4gIHRoaXMuc2V0U2l6ZSh3aWR0aCwgaGVpZ2h0KVxuICAuY29weSh7bGVmdDogbGVmdCwgdG9wOiB0b3AsIHJpZ2h0OiByaWdodCwgYm90dG9tOiBib3R0b219KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5yb3RhdGUgPSBmdW5jdGlvbihkZWdyZWUpIHtcbiAgLy8gcm90YXRpb24gbWF0cml4XG4gIHZhciB0aGV0YSA9IE1hdGguUEkgLyAxODAgKiBkZWdyZWVcbiAgdmFyIG1hdCA9IFtNYXRoLmNvcyh0aGV0YSksIC1NYXRoLnNpbih0aGV0YSksIE1hdGguc2luKHRoZXRhKSwgTWF0aC5jb3ModGhldGEpXVxuXG4gIC8vIHNvdXJjZSBkaW1lbnNpb25cbiAgdmFyIHdpZHRoID0gdGhpcy5nZXRTb3VyY2UoKS53aWR0aFxuICB2YXIgaGVpZ2h0ID0gdGhpcy5nZXRTb3VyY2UoKS5oZWlnaHRcblxuICAvLyBtYXhpbWFsIGZpdHRpbmcgcmVjdGFuZ2xlXG4gIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTc4OTIzOS9jYWxjdWxhdGUtbGFyZ2VzdC1yZWN0YW5nbGUtaW4tYS1yb3RhdGVkLXJlY3RhbmdsZVxuICB2YXIgdzAsIGgwXG4gIGlmICh3aWR0aCA8PSBoZWlnaHQpIHtcbiAgICB3MCA9IHdpZHRoXG4gICAgaDAgPSBoZWlnaHRcbiAgfSBlbHNlIHtcbiAgICB3MCA9IGhlaWdodFxuICAgIGgwID0gd2lkdGhcbiAgfVxuXG4gIHZhciBhbHBoYSA9IHRoZXRhIC0gTWF0aC5mbG9vcigodGhldGEgKyBNYXRoLlBJKSAvICgyICogTWF0aC5QSSkpICogKDIgKiBNYXRoLlBJKVxuICBhbHBoYSA9IE1hdGguYWJzKGFscGhhKVxuICBpZiAoYWxwaGEgPiBNYXRoLlBJIC8gMikgYWxwaGEgPSBNYXRoLlBJIC0gYWxwaGFcblxuICB2YXIgc2luYSA9IE1hdGguc2luKGFscGhhKVxuICB2YXIgY29zYSA9IE1hdGguY29zKGFscGhhKVxuICB2YXIgdzEgPSB3MCAqIGNvc2EgKyBoMCAqIHNpbmFcbiAgdmFyIGgxID0gdzAgKiBzaW5hICsgaDAgKiBjb3NhXG4gIHZhciBjID0gaDAgKiAoc2luYSAqIGNvc2EpIC8gKDIgKiBoMCAqIChzaW5hICogY29zYSkgKyB3MClcbiAgdmFyIHggPSB3MSAqIGNcbiAgdmFyIHkgPSBoMSAqIGNcbiAgdmFyIHcsIGhcbiAgaWYgKHdpZHRoIDw9IGhlaWdodCkge1xuICAgIHcgPSB3MSAtIDIgKiB4XG4gICAgaCA9IGgxIC0gMiAqIHlcbiAgfVxuICBlbHNlIHtcbiAgICB3ID0gaDEgLSAyICogeVxuICAgIGggPSB3MSAtIDIgKiB4XG4gIH1cblxuICAvLyBkaW1lbnNpb24gdHJhbnNmb3JtXG4gIHZhciBsLCB0LCByLCBiO1xuICBsID0gKHdpZHRoIC0gdykgLyAoMiAqIHdpZHRoKVxuICByID0gKHdpZHRoICsgdykgLyAoMiAqIHdpZHRoKVxuICB0ID0gKGhlaWdodCAtIGgpIC8gKDIgKiBoZWlnaHQpXG4gIGIgPSAoaGVpZ2h0ICsgaCkgLyAoMiAqIGhlaWdodClcblxuICB0aGlzLnNldFNpemUodywgaClcbiAgLnVzZVNoYWRlcihzaGFkZXJzLmNvcmUudHJhbnNmb3JtKVxuICAuc2V0TWF0cml4KCd0cmFuc2Zvcm0nLCBtYXQpXG4gIC5zZXQoJ2FTb3VyY2VDb29yZCcsIGwsIHQsIHIsIGIpXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5ibGVuZCA9IGZ1bmN0aW9uKG5vZGUsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgdmFyIG1vZGUgPSBvcHRpb25zLm1vZGUgfHwgJ25vcm1hbCdcbiAgdmFyIG9wYWNpdHkgPSB1dGlscy5pc05vdGhpbmcob3B0aW9ucy5vcGFjaXR5KSA/IDEgOiBvcHRpb25zLm9wYWNpdHlcbiAgdmFyIGNvb3JkID0gb3B0aW9ucy5jb29yZCB8fCB7bGVmdDogMCwgdG9wOiAwLCByaWdodDogMSwgYm90dG9tOiAxfVxuICB2YXIgbWFzayA9IG9wdGlvbnMubWFzayB8fCBbMjU1LCAyNTUsIDI1NSwgMjU1XVxuXG4gIHZhciBmb3JlZ3JvdW5kVW5pdCwgZm9yZWdyb3VuZE5vZGUsIG1hc2tVbml0LCBtYXNrTm9kZVxuXG4gIGlmICh1dGlscy5pc051bWJlcihub2RlKSkge1xuICAgIGZvcmVncm91bmRVbml0ID0gbm9kZVxuICAgIGZvcmVncm91bmROb2RlID0gbnVsbFxuICB9IGVsc2Uge1xuICAgIGZvcmVncm91bmRVbml0ID0gdGhpcy5fdW5pdFsyXVxuICAgIGZvcmVncm91bmROb2RlID0gbm9kZVxuICB9XG5cbiAgaWYgKHV0aWxzLmlzTnVtYmVyKG1hc2spKSB7XG4gICAgbWFza1VuaXQgPSBtYXNrXG4gICAgbWFza05vZGUgPSBudWxsXG4gIH0gZWxzZSB7XG4gICAgbWFza1VuaXQgPSB0aGlzLl91bml0WzNdXG4gICAgbWFza05vZGUgPSBtYXNrXG4gIH1cblxuICB0aGlzLl9ob2xkQ2hhaW4gPSB0cnVlXG4gIHRoaXMuY29weSgpXG4gIHRoaXMuX2hvbGRDaGFpbiA9IGZhbHNlXG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5ibGVuZFttb2RlXSlcbiAgLnNldCgnYVNvdXJjZUNvb3JkJywgY29vcmQubGVmdCwgY29vcmQudG9wLCBjb29yZC5yaWdodCwgY29vcmQuYm90dG9tKVxuICAuc2V0KCdhVGFyZ2V0Q29vcmQnLCBjb29yZC5sZWZ0LCBjb29yZC50b3AsIGNvb3JkLnJpZ2h0LCBjb29yZC5ib3R0b20pXG4gIC5zZXQoJ2ZvcmVncm91bmQnLCBmb3JlZ3JvdW5kVW5pdCwgZm9yZWdyb3VuZE5vZGUpXG4gIC5zZXQoJ29wYWNpdHknLCBvcGFjaXR5KVxuICAuc2V0VGV4dHVyZSgnbWFzaycsIG1hc2tVbml0LCBtYXNrTm9kZSwgMSwgMSlcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmJsdXIgPSBmdW5jdGlvbihyYWRpdXMpIHtcbiAgaWYgKHJhZGl1cyA8PSAwKSByZXR1cm4gdGhpc1xuICBpZiAocmFkaXVzIDw9IDQpIHJldHVybiB0aGlzLmdhdXNzaWFuQmx1cihyYWRpdXMpXG5cbiAgdmFyIHcgPSB0aGlzLmdldFNvdXJjZSgpLndpZHRoXG4gIHZhciBoID0gdGhpcy5nZXRTb3VyY2UoKS5oZWlnaHRcbiAgdmFyIHIgPSBNYXRoLnNxcnQocmFkaXVzKVxuXG4gIHRoaXMuY2hhaW4oKVxuICAuZ2F1c3NpYW5CbHVyKHIpXG4gIC5zZXRTaXplKHcgLyByLCBoIC8gcilcbiAgLmNvcHkoKVxuICAuZ2F1c3NpYW5CbHVyKHIpXG4gIC5zZXRTaXplKHcsIGgpXG4gIC5jb3B5KClcbiAgLmRvbmUoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5nYXVzc2lhbkJsdXIgPSBmdW5jdGlvbihyYWRpdXMpIHtcbiAgaWYgKHJhZGl1cyA8PSAwKSByZXR1cm4gdGhpc1xuXG4gIHZhciBnYXVzc2lhbiA9IHNoYWRlcnMuYmx1ci5nYXVzc2lhbjI1NlxuICBmb3IgKHZhciBpID0gMjsgaSA8IDI1NjsgaSAqPSAyKSB7XG4gICAgaWYgKHJhZGl1cyA8PSBpKSB7XG4gICAgICBnYXVzc2lhbiA9IHNoYWRlcnMuYmx1clsnZ2F1c3NpYW4nICsgaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgdGhpcy5jaGFpbigpXG4gIC51c2VTaGFkZXIoZ2F1c3NpYW4pXG4gIC5zZXQoJ3NpZ21hJywgcmFkaXVzIC8gMylcbiAgLnNldCgnYXhpcycsIFsxLCAwXSlcbiAgLnJ1bigpXG4gIC51c2VTaGFkZXIoZ2F1c3NpYW4pXG4gIC5zZXQoJ3NpZ21hJywgcmFkaXVzIC8gMylcbiAgLnNldCgnYXhpcycsIFswLCAxXSlcbiAgLnJ1bigpXG4gIC5kb25lKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuYnJpZ2h0bmVzc0NvbnRyYXN0ID0gZnVuY3Rpb24oYnJpZ2h0bmVzcywgY29udHJhc3QpIHtcbiAgYnJpZ2h0bmVzcyA9IGJyaWdodG5lc3MgfHwgMFxuICBjb250cmFzdCA9IHV0aWxzLmlzTm90aGluZyhjb250cmFzdCkgPyAxIDogY29udHJhc3RcblxuICB0aGlzLnVzZVNoYWRlcihzaGFkZXJzLmVmZmVjdHNbJ2JyaWdodG5lc3MtY29udHJhc3QnXSlcbiAgLnNldCgnYnJpZ2h0bmVzcycsIGJyaWdodG5lc3MpXG4gIC5zZXQoJ2NvbnRyYXN0JywgY29udHJhc3QpXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5odWVTYXR1cmF0aW9uID0gZnVuY3Rpb24oaHVlLCBzYXR1cmF0aW9uLCBsaWdodG5lc3MpIHtcbiAgaHVlID0gaHVlIHx8IDBcbiAgc2F0dXJhdGlvbiA9IHNhdHVyYXRpb24gfHwgMFxuICBsaWdodG5lc3MgPSBsaWdodG5lc3MgfHwgMFxuXG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuZWZmZWN0c1snaHVlLXNhdHVyYXRpb24nXSlcbiAgLnNldCgnaHVlJywgaHVlKVxuICAuc2V0KCdzYXR1cmF0aW9uJywgc2F0dXJhdGlvbilcbiAgLnNldCgnbGlnaHRuZXNzJywgbGlnaHRuZXNzKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuc3BsaXRUb25lID0gZnVuY3Rpb24oaGlnaGxpZ2h0LCBzaGFkb3cpIHtcbiAgaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0IHx8IFswLjUsIDAuNSwgMC41XVxuICBzaGFkb3cgPSBzaGFkb3cgfHwgWzAuNSwgMC41LCAwLjVdXG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5lZmZlY3RzWydzcGxpdC10b25lJ10pXG4gIC5zZXQoJ2hpZ2hsaWdodCcsIGhpZ2hsaWdodClcbiAgLnNldCgnc2hhZG93Jywgc2hhZG93KVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuZHVvdG9uZSA9IGZ1bmN0aW9uKGhpZ2hsaWdodCwgc2hhZG93KSB7XG4gIGhpZ2hsaWdodCA9IGhpZ2hsaWdodCB8fCBbMSwgMSwgMV1cbiAgc2hhZG93ID0gc2hhZG93IHx8IFsxLCAxLCAxXVxuXG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuZWZmZWN0cy5kdW90b25lKVxuICAuc2V0KCdoaWdobGlnaHQnLCBoaWdobGlnaHQpXG4gIC5zZXQoJ3NoYWRvdycsIHNoYWRvdylcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLnNoYXJwZW4gPSBmdW5jdGlvbihzdHJlbmd0aCwgcmFkaXVzKSB7XG4gIHJhZGl1cyA9IHJhZGl1cyB8fCA1XG5cbiAgdmFyIHNvdXJjZSA9IHRoaXMuc291cmNlVW5pdFxuICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXRVbml0XG5cbiAgdGhpcy5zZXRUYXJnZXQodGhpcy5fdW5pdFsyXSlcbiAgLmNvcHkoKVxuICAuc2V0U291cmNlKHRoaXMuX3VuaXRbMl0pLnNldFRhcmdldCh0aGlzLl91bml0WzNdKVxuICAuYmx1cihyYWRpdXMpXG4gIC5zZXRTb3VyY2UodGhpcy5fdW5pdFsyXSkuc2V0VGFyZ2V0KHRhcmdldClcbiAgLnVzZVNoYWRlcihzaGFkZXJzLmVmZmVjdHMuc2hhcnBlbilcbiAgLnNldCgnc3RyZW5ndGgnLCBzdHJlbmd0aClcbiAgLnNldCgnYmFja2dyb3VuZCcsIHRoaXMuX3VuaXRbM10sIG51bGwpXG4gIC5ydW4oKVxuICAuc2V0U291cmNlKHNvdXJjZSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUudmlnbmV0dGUgPSBmdW5jdGlvbihkYXJrZW4sIGJyaWdodGVuKSB7XG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuZWZmZWN0cy52aWduZXR0ZSlcbiAgLnNldCgnZGFya2VuJywgZGFya2VuKVxuICAuc2V0KCdicmlnaHRlbicsIGJyaWdodGVuKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBzZXRTdGFnZShzb3VyY2VVbml0LCB0YXJnZXRVbml0Wywgbm9kZV0pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHNvdXJjZSB1bml0IGFuZCB0YXJnZXQgdW5pdCwgYW5kIG9wdGlvbmFsbHkgbG9hZCBpbWFnZSBmcm9tIG5vZGUgdG8gXG4vLyBzb3VyY2UgdW5pdC4gSXQgcmVzaXplcyB0YXJnZXQgdW5pdCB0byBtYXRjaCBzb3VyY2UgdW5pdCBhZnRlcndhcmRzLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRTdGFnZSA9IGZ1bmN0aW9uKHNvdXJjZVVuaXQsIHRhcmdldFVuaXQsIG5vZGUpIHtcbiAgdGhpcy5zZXRTb3VyY2Uoc291cmNlVW5pdCwgbm9kZSkuc2V0VGFyZ2V0KHRhcmdldFVuaXQpXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5jaGFpbiA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5fY2hhaW4uY291bnQgPiAwKSB7XG4gICAgdGhpcy5fY2hhaW4uY291bnQgKz0gMVxuICB9IGVsc2Uge1xuICAgIHRoaXMuX2NoYWluID0ge3NvdXJjZTogdGhpcy5zb3VyY2VVbml0LCB0YXJnZXQ6IHRoaXMudGFyZ2V0VW5pdCwgdW5pdDogMCwgY291bnQ6IDF9XG4gICAgdGhpcy5zZXRUYXJnZXQodGhpcy5fdW5pdFswXSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuZG9uZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5fY2hhaW4uY291bnQgPD0gMCkgcmV0dXJuIHRoaXNcbiAgdGhpcy5fY2hhaW4uY291bnQgLT0gMVxuICBpZiAodGhpcy5fY2hhaW4uY291bnQgPT09IDApIHtcbiAgICB0aGlzLnNldFRhcmdldCh0aGlzLl9jaGFpbi50YXJnZXQpLmNvcHkoKS5zZXRTb3VyY2UodGhpcy5fY2hhaW4uc291cmNlKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbi8vIGdldFNvdXJjZSgpXG4vLyByZXR1cm5zIGN1cnJlbnQgc291cmNlIGltYWdlXG4vL1xuR2xpbWcucHJvdG90eXBlLmdldFNvdXJjZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fdGV4dHVyZXNbdGhpcy5zb3VyY2VVbml0XVxufVxuXG4vLyBzZXRTb3VyY2UodW5pdFssIG5vZGVdKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCBzb3VyY2UgdW5pdCwgYW5kIG9wdGlvbmFsbHkgbG9hZCBpbWFnZSBmcm9tIG5vZGUgdG8gc291cmNlIHVuaXQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnNldFNvdXJjZSA9IGZ1bmN0aW9uKHVuaXQsIG5vZGUpIHtcbiAgdGhpcy5zb3VyY2VVbml0ID0gdW5pdFxuICBpZiAobm9kZSkgdGhpcy51c2VUZXh0dXJlKHVuaXQsIG5vZGUpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIGdldFRhcmdldCgpXG4vLyByZXR1cm5zIGN1cnJlbnQgdGFyZ2V0IGltYWdlLCBudWxsIGlmIHRhcmdldCBpcyB0aGUgY2FudmFzXG4vL1xuR2xpbWcucHJvdG90eXBlLmdldFRhcmdldCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fdGV4dHVyZXNbdGhpcy50YXJnZXRVbml0XVxufVxuXG4vLyBzZXRUYXJnZXQodW5pdClcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBTZXQgdGFyZ2V0IHVuaXQuIEl0IHJlc2l6ZXMgdGFyZ2V0IHVuaXQgdG8gbWF0Y2ggc291cmNlIHVuaXQgYWZ0ZXJ3YXJkcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0VGFyZ2V0ID0gZnVuY3Rpb24odW5pdCkge1xuICB0aGlzLnRhcmdldFVuaXQgPSB1bml0XG5cbiAgaWYgKHV0aWxzLmlzTm90aGluZyh1bml0KSkge1xuICAgIHRoaXMuZ2wuYmluZEZyYW1lYnVmZmVyKHRoaXMuZ2wuRlJBTUVCVUZGRVIsIG51bGwpXG4gIH1cblxuICB2YXIgc291cmNlID0gdGhpcy5nZXRTb3VyY2UoKVxuICBpZiAoc291cmNlKSB0aGlzLnNldFNpemUoc291cmNlLndpZHRoLCBzb3VyY2UuaGVpZ2h0KVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHVzZVNoYWRlcihzb3VyY2UpXG4vLyByZXR1cm5zIGEgU2hhZGVyIG9iamVjdFxuLy9cbi8vIENyZWF0ZSBhbmQgY2FjaGUgYSBXZWJHTCBzaGFkZXIgcHJvZ3JhbSBmcm9tIHNvdXJjZSBhbmQgcmV0dXJuIGl0LiBVc2UgY2FjaGVkIFxuLy8gc2hhZGVyIGlmIHBvc3NpYmxlLlxuLy9cbi8vIFRoZSBzb3VyY2Ugc2hvdWxkIGJlIGEgZnJhZ21lbnQgc2hhZGVyIGJhc2VkIG9uIGdsaW1nLnNoYWRlcnMuY29weS4gSXQgd2lsbCBcbi8vIGJlIGNvbXBpbGVkIGFuZCBsaW5rZWQgd2l0aCBnbGltZy5zaGFkZXJzLnZlcnRleC5cbi8vXG4vLyBHbGltZyBzaGFkZXJzIGFyZSBsb2FkZWQgaW4gZ2xpbWcuc2hhZGVycywgdGhlaXIgc291cmNlIGZpbGVzIGFyZSBsb2NhdGVkIGF0IFxuLy8gc3JjL3NoYWRlcnMuIFRha2UgYSBsb29rIGF0IHRoZSBzb3VyY2VzIHRvIHNlZSBob3cgdGhleSBhcmUgb3JnYW5pemVkLlxuLy9cbkdsaW1nLnByb3RvdHlwZS51c2VTaGFkZXIgPSBmdW5jdGlvbihzb3VyY2UpIHtcbiAgaWYgKCF0aGlzLl9zaGFkZXJzW3NvdXJjZV0pIHtcbiAgICB0aGlzLl9zaGFkZXJzW3NvdXJjZV0gPSBuZXcgU2hhZGVyKHRoaXMsIHNvdXJjZSlcbiAgfVxuXG4gIHZhciB0ZXh0dXJlID0gdGhpcy5nZXRTb3VyY2UoKVxuICB0aGlzLl9zaGFkZXJzW3NvdXJjZV1cbiAgLnVzZSgpXG4gIC5zZXQoJ2FTb3VyY2VDb29yZCcsIDAsIDAsIDEsIDEpXG4gIC5zZXQoJ2FUYXJnZXRDb29yZCcsIDAsIDAsIDEsIDEpXG4gIC5zZXQoJ2FNYXNrQ29vcmQnLCAwLCAwLCAxLCAxKVxuICAuc2V0KCdmbGlwWScsIHRoaXMudGFyZ2V0VW5pdCA9PT0gbnVsbCA/IC0xIDogMSlcbiAgLnNldCgnc291cmNlJywgdGhpcy5zb3VyY2VVbml0LCBudWxsKVxuICAuc2V0KCdzaXplJywgWzEgLyB0ZXh0dXJlLndpZHRoLCAxIC8gdGV4dHVyZS5oZWlnaHQsIHRleHR1cmUud2lkdGgsIHRleHR1cmUuaGVpZ2h0XSlcblxuICByZXR1cm4gdGhpcy5fc2hhZGVyc1tzb3VyY2VdXG59XG5cbkdsaW1nLnByb3RvdHlwZS5zdGVwID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA8PSAwIHx8IHRoaXMuX2hvbGRDaGFpbikgcmV0dXJuIHRoaXNcbiAgdmFyIHVuaXQgPSB0aGlzLl9jaGFpbi51bml0ID09PSAwID8gMSA6IDBcbiAgdGhpcy5zZXRTb3VyY2UodGhpcy50YXJnZXRVbml0KS5zZXRUYXJnZXQodGhpcy5fdW5pdFt1bml0XSlcbiAgdGhpcy5fY2hhaW4udW5pdCA9IHVuaXRcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gcHJpdmF0ZVxuLy8gdXNlQnVmZmVyKGFycmF5KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIENyZWF0ZSBhbmQgY2FjaGUgYSBXZWJHTCBidWZmZXIgZnJvbSBhcnJheS4gVXNlIGNhY2hlZCBidWZmZXIgaWYgcG9zc2libGUuXG4vL1xuLy8gVG8gY3JlYXRlL3Bhc3MgdmVydGljZXMgdG8gc2hhZGVyLCB1c2Ugc2hhZGVyLnNldCgpIGluc3RlYWQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnVzZUJ1ZmZlciA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gIGlmICghdXRpbHMuaXNBcnJheShhcnJheSkpIGFycmF5ID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gIHZhciBrZXkgPSBhcnJheS5qb2luKClcblxuICBpZiAoIXRoaXMuX2J1ZmZlcnNba2V5XSkge1xuICAgIHRoaXMuX2J1ZmZlcnNba2V5XSA9IG5ldyBCdWZmZXIodGhpcy5nbCwgYXJyYXkpXG4gIH1cbiAgdGhpcy5fYnVmZmVyc1trZXldLmJpbmQoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHByaXZhdGVcbi8vIHVzZVRleHR1cmUodW5pdCwgbm9kZSlcbi8vIHVzZVRleHR1cmUodW5pdCwgd2lkdGgsIGhlaWdodClcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBDcmVhdGUgYW5kIGNhY2hlIGEgV2ViR0wgdGV4dHVyZSB1bml0IGZyb20gbm9kZSwgb3IgY3JlYXRlIGEgZnJhbWVidWZmZXIgXG4vLyB0ZXh1dHJlIGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIHByb3ZpZGVkLiBVc2UgY2FjaGVkIHRleHR1cmUgaWYgcG9zc2libGUuXG4vL1xuLy8gVG8gY3JlYXRlL3Bhc3MgdGV4dHVyZXMgdG8gc2hhZGVyLCB1c2Ugc2hhZGVyLnNldCgpIGluc3RlYWQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnVzZVRleHR1cmUgPSBmdW5jdGlvbih1bml0LCBub2RlT3JEYXRhLCB3aWR0aCwgaGVpZ2h0KSB7XG4gIHZhciB0ZXh0dXJlID0gdGhpcy5fdGV4dHVyZXNbdW5pdF1cbiAgdmFyIHJldXNlID0gIW5vZGVPckRhdGEgJiYgdGV4dHVyZSAmJiB0ZXh0dXJlLmZyYW1lYnVmZmVyICYmXG4gICAgICAgICAgICAgIHRleHR1cmUud2lkdGggPT09IHdpZHRoICYmIHRleHR1cmUuaGVpZ2h0ID09PSBoZWlnaHRcblxuICBpZiAoIXJldXNlKSB7XG4gICAgaWYgKHRoaXMuX3RleHR1cmVzW3VuaXRdKSB0aGlzLl90ZXh0dXJlc1t1bml0XS5kZXN0cm95KClcbiAgICB0aGlzLl90ZXh0dXJlc1t1bml0XSA9IG5ldyBUZXh0dXJlKHRoaXMuZ2wsIHVuaXQsIG5vZGVPckRhdGEsIHdpZHRoLCBoZWlnaHQsIHRoaXMub3B0aW9ucylcbiAgfVxuXG4gIHRoaXMuX3RleHR1cmVzW3VuaXRdLmJpbmQoKVxuICByZXR1cm4gdGhpc1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBnbGltZ1xuXG52YXIgR2xpbWcgPSByZXF1aXJlKCcuL2dsaW1nJylcblxuZnVuY3Rpb24gZ2xpbWcoY2FudmFzLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgR2xpbWcoY2FudmFzLCBvcHRpb25zKVxufVxuXG5pbml0KGdsaW1nKVxuXG5mdW5jdGlvbiBpbml0KGdsaW1nKSB7XG4gIGdsaW1nLmluZm8gPSB7fVxuICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgdmFyIGdsID0gY2FudmFzLmdldENvbnRleHQoJ3dlYmdsJykgfHwgY2FudmFzLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcpXG4gIGlmIChnbCkge1xuICAgIGdsaW1nLmluZm8uc3VwcG9ydGVkID0gdHJ1ZVxuICAgIGdsaW1nLmluZm8ubWF4U2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKVxuICAgIGdsaW1nLmluZm8ubWF4VW5pdCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9JTUFHRV9VTklUUykgLSA0XG4gIH0gZWxzZSB7XG4gICAgZ2xpbWcuaW5mby5zdXBwb3J0ZWQgPSBmYWxzZVxuICB9XG5cbiAgZ2xpbWcuc2hhZGVycyA9IHJlcXVpcmUoJy4vc2hhZGVycycpXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFNoYWRlclxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gU2hhZGVyKGdsaW1nLCBzb3VyY2UpIHtcbiAgdGhpcy5nbGltZyA9IGdsaW1nXG4gIHZhciBnbCA9IHRoaXMuZ2wgPSBnbGltZy5nbFxuICB2YXIgdmVydGV4ID0gcmVxdWlyZSgnLi9zaGFkZXJzJykuY29yZS52ZXJ0ZXhcbiAgdmFyIHZlcnRleFNoYWRlciA9IGNyZWF0ZVNoYWRlcihnbCwgZ2wuVkVSVEVYX1NIQURFUiwgdmVydGV4KVxuICB2YXIgZnJhZ21lbnRTaGFkZXIgPSBjcmVhdGVTaGFkZXIoZ2wsIGdsLkZSQUdNRU5UX1NIQURFUiwgc291cmNlKVxuICB2YXIgcHJvZ3JhbSA9IHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKVxuXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCBmcmFnbWVudFNoYWRlcilcbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSlcblxuICBnbC5kZWxldGVTaGFkZXIodmVydGV4U2hhZGVyKVxuICBnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpXG5cbiAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkgdGhyb3cgJ3NoYWRlciBsaW5rIGVycm9yJ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKVxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZnVuY1xuXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDIpIHtcbiAgICBpZiAodXRpbHMuaXNOdW1iZXIodmFsdWVzKSkge1xuICAgICAgZnVuYyA9ICdzZXRGbG9hdCdcbiAgICB9IGVsc2UgaWYgKHV0aWxzLmlzQXJyYXkodmFsdWVzKSkge1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPD0gNCB8fCB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkpIHtcbiAgICAgICAgZnVuYyA9ICdzZXRWZWN0b3InXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmdW5jID0gJ3NldE1hdHJpeCdcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAzKSB7XG4gICAgZnVuYyA9ICdzZXRUZXh0dXJlJ1xuICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gNSkge1xuICAgIGZ1bmMgPSAnc2V0UmVjdCdcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyAnaW52YWxpZCBhcmd1bWVudHMnXG4gIH1cblxuICByZXR1cm4gdGhpc1tmdW5jXS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cblNoYWRlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZHJhd0FycmF5cyh0aGlzLmdsLlRSSUFOR0xFX1NUUklQLCAwLCA0KVxuICB0aGlzLmdsaW1nLnN0ZXAoKVxuICByZXR1cm4gdGhpcy5nbGltZ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldEZsb2F0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGdsLnVuaWZvcm0xZihsb2NhdGlvbiwgdmFsdWUpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldFZlY3RvciA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgdmFyIG4gPSB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkgPyB2YWx1ZXNbMF0ubGVuZ3RoIDogdmFsdWVzLmxlbmd0aFxuICAgIHZhciBmdW5jID0gJ3VuaWZvcm0nICsgbiArICdmdidcbiAgICBnbFtmdW5jXShsb2NhdGlvbiwgW10uY29uY2F0KHZhbHVlcykpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldE1hdHJpeCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDQpIHtcbiAgICAgIGdsLnVuaWZvcm1NYXRyaXgyZnYobG9jYXRpb24sIGZhbHNlLCB2YWx1ZXMpXG4gICAgfSBlbHNlIGlmICh2YWx1ZXMubGVuZ3RoID09PSA5KSB7XG4gICAgICBnbC51bmlmb3JtTWF0cml4M2Z2KGxvY2F0aW9uLCBmYWxzZSwgdmFsdWVzKVxuICAgIH0gZWxzZSBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMTYpIHtcbiAgICAgIGdsLnVuaWZvcm1NYXRyaXg0ZnYobG9jYXRpb24sIGZhbHNlLCB2YWx1ZXMpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5zZXRUZXh0dXJlID0gZnVuY3Rpb24obmFtZSwgdW5pdCwgbm9kZSwgd2lkdGgsIGhlaWdodCkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgaWYgKG5vZGUpIHRoaXMuZ2xpbWcudXNlVGV4dHVyZSh1bml0LCBub2RlLCB3aWR0aCwgaGVpZ2h0KVxuICAgIGdsLnVuaWZvcm0xaShsb2NhdGlvbiwgdW5pdClcbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uKG5hbWUsIGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLCBuYW1lKVxuICBpZiAobG9jYXRpb24gIT09IG51bGwpIHtcbiAgICB0aGlzLmdsaW1nLnVzZUJ1ZmZlcihsZWZ0LCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIHRvcCwgcmlnaHQsIGJvdHRvbSlcbiAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2NhdGlvbilcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvY2F0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5nbC5kZWxldGVQcm9ncmFtKHRoaXMucHJvZ3JhbSlcbiAgdGhpcy5wcm9ncmFtID0gbnVsbFxuICB0aGlzLmdsID0gbnVsbFxuICB0aGlzLmdsaW1nID0gbnVsbFxufVxuXG5mdW5jdGlvbiBjcmVhdGVTaGFkZXIoZ2wsIHR5cGUsIHNvdXJjZSkge1xuICB2YXIgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKHR5cGUpXG4gIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNvdXJjZSlcbiAgZ2wuY29tcGlsZVNoYWRlcihzaGFkZXIpXG4gIHJldHVybiBzaGFkZXJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBjb3JlOiB7XG4gICAgdmVydGV4OiBcImF0dHJpYnV0ZSB2ZWMyIGFTb3VyY2VDb29yZDtcXG5hdHRyaWJ1dGUgdmVjMiBhVGFyZ2V0Q29vcmQ7XFxuYXR0cmlidXRlIHZlYzIgYU1hc2tDb29yZDtcXG51bmlmb3JtIGZsb2F0IGZsaXBZO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gICBnbF9Qb3NpdGlvbiA9IHZlYzQoKGFUYXJnZXRDb29yZCAqIDIuMCAtIDEuMCkgKiB2ZWMyKDEsIGZsaXBZKSwgMC4wLCAxLjApO1xcbiAgIGNvb3JkID0gYVNvdXJjZUNvb3JkO1xcbiAgIG1hc2tDb29yZCA9IGFNYXNrQ29vcmQ7XFxufVxcblwiLFxuICAgIGNvcHk6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG59XFxuXCIsXG4gICAgdHJhbnNmb3JtOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gbWF0MiB0cmFuc2Zvcm07XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGZpcnN0IC0wLjUgaXMgYXBwbGllZCB0byBjZW50ZXIgaW1hZ2VcXG4gIC8vIHRoZW4gd2lkdGg6aGVpZ2h0IHJhdGlvIGlzIGFwcGxpZWQgdG8ga2VlcCBhc3BlY3RcXG4gIC8vIHRoZW4gdHJhbnNmb3JtIGlzIGFwcGxpZWRcXG4gIC8vIHRoZW4gcHJlLXRyYW5zZm9ybXMgYXJlIHJldmVyc2VkXFxuICAvL1xcbiAgdmVjMiByID0gdmVjMihzaXplLnAgLyBzaXplLnEsIDEuMCk7XFxuICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB0cmFuc2Zvcm0gKiAoKGNvb3JkIC0gMC41KSAqIHIpIC8gciArIDAuNSk7XFxufVxcblwiXG4gIH0sXG4gIGJsZW5kOiB7XG4gICAgbm9ybWFsOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IHNyYztcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIG11bHRpcGx5OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IHNyYyAqIGRzdDtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIHNjcmVlbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSAxLjAgLSAoMS4wIC0gc3JjKSAqICgxLjAgLSBkc3QpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgb3ZlcmxheTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQuciA9IGRzdC5yIDwgMC41ID8gMi4wICogc3JjLnIgKiBkc3QuciA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMucikgKiAoMS4wIC0gZHN0LnIpO1xcbiAgYmxlbmQuZyA9IGRzdC5nIDwgMC41ID8gMi4wICogc3JjLmcgKiBkc3QuZyA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMuZykgKiAoMS4wIC0gZHN0LmcpO1xcbiAgYmxlbmQuYiA9IGRzdC5iIDwgMC41ID8gMi4wICogc3JjLmIgKiBkc3QuYiA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMuYikgKiAoMS4wIC0gZHN0LmIpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgZGFya2VuOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IG1pbihzcmMsIGRzdCk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBsaWdodGVuOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IG1heChzcmMsIGRzdCk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICAnY29sb3ItZG9kZ2UnOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZC5yID0gc3JjLnIgPT0gMS4wID8gMS4wIDogZHN0LnIgLyAoMS4wIC0gc3JjLnIpO1xcbiAgYmxlbmQuZyA9IHNyYy5nID09IDEuMCA/IDEuMCA6IGRzdC5nIC8gKDEuMCAtIHNyYy5nKTtcXG4gIGJsZW5kLmIgPSBzcmMuYiA9PSAxLjAgPyAxLjAgOiBkc3QuYiAvICgxLjAgLSBzcmMuYik7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICAnY29sb3ItYnVybic6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kLnIgPSBzcmMuciA9PSAwLjAgPyAwLjAgOiAxLjAgLSAoMS4wIC0gZHN0LnIpIC8gc3JjLnI7XFxuICBibGVuZC5nID0gc3JjLmcgPT0gMC4wID8gMC4wIDogMS4wIC0gKDEuMCAtIGRzdC5nKSAvIHNyYy5nO1xcbiAgYmxlbmQuYiA9IHNyYy5iID09IDAuMCA/IDAuMCA6IDEuMCAtICgxLjAgLSBkc3QuYikgLyBzcmMuYjtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgICdoYXJkLWxpZ2h0JzogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQuciA9IHNyYy5yIDwgMC41ID8gMi4wICogc3JjLnIgKiBkc3QuciA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMucikgKiAoMS4wIC0gZHN0LnIpO1xcbiAgYmxlbmQuZyA9IHNyYy5nIDwgMC41ID8gMi4wICogc3JjLmcgKiBkc3QuZyA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMuZykgKiAoMS4wIC0gZHN0LmcpO1xcbiAgYmxlbmQuYiA9IHNyYy5iIDwgMC41ID8gMi4wICogc3JjLmIgKiBkc3QuYiA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMuYikgKiAoMS4wIC0gZHN0LmIpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgJ3NvZnQtbGlnaHQnOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZC5yID0gc3JjLnIgPCAwLjUgPyAyLjAgKiBzcmMuciAqIGRzdC5yICsgZHN0LnIgKiBkc3QuciAqICgxLjAgLSAyLjAgKiBzcmMucilcXG4gICAgOiBzcXJ0KGRzdC5yKSAqICgyLjAgKiBzcmMuciAtIDEuMCkgKyAyLjAgKiBkc3QuciAqICgxLjAgLSBzcmMucik7XFxuICBibGVuZC5nID0gc3JjLmcgPCAwLjUgPyAyLjAgKiBzcmMuZyAqIGRzdC5nICsgZHN0LmcgKiBkc3QuZyAqICgxLjAgLSAyLjAgKiBzcmMuZylcXG4gICAgOiBzcXJ0KGRzdC5nKSAqICgyLjAgKiBzcmMuZyAtIDEuMCkgKyAyLjAgKiBkc3QuZyAqICgxLjAgLSBzcmMuZyk7XFxuICBibGVuZC5iID0gc3JjLmIgPCAwLjUgPyAyLjAgKiBzcmMuYiAqIGRzdC5iICsgZHN0LmIgKiBkc3QuYiAqICgxLjAgLSAyLjAgKiBzcmMuYilcXG4gICAgOiBzcXJ0KGRzdC5iKSAqICgyLjAgKiBzcmMuYiAtIDEuMCkgKyAyLjAgKiBkc3QuYiAqICgxLjAgLSBzcmMuYik7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSBvcGFjaXR5ICogdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCkuYTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBkaWZmZXJlbmNlOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IGFicyhkc3QgLSBzcmMpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgZXhjbHVzaW9uOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBvcGFjaXR5O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IHNyYyArIGRzdCAtIDIuMCAqIHNyYyAqIGRzdDtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGh1ZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52ZWMzIHJnYjJoY2wodmVjMyBjKSB7XFxuICB2ZWM0IHAgPSBjLnIgPiBjLmcgPyB2ZWM0KGMucmdiLCAwLjApIDogdmVjNChjLmdiciwgMi4wKTtcXG4gIHZlYzQgcSA9IGMuYiA+IHAueCA/IHZlYzQoYy5icmcsIDQuMCkgOiBwO1xcblxcbiAgZmxvYXQgTSA9IHEueDtcXG4gIGZsb2F0IG0gPSBtaW4ocS55LCBxLnopO1xcbiAgZmxvYXQgQyA9IE0gLSBtO1xcblxcbiAgZmxvYXQgSCA9IEMgPT0gMC4wID8gMC4wIDogbW9kKChxLnkgLSBxLnopIC8gQyArIHEudywgNi4wKTtcXG4gIGZsb2F0IEwgPSAwLjUgKiAoTSArIG0pO1xcblxcbiAgcmV0dXJuIHZlYzMoSCwgQywgTCk7XFxufVxcblxcbnZlYzMgaGNsMnJnYih2ZWMzIGMpIHtcXG4gIGZsb2F0IEggPSBjLng7XFxuXFxuICBmbG9hdCBSID0gYWJzKEggLSAzLjApIC0gMS4wO1xcbiAgZmxvYXQgRyA9IDIuMCAtIGFicyhIIC0gMi4wKTtcXG4gIGZsb2F0IEIgPSAyLjAgLSBhYnMoSCAtIDQuMCk7XFxuICB2ZWMzIHJnYiA9IGNsYW1wKHZlYzMoUiwgRywgQiksIDAuMCwgMS4wKTtcXG5cXG4gIHJldHVybiAocmdiIC0gMC41KSAqIGMueSArIGMuejtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIHZlYzMgaGNsID0gcmdiMmhjbChkc3QucmdiKTtcXG4gIGJsZW5kLnJnYiA9IGhjbDJyZ2IodmVjMyhyZ2IyaGNsKHNyYy5yZ2IpLngsIGhjbC55LCBoY2wueikpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgc2F0dXJhdGlvbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52ZWMzIHJnYjJoY2wodmVjMyBjKSB7XFxuICB2ZWM0IHAgPSBjLnIgPiBjLmcgPyB2ZWM0KGMucmdiLCAwLjApIDogdmVjNChjLmdiciwgMi4wKTtcXG4gIHZlYzQgcSA9IGMuYiA+IHAueCA/IHZlYzQoYy5icmcsIDQuMCkgOiBwO1xcblxcbiAgZmxvYXQgTSA9IHEueDtcXG4gIGZsb2F0IG0gPSBtaW4ocS55LCBxLnopO1xcbiAgZmxvYXQgQyA9IE0gLSBtO1xcblxcbiAgZmxvYXQgSCA9IEMgPT0gMC4wID8gMC4wIDogbW9kKChxLnkgLSBxLnopIC8gQyArIHEudywgNi4wKTtcXG4gIGZsb2F0IEwgPSAwLjUgKiAoTSArIG0pO1xcblxcbiAgcmV0dXJuIHZlYzMoSCwgQywgTCk7XFxufVxcblxcbnZlYzMgaGNsMnJnYih2ZWMzIGMpIHtcXG4gIGZsb2F0IEggPSBjLng7XFxuXFxuICBmbG9hdCBSID0gYWJzKEggLSAzLjApIC0gMS4wO1xcbiAgZmxvYXQgRyA9IDIuMCAtIGFicyhIIC0gMi4wKTtcXG4gIGZsb2F0IEIgPSAyLjAgLSBhYnMoSCAtIDQuMCk7XFxuICB2ZWMzIHJnYiA9IGNsYW1wKHZlYzMoUiwgRywgQiksIDAuMCwgMS4wKTtcXG5cXG4gIHJldHVybiAocmdiIC0gMC41KSAqIGMueSArIGMuejtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIHZlYzMgaGNsID0gcmdiMmhjbChkc3QucmdiKTtcXG4gIGJsZW5kLnJnYiA9IGhjbDJyZ2IodmVjMyhoY2wueCwgcmdiMmhjbChzcmMucmdiKS55LCBoY2wueikpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gb3BhY2l0eSAqIHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpLmE7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgY29sb3I6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woc3JjLnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMoaGNsLngsIGhjbC55LCByZ2IyaGNsKGRzdC5yZ2IpLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGx1bWlub3NpdHk6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IG9wYWNpdHk7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woZHN0LnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMoaGNsLngsIGhjbC55LCByZ2IyaGNsKHNyYy5yZ2IpLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IG9wYWNpdHkgKiB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKS5hO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiXG4gIH0sXG4gIGJsdXI6IHtcbiAgICBnYXVzc2lhbjI6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDIuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICAgIGdhdXNzaWFuNDogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gNC4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW44OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSA4LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgICBnYXVzc2lhbjE2OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAxNi4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW4zMjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gMzIuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICAgIGdhdXNzaWFuNjQ6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDY0LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgICBnYXVzc2lhbjEyODogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gMTI4LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgICBnYXVzc2lhbjI1NjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gMjU2LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIlxuICB9LFxuICBlZmZlY3RzOiB7XG4gICAgJ2JyaWdodG5lc3MtY29udHJhc3QnOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG51bmlmb3JtIGZsb2F0IGJyaWdodG5lc3M7XFxudW5pZm9ybSBmbG9hdCBjb250cmFzdDtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG5jb25zdCBmbG9hdCBlID0gMTBlLTEwO1xcblxcbmZsb2F0IGx1bWEodmVjMyBjKSB7XFxuICByZXR1cm4gMC4yOTkgKiBjLnIgKyAwLjU4NyAqIGMuZyArIDAuMTE0ICogYy5iO1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG5cXG4gIC8qXFxuICBmbG9hdCBsID0gbHVtYShzcmMucmdiKTtcXG4gIHNyYy5yZ2IgKj0gKChsICsgYnJpZ2h0bmVzcyAtIDAuNSkgKiBjb250cmFzdCArIDAuNSkgLyAobCArIGUpO1xcbiAgKi9cXG5cXG4gIHNyYy5yZ2IgPSAoc3JjLnJnYiArIGJyaWdodG5lc3MgLSAwLjUpICogY29udHJhc3QgKyAwLjU7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzcmM7XFxufVxcblwiLFxuICAgICdodWUtc2F0dXJhdGlvbic6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gZmxvYXQgaHVlO1xcbnVuaWZvcm0gZmxvYXQgc2F0dXJhdGlvbjtcXG51bmlmb3JtIGZsb2F0IGxpZ2h0bmVzcztcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52ZWMzIHJnYjJoY2wodmVjMyBjKSB7XFxuICB2ZWM0IHAgPSBjLnIgPiBjLmcgPyB2ZWM0KGMucmdiLCAwLjApIDogdmVjNChjLmdiciwgMi4wKTtcXG4gIHZlYzQgcSA9IGMuYiA+IHAueCA/IHZlYzQoYy5icmcsIDQuMCkgOiBwO1xcblxcbiAgZmxvYXQgTSA9IHEueDtcXG4gIGZsb2F0IG0gPSBtaW4ocS55LCBxLnopO1xcbiAgZmxvYXQgQyA9IE0gLSBtO1xcblxcbiAgZmxvYXQgSCA9IEMgPT0gMC4wID8gMC4wIDogbW9kKChxLnkgLSBxLnopIC8gQyArIHEudywgNi4wKTtcXG4gIGZsb2F0IEwgPSAwLjUgKiAoTSArIG0pO1xcblxcbiAgcmV0dXJuIHZlYzMoSCwgQywgTCk7XFxufVxcblxcbnZlYzMgaGNsMnJnYih2ZWMzIGMpIHtcXG4gIGZsb2F0IEggPSBjLng7XFxuXFxuICBmbG9hdCBSID0gYWJzKEggLSAzLjApIC0gMS4wO1xcbiAgZmxvYXQgRyA9IDIuMCAtIGFicyhIIC0gMi4wKTtcXG4gIGZsb2F0IEIgPSAyLjAgLSBhYnMoSCAtIDQuMCk7XFxuICB2ZWMzIHJnYiA9IGNsYW1wKHZlYzMoUiwgRywgQiksIDAuMCwgMS4wKTtcXG5cXG4gIHJldHVybiAocmdiIC0gMC41KSAqIGMueSArIGMuejtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woc3JjLnJnYik7XFxuICBoY2wueCA9IG1vZChoY2wueCArIGh1ZSAqIDYuMCwgNi4wKTtcXG4gIGhjbC55ICo9IHNhdHVyYXRpb247XFxuICBoY2wueiArPSBsaWdodG5lc3M7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGhjbDJyZ2IoaGNsKSwgc3JjLmEpO1xcbn1cXG5cIixcbiAgICAnc3BsaXQtdG9uZSc6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnVuaWZvcm0gdmVjMyBoaWdobGlnaHQ7XFxudW5pZm9ybSB2ZWMzIHNoYWRvdztcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG5jb25zdCBmbG9hdCBlID0gMTBlLTEwO1xcblxcbnZlYzMgc29mdGxpZ2h0KHZlYzMgc3JjLCB2ZWMzIGRzdCkge1xcbiAgdmVjMyBjb2xvcjtcXG4gIGNvbG9yLnIgPSBzcmMuciA8IDAuNSA/IDIuMCAqIHNyYy5yICogZHN0LnIgKyBkc3QuciAqIGRzdC5yICogKDEuMCAtIDIuMCAqIHNyYy5yKVxcbiAgICA6IHNxcnQoZHN0LnIpICogKDIuMCAqIHNyYy5yIC0gMS4wKSArIDIuMCAqIGRzdC5yICogKDEuMCAtIHNyYy5yKTtcXG4gIGNvbG9yLmcgPSBzcmMuZyA8IDAuNSA/IDIuMCAqIHNyYy5nICogZHN0LmcgKyBkc3QuZyAqIGRzdC5nICogKDEuMCAtIDIuMCAqIHNyYy5nKVxcbiAgICA6IHNxcnQoZHN0LmcpICogKDIuMCAqIHNyYy5nIC0gMS4wKSArIDIuMCAqIGRzdC5nICogKDEuMCAtIHNyYy5nKTtcXG4gIGNvbG9yLmIgPSBzcmMuYiA8IDAuNSA/IDIuMCAqIHNyYy5iICogZHN0LmIgKyBkc3QuYiAqIGRzdC5iICogKDEuMCAtIDIuMCAqIHNyYy5iKVxcbiAgICA6IHNxcnQoZHN0LmIpICogKDIuMCAqIHNyYy5iIC0gMS4wKSArIDIuMCAqIGRzdC5iICogKDEuMCAtIHNyYy5iKTtcXG4gIHJldHVybiBjb2xvcjtcXG59XFxuXFxuZmxvYXQgbHVtYSh2ZWMzIGMpIHtcXG4gIHJldHVybiAwLjI5OSAqIGMuciArIDAuNTg3ICogYy5nICsgMC4xMTQgKiBjLmI7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgLy8gY2FzdCBzb2Z0IGxpZ2h0IHVzaW5nIGhpZ2hsaWdodCBhbmQgc2hhZG93XFxuICB2ZWMzIGggPSBzb2Z0bGlnaHQoaGlnaGxpZ2h0LCBzcmMucmdiKTtcXG4gIHZlYzMgcyA9IHNvZnRsaWdodChzaGFkb3csIHNyYy5yZ2IpO1xcblxcbiAgLy8gYmxlbmQgYmFzZWQgb24gbHVtaW5hbmNlXFxuICBmbG9hdCBsID0gbHVtYShzcmMucmdiKTtcXG4gIHZlYzMgYyA9IGggKiBsICsgcyAqICgxLjAgLSBsKTtcXG4gIGMgPSBjIC8gKGx1bWEoYykgKyBlKSAqIGw7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGMsIHNyYy5hKTtcXG59XFxuXCIsXG4gICAgZHVvdG9uZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSB2ZWMzIGhpZ2hsaWdodDtcXG51bmlmb3JtIHZlYzMgc2hhZG93O1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbmNvbnN0IGZsb2F0IGUgPSAxMGUtMTA7XFxuXFxuZmxvYXQgbHVtYSh2ZWMzIGMpIHtcXG4gIHJldHVybiAwLjI5OSAqIGMuciArIDAuNTg3ICogYy5nICsgMC4xMTQgKiBjLmI7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcblxcbiAgZmxvYXQgbCA9IGx1bWEoc3JjLnJnYik7XFxuXFxuICAvLyBoaWdobGlnaHQgYW5kIHNoYWRvdyBjb2xvciBub3JtYWxpemVkIHRvIHNhbWUgbHVtaW5hbmNlXFxuICB2ZWMzIGggPSAoaGlnaGxpZ2h0ICsgZSkgLyAobHVtYShoaWdobGlnaHQpICsgZSkgKiBsO1xcbiAgdmVjMyBzID0gKHNoYWRvdyArIGUpIC8gKGx1bWEoc2hhZG93KSArIGUpICogbDtcXG5cXG4gIC8vIGJsZW5kIGJhc2VkIG9uIGx1bWluYW5jZVxcbiAgdmVjMyBjID0gaCAqIGwgKyBzICogKDEuMCAtIGwpO1xcblxcbiAgZ2xfRnJhZ0NvbG9yID0gdmVjNChjLCBzcmMuYSk7XFxufVxcblwiLFxuICAgIHNoYXJwZW46IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzdHJlbmd0aDtcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgYmFja2dyb3VuZDtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG5jb25zdCBmbG9hdCBlID0gMTBlLTEwO1xcblxcbmZsb2F0IGx1bWEodmVjMyBjKSB7XFxuICByZXR1cm4gMC4yOTkgKiBjLnIgKyAwLjU4NyAqIGMuZyArIDAuMTE0ICogYy5iO1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG5cXG4gIGZsb2F0IGxzcmMgPSBsdW1hKHNyYy5yZ2IpO1xcbiAgZmxvYXQgbCA9IGx1bWEodGV4dHVyZTJEKGJhY2tncm91bmQsIGNvb3JkKS5yZ2IpO1xcblxcbiAgc3JjLnJnYiAqPSAoKGxzcmMgLSBsKSAqIHN0cmVuZ3RoICsgbCkgLyAobHNyYyArIGUpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gc3JjO1xcbn1cXG5cIixcbiAgICB2aWduZXR0ZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudW5pZm9ybSBmbG9hdCBkYXJrZW47XFxudW5pZm9ybSBmbG9hdCBicmlnaHRlbjtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG5jb25zdCBmbG9hdCBlID0gMTBlLTEwO1xcblxcbmZsb2F0IGx1bWEodmVjMyBjKSB7XFxuICByZXR1cm4gMC4yOTkgKiBjLnIgKyAwLjU4NyAqIGMuZyArIDAuMTE0ICogYy5iO1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG5cXG4gIC8vIGRpc3RhbmNlIHRvIGVhY2ggYm9yZGVyXFxuICBmbG9hdCBhID0gY29vcmQueCA8IDAuNSA/IGNvb3JkLnggOiAxLjAgLSBjb29yZC54O1xcbiAgZmxvYXQgYiA9IGNvb3JkLnkgPCAwLjUgPyBjb29yZC55IDogMS4wIC0gY29vcmQueTtcXG5cXG4gIC8vIGxwIG5vcm0gdXNlZCBhcyBkaXN0YW5jZSwgMC4yIHNlZW1zIHRvIGJlIGEgbmljZSB2YWx1ZSBmb3IgcFxcbiAgZmxvYXQgcCA9IDAuMjtcXG4gIGZsb2F0IGQgPSBwb3coYSwgcCkgKyBwb3coYiwgcCk7XFxuICBmbG9hdCBkbWF4ID0gMi4wICogcG93KDAuNSwgcCk7XFxuXFxuICAvLyBicmlnaHRlbiBvdmVyYWxsLCB0aGVuIGRhcmtlbiBiYXNlZCBvbiBscCBkaXN0YW5jZVxcbiAgZmxvYXQgbCA9IGx1bWEoc3JjLnJnYik7XFxuICBzcmMucmdiICo9IChsICsgYnJpZ2h0ZW4gLSBkYXJrZW4gKiAoMS4wIC0gZCAvIGRtYXgpKSAvIChsICsgZSk7XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzcmM7XFxufVxcblwiXG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gVGV4dHVyZVxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gVGV4dHVyZShnbCwgdW5pdCwgbm9kZU9yRGF0YSwgd2lkdGgsIGhlaWdodCwgb3B0aW9ucykge1xuICB0aGlzLmdsID0gZ2xcbiAgdGhpcy51bml0ID0gdW5pdFxuICB0aGlzLndpZHRoID0gd2lkdGhcbiAgdGhpcy5oZWlnaHQgPSBoZWlnaHRcblxuICB0aGlzLnRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKClcbiAgdGhpcy5iaW5kKClcbiAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCB0cnVlKVxuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKVxuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTElORUFSKVxuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKVxuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKVxuXG4gIGlmICh1dGlscy5pc0FycmF5KG5vZGVPckRhdGEpKSB7XG4gICAgdmFyIGRhdGEgPSBuZXcgVWludDhBcnJheShub2RlT3JEYXRhKVxuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5ORUFSRVNUKVxuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKVxuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgd2lkdGgsIGhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgZGF0YSlcblxuICB9IGVsc2UgaWYgKHV0aWxzLmlzTm90aGluZyhub2RlT3JEYXRhKSkge1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgd2lkdGgsIGhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgbnVsbClcbiAgICB0aGlzLmZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKVxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5mcmFtZWJ1ZmZlcilcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZSwgMClcblxuICB9IGVsc2Uge1xuICAgIHZhciBub2RlID0gdXRpbHMuZ2V0Tm9kZShub2RlT3JEYXRhKVxuXG4gICAgdmFyIG1heFNpemUgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfU0laRSlcbiAgICBpZiAodXRpbHMuaXNOdW1iZXIob3B0aW9ucy5yZXNpemUpKSB7XG4gICAgICBtYXhTaXplID0gTWF0aC5taW4obWF4U2l6ZSwgb3B0aW9ucy5yZXNpemUpXG4gICAgfVxuXG4gICAgbm9kZSA9IHJlc2l6ZShub2RlLCBtYXhTaXplKVxuICAgIHRoaXMud2lkdGggPSBub2RlLndpZHRoXG4gICAgdGhpcy5oZWlnaHQgPSBub2RlLmhlaWdodFxuXG4gICAgaWYgKHV0aWxzLmlzV2ViZ2wobm9kZSkgJiYgdXRpbHMuaXNXZWJraXQoKSkge1xuICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0ZMSVBfWV9XRUJHTCwgdHJ1ZSlcbiAgICB9XG5cbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG5vZGUpXG4gIH1cbn1cblxuVGV4dHVyZS5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG4gIGdsLmFjdGl2ZVRleHR1cmUoZ2xbJ1RFWFRVUkUnICsgdGhpcy51bml0XSlcbiAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy50ZXh0dXJlKVxuICBpZiAodGhpcy5mcmFtZWJ1ZmZlcikgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmZyYW1lYnVmZmVyKVxuICByZXR1cm4gdGhpc1xufVxuXG5UZXh0dXJlLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLnRleHR1cmUpXG4gIGlmICh0aGlzLmZyYW1lYnVmZmVyKSB7XG4gICAgdGhpcy5nbC5kZWxldGVGcmFtZWJ1ZmZlcih0aGlzLmZyYW1lYnVmZmVyKVxuICAgIHRoaXMuZnJhbWVidWZmZXIgPSBudWxsXG4gIH1cbiAgdGhpcy50ZXh0dXJlID0gbnVsbFxuICB0aGlzLmdsID0gbnVsbFxufVxuXG5mdW5jdGlvbiByZXNpemUobm9kZSwgbWF4U2l6ZSkge1xuICBpZiAobm9kZS53aWR0aCA8PSBtYXhTaXplICYmIG5vZGUuaGVpZ2h0IDw9IG1heFNpemUpIHtcbiAgICByZXR1cm4gbm9kZVxuICB9IGVsc2UgaWYgKG5vZGUud2lkdGggPiBtYXhTaXplICogMiB8fCBub2RlLmhlaWdodCA+IG1heFNpemUgKiAyKSB7XG4gICAgcmV0dXJuIHJlc2l6ZShyZXNpemUobm9kZSwgbWF4U2l6ZSAqIDIpLCBtYXhTaXplKVxuICB9IGVsc2Uge1xuICAgIHZhciB3aWR0aCwgaGVpZ2h0XG4gICAgaWYgKG5vZGUud2lkdGggPiBub2RlLmhlaWdodCkge1xuICAgICAgd2lkdGggPSBtYXhTaXplXG4gICAgICBoZWlnaHQgPSBNYXRoLmZsb29yKG1heFNpemUgLyBub2RlLndpZHRoICogbm9kZS5oZWlnaHQpXG4gICAgfSBlbHNlIHtcbiAgICAgIGhlaWdodCA9IG1heFNpemVcbiAgICAgIHdpZHRoID0gTWF0aC5mbG9vcihtYXhTaXplIC8gbm9kZS5oZWlnaHQgKiBub2RlLndpZHRoKVxuICAgIH1cblxuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoXG4gICAgY2FudmFzLmhlaWdodCA9IGhlaWdodFxuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgd2lkdGgsIGhlaWdodClcbiAgICBjdHguZHJhd0ltYWdlKG5vZGUsIDAsIDAsIHdpZHRoLCBoZWlnaHQpXG5cbiAgICByZXR1cm4gY2FudmFzXG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBpc1N0cmluZzogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBTdHJpbmddJ1xuICB9LFxuXG4gIGlzTnVtYmVyOiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IE51bWJlcl0nXG4gIH0sXG5cbiAgaXNBcnJheTogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nXG4gIH0sXG5cbiAgaXNOb3RoaW5nOiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsIHx8IHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnXG4gIH0sXG5cbiAgaXNXZWJnbDogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiBub2RlLmdldENvbnRleHQgJiZcbiAgICAgICAgICAgKG5vZGUuZ2V0Q29udGV4dCgnd2ViZ2wnKSB8fCBub2RlLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcpKVxuICB9LFxuXG4gIGlzV2Via2l0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZVxuICB9LFxuXG4gIGdldE5vZGU6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAodGhpcy5pc1N0cmluZyhub2RlKSkge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iobm9kZSlcbiAgICB9IGVsc2UgaWYgKG5vZGUuaXNHbGltZykge1xuICAgICAgcmV0dXJuIG5vZGUuY2FudmFzXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlXG4gICAgfVxuICB9XG59XG4iXX0=
(3)
});
