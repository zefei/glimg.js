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

// new Glimg([canvas])
//
// Create an empty Glimg object.
//
// If canvas is provided, either node or selector, Glimg will use that canvas 
// node instead of creating a new one.
//
// Notice that you cannot use a canvas that has called getContext('2d').
//
function Glimg(canvas) {
  if (canvas) {
    canvas = utils.getNode(canvas)
  } else {
    canvas = document.createElement('canvas')
  }

  var options = {
    preserveDrawingBuffer: true,
    premultipliedAlpha: true
  }

  var gl = canvas.getContext('webgl', options) ||
           canvas.getContext('experimental-webgl', options)

  if (!gl) throw 'WebGL is not supported'

  this.isGlimg = true
  this.canvas = canvas
  this.gl = gl
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
  this.setSource(this.sourceUnit, node).setSize(node.width, node.height)
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
    this.useTexture(this.targetUnit, width, height)
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
  var coord = options.coord || {left: 0, top: 0, right: 1, bottom: 1}
  var mask = options.mask || [255, 255, 255, 255]

  this._holdChain = true
  this.copy()
  this._holdChain = false

  this.useShader(shaders.blend[mode])
  .set('aSourceCoord', coord.left, coord.top, coord.right, coord.bottom)
  .set('aTargetCoord', coord.left, coord.top, coord.right, coord.bottom)
  .set('foreground', this._unit[2], node)
  .set('mask', this._unit[3], mask)
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

Glimg.prototype.contrast = function(strength) {
  this.useShader(shaders.effects.contrast)
  .set('strength', strength)
  .run()

  return this
}

Glimg.prototype.monotone = function(strength) {
  this.useShader(shaders.effects.monotone)
  .set('strength', strength)
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
Glimg.prototype.useTexture = function(unit, nodeOrWidth, height) {
  var texture = this._textures[unit]
  var reuse = !utils.isNothing(height) && texture && texture.framebuffer &&
              texture.width === nodeOrWidth && texture.height === height

  if (!reuse) {
    if (this._textures[unit]) this._textures[unit].destroy()
    this._textures[unit] = new Texture(this.gl, unit, nodeOrWidth, height)
  }

  this._textures[unit].bind()
  return this
}

},{"./buffer":1,"./shader":4,"./shaders":5,"./texture":6,"./utils":7}],3:[function(_dereq_,module,exports){
module.exports = glimg

var Glimg = _dereq_('./glimg')

function glimg(canvas) {
  return new Glimg(canvas)
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

Shader.prototype.setTexture = function(name, unit, node) {
  var gl = this.gl

  var location = gl.getUniformLocation(this.program, name)
  if (location !== null) {
    if (node) this.glimg.useTexture(unit, node)
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
    normal: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src;\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    multiply: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src * dst;\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    screen: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = 1.0 - (1.0 - src) * (1.0 - dst);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    overlay: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = dst.r < 0.5 ? 2.0 * src.r * dst.r : 1.0 - 2.0 * (1.0 - src.r) * (1.0 - dst.r);\n  blend.g = dst.g < 0.5 ? 2.0 * src.g * dst.g : 1.0 - 2.0 * (1.0 - src.g) * (1.0 - dst.g);\n  blend.b = dst.b < 0.5 ? 2.0 * src.b * dst.b : 1.0 - 2.0 * (1.0 - src.b) * (1.0 - dst.b);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    darken: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = min(src, dst);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    lighten: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = max(src, dst);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'color-dodge': "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r == 1.0 ? 1.0 : dst.r / (1.0 - src.r);\n  blend.g = src.g == 1.0 ? 1.0 : dst.g / (1.0 - src.g);\n  blend.b = src.b == 1.0 ? 1.0 : dst.b / (1.0 - src.b);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'color-burn': "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r == 0.0 ? 0.0 : 1.0 - (1.0 - dst.r) / src.r;\n  blend.g = src.g == 0.0 ? 0.0 : 1.0 - (1.0 - dst.g) / src.g;\n  blend.b = src.b == 0.0 ? 0.0 : 1.0 - (1.0 - dst.b) / src.b;\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'hard-light': "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r < 0.5 ? 2.0 * src.r * dst.r : 1.0 - 2.0 * (1.0 - src.r) * (1.0 - dst.r);\n  blend.g = src.g < 0.5 ? 2.0 * src.g * dst.g : 1.0 - 2.0 * (1.0 - src.g) * (1.0 - dst.g);\n  blend.b = src.b < 0.5 ? 2.0 * src.b * dst.b : 1.0 - 2.0 * (1.0 - src.b) * (1.0 - dst.b);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    'soft-light': "\nprecision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)\n    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);\n  blend.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)\n    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);\n  blend.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)\n    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    difference: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = abs(dst - src);\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    exclusion: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  blend = src + dst - 2.0 * src * dst;\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    hue: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(dst.rgb);\n  blend.rgb = hcl2rgb(vec3(rgb2hcl(src.rgb).x, hcl.y, hcl.z));\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    saturation: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(dst.rgb);\n  blend.rgb = hcl2rgb(vec3(hcl.x, rgb2hcl(src.rgb).y, hcl.z));\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    color: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(src.rgb);\n  blend.rgb = hcl2rgb(vec3(hcl.x, hcl.y, rgb2hcl(dst.rgb).z));\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n",
    luminosity: "precision mediump float;\n\nuniform sampler2D source;\nuniform sampler2D foreground;\nuniform sampler2D mask;\nuniform vec4 size;\nvarying vec2 coord;\nvarying vec2 maskCoord;\n\nvec3 rgb2hcl(vec3 c) {\n  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);\n  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;\n\n  float M = q.x;\n  float m = min(q.y, q.z);\n  float C = M - m;\n\n  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);\n  float L = 0.5 * (M + m);\n\n  return vec3(H, C, L);\n}\n\nvec3 hcl2rgb(vec3 c) {\n  float H = c.x;\n\n  float R = abs(H - 3.0) - 1.0;\n  float G = 2.0 - abs(H - 2.0);\n  float B = 2.0 - abs(H - 4.0);\n  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);\n\n  return (rgb - 0.5) * c.y + c.z;\n}\n\nvoid main() {\n  vec4 dst = texture2D(source, coord);\n  vec4 src = texture2D(foreground, maskCoord);\n  vec4 blend;\n\n  vec3 hcl = rgb2hcl(dst.rgb);\n  blend.rgb = hcl2rgb(vec3(hcl.x, hcl.y, rgb2hcl(src.rgb).z));\n\n  blend.a = src.a;\n  blend *= texture2D(mask, maskCoord);\n  gl_FragColor = blend + dst * (1.0 - blend.a);\n}\n"
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
    contrast: "precision mediump float;\n\nuniform float strength;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\n\nvoid main() {\n  vec4 color = texture2D(source, coord);\n  gl_FragColor = vec4((color.rgb - 0.5) * strength + 0.5, color.a);\n}\n",
    monotone: "precision mediump float;\n\nuniform float strength;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\n\nvoid main() {\n  vec4 color = texture2D(source, coord);\n  float i = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;\n  vec3 gray = vec3(i, i, i);\n  gl_FragColor = vec4(i * strength + color.rgb * (1.0 - strength), color.a);\n}\n"
  }
}

},{}],6:[function(_dereq_,module,exports){
module.exports = Texture

var utils = _dereq_('./utils')

function Texture(gl, unit, nodeOrWidth, height) {
  this.gl = gl
  this.unit = unit

  this.texture = gl.createTexture()
  this.bind()
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  if (utils.isArray(nodeOrWidth)) {
    var data = new Uint8Array(nodeOrWidth)
    var width = Math.ceil(data.length / 4)
    var height = 1

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)

  } else if (utils.isNothing(height)) {
    var node = utils.getNode(nodeOrWidth)
    this.width = node.width
    this.height = node.height

    if (node.getContext && utils.isWebkit()) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    }

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, node)

  } else {
    this.width = nodeOrWidth
    this.height = height
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    this.framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
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

},{"./utils":7}],7:[function(_dereq_,module,exports){
module.exports = {
  isString: function(obj) {
    return toString.call(obj) === '[object String]'
  },

  isNumber: function(obj) {
    return toString.call(obj) === '[object Number]'
  },

  isArray: function(obj) {
    return toString.call(obj) === '[object Array]'
  },

  isNothing: function(obj) {
    return obj === null || typeof obj === 'undefined'
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

  isWebkit: function() {
    return 'WebkitAppearance' in document.documentElement.style
  }
}

},{}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xvY2FsL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9idWZmZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL2dsaW1nLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9tYWluLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9zaGFkZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3NoYWRlcnMuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3RleHR1cmUuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIEJ1ZmZlcihnbCwgYXJyYXkpIHtcbiAgdGhpcy5nbCA9IGdsXG4gIHRoaXMuYnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKClcbiAgdGhpcy5iaW5kKClcbiAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIG5ldyBGbG9hdDMyQXJyYXkoYXJyYXkpLCBnbC5TVEFUSUNfRFJBVylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuYmluZEJ1ZmZlcih0aGlzLmdsLkFSUkFZX0JVRkZFUiwgdGhpcy5idWZmZXIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLmRlbGV0ZUJ1ZmZlcih0aGlzLmJ1ZmZlcilcbiAgdGhpcy5idWZmZXIgPSBudWxsXG4gIHRoaXMuZ2wgPSBudWxsXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEdsaW1nXG5cbnZhciBTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcicpXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnLi9idWZmZXInKVxudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuL3RleHR1cmUnKVxudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKVxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbi8vIG5ldyBHbGltZyhbY2FudmFzXSlcbi8vXG4vLyBDcmVhdGUgYW4gZW1wdHkgR2xpbWcgb2JqZWN0LlxuLy9cbi8vIElmIGNhbnZhcyBpcyBwcm92aWRlZCwgZWl0aGVyIG5vZGUgb3Igc2VsZWN0b3IsIEdsaW1nIHdpbGwgdXNlIHRoYXQgY2FudmFzIFxuLy8gbm9kZSBpbnN0ZWFkIG9mIGNyZWF0aW5nIGEgbmV3IG9uZS5cbi8vXG4vLyBOb3RpY2UgdGhhdCB5b3UgY2Fubm90IHVzZSBhIGNhbnZhcyB0aGF0IGhhcyBjYWxsZWQgZ2V0Q29udGV4dCgnMmQnKS5cbi8vXG5mdW5jdGlvbiBHbGltZyhjYW52YXMpIHtcbiAgaWYgKGNhbnZhcykge1xuICAgIGNhbnZhcyA9IHV0aWxzLmdldE5vZGUoY2FudmFzKVxuICB9IGVsc2Uge1xuICAgIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpXG4gIH1cblxuICB2YXIgb3B0aW9ucyA9IHtcbiAgICBwcmVzZXJ2ZURyYXdpbmdCdWZmZXI6IHRydWUsXG4gICAgcHJlbXVsdGlwbGllZEFscGhhOiB0cnVlXG4gIH1cblxuICB2YXIgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ2wnLCBvcHRpb25zKSB8fFxuICAgICAgICAgICBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJywgb3B0aW9ucylcblxuICBpZiAoIWdsKSB0aHJvdyAnV2ViR0wgaXMgbm90IHN1cHBvcnRlZCdcblxuICB0aGlzLmlzR2xpbWcgPSB0cnVlXG4gIHRoaXMuY2FudmFzID0gY2FudmFzXG4gIHRoaXMuZ2wgPSBnbFxuICB0aGlzLl9idWZmZXJzID0ge31cbiAgdGhpcy5fdGV4dHVyZXMgPSB7fVxuICB0aGlzLl9zaGFkZXJzID0ge31cbiAgdmFyIG1heFVuaXQgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpIC0gMVxuICB0aGlzLl91bml0ID0gW21heFVuaXQsIG1heFVuaXQgLSAxLCBtYXhVbml0IC0gMiwgbWF4VW5pdCAtIDNdXG4gIHRoaXMuX2NoYWluID0ge2NvdW50OiAwfVxuICB0aGlzLnNldFNvdXJjZSgwKVxuICB0aGlzLnNldFRhcmdldChudWxsKVxuICB0aGlzLnNldFpvb20obnVsbClcbn1cblxuLy8gbG9hZChub2RlWywgbm9jb3B5XSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBMb2FkIGltYWdlIGZyb20gYSBub2RlIChjYW52YXMsIGltYWdlIG9yIHZpZGVvKSBhcyBzb3VyY2UgaW1hZ2UuIFRoZW4gY29weSBpdCBcbi8vIHRvIHRoZSB0YXJnZXQgaW1hZ2UgdW5sZXNzIG5vY29weSBpcyBzZXQuXG4vL1xuR2xpbWcucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihub2RlLCBub2NvcHkpIHtcbiAgbm9kZSA9IHV0aWxzLmdldE5vZGUobm9kZSlcbiAgdGhpcy5zZXRTb3VyY2UodGhpcy5zb3VyY2VVbml0LCBub2RlKS5zZXRTaXplKG5vZGUud2lkdGgsIG5vZGUuaGVpZ2h0KVxuICBpZiAoIW5vY29weSkgdGhpcy5jb3B5KClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gbG9hZEZyb21VcmwodXJsWywgY2FsbGJhY2tbLCBub2NvcHldXSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBMb2FkIHJlbW90ZSBpbWFnZSBhcyBzb3VyY2UgaW1hZ2UuIENhbGxiYWNrIGlzIGZpcmVkIHdoZW4gaW1hZ2UgaXMgbG9hZGVkLiAgXG4vLyBUaGVuIGNvcHkgaXQgdG8gdGhlIHRhcmdldCBpbWFnZSB1bmxlc3Mgbm9jb3B5IGlzIHNldC5cbi8vXG5HbGltZy5wcm90b3R5cGUubG9hZEZyb21VcmwgPSBmdW5jdGlvbih1cmwsIGNhbGxiYWNrLCBub2NvcHkpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBpbWFnZSA9IG5ldyBJbWFnZSgpXG4gIGltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIHNlbGYubG9hZChpbWFnZSwgbm9jb3B5KVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKVxuICB9XG4gIGltYWdlLnNyYyA9IHVybFxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBzZXRTaXplKHdpZHRoLCBoZWlnaHQpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHRhcmdldCBpbWFnZSBzaXplLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRTaXplID0gZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuICBpZiAodGhpcy50YXJnZXRVbml0ID09PSBudWxsKSB7XG4gICAgdGhpcy53aWR0aCA9IHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGhcbiAgICB0aGlzLmhlaWdodCA9IHRoaXMuY2FudmFzLmhlaWdodCA9IGhlaWdodFxuICAgIHRoaXMuem9vbSh0aGlzLl96b29tTGV2ZWwpXG4gIH0gZWxzZSB7XG4gICAgdGhpcy51c2VUZXh0dXJlKHRoaXMudGFyZ2V0VW5pdCwgd2lkdGgsIGhlaWdodClcbiAgfVxuXG4gIHRoaXMuZ2wudmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gc2V0Wm9vbSh6b29tTGV2ZWwpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IGNzcyBzaXplIG9mIHRoZSBjYW52YXMgYWNjb3JkaW5nIHRvIGFjdHVhbCBpbWFnZSBzaXplLiBUaGlzIHBlcnNpc3RzIFxuLy8gdGhyb3VnaCByZXNpemVzLlxuLy9cbi8vIFpvb20gbGV2ZWwgY2FuIGJlIGEgbnVtYmVyOiB6b29tIHJhdGlvLCBvciAnZml0JzogMTAwJSBwYXJlbnQgd2lkdGgsIG9yIG51bGw6IFxuLy8gbm90IHpvb21pbmcgb24gcmVzaXplcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0Wm9vbSA9IGZ1bmN0aW9uKHpvb21MZXZlbCkge1xuICB0aGlzLl96b29tTGV2ZWwgPSB6b29tTGV2ZWxcbiAgdGhpcy56b29tKHpvb21MZXZlbClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gem9vbSh6b29tTGV2ZWwpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gWm9vbSB0aGUgY2FudmFzIG9uY2UuIFNlZSAnc2V0Wm9vbScgZm9yIG1vcmUgZGV0YWlscy5cbi8vXG5HbGltZy5wcm90b3R5cGUuem9vbSA9IGZ1bmN0aW9uKHpvb21MZXZlbCkge1xuICBpZiAodXRpbHMuaXNOb3RoaW5nKHpvb21MZXZlbCkpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9IGVsc2UgaWYgKHpvb21MZXZlbCA9PT0gJ2ZpdCcpIHtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS53aWR0aCA9ICcxMDAlJ1xuICB9IGVsc2Uge1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLndpZHRoID0gJycgKyAodGhpcy53aWR0aCAqIHpvb21MZXZlbCkgKyAncHgnXG4gIH1cbiAgdGhpcy5jYW52YXMuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gYXBwbHkoKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIEFwcGx5IHJlbmRlcmVkIHJlc3VsdCBiYWNrIHRvIHNvdXJjZSBpbWFnZS5cbi8vXG5HbGltZy5wcm90b3R5cGUuYXBwbHkgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5zZXRTb3VyY2UodGhpcy5zb3VyY2VVbml0LCB0aGlzKVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBjbGVhcihbcmVkLCBncmVlbiwgYmx1ZSwgYWxwaGFdKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIENsZWFyIGNhbnZhcyB3aXRoIHNwZWNpZmllZCBjb2xvciwgZGVmYXVsdCAoMCwgMCwgMCwgMCkuXG4vL1xuR2xpbWcucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24ocmVkLCBncmVlbiwgYmx1ZSwgYWxwaGEpIHtcbiAgdGhpcy5nbC5jbGVhckNvbG9yKHJlZCB8fCAwLCBncmVlbiB8fCAwLCBibHVlIHx8IDAsIGFscGhhIHx8IDApXG4gIHRoaXMuZ2wuY2xlYXIodGhpcy5nbC5DT0xPUl9CVUZGRVJfQklUKVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyB0b0RhdGFVcmwoW2Zvcm1hdF0pXG4vLyByZXR1cm5zIGEgYmFzZTY0IHVybCBTdHJpbmdcbi8vXG4vLyBTYXZlIGltYWdlIGRhdGEgdG8gYmFzZTY0IHVybC4gRm9ybWF0IGNhbiBiZSAnanBlZycgKGRlZmF1bHQpIG9yICdwbmcnLlxuLy8gVGhpcyBjYW4gYmUgdXNlZCBhcyA8YT4gaHJlZiBvciB3aW5kb3cubG9jYXRpb24uXG4vL1xuR2xpbWcucHJvdG90eXBlLnRvRGF0YVVSTCA9IGZ1bmN0aW9uKGZvcm1hdCkge1xuICBmb3JtYXQgPSBmb3JtYXQgfHwgJ2pwZWcnXG4gIHJldHVybiB0aGlzLmNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlLycgKyBmb3JtYXQpXG59XG5cbi8vIGRlc3Ryb3koKVxuLy8gcmV0dXJucyBub3RoaW5nXG4vL1xuLy8gRGVzdHJveSB0aGUgb2JqZWN0LCBmcmVlIGFsbG9jYXRlZCBtZW1vcmllcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5nbCkge1xuICAgIHZhciBrZXlcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9idWZmZXJzKSB7XG4gICAgICB0aGlzLl9idWZmZXJzW2tleV0uZGVzdHJveSgpXG4gICAgfVxuXG4gICAgZm9yIChrZXkgaW4gdGhpcy5fdGV4dHVyZXMpIHtcbiAgICAgIHRoaXMuX3RleHR1cmVzW2tleV0uZGVzdHJveSgpXG4gICAgfVxuXG4gICAgZm9yIChrZXkgaW4gdGhpcy5fc2hhZGVycykge1xuICAgICAgdGhpcy5fc2hhZGVyc1trZXldLmRlc3Ryb3koKVxuICAgIH1cblxuICAgIHRoaXMuY2FudmFzID0gbnVsbFxuICAgIHRoaXMuZ2wgPSBudWxsXG4gICAgdGhpcy5fYnVmZmVycyA9IG51bGxcbiAgICB0aGlzLl90ZXh0dXJlcyA9IG51bGxcbiAgICB0aGlzLl9zaGFkZXJzID0gbnVsbFxuICB9XG59XG5cbkdsaW1nLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oc291cmNlQ29vcmQsIHRhcmdldENvb3JkKSB7XG4gIHZhciBzID0gc291cmNlQ29vcmQgfHwge2xlZnQ6IDAsIHRvcDogMCwgcmlnaHQgOiAxLCBib3R0b206IDF9XG4gIHZhciB0ID0gdGFyZ2V0Q29vcmQgfHwge2xlZnQ6IDAsIHRvcDogMCwgcmlnaHQgOiAxLCBib3R0b206IDF9XG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5jb3JlLmNvcHkpXG4gIC5zZXQoJ2FTb3VyY2VDb29yZCcsIHMubGVmdCwgcy50b3AsIHMucmlnaHQsIHMuYm90dG9tKVxuICAuc2V0KCdhVGFyZ2V0Q29vcmQnLCB0LmxlZnQsIHQudG9wLCB0LnJpZ2h0LCB0LmJvdHRvbSlcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gY3JvcChsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQ3JvcCB0aGUgaW1hZ2UuIENvb3JkaW5hdGVzIGFyZSBpbiBwZXJjZW50YWdlLCBub3QgcGl4ZWxzLiBUaGV5IHNob3VsZCBiZSBpbiBcbi8vIHRoZSByYW5nZSBvZiBbMCwgMV0uXG4vL1xuR2xpbWcucHJvdG90eXBlLmNyb3AgPSBmdW5jdGlvbihsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20pIHtcbiAgdmFyIHdpZHRoID0gKHJpZ2h0IC0gbGVmdCkgKiB0aGlzLl90ZXh0dXJlc1swXS53aWR0aFxuICB2YXIgaGVpZ2h0ID0gKGJvdHRvbSAtIHRvcCkgKiB0aGlzLl90ZXh0dXJlc1swXS5oZWlnaHRcblxuICB0aGlzLnNldFNpemUod2lkdGgsIGhlaWdodClcbiAgLmNvcHkoe2xlZnQ6IGxlZnQsIHRvcDogdG9wLCByaWdodDogcmlnaHQsIGJvdHRvbTogYm90dG9tfSlcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUucm90YXRlID0gZnVuY3Rpb24oZGVncmVlKSB7XG4gIC8vIHJvdGF0aW9uIG1hdHJpeFxuICB2YXIgdGhldGEgPSBNYXRoLlBJIC8gMTgwICogZGVncmVlXG4gIHZhciBtYXQgPSBbTWF0aC5jb3ModGhldGEpLCAtTWF0aC5zaW4odGhldGEpLCBNYXRoLnNpbih0aGV0YSksIE1hdGguY29zKHRoZXRhKV1cblxuICAvLyBzb3VyY2UgZGltZW5zaW9uXG4gIHZhciB3aWR0aCA9IHRoaXMuZ2V0U291cmNlKCkud2lkdGhcbiAgdmFyIGhlaWdodCA9IHRoaXMuZ2V0U291cmNlKCkuaGVpZ2h0XG5cbiAgLy8gbWF4aW1hbCBmaXR0aW5nIHJlY3RhbmdsZVxuICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzU3ODkyMzkvY2FsY3VsYXRlLWxhcmdlc3QtcmVjdGFuZ2xlLWluLWEtcm90YXRlZC1yZWN0YW5nbGVcbiAgdmFyIHcwLCBoMFxuICBpZiAod2lkdGggPD0gaGVpZ2h0KSB7XG4gICAgdzAgPSB3aWR0aFxuICAgIGgwID0gaGVpZ2h0XG4gIH0gZWxzZSB7XG4gICAgdzAgPSBoZWlnaHRcbiAgICBoMCA9IHdpZHRoXG4gIH1cblxuICB2YXIgYWxwaGEgPSB0aGV0YSAtIE1hdGguZmxvb3IoKHRoZXRhICsgTWF0aC5QSSkgLyAoMiAqIE1hdGguUEkpKSAqICgyICogTWF0aC5QSSlcbiAgYWxwaGEgPSBNYXRoLmFicyhhbHBoYSlcbiAgaWYgKGFscGhhID4gTWF0aC5QSSAvIDIpIGFscGhhID0gTWF0aC5QSSAtIGFscGhhXG5cbiAgdmFyIHNpbmEgPSBNYXRoLnNpbihhbHBoYSlcbiAgdmFyIGNvc2EgPSBNYXRoLmNvcyhhbHBoYSlcbiAgdmFyIHcxID0gdzAgKiBjb3NhICsgaDAgKiBzaW5hXG4gIHZhciBoMSA9IHcwICogc2luYSArIGgwICogY29zYVxuICB2YXIgYyA9IGgwICogKHNpbmEgKiBjb3NhKSAvICgyICogaDAgKiAoc2luYSAqIGNvc2EpICsgdzApXG4gIHZhciB4ID0gdzEgKiBjXG4gIHZhciB5ID0gaDEgKiBjXG4gIHZhciB3LCBoXG4gIGlmICh3aWR0aCA8PSBoZWlnaHQpIHtcbiAgICB3ID0gdzEgLSAyICogeFxuICAgIGggPSBoMSAtIDIgKiB5XG4gIH1cbiAgZWxzZSB7XG4gICAgdyA9IGgxIC0gMiAqIHlcbiAgICBoID0gdzEgLSAyICogeFxuICB9XG5cbiAgLy8gZGltZW5zaW9uIHRyYW5zZm9ybVxuICB2YXIgbCwgdCwgciwgYjtcbiAgbCA9ICh3aWR0aCAtIHcpIC8gKDIgKiB3aWR0aClcbiAgciA9ICh3aWR0aCArIHcpIC8gKDIgKiB3aWR0aClcbiAgdCA9IChoZWlnaHQgLSBoKSAvICgyICogaGVpZ2h0KVxuICBiID0gKGhlaWdodCArIGgpIC8gKDIgKiBoZWlnaHQpXG5cbiAgdGhpcy5zZXRTaXplKHcsIGgpXG4gIC51c2VTaGFkZXIoc2hhZGVycy5jb3JlLnRyYW5zZm9ybSlcbiAgLnNldE1hdHJpeCgndHJhbnNmb3JtJywgbWF0KVxuICAuc2V0KCdhU291cmNlQ29vcmQnLCBsLCB0LCByLCBiKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuYmxlbmQgPSBmdW5jdGlvbihub2RlLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gIHZhciBtb2RlID0gb3B0aW9ucy5tb2RlIHx8ICdub3JtYWwnXG4gIHZhciBjb29yZCA9IG9wdGlvbnMuY29vcmQgfHwge2xlZnQ6IDAsIHRvcDogMCwgcmlnaHQ6IDEsIGJvdHRvbTogMX1cbiAgdmFyIG1hc2sgPSBvcHRpb25zLm1hc2sgfHwgWzI1NSwgMjU1LCAyNTUsIDI1NV1cblxuICB0aGlzLl9ob2xkQ2hhaW4gPSB0cnVlXG4gIHRoaXMuY29weSgpXG4gIHRoaXMuX2hvbGRDaGFpbiA9IGZhbHNlXG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5ibGVuZFttb2RlXSlcbiAgLnNldCgnYVNvdXJjZUNvb3JkJywgY29vcmQubGVmdCwgY29vcmQudG9wLCBjb29yZC5yaWdodCwgY29vcmQuYm90dG9tKVxuICAuc2V0KCdhVGFyZ2V0Q29vcmQnLCBjb29yZC5sZWZ0LCBjb29yZC50b3AsIGNvb3JkLnJpZ2h0LCBjb29yZC5ib3R0b20pXG4gIC5zZXQoJ2ZvcmVncm91bmQnLCB0aGlzLl91bml0WzJdLCBub2RlKVxuICAuc2V0KCdtYXNrJywgdGhpcy5fdW5pdFszXSwgbWFzaylcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmJsdXIgPSBmdW5jdGlvbihyYWRpdXMpIHtcbiAgaWYgKHJhZGl1cyA8PSAwKSByZXR1cm4gdGhpc1xuICBpZiAocmFkaXVzIDw9IDQpIHJldHVybiB0aGlzLmdhdXNzaWFuQmx1cihyYWRpdXMpXG5cbiAgdmFyIHcgPSB0aGlzLmdldFNvdXJjZSgpLndpZHRoXG4gIHZhciBoID0gdGhpcy5nZXRTb3VyY2UoKS5oZWlnaHRcbiAgdmFyIHIgPSBNYXRoLnNxcnQocmFkaXVzKVxuXG4gIHRoaXMuY2hhaW4oKVxuICAuZ2F1c3NpYW5CbHVyKHIpXG4gIC5zZXRTaXplKHcgLyByLCBoIC8gcilcbiAgLmNvcHkoKVxuICAuZ2F1c3NpYW5CbHVyKHIpXG4gIC5zZXRTaXplKHcsIGgpXG4gIC5jb3B5KClcbiAgLmRvbmUoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5nYXVzc2lhbkJsdXIgPSBmdW5jdGlvbihyYWRpdXMpIHtcbiAgaWYgKHJhZGl1cyA8PSAwKSByZXR1cm4gdGhpc1xuXG4gIHZhciBnYXVzc2lhbiA9IHNoYWRlcnMuYmx1ci5nYXVzc2lhbjI1NlxuICBmb3IgKHZhciBpID0gMjsgaSA8IDI1NjsgaSAqPSAyKSB7XG4gICAgaWYgKHJhZGl1cyA8PSBpKSB7XG4gICAgICBnYXVzc2lhbiA9IHNoYWRlcnMuYmx1clsnZ2F1c3NpYW4nICsgaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgdGhpcy5jaGFpbigpXG4gIC51c2VTaGFkZXIoZ2F1c3NpYW4pXG4gIC5zZXQoJ3NpZ21hJywgcmFkaXVzIC8gMylcbiAgLnNldCgnYXhpcycsIFsxLCAwXSlcbiAgLnJ1bigpXG4gIC51c2VTaGFkZXIoZ2F1c3NpYW4pXG4gIC5zZXQoJ3NpZ21hJywgcmFkaXVzIC8gMylcbiAgLnNldCgnYXhpcycsIFswLCAxXSlcbiAgLnJ1bigpXG4gIC5kb25lKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuY29udHJhc3QgPSBmdW5jdGlvbihzdHJlbmd0aCkge1xuICB0aGlzLnVzZVNoYWRlcihzaGFkZXJzLmVmZmVjdHMuY29udHJhc3QpXG4gIC5zZXQoJ3N0cmVuZ3RoJywgc3RyZW5ndGgpXG4gIC5ydW4oKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5tb25vdG9uZSA9IGZ1bmN0aW9uKHN0cmVuZ3RoKSB7XG4gIHRoaXMudXNlU2hhZGVyKHNoYWRlcnMuZWZmZWN0cy5tb25vdG9uZSlcbiAgLnNldCgnc3RyZW5ndGgnLCBzdHJlbmd0aClcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gc2V0U3RhZ2Uoc291cmNlVW5pdCwgdGFyZ2V0VW5pdFssIG5vZGVdKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCBzb3VyY2UgdW5pdCBhbmQgdGFyZ2V0IHVuaXQsIGFuZCBvcHRpb25hbGx5IGxvYWQgaW1hZ2UgZnJvbSBub2RlIHRvIFxuLy8gc291cmNlIHVuaXQuIEl0IHJlc2l6ZXMgdGFyZ2V0IHVuaXQgdG8gbWF0Y2ggc291cmNlIHVuaXQgYWZ0ZXJ3YXJkcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0U3RhZ2UgPSBmdW5jdGlvbihzb3VyY2VVbml0LCB0YXJnZXRVbml0LCBub2RlKSB7XG4gIHRoaXMuc2V0U291cmNlKHNvdXJjZVVuaXQsIG5vZGUpLnNldFRhcmdldCh0YXJnZXRVbml0KVxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuY2hhaW4gPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuX2NoYWluLmNvdW50ID4gMCkge1xuICAgIHRoaXMuX2NoYWluLmNvdW50ICs9IDFcbiAgfSBlbHNlIHtcbiAgICB0aGlzLl9jaGFpbiA9IHtzb3VyY2U6IHRoaXMuc291cmNlVW5pdCwgdGFyZ2V0OiB0aGlzLnRhcmdldFVuaXQsIHVuaXQ6IDAsIGNvdW50OiAxfVxuICAgIHRoaXMuc2V0VGFyZ2V0KHRoaXMuX3VuaXRbMF0pXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmRvbmUgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuX2NoYWluLmNvdW50IDw9IDApIHJldHVybiB0aGlzXG4gIHRoaXMuX2NoYWluLmNvdW50IC09IDFcbiAgaWYgKHRoaXMuX2NoYWluLmNvdW50ID09PSAwKSB7XG4gICAgdGhpcy5zZXRUYXJnZXQodGhpcy5fY2hhaW4udGFyZ2V0KS5jb3B5KCkuc2V0U291cmNlKHRoaXMuX2NoYWluLnNvdXJjZSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBnZXRTb3VyY2UoKVxuLy8gcmV0dXJucyBjdXJyZW50IHNvdXJjZSBpbWFnZVxuLy9cbkdsaW1nLnByb3RvdHlwZS5nZXRTb3VyY2UgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3RleHR1cmVzW3RoaXMuc291cmNlVW5pdF1cbn1cblxuLy8gc2V0U291cmNlKHVuaXRbLCBub2RlXSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBTZXQgc291cmNlIHVuaXQsIGFuZCBvcHRpb25hbGx5IGxvYWQgaW1hZ2UgZnJvbSBub2RlIHRvIHNvdXJjZSB1bml0LlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRTb3VyY2UgPSBmdW5jdGlvbih1bml0LCBub2RlKSB7XG4gIHRoaXMuc291cmNlVW5pdCA9IHVuaXRcbiAgaWYgKG5vZGUpIHRoaXMudXNlVGV4dHVyZSh1bml0LCBub2RlKVxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBnZXRUYXJnZXQoKVxuLy8gcmV0dXJucyBjdXJyZW50IHRhcmdldCBpbWFnZSwgbnVsbCBpZiB0YXJnZXQgaXMgdGhlIGNhbnZhc1xuLy9cbkdsaW1nLnByb3RvdHlwZS5nZXRUYXJnZXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3RleHR1cmVzW3RoaXMudGFyZ2V0VW5pdF1cbn1cblxuLy8gc2V0VGFyZ2V0KHVuaXQpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHRhcmdldCB1bml0LiBJdCByZXNpemVzIHRhcmdldCB1bml0IHRvIG1hdGNoIHNvdXJjZSB1bml0IGFmdGVyd2FyZHMuXG4vL1xuR2xpbWcucHJvdG90eXBlLnNldFRhcmdldCA9IGZ1bmN0aW9uKHVuaXQpIHtcbiAgdGhpcy50YXJnZXRVbml0ID0gdW5pdFxuXG4gIGlmICh1dGlscy5pc05vdGhpbmcodW5pdCkpIHtcbiAgICB0aGlzLmdsLmJpbmRGcmFtZWJ1ZmZlcih0aGlzLmdsLkZSQU1FQlVGRkVSLCBudWxsKVxuICB9XG5cbiAgdmFyIHNvdXJjZSA9IHRoaXMuZ2V0U291cmNlKClcbiAgaWYgKHNvdXJjZSkgdGhpcy5zZXRTaXplKHNvdXJjZS53aWR0aCwgc291cmNlLmhlaWdodClcblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyB1c2VTaGFkZXIoc291cmNlKVxuLy8gcmV0dXJucyBhIFNoYWRlciBvYmplY3Rcbi8vXG4vLyBDcmVhdGUgYW5kIGNhY2hlIGEgV2ViR0wgc2hhZGVyIHByb2dyYW0gZnJvbSBzb3VyY2UgYW5kIHJldHVybiBpdC4gVXNlIGNhY2hlZCBcbi8vIHNoYWRlciBpZiBwb3NzaWJsZS5cbi8vXG4vLyBUaGUgc291cmNlIHNob3VsZCBiZSBhIGZyYWdtZW50IHNoYWRlciBiYXNlZCBvbiBnbGltZy5zaGFkZXJzLmNvcHkuIEl0IHdpbGwgXG4vLyBiZSBjb21waWxlZCBhbmQgbGlua2VkIHdpdGggZ2xpbWcuc2hhZGVycy52ZXJ0ZXguXG4vL1xuLy8gR2xpbWcgc2hhZGVycyBhcmUgbG9hZGVkIGluIGdsaW1nLnNoYWRlcnMsIHRoZWlyIHNvdXJjZSBmaWxlcyBhcmUgbG9jYXRlZCBhdCBcbi8vIHNyYy9zaGFkZXJzLiBUYWtlIGEgbG9vayBhdCB0aGUgc291cmNlcyB0byBzZWUgaG93IHRoZXkgYXJlIG9yZ2FuaXplZC5cbi8vXG5HbGltZy5wcm90b3R5cGUudXNlU2hhZGVyID0gZnVuY3Rpb24oc291cmNlKSB7XG4gIGlmICghdGhpcy5fc2hhZGVyc1tzb3VyY2VdKSB7XG4gICAgdGhpcy5fc2hhZGVyc1tzb3VyY2VdID0gbmV3IFNoYWRlcih0aGlzLCBzb3VyY2UpXG4gIH1cblxuICB2YXIgdGV4dHVyZSA9IHRoaXMuZ2V0U291cmNlKClcbiAgdGhpcy5fc2hhZGVyc1tzb3VyY2VdXG4gIC51c2UoKVxuICAuc2V0KCdhU291cmNlQ29vcmQnLCAwLCAwLCAxLCAxKVxuICAuc2V0KCdhVGFyZ2V0Q29vcmQnLCAwLCAwLCAxLCAxKVxuICAuc2V0KCdhTWFza0Nvb3JkJywgMCwgMCwgMSwgMSlcbiAgLnNldCgnZmxpcFknLCB0aGlzLnRhcmdldFVuaXQgPT09IG51bGwgPyAtMSA6IDEpXG4gIC5zZXQoJ3NvdXJjZScsIHRoaXMuc291cmNlVW5pdCwgbnVsbClcbiAgLnNldCgnc2l6ZScsIFsxIC8gdGV4dHVyZS53aWR0aCwgMSAvIHRleHR1cmUuaGVpZ2h0LCB0ZXh0dXJlLndpZHRoLCB0ZXh0dXJlLmhlaWdodF0pXG5cbiAgcmV0dXJuIHRoaXMuX3NoYWRlcnNbc291cmNlXVxufVxuXG5HbGltZy5wcm90b3R5cGUuc3RlcCA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5fY2hhaW4uY291bnQgPD0gMCB8fCB0aGlzLl9ob2xkQ2hhaW4pIHJldHVybiB0aGlzXG4gIHZhciB1bml0ID0gdGhpcy5fY2hhaW4udW5pdCA9PT0gMCA/IDEgOiAwXG4gIHRoaXMuc2V0U291cmNlKHRoaXMudGFyZ2V0VW5pdCkuc2V0VGFyZ2V0KHRoaXMuX3VuaXRbdW5pdF0pXG4gIHRoaXMuX2NoYWluLnVuaXQgPSB1bml0XG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHByaXZhdGVcbi8vIHVzZUJ1ZmZlcihhcnJheSlcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBDcmVhdGUgYW5kIGNhY2hlIGEgV2ViR0wgYnVmZmVyIGZyb20gYXJyYXkuIFVzZSBjYWNoZWQgYnVmZmVyIGlmIHBvc3NpYmxlLlxuLy9cbi8vIFRvIGNyZWF0ZS9wYXNzIHZlcnRpY2VzIHRvIHNoYWRlciwgdXNlIHNoYWRlci5zZXQoKSBpbnN0ZWFkLlxuLy9cbkdsaW1nLnByb3RvdHlwZS51c2VCdWZmZXIgPSBmdW5jdGlvbihhcnJheSkge1xuICBpZiAoIXV0aWxzLmlzQXJyYXkoYXJyYXkpKSBhcnJheSA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICB2YXIga2V5ID0gYXJyYXkuam9pbigpXG5cbiAgaWYgKCF0aGlzLl9idWZmZXJzW2tleV0pIHtcbiAgICB0aGlzLl9idWZmZXJzW2tleV0gPSBuZXcgQnVmZmVyKHRoaXMuZ2wsIGFycmF5KVxuICB9XG4gIHRoaXMuX2J1ZmZlcnNba2V5XS5iaW5kKClcblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBwcml2YXRlXG4vLyB1c2VUZXh0dXJlKHVuaXQsIG5vZGUpXG4vLyB1c2VUZXh0dXJlKHVuaXQsIHdpZHRoLCBoZWlnaHQpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQ3JlYXRlIGFuZCBjYWNoZSBhIFdlYkdMIHRleHR1cmUgdW5pdCBmcm9tIG5vZGUsIG9yIGNyZWF0ZSBhIGZyYW1lYnVmZmVyIFxuLy8gdGV4dXRyZSBpZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBwcm92aWRlZC4gVXNlIGNhY2hlZCB0ZXh0dXJlIGlmIHBvc3NpYmxlLlxuLy9cbi8vIFRvIGNyZWF0ZS9wYXNzIHRleHR1cmVzIHRvIHNoYWRlciwgdXNlIHNoYWRlci5zZXQoKSBpbnN0ZWFkLlxuLy9cbkdsaW1nLnByb3RvdHlwZS51c2VUZXh0dXJlID0gZnVuY3Rpb24odW5pdCwgbm9kZU9yV2lkdGgsIGhlaWdodCkge1xuICB2YXIgdGV4dHVyZSA9IHRoaXMuX3RleHR1cmVzW3VuaXRdXG4gIHZhciByZXVzZSA9ICF1dGlscy5pc05vdGhpbmcoaGVpZ2h0KSAmJiB0ZXh0dXJlICYmIHRleHR1cmUuZnJhbWVidWZmZXIgJiZcbiAgICAgICAgICAgICAgdGV4dHVyZS53aWR0aCA9PT0gbm9kZU9yV2lkdGggJiYgdGV4dHVyZS5oZWlnaHQgPT09IGhlaWdodFxuXG4gIGlmICghcmV1c2UpIHtcbiAgICBpZiAodGhpcy5fdGV4dHVyZXNbdW5pdF0pIHRoaXMuX3RleHR1cmVzW3VuaXRdLmRlc3Ryb3koKVxuICAgIHRoaXMuX3RleHR1cmVzW3VuaXRdID0gbmV3IFRleHR1cmUodGhpcy5nbCwgdW5pdCwgbm9kZU9yV2lkdGgsIGhlaWdodClcbiAgfVxuXG4gIHRoaXMuX3RleHR1cmVzW3VuaXRdLmJpbmQoKVxuICByZXR1cm4gdGhpc1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBnbGltZ1xuXG52YXIgR2xpbWcgPSByZXF1aXJlKCcuL2dsaW1nJylcblxuZnVuY3Rpb24gZ2xpbWcoY2FudmFzKSB7XG4gIHJldHVybiBuZXcgR2xpbWcoY2FudmFzKVxufVxuXG5pbml0KGdsaW1nKVxuXG5mdW5jdGlvbiBpbml0KGdsaW1nKSB7XG4gIGdsaW1nLmluZm8gPSB7fVxuICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgdmFyIGdsID0gY2FudmFzLmdldENvbnRleHQoJ3dlYmdsJykgfHwgY2FudmFzLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcpXG4gIGlmIChnbCkge1xuICAgIGdsaW1nLmluZm8uc3VwcG9ydGVkID0gdHJ1ZVxuICAgIGdsaW1nLmluZm8ubWF4U2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKVxuICAgIGdsaW1nLmluZm8ubWF4VW5pdCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9JTUFHRV9VTklUUykgLSA0XG4gIH0gZWxzZSB7XG4gICAgZ2xpbWcuaW5mby5zdXBwb3J0ZWQgPSBmYWxzZVxuICB9XG5cbiAgZ2xpbWcuc2hhZGVycyA9IHJlcXVpcmUoJy4vc2hhZGVycycpXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFNoYWRlclxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gU2hhZGVyKGdsaW1nLCBzb3VyY2UpIHtcbiAgdGhpcy5nbGltZyA9IGdsaW1nXG4gIHZhciBnbCA9IHRoaXMuZ2wgPSBnbGltZy5nbFxuICB2YXIgdmVydGV4ID0gcmVxdWlyZSgnLi9zaGFkZXJzJykuY29yZS52ZXJ0ZXhcbiAgdmFyIHZlcnRleFNoYWRlciA9IGNyZWF0ZVNoYWRlcihnbCwgZ2wuVkVSVEVYX1NIQURFUiwgdmVydGV4KVxuICB2YXIgZnJhZ21lbnRTaGFkZXIgPSBjcmVhdGVTaGFkZXIoZ2wsIGdsLkZSQUdNRU5UX1NIQURFUiwgc291cmNlKVxuICB2YXIgcHJvZ3JhbSA9IHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKVxuXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpXG4gIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCBmcmFnbWVudFNoYWRlcilcbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSlcblxuICBnbC5kZWxldGVTaGFkZXIodmVydGV4U2hhZGVyKVxuICBnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpXG5cbiAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkgdGhyb3cgJ3NoYWRlciBsaW5rIGVycm9yJ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKVxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZnVuY1xuXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDIpIHtcbiAgICBpZiAodXRpbHMuaXNOdW1iZXIodmFsdWVzKSkge1xuICAgICAgZnVuYyA9ICdzZXRGbG9hdCdcbiAgICB9IGVsc2UgaWYgKHV0aWxzLmlzQXJyYXkodmFsdWVzKSkge1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPD0gNCB8fCB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkpIHtcbiAgICAgICAgZnVuYyA9ICdzZXRWZWN0b3InXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmdW5jID0gJ3NldE1hdHJpeCdcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAzKSB7XG4gICAgZnVuYyA9ICdzZXRUZXh0dXJlJ1xuICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gNSkge1xuICAgIGZ1bmMgPSAnc2V0UmVjdCdcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyAnaW52YWxpZCBhcmd1bWVudHMnXG4gIH1cblxuICByZXR1cm4gdGhpc1tmdW5jXS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cblNoYWRlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZHJhd0FycmF5cyh0aGlzLmdsLlRSSUFOR0xFX1NUUklQLCAwLCA0KVxuICB0aGlzLmdsaW1nLnN0ZXAoKVxuICByZXR1cm4gdGhpcy5nbGltZ1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldEZsb2F0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgdmFyIGdsID0gdGhpcy5nbFxuXG4gIHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIGdsLnVuaWZvcm0xZihsb2NhdGlvbiwgdmFsdWUpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldFZlY3RvciA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgdmFyIG4gPSB1dGlscy5pc0FycmF5KHZhbHVlc1swXSkgPyB2YWx1ZXNbMF0ubGVuZ3RoIDogdmFsdWVzLmxlbmd0aFxuICAgIHZhciBmdW5jID0gJ3VuaWZvcm0nICsgbiArICdmdidcbiAgICBnbFtmdW5jXShsb2NhdGlvbiwgW10uY29uY2F0KHZhbHVlcykpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldE1hdHJpeCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlcykge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDQpIHtcbiAgICAgIGdsLnVuaWZvcm1NYXRyaXgyZnYobG9jYXRpb24sIGZhbHNlLCB2YWx1ZXMpXG4gICAgfSBlbHNlIGlmICh2YWx1ZXMubGVuZ3RoID09PSA5KSB7XG4gICAgICBnbC51bmlmb3JtTWF0cml4M2Z2KGxvY2F0aW9uLCBmYWxzZSwgdmFsdWVzKVxuICAgIH0gZWxzZSBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMTYpIHtcbiAgICAgIGdsLnVuaWZvcm1NYXRyaXg0ZnYobG9jYXRpb24sIGZhbHNlLCB2YWx1ZXMpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5zZXRUZXh0dXJlID0gZnVuY3Rpb24obmFtZSwgdW5pdCwgbm9kZSkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgaWYgKG5vZGUpIHRoaXMuZ2xpbWcudXNlVGV4dHVyZSh1bml0LCBub2RlKVxuICAgIGdsLnVuaWZvcm0xaShsb2NhdGlvbiwgdW5pdClcbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0UmVjdCA9IGZ1bmN0aW9uKG5hbWUsIGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLCBuYW1lKVxuICBpZiAobG9jYXRpb24gIT09IG51bGwpIHtcbiAgICB0aGlzLmdsaW1nLnVzZUJ1ZmZlcihsZWZ0LCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIHRvcCwgcmlnaHQsIGJvdHRvbSlcbiAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2NhdGlvbilcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvY2F0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5nbC5kZWxldGVQcm9ncmFtKHRoaXMucHJvZ3JhbSlcbiAgdGhpcy5wcm9ncmFtID0gbnVsbFxuICB0aGlzLmdsID0gbnVsbFxuICB0aGlzLmdsaW1nID0gbnVsbFxufVxuXG5mdW5jdGlvbiBjcmVhdGVTaGFkZXIoZ2wsIHR5cGUsIHNvdXJjZSkge1xuICB2YXIgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKHR5cGUpXG4gIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNvdXJjZSlcbiAgZ2wuY29tcGlsZVNoYWRlcihzaGFkZXIpXG4gIHJldHVybiBzaGFkZXJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBjb3JlOiB7XG4gICAgdmVydGV4OiBcImF0dHJpYnV0ZSB2ZWMyIGFTb3VyY2VDb29yZDtcXG5hdHRyaWJ1dGUgdmVjMiBhVGFyZ2V0Q29vcmQ7XFxuYXR0cmlidXRlIHZlYzIgYU1hc2tDb29yZDtcXG51bmlmb3JtIGZsb2F0IGZsaXBZO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gICBnbF9Qb3NpdGlvbiA9IHZlYzQoKGFUYXJnZXRDb29yZCAqIDIuMCAtIDEuMCkgKiB2ZWMyKDEsIGZsaXBZKSwgMC4wLCAxLjApO1xcbiAgIGNvb3JkID0gYVNvdXJjZUNvb3JkO1xcbiAgIG1hc2tDb29yZCA9IGFNYXNrQ29vcmQ7XFxufVxcblwiLFxuICAgIGNvcHk6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG59XFxuXCIsXG4gICAgdHJhbnNmb3JtOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gbWF0MiB0cmFuc2Zvcm07XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGZpcnN0IC0wLjUgaXMgYXBwbGllZCB0byBjZW50ZXIgaW1hZ2VcXG4gIC8vIHRoZW4gd2lkdGg6aGVpZ2h0IHJhdGlvIGlzIGFwcGxpZWQgdG8ga2VlcCBhc3BlY3RcXG4gIC8vIHRoZW4gdHJhbnNmb3JtIGlzIGFwcGxpZWRcXG4gIC8vIHRoZW4gcHJlLXRyYW5zZm9ybXMgYXJlIHJldmVyc2VkXFxuICAvL1xcbiAgdmVjMiByID0gdmVjMihzaXplLnAgLyBzaXplLnEsIDEuMCk7XFxuICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB0cmFuc2Zvcm0gKiAoKGNvb3JkIC0gMC41KSAqIHIpIC8gciArIDAuNSk7XFxufVxcblwiXG4gIH0sXG4gIGJsZW5kOiB7XG4gICAgbm9ybWFsOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kID0gc3JjO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCk7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgbXVsdGlwbHk6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBzcmMgKiBkc3Q7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBzY3JlZW46IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSAxLjAgLSAoMS4wIC0gc3JjKSAqICgxLjAgLSBkc3QpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCk7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgb3ZlcmxheTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZC5yID0gZHN0LnIgPCAwLjUgPyAyLjAgKiBzcmMuciAqIGRzdC5yIDogMS4wIC0gMi4wICogKDEuMCAtIHNyYy5yKSAqICgxLjAgLSBkc3Qucik7XFxuICBibGVuZC5nID0gZHN0LmcgPCAwLjUgPyAyLjAgKiBzcmMuZyAqIGRzdC5nIDogMS4wIC0gMi4wICogKDEuMCAtIHNyYy5nKSAqICgxLjAgLSBkc3QuZyk7XFxuICBibGVuZC5iID0gZHN0LmIgPCAwLjUgPyAyLjAgKiBzcmMuYiAqIGRzdC5iIDogMS4wIC0gMi4wICogKDEuMCAtIHNyYy5iKSAqICgxLjAgLSBkc3QuYik7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBkYXJrZW46IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBtaW4oc3JjLCBkc3QpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCk7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgbGlnaHRlbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IG1heChzcmMsIGRzdCk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICAnY29sb3ItZG9kZ2UnOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kLnIgPSBzcmMuciA9PSAxLjAgPyAxLjAgOiBkc3QuciAvICgxLjAgLSBzcmMucik7XFxuICBibGVuZC5nID0gc3JjLmcgPT0gMS4wID8gMS4wIDogZHN0LmcgLyAoMS4wIC0gc3JjLmcpO1xcbiAgYmxlbmQuYiA9IHNyYy5iID09IDEuMCA/IDEuMCA6IGRzdC5iIC8gKDEuMCAtIHNyYy5iKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgICdjb2xvci1idXJuJzogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZC5yID0gc3JjLnIgPT0gMC4wID8gMC4wIDogMS4wIC0gKDEuMCAtIGRzdC5yKSAvIHNyYy5yO1xcbiAgYmxlbmQuZyA9IHNyYy5nID09IDAuMCA/IDAuMCA6IDEuMCAtICgxLjAgLSBkc3QuZykgLyBzcmMuZztcXG4gIGJsZW5kLmIgPSBzcmMuYiA9PSAwLjAgPyAwLjAgOiAxLjAgLSAoMS4wIC0gZHN0LmIpIC8gc3JjLmI7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICAnaGFyZC1saWdodCc6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQuciA9IHNyYy5yIDwgMC41ID8gMi4wICogc3JjLnIgKiBkc3QuciA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMucikgKiAoMS4wIC0gZHN0LnIpO1xcbiAgYmxlbmQuZyA9IHNyYy5nIDwgMC41ID8gMi4wICogc3JjLmcgKiBkc3QuZyA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMuZykgKiAoMS4wIC0gZHN0LmcpO1xcbiAgYmxlbmQuYiA9IHNyYy5iIDwgMC41ID8gMi4wICogc3JjLmIgKiBkc3QuYiA6IDEuMCAtIDIuMCAqICgxLjAgLSBzcmMuYikgKiAoMS4wIC0gZHN0LmIpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCk7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCIsXG4gICAgJ3NvZnQtbGlnaHQnOiBcIlxcbnByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIGJsZW5kLnIgPSBzcmMuciA8IDAuNSA/IDIuMCAqIHNyYy5yICogZHN0LnIgKyBkc3QuciAqIGRzdC5yICogKDEuMCAtIDIuMCAqIHNyYy5yKVxcbiAgICA6IHNxcnQoZHN0LnIpICogKDIuMCAqIHNyYy5yIC0gMS4wKSArIDIuMCAqIGRzdC5yICogKDEuMCAtIHNyYy5yKTtcXG4gIGJsZW5kLmcgPSBzcmMuZyA8IDAuNSA/IDIuMCAqIHNyYy5nICogZHN0LmcgKyBkc3QuZyAqIGRzdC5nICogKDEuMCAtIDIuMCAqIHNyYy5nKVxcbiAgICA6IHNxcnQoZHN0LmcpICogKDIuMCAqIHNyYy5nIC0gMS4wKSArIDIuMCAqIGRzdC5nICogKDEuMCAtIHNyYy5nKTtcXG4gIGJsZW5kLmIgPSBzcmMuYiA8IDAuNSA/IDIuMCAqIHNyYy5iICogZHN0LmIgKyBkc3QuYiAqIGRzdC5iICogKDEuMCAtIDIuMCAqIHNyYy5iKVxcbiAgICA6IHNxcnQoZHN0LmIpICogKDIuMCAqIHNyYy5iIC0gMS4wKSArIDIuMCAqIGRzdC5iICogKDEuMCAtIHNyYy5iKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGRpZmZlcmVuY2U6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgYmxlbmQgPSBhYnMoZHN0IC0gc3JjKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGV4Y2x1c2lvbjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICBibGVuZCA9IHNyYyArIGRzdCAtIDIuMCAqIHNyYyAqIGRzdDtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGh1ZTogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSBzYW1wbGVyMkQgZm9yZWdyb3VuZDtcXG51bmlmb3JtIHNhbXBsZXIyRCBtYXNrO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcblxcbnZlYzMgcmdiMmhjbCh2ZWMzIGMpIHtcXG4gIHZlYzQgcCA9IGMuciA+IGMuZyA/IHZlYzQoYy5yZ2IsIDAuMCkgOiB2ZWM0KGMuZ2JyLCAyLjApO1xcbiAgdmVjNCBxID0gYy5iID4gcC54ID8gdmVjNChjLmJyZywgNC4wKSA6IHA7XFxuXFxuICBmbG9hdCBNID0gcS54O1xcbiAgZmxvYXQgbSA9IG1pbihxLnksIHEueik7XFxuICBmbG9hdCBDID0gTSAtIG07XFxuXFxuICBmbG9hdCBIID0gQyA9PSAwLjAgPyAwLjAgOiBtb2QoKHEueSAtIHEueikgLyBDICsgcS53LCA2LjApO1xcbiAgZmxvYXQgTCA9IDAuNSAqIChNICsgbSk7XFxuXFxuICByZXR1cm4gdmVjMyhILCBDLCBMKTtcXG59XFxuXFxudmVjMyBoY2wycmdiKHZlYzMgYykge1xcbiAgZmxvYXQgSCA9IGMueDtcXG5cXG4gIGZsb2F0IFIgPSBhYnMoSCAtIDMuMCkgLSAxLjA7XFxuICBmbG9hdCBHID0gMi4wIC0gYWJzKEggLSAyLjApO1xcbiAgZmxvYXQgQiA9IDIuMCAtIGFicyhIIC0gNC4wKTtcXG4gIHZlYzMgcmdiID0gY2xhbXAodmVjMyhSLCBHLCBCKSwgMC4wLCAxLjApO1xcblxcbiAgcmV0dXJuIChyZ2IgLSAwLjUpICogYy55ICsgYy56O1xcbn1cXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGRzdCA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIHZlYzQgc3JjID0gdGV4dHVyZTJEKGZvcmVncm91bmQsIG1hc2tDb29yZCk7XFxuICB2ZWM0IGJsZW5kO1xcblxcbiAgdmVjMyBoY2wgPSByZ2IyaGNsKGRzdC5yZ2IpO1xcbiAgYmxlbmQucmdiID0gaGNsMnJnYih2ZWMzKHJnYjJoY2woc3JjLnJnYikueCwgaGNsLnksIGhjbC56KSk7XFxuXFxuICBibGVuZC5hID0gc3JjLmE7XFxuICBibGVuZCAqPSB0ZXh0dXJlMkQobWFzaywgbWFza0Nvb3JkKTtcXG4gIGdsX0ZyYWdDb2xvciA9IGJsZW5kICsgZHN0ICogKDEuMCAtIGJsZW5kLmEpO1xcbn1cXG5cIixcbiAgICBzYXR1cmF0aW9uOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woZHN0LnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMoaGNsLngsIHJnYjJoY2woc3JjLnJnYikueSwgaGNsLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGNvbG9yOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHNhbXBsZXIyRCBmb3JlZ3JvdW5kO1xcbnVuaWZvcm0gc2FtcGxlcjJEIG1hc2s7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuXFxudmVjMyByZ2IyaGNsKHZlYzMgYykge1xcbiAgdmVjNCBwID0gYy5yID4gYy5nID8gdmVjNChjLnJnYiwgMC4wKSA6IHZlYzQoYy5nYnIsIDIuMCk7XFxuICB2ZWM0IHEgPSBjLmIgPiBwLnggPyB2ZWM0KGMuYnJnLCA0LjApIDogcDtcXG5cXG4gIGZsb2F0IE0gPSBxLng7XFxuICBmbG9hdCBtID0gbWluKHEueSwgcS56KTtcXG4gIGZsb2F0IEMgPSBNIC0gbTtcXG5cXG4gIGZsb2F0IEggPSBDID09IDAuMCA/IDAuMCA6IG1vZCgocS55IC0gcS56KSAvIEMgKyBxLncsIDYuMCk7XFxuICBmbG9hdCBMID0gMC41ICogKE0gKyBtKTtcXG5cXG4gIHJldHVybiB2ZWMzKEgsIEMsIEwpO1xcbn1cXG5cXG52ZWMzIGhjbDJyZ2IodmVjMyBjKSB7XFxuICBmbG9hdCBIID0gYy54O1xcblxcbiAgZmxvYXQgUiA9IGFicyhIIC0gMy4wKSAtIDEuMDtcXG4gIGZsb2F0IEcgPSAyLjAgLSBhYnMoSCAtIDIuMCk7XFxuICBmbG9hdCBCID0gMi4wIC0gYWJzKEggLSA0LjApO1xcbiAgdmVjMyByZ2IgPSBjbGFtcCh2ZWMzKFIsIEcsIEIpLCAwLjAsIDEuMCk7XFxuXFxuICByZXR1cm4gKHJnYiAtIDAuNSkgKiBjLnkgKyBjLno7XFxufVxcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgZHN0ID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgdmVjNCBzcmMgPSB0ZXh0dXJlMkQoZm9yZWdyb3VuZCwgbWFza0Nvb3JkKTtcXG4gIHZlYzQgYmxlbmQ7XFxuXFxuICB2ZWMzIGhjbCA9IHJnYjJoY2woc3JjLnJnYik7XFxuICBibGVuZC5yZ2IgPSBoY2wycmdiKHZlYzMoaGNsLngsIGhjbC55LCByZ2IyaGNsKGRzdC5yZ2IpLnopKTtcXG5cXG4gIGJsZW5kLmEgPSBzcmMuYTtcXG4gIGJsZW5kICo9IHRleHR1cmUyRChtYXNrLCBtYXNrQ29vcmQpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gYmxlbmQgKyBkc3QgKiAoMS4wIC0gYmxlbmQuYSk7XFxufVxcblwiLFxuICAgIGx1bWlub3NpdHk6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gc2FtcGxlcjJEIGZvcmVncm91bmQ7XFxudW5pZm9ybSBzYW1wbGVyMkQgbWFzaztcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5cXG52ZWMzIHJnYjJoY2wodmVjMyBjKSB7XFxuICB2ZWM0IHAgPSBjLnIgPiBjLmcgPyB2ZWM0KGMucmdiLCAwLjApIDogdmVjNChjLmdiciwgMi4wKTtcXG4gIHZlYzQgcSA9IGMuYiA+IHAueCA/IHZlYzQoYy5icmcsIDQuMCkgOiBwO1xcblxcbiAgZmxvYXQgTSA9IHEueDtcXG4gIGZsb2F0IG0gPSBtaW4ocS55LCBxLnopO1xcbiAgZmxvYXQgQyA9IE0gLSBtO1xcblxcbiAgZmxvYXQgSCA9IEMgPT0gMC4wID8gMC4wIDogbW9kKChxLnkgLSBxLnopIC8gQyArIHEudywgNi4wKTtcXG4gIGZsb2F0IEwgPSAwLjUgKiAoTSArIG0pO1xcblxcbiAgcmV0dXJuIHZlYzMoSCwgQywgTCk7XFxufVxcblxcbnZlYzMgaGNsMnJnYih2ZWMzIGMpIHtcXG4gIGZsb2F0IEggPSBjLng7XFxuXFxuICBmbG9hdCBSID0gYWJzKEggLSAzLjApIC0gMS4wO1xcbiAgZmxvYXQgRyA9IDIuMCAtIGFicyhIIC0gMi4wKTtcXG4gIGZsb2F0IEIgPSAyLjAgLSBhYnMoSCAtIDQuMCk7XFxuICB2ZWMzIHJnYiA9IGNsYW1wKHZlYzMoUiwgRywgQiksIDAuMCwgMS4wKTtcXG5cXG4gIHJldHVybiAocmdiIC0gMC41KSAqIGMueSArIGMuejtcXG59XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBkc3QgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICB2ZWM0IHNyYyA9IHRleHR1cmUyRChmb3JlZ3JvdW5kLCBtYXNrQ29vcmQpO1xcbiAgdmVjNCBibGVuZDtcXG5cXG4gIHZlYzMgaGNsID0gcmdiMmhjbChkc3QucmdiKTtcXG4gIGJsZW5kLnJnYiA9IGhjbDJyZ2IodmVjMyhoY2wueCwgaGNsLnksIHJnYjJoY2woc3JjLnJnYikueikpO1xcblxcbiAgYmxlbmQuYSA9IHNyYy5hO1xcbiAgYmxlbmQgKj0gdGV4dHVyZTJEKG1hc2ssIG1hc2tDb29yZCk7XFxuICBnbF9GcmFnQ29sb3IgPSBibGVuZCArIGRzdCAqICgxLjAgLSBibGVuZC5hKTtcXG59XFxuXCJcbiAgfSxcbiAgYmx1cjoge1xuICAgIGdhdXNzaWFuMjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gMi4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW40OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSA0LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgICBnYXVzc2lhbjg6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDguMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICAgIGdhdXNzaWFuMTY6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbnZhcnlpbmcgdmVjMiBtYXNrQ29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDE2LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgICBnYXVzc2lhbjMyOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAzMi4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gICAgZ2F1c3NpYW42NDogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxudmFyeWluZyB2ZWMyIG1hc2tDb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gNjQuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICAgIGdhdXNzaWFuMTI4OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAxMjguMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICAgIGdhdXNzaWFuMjU2OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG52YXJ5aW5nIHZlYzIgbWFza0Nvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAyNTYuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiXG4gIH0sXG4gIGVmZmVjdHM6IHtcbiAgICBjb250cmFzdDogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHN0cmVuZ3RoO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgdmVjNCBjb2xvciA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcXG4gIGdsX0ZyYWdDb2xvciA9IHZlYzQoKGNvbG9yLnJnYiAtIDAuNSkgKiBzdHJlbmd0aCArIDAuNSwgY29sb3IuYSk7XFxufVxcblwiLFxuICAgIG1vbm90b25lOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc3RyZW5ndGg7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICB2ZWM0IGNvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbiAgZmxvYXQgaSA9IGNvbG9yLnIgKiAwLjMgKyBjb2xvci5nICogMC41OSArIGNvbG9yLmIgKiAwLjExO1xcbiAgdmVjMyBncmF5ID0gdmVjMyhpLCBpLCBpKTtcXG4gIGdsX0ZyYWdDb2xvciA9IHZlYzQoaSAqIHN0cmVuZ3RoICsgY29sb3IucmdiICogKDEuMCAtIHN0cmVuZ3RoKSwgY29sb3IuYSk7XFxufVxcblwiXG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gVGV4dHVyZVxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gVGV4dHVyZShnbCwgdW5pdCwgbm9kZU9yV2lkdGgsIGhlaWdodCkge1xuICB0aGlzLmdsID0gZ2xcbiAgdGhpcy51bml0ID0gdW5pdFxuXG4gIHRoaXMudGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKVxuICB0aGlzLmJpbmQoKVxuICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIHRydWUpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5MSU5FQVIpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpXG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpXG5cbiAgaWYgKHV0aWxzLmlzQXJyYXkobm9kZU9yV2lkdGgpKSB7XG4gICAgdmFyIGRhdGEgPSBuZXcgVWludDhBcnJheShub2RlT3JXaWR0aClcbiAgICB2YXIgd2lkdGggPSBNYXRoLmNlaWwoZGF0YS5sZW5ndGggLyA0KVxuICAgIHZhciBoZWlnaHQgPSAxXG5cbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVClcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVClcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIHdpZHRoLCBoZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIGRhdGEpXG5cbiAgfSBlbHNlIGlmICh1dGlscy5pc05vdGhpbmcoaGVpZ2h0KSkge1xuICAgIHZhciBub2RlID0gdXRpbHMuZ2V0Tm9kZShub2RlT3JXaWR0aClcbiAgICB0aGlzLndpZHRoID0gbm9kZS53aWR0aFxuICAgIHRoaXMuaGVpZ2h0ID0gbm9kZS5oZWlnaHRcblxuICAgIGlmIChub2RlLmdldENvbnRleHQgJiYgdXRpbHMuaXNXZWJraXQoKSkge1xuICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0ZMSVBfWV9XRUJHTCwgdHJ1ZSlcbiAgICB9XG5cbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG5vZGUpXG5cbiAgfSBlbHNlIHtcbiAgICB0aGlzLndpZHRoID0gbm9kZU9yV2lkdGhcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodFxuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG51bGwpXG5cbiAgICB0aGlzLmZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKVxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5mcmFtZWJ1ZmZlcilcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZSwgMClcbiAgfVxufVxuXG5UZXh0dXJlLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2xcbiAgZ2wuYWN0aXZlVGV4dHVyZShnbFsnVEVYVFVSRScgKyB0aGlzLnVuaXRdKVxuICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUpXG4gIGlmICh0aGlzLmZyYW1lYnVmZmVyKSBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZnJhbWVidWZmZXIpXG4gIHJldHVybiB0aGlzXG59XG5cblRleHR1cmUucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5nbC5kZWxldGVUZXh0dXJlKHRoaXMudGV4dHVyZSlcbiAgaWYgKHRoaXMuZnJhbWVidWZmZXIpIHtcbiAgICB0aGlzLmdsLmRlbGV0ZUZyYW1lYnVmZmVyKHRoaXMuZnJhbWVidWZmZXIpXG4gICAgdGhpcy5mcmFtZWJ1ZmZlciA9IG51bGxcbiAgfVxuICB0aGlzLnRleHR1cmUgPSBudWxsXG4gIHRoaXMuZ2wgPSBudWxsXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNTdHJpbmc6IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IFN0cmluZ10nXG4gIH0sXG5cbiAgaXNOdW1iZXI6IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IE51bWJlcl0nXG4gIH0sXG5cbiAgaXNBcnJheTogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9LFxuXG4gIGlzTm90aGluZzogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJ1xuICB9LFxuXG4gIGdldE5vZGU6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAodGhpcy5pc1N0cmluZyhub2RlKSkge1xuICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iobm9kZSlcbiAgICB9IGVsc2UgaWYgKG5vZGUuaXNHbGltZykge1xuICAgICAgcmV0dXJuIG5vZGUuY2FudmFzXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlXG4gICAgfVxuICB9LFxuXG4gIGlzV2Via2l0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZVxuICB9XG59XG4iXX0=
(3)
});
