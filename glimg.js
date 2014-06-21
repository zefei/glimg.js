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
    premultipliedAlpha: false
  }

  var gl = canvas.getContext('webgl', options) ||
           canvas.getContext('experimental-webgl', options)

  if (!gl) throw 'WebGL is not supported'

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  this.isGlimg = true
  this.canvas = canvas
  this.gl = gl
  this._buffers = {}
  this._textures = {}
  this._shaders = {}
  var maxUnit = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) - 1
  this._unit = [maxUnit, maxUnit - 1, maxUnit - 2]
  this._chain = {count: 0}
  this.setStage(0, null)
  this.setZoom(null)
}

// load(node[, callback])
// load(url[, callback])
// returns this object
//
// Load image from a node (canvas, image or video) or from an image url. 
// Callback is called at the end.
//
Glimg.prototype.load = function(nodeOrUrl, callback) {
  if (utils.isString(nodeOrUrl)) {
    var self = this
    var image = new Image()
    image.onload = function() {
      self.load(image, callback)
    }
    image.src = nodeOrUrl
  } else {
    this.setSource(this.sourceUnit, nodeOrUrl)
    .setSize(nodeOrUrl.width, nodeOrUrl.height)
    .copy()
    if (callback) callback()
  }

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

// apply()
// returns this object
//
// Apply rendered result back to source image, then reset stage. See 'setStage' 
// for more details.
//
Glimg.prototype.apply = function() {
  this.setSource(this.sourceUnit, this)
  return this
}

// clear(red, green, blue, alpha)
// returns this object
//
// Clear canvas with specified color.
//
Glimg.prototype.clear = function(red, green, blue, alpha) {
  this.gl.clearColor(red, green, blue, alpha)
  this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  return this
}

// toDataUrl()
// returns a base64 url String
//
// Save image data to base64 url.
// This can be used as <a> href or window.location.
//
Glimg.prototype.toDataURL = function() {
  return this.canvas.toDataURL('image/jpeg')
}

Glimg.prototype.copy = function(sourceCoord, targetCoord) {
  var s = sourceCoord || {left: 0, top: 0, right : 1, bottom: 1}
  var t = targetCoord || {left: 0, top: 0, right : 1, bottom: 1}

  this.useShader(shaders.copy)
  .set('sourceCoord', s.left, s.top, s.right, s.bottom)
  .set('targetCoord', t.left, t.top, t.right, t.bottom)
  .run()

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
  .useShader(shaders.transform)
  .setMatrix('transform', mat)
  .set('sourceCoord', l, t, r, b)
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

  var gaussian = shaders.gaussian256
  for (var i = 2; i < 256; i *= 2) {
    if (radius <= i) {
      gaussian = shaders['gaussian' + i]
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
  this.useShader(shaders.contrast)
  .set('strength', strength)
  .run()

  return this
}

Glimg.prototype.monotone = function(strength) {
  this.useShader(shaders.monotone)
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

Glimg.prototype.step = function() {
  if (this._chain.count <= 0) return this
  var unit = this._chain.unit === 0 ? 1 : 0
  this.setSource(this.targetUnit).setTarget(this._unit[unit])
  this._chain.unit = unit
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
  .set('sourceCoord', 0, 0, 1, 1)
  .set('targetCoord', 0, 0, 1, 1)
  .set('flipY', this.targetUnit === null ? -1 : 1)
  .set('source', this.sourceUnit, null)
  .set('size', [1 / texture.width, 1 / texture.height, texture.width, texture.height])

  return this._shaders[source]
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
    glimg.info.maxUnit = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
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
  var vertex = _dereq_('./shaders').vertex
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
  vertex: "attribute vec2 sourceCoord;\nattribute vec2 targetCoord;\nuniform float flipY;\nvarying vec2 coord;\n\nvoid main() {\n   gl_Position = vec4((targetCoord * 2.0 - 1.0) * vec2(1, flipY), 0.0, 1.0);\n   coord = sourceCoord;\n}\n",
  copy: "precision mediump float;\n\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\n\nvoid main() {\n  gl_FragColor = texture2D(source, coord);\n}\n",
  transform: "precision mediump float;\n\nuniform mat2 transform;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\n\nvoid main() {\n  // first -0.5 is applied to center image\n  // then width:height ratio is applied to keep aspect\n  // then transform is applied\n  // then pre-transforms are reversed\n  //\n  vec2 r = vec2(size.p / size.q, 1.0);\n  gl_FragColor = texture2D(source, transform * ((coord - 0.5) * r) / r + 0.5);\n}\n",
  contrast: "precision mediump float;\n\nuniform float strength;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\n\nvoid main() {\n  vec4 color = texture2D(source, coord);\n  gl_FragColor = vec4((color.rgb - 0.5) * strength + 0.5, color.a);\n}\n",
  monotone: "precision mediump float;\n\nuniform float strength;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\n\nvoid main() {\n  vec4 color = texture2D(source, coord);\n  float i = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;\n  vec3 gray = vec3(i, i, i);\n  gl_FragColor = vec4(i * strength + color.rgb * (1.0 - strength), color.a);\n}\n",
  gaussian2: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 2.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
  gaussian4: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 4.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
  gaussian8: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 8.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
  gaussian16: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 16.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
  gaussian32: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 32.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
  gaussian64: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 64.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
  gaussian128: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 128.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n",
  gaussian256: "precision mediump float;\n\nuniform float sigma;\nuniform vec2 axis;\nuniform sampler2D source;\nuniform vec4 size;\nvarying vec2 coord;\nconst float pi = 3.14159265;\nconst float radius = 256.0;\n\nvoid main() {\n  // incremental gaussian (GPU Gems 3 pp. 877 - 889)\n  vec3 g;\n  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);\n  g.y = exp(-0.5 / (sigma * sigma));\n  g.z = g.y * g.y;\n\n  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);\n  float weight = 0.0;\n\n  sum += texture2D(source, coord) * g.x;\n  weight += g.x;\n  g.xy *= g.yz;\n\n  for (float i = 1.0; i <= radius; i++) {\n    sum += texture2D(source, coord - i * size.xy * axis) * g.x;\n    sum += texture2D(source, coord + i * size.xy * axis) * g.x;\n    weight += 2.0 * g.x;\n    g.xy *= g.yz;\n  }\n\n  gl_FragColor = sum / weight;\n}\n"
}

},{}],6:[function(_dereq_,module,exports){
module.exports = Texture

var utils = _dereq_('./utils')

function Texture(gl, unit, nodeOrWidth, height) {
  this.gl = gl
  this.unit = unit

  this.texture = gl.createTexture()
  this.bind()
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  if (utils.isNothing(height)) {
    var node = utils.getNode(nodeOrWidth)
    this.width = node.width
    this.height = node.height
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
  }
}

},{}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdXNyL2xvY2FsL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9idWZmZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL2dsaW1nLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9tYWluLmpzIiwiL1VzZXJzL3plZmVpL1Byb2plY3RzL2dsaW1nLmpzL3NyYy9zaGFkZXIuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3NoYWRlcnMuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3RleHR1cmUuanMiLCIvVXNlcnMvemVmZWkvUHJvamVjdHMvZ2xpbWcuanMvc3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcmVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIEJ1ZmZlcihnbCwgYXJyYXkpIHtcbiAgdGhpcy5nbCA9IGdsXG4gIHRoaXMuYnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKClcbiAgdGhpcy5iaW5kKClcbiAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIG5ldyBGbG9hdDMyQXJyYXkoYXJyYXkpLCBnbC5TVEFUSUNfRFJBVylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuYmluZEJ1ZmZlcih0aGlzLmdsLkFSUkFZX0JVRkZFUiwgdGhpcy5idWZmZXIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLmRlbGV0ZUJ1ZmZlcih0aGlzLmJ1ZmZlcilcbiAgdGhpcy5idWZmZXIgPSBudWxsXG4gIHRoaXMuZ2wgPSBudWxsXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEdsaW1nXG5cbnZhciBTaGFkZXIgPSByZXF1aXJlKCcuL3NoYWRlcicpXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnLi9idWZmZXInKVxudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuL3RleHR1cmUnKVxudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKVxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbi8vIG5ldyBHbGltZyhbY2FudmFzXSlcbi8vXG4vLyBDcmVhdGUgYW4gZW1wdHkgR2xpbWcgb2JqZWN0LlxuLy9cbi8vIElmIGNhbnZhcyBpcyBwcm92aWRlZCwgZWl0aGVyIG5vZGUgb3Igc2VsZWN0b3IsIEdsaW1nIHdpbGwgdXNlIHRoYXQgY2FudmFzIFxuLy8gbm9kZSBpbnN0ZWFkIG9mIGNyZWF0aW5nIGEgbmV3IG9uZS5cbi8vXG4vLyBOb3RpY2UgdGhhdCB5b3UgY2Fubm90IHVzZSBhIGNhbnZhcyB0aGF0IGhhcyBjYWxsZWQgZ2V0Q29udGV4dCgnMmQnKS5cbi8vXG5mdW5jdGlvbiBHbGltZyhjYW52YXMpIHtcbiAgaWYgKGNhbnZhcykge1xuICAgIGNhbnZhcyA9IHV0aWxzLmdldE5vZGUoY2FudmFzKVxuICB9IGVsc2Uge1xuICAgIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpXG4gIH1cblxuICB2YXIgb3B0aW9ucyA9IHtcbiAgICBwcmVzZXJ2ZURyYXdpbmdCdWZmZXI6IHRydWUsXG4gICAgcHJlbXVsdGlwbGllZEFscGhhOiBmYWxzZVxuICB9XG5cbiAgdmFyIGdsID0gY2FudmFzLmdldENvbnRleHQoJ3dlYmdsJywgb3B0aW9ucykgfHxcbiAgICAgICAgICAgY2FudmFzLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcsIG9wdGlvbnMpXG5cbiAgaWYgKCFnbCkgdGhyb3cgJ1dlYkdMIGlzIG5vdCBzdXBwb3J0ZWQnXG5cbiAgZ2wuZW5hYmxlKGdsLkJMRU5EKVxuICBnbC5ibGVuZEZ1bmMoZ2wuU1JDX0FMUEhBLCBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBKVxuXG4gIHRoaXMuaXNHbGltZyA9IHRydWVcbiAgdGhpcy5jYW52YXMgPSBjYW52YXNcbiAgdGhpcy5nbCA9IGdsXG4gIHRoaXMuX2J1ZmZlcnMgPSB7fVxuICB0aGlzLl90ZXh0dXJlcyA9IHt9XG4gIHRoaXMuX3NoYWRlcnMgPSB7fVxuICB2YXIgbWF4VW5pdCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9JTUFHRV9VTklUUykgLSAxXG4gIHRoaXMuX3VuaXQgPSBbbWF4VW5pdCwgbWF4VW5pdCAtIDEsIG1heFVuaXQgLSAyXVxuICB0aGlzLl9jaGFpbiA9IHtjb3VudDogMH1cbiAgdGhpcy5zZXRTdGFnZSgwLCBudWxsKVxuICB0aGlzLnNldFpvb20obnVsbClcbn1cblxuLy8gbG9hZChub2RlWywgY2FsbGJhY2tdKVxuLy8gbG9hZCh1cmxbLCBjYWxsYmFja10pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gTG9hZCBpbWFnZSBmcm9tIGEgbm9kZSAoY2FudmFzLCBpbWFnZSBvciB2aWRlbykgb3IgZnJvbSBhbiBpbWFnZSB1cmwuIFxuLy8gQ2FsbGJhY2sgaXMgY2FsbGVkIGF0IHRoZSBlbmQuXG4vL1xuR2xpbWcucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihub2RlT3JVcmwsIGNhbGxiYWNrKSB7XG4gIGlmICh1dGlscy5pc1N0cmluZyhub2RlT3JVcmwpKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgdmFyIGltYWdlID0gbmV3IEltYWdlKClcbiAgICBpbWFnZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHNlbGYubG9hZChpbWFnZSwgY2FsbGJhY2spXG4gICAgfVxuICAgIGltYWdlLnNyYyA9IG5vZGVPclVybFxuICB9IGVsc2Uge1xuICAgIHRoaXMuc2V0U291cmNlKHRoaXMuc291cmNlVW5pdCwgbm9kZU9yVXJsKVxuICAgIC5zZXRTaXplKG5vZGVPclVybC53aWR0aCwgbm9kZU9yVXJsLmhlaWdodClcbiAgICAuY29weSgpXG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBzZXRTaXplKHdpZHRoLCBoZWlnaHQpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHRhcmdldCBpbWFnZSBzaXplLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRTaXplID0gZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuICBpZiAodGhpcy50YXJnZXRVbml0ID09PSBudWxsKSB7XG4gICAgdGhpcy53aWR0aCA9IHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGhcbiAgICB0aGlzLmhlaWdodCA9IHRoaXMuY2FudmFzLmhlaWdodCA9IGhlaWdodFxuICAgIHRoaXMuem9vbSh0aGlzLl96b29tTGV2ZWwpXG4gIH0gZWxzZSB7XG4gICAgdGhpcy51c2VUZXh0dXJlKHRoaXMudGFyZ2V0VW5pdCwgd2lkdGgsIGhlaWdodClcbiAgfVxuXG4gIHRoaXMuZ2wudmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gc2V0Wm9vbSh6b29tTGV2ZWwpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IGNzcyBzaXplIG9mIHRoZSBjYW52YXMgYWNjb3JkaW5nIHRvIGFjdHVhbCBpbWFnZSBzaXplLiBUaGlzIHBlcnNpc3RzIFxuLy8gdGhyb3VnaCByZXNpemVzLlxuLy9cbi8vIFpvb20gbGV2ZWwgY2FuIGJlIGEgbnVtYmVyOiB6b29tIHJhdGlvLCBvciAnZml0JzogMTAwJSBwYXJlbnQgd2lkdGgsIG9yIG51bGw6IFxuLy8gbm90IHpvb21pbmcgb24gcmVzaXplcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0Wm9vbSA9IGZ1bmN0aW9uKHpvb21MZXZlbCkge1xuICB0aGlzLl96b29tTGV2ZWwgPSB6b29tTGV2ZWxcbiAgdGhpcy56b29tKHpvb21MZXZlbClcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gem9vbSh6b29tTGV2ZWwpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gWm9vbSB0aGUgY2FudmFzIG9uY2UuIFNlZSAnc2V0Wm9vbScgZm9yIG1vcmUgZGV0YWlscy5cbi8vXG5HbGltZy5wcm90b3R5cGUuem9vbSA9IGZ1bmN0aW9uKHpvb21MZXZlbCkge1xuICBpZiAodXRpbHMuaXNOb3RoaW5nKHpvb21MZXZlbCkpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9IGVsc2UgaWYgKHpvb21MZXZlbCA9PT0gJ2ZpdCcpIHtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS53aWR0aCA9ICcxMDAlJ1xuICB9IGVsc2Uge1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLndpZHRoID0gJycgKyAodGhpcy53aWR0aCAqIHpvb21MZXZlbCkgKyAncHgnXG4gIH1cbiAgdGhpcy5jYW52YXMuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gY3JvcChsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQ3JvcCB0aGUgaW1hZ2UuIENvb3JkaW5hdGVzIGFyZSBpbiBwZXJjZW50YWdlLCBub3QgcGl4ZWxzLiBUaGV5IHNob3VsZCBiZSBpbiBcbi8vIHRoZSByYW5nZSBvZiBbMCwgMV0uXG4vL1xuR2xpbWcucHJvdG90eXBlLmNyb3AgPSBmdW5jdGlvbihsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20pIHtcbiAgdmFyIHdpZHRoID0gKHJpZ2h0IC0gbGVmdCkgKiB0aGlzLl90ZXh0dXJlc1swXS53aWR0aFxuICB2YXIgaGVpZ2h0ID0gKGJvdHRvbSAtIHRvcCkgKiB0aGlzLl90ZXh0dXJlc1swXS5oZWlnaHRcblxuICB0aGlzLnNldFNpemUod2lkdGgsIGhlaWdodClcbiAgLmNvcHkoe2xlZnQ6IGxlZnQsIHRvcDogdG9wLCByaWdodDogcmlnaHQsIGJvdHRvbTogYm90dG9tfSlcblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBhcHBseSgpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQXBwbHkgcmVuZGVyZWQgcmVzdWx0IGJhY2sgdG8gc291cmNlIGltYWdlLCB0aGVuIHJlc2V0IHN0YWdlLiBTZWUgJ3NldFN0YWdlJyBcbi8vIGZvciBtb3JlIGRldGFpbHMuXG4vL1xuR2xpbWcucHJvdG90eXBlLmFwcGx5ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2V0U291cmNlKHRoaXMuc291cmNlVW5pdCwgdGhpcylcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gY2xlYXIocmVkLCBncmVlbiwgYmx1ZSwgYWxwaGEpXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gQ2xlYXIgY2FudmFzIHdpdGggc3BlY2lmaWVkIGNvbG9yLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKHJlZCwgZ3JlZW4sIGJsdWUsIGFscGhhKSB7XG4gIHRoaXMuZ2wuY2xlYXJDb2xvcihyZWQsIGdyZWVuLCBibHVlLCBhbHBoYSlcbiAgdGhpcy5nbC5jbGVhcih0aGlzLmdsLkNPTE9SX0JVRkZFUl9CSVQpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHRvRGF0YVVybCgpXG4vLyByZXR1cm5zIGEgYmFzZTY0IHVybCBTdHJpbmdcbi8vXG4vLyBTYXZlIGltYWdlIGRhdGEgdG8gYmFzZTY0IHVybC5cbi8vIFRoaXMgY2FuIGJlIHVzZWQgYXMgPGE+IGhyZWYgb3Igd2luZG93LmxvY2F0aW9uLlxuLy9cbkdsaW1nLnByb3RvdHlwZS50b0RhdGFVUkwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvanBlZycpXG59XG5cbkdsaW1nLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oc291cmNlQ29vcmQsIHRhcmdldENvb3JkKSB7XG4gIHZhciBzID0gc291cmNlQ29vcmQgfHwge2xlZnQ6IDAsIHRvcDogMCwgcmlnaHQgOiAxLCBib3R0b206IDF9XG4gIHZhciB0ID0gdGFyZ2V0Q29vcmQgfHwge2xlZnQ6IDAsIHRvcDogMCwgcmlnaHQgOiAxLCBib3R0b206IDF9XG5cbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5jb3B5KVxuICAuc2V0KCdzb3VyY2VDb29yZCcsIHMubGVmdCwgcy50b3AsIHMucmlnaHQsIHMuYm90dG9tKVxuICAuc2V0KCd0YXJnZXRDb29yZCcsIHQubGVmdCwgdC50b3AsIHQucmlnaHQsIHQuYm90dG9tKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUucm90YXRlID0gZnVuY3Rpb24oZGVncmVlKSB7XG4gIC8vIHJvdGF0aW9uIG1hdHJpeFxuICB2YXIgdGhldGEgPSBNYXRoLlBJIC8gMTgwICogZGVncmVlXG4gIHZhciBtYXQgPSBbTWF0aC5jb3ModGhldGEpLCAtTWF0aC5zaW4odGhldGEpLCBNYXRoLnNpbih0aGV0YSksIE1hdGguY29zKHRoZXRhKV1cblxuICAvLyBzb3VyY2UgZGltZW5zaW9uXG4gIHZhciB3aWR0aCA9IHRoaXMuZ2V0U291cmNlKCkud2lkdGhcbiAgdmFyIGhlaWdodCA9IHRoaXMuZ2V0U291cmNlKCkuaGVpZ2h0XG5cbiAgLy8gbWF4aW1hbCBmaXR0aW5nIHJlY3RhbmdsZVxuICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzU3ODkyMzkvY2FsY3VsYXRlLWxhcmdlc3QtcmVjdGFuZ2xlLWluLWEtcm90YXRlZC1yZWN0YW5nbGVcbiAgdmFyIHcwLCBoMFxuICBpZiAod2lkdGggPD0gaGVpZ2h0KSB7XG4gICAgdzAgPSB3aWR0aFxuICAgIGgwID0gaGVpZ2h0XG4gIH0gZWxzZSB7XG4gICAgdzAgPSBoZWlnaHRcbiAgICBoMCA9IHdpZHRoXG4gIH1cblxuICB2YXIgYWxwaGEgPSB0aGV0YSAtIE1hdGguZmxvb3IoKHRoZXRhICsgTWF0aC5QSSkgLyAoMiAqIE1hdGguUEkpKSAqICgyICogTWF0aC5QSSlcbiAgYWxwaGEgPSBNYXRoLmFicyhhbHBoYSlcbiAgaWYgKGFscGhhID4gTWF0aC5QSSAvIDIpIGFscGhhID0gTWF0aC5QSSAtIGFscGhhXG5cbiAgdmFyIHNpbmEgPSBNYXRoLnNpbihhbHBoYSlcbiAgdmFyIGNvc2EgPSBNYXRoLmNvcyhhbHBoYSlcbiAgdmFyIHcxID0gdzAgKiBjb3NhICsgaDAgKiBzaW5hXG4gIHZhciBoMSA9IHcwICogc2luYSArIGgwICogY29zYVxuICB2YXIgYyA9IGgwICogKHNpbmEgKiBjb3NhKSAvICgyICogaDAgKiAoc2luYSAqIGNvc2EpICsgdzApXG4gIHZhciB4ID0gdzEgKiBjXG4gIHZhciB5ID0gaDEgKiBjXG4gIHZhciB3LCBoXG4gIGlmICh3aWR0aCA8PSBoZWlnaHQpIHtcbiAgICB3ID0gdzEgLSAyICogeFxuICAgIGggPSBoMSAtIDIgKiB5XG4gIH1cbiAgZWxzZSB7XG4gICAgdyA9IGgxIC0gMiAqIHlcbiAgICBoID0gdzEgLSAyICogeFxuICB9XG5cbiAgLy8gZGltZW5zaW9uIHRyYW5zZm9ybVxuICB2YXIgbCwgdCwgciwgYjtcbiAgbCA9ICh3aWR0aCAtIHcpIC8gKDIgKiB3aWR0aClcbiAgciA9ICh3aWR0aCArIHcpIC8gKDIgKiB3aWR0aClcbiAgdCA9IChoZWlnaHQgLSBoKSAvICgyICogaGVpZ2h0KVxuICBiID0gKGhlaWdodCArIGgpIC8gKDIgKiBoZWlnaHQpXG5cbiAgdGhpcy5zZXRTaXplKHcsIGgpXG4gIC51c2VTaGFkZXIoc2hhZGVycy50cmFuc2Zvcm0pXG4gIC5zZXRNYXRyaXgoJ3RyYW5zZm9ybScsIG1hdClcbiAgLnNldCgnc291cmNlQ29vcmQnLCBsLCB0LCByLCBiKVxuICAucnVuKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuYmx1ciA9IGZ1bmN0aW9uKHJhZGl1cykge1xuICBpZiAocmFkaXVzIDw9IDApIHJldHVybiB0aGlzXG4gIGlmIChyYWRpdXMgPD0gNCkgcmV0dXJuIHRoaXMuZ2F1c3NpYW5CbHVyKHJhZGl1cylcblxuICB2YXIgdyA9IHRoaXMuZ2V0U291cmNlKCkud2lkdGhcbiAgdmFyIGggPSB0aGlzLmdldFNvdXJjZSgpLmhlaWdodFxuICB2YXIgciA9IE1hdGguc3FydChyYWRpdXMpXG5cbiAgdGhpcy5jaGFpbigpXG4gIC5nYXVzc2lhbkJsdXIocilcbiAgLnNldFNpemUodyAvIHIsIGggLyByKVxuICAuY29weSgpXG4gIC5nYXVzc2lhbkJsdXIocilcbiAgLnNldFNpemUodywgaClcbiAgLmNvcHkoKVxuICAuZG9uZSgpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmdhdXNzaWFuQmx1ciA9IGZ1bmN0aW9uKHJhZGl1cykge1xuICBpZiAocmFkaXVzIDw9IDApIHJldHVybiB0aGlzXG5cbiAgdmFyIGdhdXNzaWFuID0gc2hhZGVycy5nYXVzc2lhbjI1NlxuICBmb3IgKHZhciBpID0gMjsgaSA8IDI1NjsgaSAqPSAyKSB7XG4gICAgaWYgKHJhZGl1cyA8PSBpKSB7XG4gICAgICBnYXVzc2lhbiA9IHNoYWRlcnNbJ2dhdXNzaWFuJyArIGldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIHRoaXMuY2hhaW4oKVxuICAudXNlU2hhZGVyKGdhdXNzaWFuKVxuICAuc2V0KCdzaWdtYScsIHJhZGl1cyAvIDMpXG4gIC5zZXQoJ2F4aXMnLCBbMSwgMF0pXG4gIC5ydW4oKVxuICAudXNlU2hhZGVyKGdhdXNzaWFuKVxuICAuc2V0KCdzaWdtYScsIHJhZGl1cyAvIDMpXG4gIC5zZXQoJ2F4aXMnLCBbMCwgMV0pXG4gIC5ydW4oKVxuICAuZG9uZSgpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLmNvbnRyYXN0ID0gZnVuY3Rpb24oc3RyZW5ndGgpIHtcbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5jb250cmFzdClcbiAgLnNldCgnc3RyZW5ndGgnLCBzdHJlbmd0aClcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLm1vbm90b25lID0gZnVuY3Rpb24oc3RyZW5ndGgpIHtcbiAgdGhpcy51c2VTaGFkZXIoc2hhZGVycy5tb25vdG9uZSlcbiAgLnNldCgnc3RyZW5ndGgnLCBzdHJlbmd0aClcbiAgLnJ1bigpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gc2V0U3RhZ2Uoc291cmNlVW5pdCwgdGFyZ2V0VW5pdFssIG5vZGVdKVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCBzb3VyY2UgdW5pdCBhbmQgdGFyZ2V0IHVuaXQsIGFuZCBvcHRpb25hbGx5IGxvYWQgaW1hZ2UgZnJvbSBub2RlIHRvIFxuLy8gc291cmNlIHVuaXQuIEl0IHJlc2l6ZXMgdGFyZ2V0IHVuaXQgdG8gbWF0Y2ggc291cmNlIHVuaXQgYWZ0ZXJ3YXJkcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0U3RhZ2UgPSBmdW5jdGlvbihzb3VyY2VVbml0LCB0YXJnZXRVbml0LCBub2RlKSB7XG4gIHRoaXMuc2V0U291cmNlKHNvdXJjZVVuaXQsIG5vZGUpLnNldFRhcmdldCh0YXJnZXRVbml0KVxuICByZXR1cm4gdGhpc1xufVxuXG5HbGltZy5wcm90b3R5cGUuY2hhaW4gPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuX2NoYWluLmNvdW50ID4gMCkge1xuICAgIHRoaXMuX2NoYWluLmNvdW50ICs9IDFcbiAgfSBlbHNlIHtcbiAgICB0aGlzLl9jaGFpbiA9IHtzb3VyY2U6IHRoaXMuc291cmNlVW5pdCwgdGFyZ2V0OiB0aGlzLnRhcmdldFVuaXQsIHVuaXQ6IDAsIGNvdW50OiAxfVxuICAgIHRoaXMuc2V0VGFyZ2V0KHRoaXMuX3VuaXRbMF0pXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuR2xpbWcucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuX2NoYWluLmNvdW50IDw9IDApIHJldHVybiB0aGlzXG4gIHZhciB1bml0ID0gdGhpcy5fY2hhaW4udW5pdCA9PT0gMCA/IDEgOiAwXG4gIHRoaXMuc2V0U291cmNlKHRoaXMudGFyZ2V0VW5pdCkuc2V0VGFyZ2V0KHRoaXMuX3VuaXRbdW5pdF0pXG4gIHRoaXMuX2NoYWluLnVuaXQgPSB1bml0XG4gIHJldHVybiB0aGlzXG59XG5cbkdsaW1nLnByb3RvdHlwZS5kb25lID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA8PSAwKSByZXR1cm4gdGhpc1xuICB0aGlzLl9jaGFpbi5jb3VudCAtPSAxXG4gIGlmICh0aGlzLl9jaGFpbi5jb3VudCA9PT0gMCkge1xuICAgIHRoaXMuc2V0VGFyZ2V0KHRoaXMuX2NoYWluLnRhcmdldCkuY29weSgpLnNldFNvdXJjZSh0aGlzLl9jaGFpbi5zb3VyY2UpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gZ2V0U291cmNlKClcbi8vIHJldHVybnMgY3VycmVudCBzb3VyY2UgaW1hZ2Vcbi8vXG5HbGltZy5wcm90b3R5cGUuZ2V0U291cmNlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl90ZXh0dXJlc1t0aGlzLnNvdXJjZVVuaXRdXG59XG5cbi8vIHNldFNvdXJjZSh1bml0Wywgbm9kZV0pXG4vLyByZXR1cm5zIHRoaXMgb2JqZWN0XG4vL1xuLy8gU2V0IHNvdXJjZSB1bml0LCBhbmQgb3B0aW9uYWxseSBsb2FkIGltYWdlIGZyb20gbm9kZSB0byBzb3VyY2UgdW5pdC5cbi8vXG5HbGltZy5wcm90b3R5cGUuc2V0U291cmNlID0gZnVuY3Rpb24odW5pdCwgbm9kZSkge1xuICB0aGlzLnNvdXJjZVVuaXQgPSB1bml0XG4gIGlmIChub2RlKSB0aGlzLnVzZVRleHR1cmUodW5pdCwgbm9kZSlcbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gZ2V0VGFyZ2V0KClcbi8vIHJldHVybnMgY3VycmVudCB0YXJnZXQgaW1hZ2UsIG51bGwgaWYgdGFyZ2V0IGlzIHRoZSBjYW52YXNcbi8vXG5HbGltZy5wcm90b3R5cGUuZ2V0VGFyZ2V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl90ZXh0dXJlc1t0aGlzLnRhcmdldFVuaXRdXG59XG5cbi8vIHNldFRhcmdldCh1bml0KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIFNldCB0YXJnZXQgdW5pdC4gSXQgcmVzaXplcyB0YXJnZXQgdW5pdCB0byBtYXRjaCBzb3VyY2UgdW5pdCBhZnRlcndhcmRzLlxuLy9cbkdsaW1nLnByb3RvdHlwZS5zZXRUYXJnZXQgPSBmdW5jdGlvbih1bml0KSB7XG4gIHRoaXMudGFyZ2V0VW5pdCA9IHVuaXRcblxuICBpZiAodXRpbHMuaXNOb3RoaW5nKHVuaXQpKSB7XG4gICAgdGhpcy5nbC5iaW5kRnJhbWVidWZmZXIodGhpcy5nbC5GUkFNRUJVRkZFUiwgbnVsbClcbiAgfVxuXG4gIHZhciBzb3VyY2UgPSB0aGlzLmdldFNvdXJjZSgpXG4gIGlmIChzb3VyY2UpIHRoaXMuc2V0U2l6ZShzb3VyY2Uud2lkdGgsIHNvdXJjZS5oZWlnaHQpXG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gdXNlU2hhZGVyKHNvdXJjZSlcbi8vIHJldHVybnMgYSBTaGFkZXIgb2JqZWN0XG4vL1xuLy8gQ3JlYXRlIGFuZCBjYWNoZSBhIFdlYkdMIHNoYWRlciBwcm9ncmFtIGZyb20gc291cmNlIGFuZCByZXR1cm4gaXQuIFVzZSBjYWNoZWQgXG4vLyBzaGFkZXIgaWYgcG9zc2libGUuXG4vL1xuLy8gVGhlIHNvdXJjZSBzaG91bGQgYmUgYSBmcmFnbWVudCBzaGFkZXIgYmFzZWQgb24gZ2xpbWcuc2hhZGVycy5jb3B5LiBJdCB3aWxsIFxuLy8gYmUgY29tcGlsZWQgYW5kIGxpbmtlZCB3aXRoIGdsaW1nLnNoYWRlcnMudmVydGV4LlxuLy9cbi8vIEdsaW1nIHNoYWRlcnMgYXJlIGxvYWRlZCBpbiBnbGltZy5zaGFkZXJzLCB0aGVpciBzb3VyY2UgZmlsZXMgYXJlIGxvY2F0ZWQgYXQgXG4vLyBzcmMvc2hhZGVycy4gVGFrZSBhIGxvb2sgYXQgdGhlIHNvdXJjZXMgdG8gc2VlIGhvdyB0aGV5IGFyZSBvcmdhbml6ZWQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnVzZVNoYWRlciA9IGZ1bmN0aW9uKHNvdXJjZSkge1xuICBpZiAoIXRoaXMuX3NoYWRlcnNbc291cmNlXSkge1xuICAgIHRoaXMuX3NoYWRlcnNbc291cmNlXSA9IG5ldyBTaGFkZXIodGhpcywgc291cmNlKVxuICB9XG5cbiAgdmFyIHRleHR1cmUgPSB0aGlzLmdldFNvdXJjZSgpXG4gIHRoaXMuX3NoYWRlcnNbc291cmNlXVxuICAudXNlKClcbiAgLnNldCgnc291cmNlQ29vcmQnLCAwLCAwLCAxLCAxKVxuICAuc2V0KCd0YXJnZXRDb29yZCcsIDAsIDAsIDEsIDEpXG4gIC5zZXQoJ2ZsaXBZJywgdGhpcy50YXJnZXRVbml0ID09PSBudWxsID8gLTEgOiAxKVxuICAuc2V0KCdzb3VyY2UnLCB0aGlzLnNvdXJjZVVuaXQsIG51bGwpXG4gIC5zZXQoJ3NpemUnLCBbMSAvIHRleHR1cmUud2lkdGgsIDEgLyB0ZXh0dXJlLmhlaWdodCwgdGV4dHVyZS53aWR0aCwgdGV4dHVyZS5oZWlnaHRdKVxuXG4gIHJldHVybiB0aGlzLl9zaGFkZXJzW3NvdXJjZV1cbn1cblxuLy8gcHJpdmF0ZVxuLy8gdXNlQnVmZmVyKGFycmF5KVxuLy8gcmV0dXJucyB0aGlzIG9iamVjdFxuLy9cbi8vIENyZWF0ZSBhbmQgY2FjaGUgYSBXZWJHTCBidWZmZXIgZnJvbSBhcnJheS4gVXNlIGNhY2hlZCBidWZmZXIgaWYgcG9zc2libGUuXG4vL1xuLy8gVG8gY3JlYXRlL3Bhc3MgdmVydGljZXMgdG8gc2hhZGVyLCB1c2Ugc2hhZGVyLnNldCgpIGluc3RlYWQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnVzZUJ1ZmZlciA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gIGlmICghdXRpbHMuaXNBcnJheShhcnJheSkpIGFycmF5ID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gIHZhciBrZXkgPSBhcnJheS5qb2luKClcblxuICBpZiAoIXRoaXMuX2J1ZmZlcnNba2V5XSkge1xuICAgIHRoaXMuX2J1ZmZlcnNba2V5XSA9IG5ldyBCdWZmZXIodGhpcy5nbCwgYXJyYXkpXG4gIH1cbiAgdGhpcy5fYnVmZmVyc1trZXldLmJpbmQoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIHByaXZhdGVcbi8vIHVzZVRleHR1cmUodW5pdCwgbm9kZSlcbi8vIHVzZVRleHR1cmUodW5pdCwgd2lkdGgsIGhlaWdodClcbi8vIHJldHVybnMgdGhpcyBvYmplY3Rcbi8vXG4vLyBDcmVhdGUgYW5kIGNhY2hlIGEgV2ViR0wgdGV4dHVyZSB1bml0IGZyb20gbm9kZSwgb3IgY3JlYXRlIGEgZnJhbWVidWZmZXIgXG4vLyB0ZXh1dHJlIGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIHByb3ZpZGVkLiBVc2UgY2FjaGVkIHRleHR1cmUgaWYgcG9zc2libGUuXG4vL1xuLy8gVG8gY3JlYXRlL3Bhc3MgdGV4dHVyZXMgdG8gc2hhZGVyLCB1c2Ugc2hhZGVyLnNldCgpIGluc3RlYWQuXG4vL1xuR2xpbWcucHJvdG90eXBlLnVzZVRleHR1cmUgPSBmdW5jdGlvbih1bml0LCBub2RlT3JXaWR0aCwgaGVpZ2h0KSB7XG4gIHZhciB0ZXh0dXJlID0gdGhpcy5fdGV4dHVyZXNbdW5pdF1cbiAgdmFyIHJldXNlID0gIXV0aWxzLmlzTm90aGluZyhoZWlnaHQpICYmIHRleHR1cmUgJiYgdGV4dHVyZS5mcmFtZWJ1ZmZlciAmJlxuICAgICAgICAgICAgICB0ZXh0dXJlLndpZHRoID09PSBub2RlT3JXaWR0aCAmJiB0ZXh0dXJlLmhlaWdodCA9PT0gaGVpZ2h0XG5cbiAgaWYgKCFyZXVzZSkge1xuICAgIGlmICh0aGlzLl90ZXh0dXJlc1t1bml0XSkgdGhpcy5fdGV4dHVyZXNbdW5pdF0uZGVzdHJveSgpXG4gICAgdGhpcy5fdGV4dHVyZXNbdW5pdF0gPSBuZXcgVGV4dHVyZSh0aGlzLmdsLCB1bml0LCBub2RlT3JXaWR0aCwgaGVpZ2h0KVxuICB9XG5cbiAgdGhpcy5fdGV4dHVyZXNbdW5pdF0uYmluZCgpXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIGRlc3Ryb3koKVxuLy8gcmV0dXJucyBub3RoaW5nXG4vL1xuLy8gRGVzdHJveSB0aGUgb2JqZWN0LCBmcmVlIGFsbG9jYXRlZCBtZW1vcmllcy5cbi8vXG5HbGltZy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5nbCkge1xuICAgIHZhciBrZXlcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9idWZmZXJzKSB7XG4gICAgICB0aGlzLl9idWZmZXJzW2tleV0uZGVzdHJveSgpXG4gICAgfVxuXG4gICAgZm9yIChrZXkgaW4gdGhpcy5fdGV4dHVyZXMpIHtcbiAgICAgIHRoaXMuX3RleHR1cmVzW2tleV0uZGVzdHJveSgpXG4gICAgfVxuXG4gICAgZm9yIChrZXkgaW4gdGhpcy5fc2hhZGVycykge1xuICAgICAgdGhpcy5fc2hhZGVyc1trZXldLmRlc3Ryb3koKVxuICAgIH1cblxuICAgIHRoaXMuY2FudmFzID0gbnVsbFxuICAgIHRoaXMuZ2wgPSBudWxsXG4gICAgdGhpcy5fYnVmZmVycyA9IG51bGxcbiAgICB0aGlzLl90ZXh0dXJlcyA9IG51bGxcbiAgICB0aGlzLl9zaGFkZXJzID0gbnVsbFxuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGdsaW1nXG5cbnZhciBHbGltZyA9IHJlcXVpcmUoJy4vZ2xpbWcnKVxuXG5mdW5jdGlvbiBnbGltZyhjYW52YXMpIHtcbiAgcmV0dXJuIG5ldyBHbGltZyhjYW52YXMpXG59XG5cbmluaXQoZ2xpbWcpXG5cbmZ1bmN0aW9uIGluaXQoZ2xpbWcpIHtcbiAgZ2xpbWcuaW5mbyA9IHt9XG4gIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxuICB2YXIgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ2wnKSB8fCBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJylcbiAgaWYgKGdsKSB7XG4gICAgZ2xpbWcuaW5mby5zdXBwb3J0ZWQgPSB0cnVlXG4gICAgZ2xpbWcuaW5mby5tYXhTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX1NJWkUpXG4gICAgZ2xpbWcuaW5mby5tYXhVbml0ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX0lNQUdFX1VOSVRTKVxuICB9IGVsc2Uge1xuICAgIGdsaW1nLmluZm8uc3VwcG9ydGVkID0gZmFsc2VcbiAgfVxuXG4gIGdsaW1nLnNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBTaGFkZXJcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIFNoYWRlcihnbGltZywgc291cmNlKSB7XG4gIHRoaXMuZ2xpbWcgPSBnbGltZ1xuICB2YXIgZ2wgPSB0aGlzLmdsID0gZ2xpbWcuZ2xcbiAgdmFyIHZlcnRleCA9IHJlcXVpcmUoJy4vc2hhZGVycycpLnZlcnRleFxuICB2YXIgdmVydGV4U2hhZGVyID0gY3JlYXRlU2hhZGVyKGdsLCBnbC5WRVJURVhfU0hBREVSLCB2ZXJ0ZXgpXG4gIHZhciBmcmFnbWVudFNoYWRlciA9IGNyZWF0ZVNoYWRlcihnbCwgZ2wuRlJBR01FTlRfU0hBREVSLCBzb3VyY2UpXG4gIHZhciBwcm9ncmFtID0gdGhpcy5wcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpXG5cbiAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIHZlcnRleFNoYWRlcilcbiAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZyYWdtZW50U2hhZGVyKVxuICBnbC5saW5rUHJvZ3JhbShwcm9ncmFtKVxuXG4gIGdsLmRlbGV0ZVNoYWRlcih2ZXJ0ZXhTaGFkZXIpXG4gIGdsLmRlbGV0ZVNoYWRlcihmcmFnbWVudFNoYWRlcilcblxuICBpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB0aHJvdyAnc2hhZGVyIGxpbmsgZXJyb3InXG59XG5cblNoYWRlci5wcm90b3R5cGUudXNlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wudXNlUHJvZ3JhbSh0aGlzLnByb2dyYW0pXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWVzKSB7XG4gIHZhciBmdW5jXG5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMikge1xuICAgIGlmICh1dGlscy5pc051bWJlcih2YWx1ZXMpKSB7XG4gICAgICBmdW5jID0gJ3NldEZsb2F0J1xuICAgIH0gZWxzZSBpZiAodXRpbHMuaXNBcnJheSh2YWx1ZXMpKSB7XG4gICAgICBpZiAodmFsdWVzLmxlbmd0aCA8PSA0IHx8IHV0aWxzLmlzQXJyYXkodmFsdWVzWzBdKSkge1xuICAgICAgICBmdW5jID0gJ3NldFZlY3RvcidcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZ1bmMgPSAnc2V0TWF0cml4J1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDMpIHtcbiAgICBmdW5jID0gJ3NldFRleHR1cmUnXG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSA1KSB7XG4gICAgZnVuYyA9ICdzZXRSZWN0J1xuICB9IGVsc2Uge1xuICAgIHRocm93ICdpbnZhbGlkIGFyZ3VtZW50cydcbiAgfVxuXG4gIHJldHVybiB0aGlzW2Z1bmNdLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5nbC5kcmF3QXJyYXlzKHRoaXMuZ2wuVFJJQU5HTEVfU1RSSVAsIDAsIDQpXG4gIHRoaXMuZ2xpbWcuc3RlcCgpXG4gIHJldHVybiB0aGlzLmdsaW1nXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0RmxvYXQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG5cbiAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgbmFtZSlcbiAgaWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG4gICAgZ2wudW5pZm9ybTFmKGxvY2F0aW9uLCB2YWx1ZSlcbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0VmVjdG9yID0gZnVuY3Rpb24obmFtZSwgdmFsdWVzKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2xcblxuICB2YXIgbG9jYXRpb24gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24odGhpcy5wcm9ncmFtLCBuYW1lKVxuICBpZiAobG9jYXRpb24gIT09IG51bGwpIHtcbiAgICB2YXIgbiA9IHV0aWxzLmlzQXJyYXkodmFsdWVzWzBdKSA/IHZhbHVlc1swXS5sZW5ndGggOiB2YWx1ZXMubGVuZ3RoXG4gICAgdmFyIGZ1bmMgPSAndW5pZm9ybScgKyBuICsgJ2Z2J1xuICAgIGdsW2Z1bmNdKGxvY2F0aW9uLCBbXS5jb25jYXQodmFsdWVzKSlcbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuc2V0TWF0cml4ID0gZnVuY3Rpb24obmFtZSwgdmFsdWVzKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2xcblxuICB2YXIgbG9jYXRpb24gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24odGhpcy5wcm9ncmFtLCBuYW1lKVxuICBpZiAobG9jYXRpb24gIT09IG51bGwpIHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gNCkge1xuICAgICAgZ2wudW5pZm9ybU1hdHJpeDJmdihsb2NhdGlvbiwgZmFsc2UsIHZhbHVlcylcbiAgICB9IGVsc2UgaWYgKHZhbHVlcy5sZW5ndGggPT09IDkpIHtcbiAgICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYobG9jYXRpb24sIGZhbHNlLCB2YWx1ZXMpXG4gICAgfSBlbHNlIGlmICh2YWx1ZXMubGVuZ3RoID09PSAxNikge1xuICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdihsb2NhdGlvbiwgZmFsc2UsIHZhbHVlcylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5TaGFkZXIucHJvdG90eXBlLnNldFRleHR1cmUgPSBmdW5jdGlvbihuYW1lLCB1bml0LCBub2RlKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2xcblxuICB2YXIgbG9jYXRpb24gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24odGhpcy5wcm9ncmFtLCBuYW1lKVxuICBpZiAobG9jYXRpb24gIT09IG51bGwpIHtcbiAgICBpZiAobm9kZSkgdGhpcy5nbGltZy51c2VUZXh0dXJlKHVuaXQsIG5vZGUpXG4gICAgZ2wudW5pZm9ybTFpKGxvY2F0aW9uLCB1bml0KVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuU2hhZGVyLnByb3RvdHlwZS5zZXRSZWN0ID0gZnVuY3Rpb24obmFtZSwgbGVmdCwgdG9wLCByaWdodCwgYm90dG9tKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2xcblxuICB2YXIgbG9jYXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpXG4gIGlmIChsb2NhdGlvbiAhPT0gbnVsbCkge1xuICAgIHRoaXMuZ2xpbWcudXNlQnVmZmVyKGxlZnQsIHRvcCwgbGVmdCwgYm90dG9tLCByaWdodCwgdG9wLCByaWdodCwgYm90dG9tKVxuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvY2F0aW9uKVxuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIobG9jYXRpb24sIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMClcbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cblNoYWRlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmdsLmRlbGV0ZVByb2dyYW0odGhpcy5wcm9ncmFtKVxuICB0aGlzLnByb2dyYW0gPSBudWxsXG4gIHRoaXMuZ2wgPSBudWxsXG4gIHRoaXMuZ2xpbWcgPSBudWxsXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNoYWRlcihnbCwgdHlwZSwgc291cmNlKSB7XG4gIHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIodHlwZSlcbiAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKVxuICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcilcbiAgcmV0dXJuIHNoYWRlclxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIHZlcnRleDogXCJhdHRyaWJ1dGUgdmVjMiBzb3VyY2VDb29yZDtcXG5hdHRyaWJ1dGUgdmVjMiB0YXJnZXRDb29yZDtcXG51bmlmb3JtIGZsb2F0IGZsaXBZO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCh0YXJnZXRDb29yZCAqIDIuMCAtIDEuMCkgKiB2ZWMyKDEsIGZsaXBZKSwgMC4wLCAxLjApO1xcbiAgIGNvb3JkID0gc291cmNlQ29vcmQ7XFxufVxcblwiLFxuICBjb3B5OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xcbn1cXG5cIixcbiAgdHJhbnNmb3JtOiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gbWF0MiB0cmFuc2Zvcm07XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBmaXJzdCAtMC41IGlzIGFwcGxpZWQgdG8gY2VudGVyIGltYWdlXFxuICAvLyB0aGVuIHdpZHRoOmhlaWdodCByYXRpbyBpcyBhcHBsaWVkIHRvIGtlZXAgYXNwZWN0XFxuICAvLyB0aGVuIHRyYW5zZm9ybSBpcyBhcHBsaWVkXFxuICAvLyB0aGVuIHByZS10cmFuc2Zvcm1zIGFyZSByZXZlcnNlZFxcbiAgLy9cXG4gIHZlYzIgciA9IHZlYzIoc2l6ZS5wIC8gc2l6ZS5xLCAxLjApO1xcbiAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgdHJhbnNmb3JtICogKChjb29yZCAtIDAuNSkgKiByKSAvIHIgKyAwLjUpO1xcbn1cXG5cIixcbiAgY29udHJhc3Q6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzdHJlbmd0aDtcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgY29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICBnbF9GcmFnQ29sb3IgPSB2ZWM0KChjb2xvci5yZ2IgLSAwLjUpICogc3RyZW5ndGggKyAwLjUsIGNvbG9yLmEpO1xcbn1cXG5cIixcbiAgbW9ub3RvbmU6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzdHJlbmd0aDtcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIHZlYzQgY29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCk7XFxuICBmbG9hdCBpID0gY29sb3IuciAqIDAuMyArIGNvbG9yLmcgKiAwLjU5ICsgY29sb3IuYiAqIDAuMTE7XFxuICB2ZWMzIGdyYXkgPSB2ZWMzKGksIGksIGkpO1xcbiAgZ2xfRnJhZ0NvbG9yID0gdmVjNChpICogc3RyZW5ndGggKyBjb2xvci5yZ2IgKiAoMS4wIC0gc3RyZW5ndGgpLCBjb2xvci5hKTtcXG59XFxuXCIsXG4gIGdhdXNzaWFuMjogXCJwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG5cXG51bmlmb3JtIGZsb2F0IHNpZ21hO1xcbnVuaWZvcm0gdmVjMiBheGlzO1xcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG51bmlmb3JtIHZlYzQgc2l6ZTtcXG52YXJ5aW5nIHZlYzIgY29vcmQ7XFxuY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY1O1xcbmNvbnN0IGZsb2F0IHJhZGl1cyA9IDIuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiLFxuICBnYXVzc2lhbjQ6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSA0LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgZ2F1c3NpYW44OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gOC4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gIGdhdXNzaWFuMTY6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAxNi4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gIGdhdXNzaWFuMzI6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAzMi4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gIGdhdXNzaWFuNjQ6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSA2NC4wO1xcblxcbnZvaWQgbWFpbigpIHtcXG4gIC8vIGluY3JlbWVudGFsIGdhdXNzaWFuIChHUFUgR2VtcyAzIHBwLiA4NzcgLSA4ODkpXFxuICB2ZWMzIGc7XFxuICBnLnggPSAxLjAgLyAoc3FydCgyLjAgKiBwaSkgKiBzaWdtYSk7XFxuICBnLnkgPSBleHAoLTAuNSAvIChzaWdtYSAqIHNpZ21hKSk7XFxuICBnLnogPSBnLnkgKiBnLnk7XFxuXFxuICB2ZWM0IHN1bSA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4wKTtcXG4gIGZsb2F0IHdlaWdodCA9IDAuMDtcXG5cXG4gIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCkgKiBnLng7XFxuICB3ZWlnaHQgKz0gZy54O1xcbiAgZy54eSAqPSBnLnl6O1xcblxcbiAgZm9yIChmbG9hdCBpID0gMS4wOyBpIDw9IHJhZGl1czsgaSsrKSB7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCAtIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHN1bSArPSB0ZXh0dXJlMkQoc291cmNlLCBjb29yZCArIGkgKiBzaXplLnh5ICogYXhpcykgKiBnLng7XFxuICAgIHdlaWdodCArPSAyLjAgKiBnLng7XFxuICAgIGcueHkgKj0gZy55ejtcXG4gIH1cXG5cXG4gIGdsX0ZyYWdDb2xvciA9IHN1bSAvIHdlaWdodDtcXG59XFxuXCIsXG4gIGdhdXNzaWFuMTI4OiBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbnVuaWZvcm0gZmxvYXQgc2lnbWE7XFxudW5pZm9ybSB2ZWMyIGF4aXM7XFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbnVuaWZvcm0gdmVjNCBzaXplO1xcbnZhcnlpbmcgdmVjMiBjb29yZDtcXG5jb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjU7XFxuY29uc3QgZmxvYXQgcmFkaXVzID0gMTI4LjA7XFxuXFxudm9pZCBtYWluKCkge1xcbiAgLy8gaW5jcmVtZW50YWwgZ2F1c3NpYW4gKEdQVSBHZW1zIDMgcHAuIDg3NyAtIDg4OSlcXG4gIHZlYzMgZztcXG4gIGcueCA9IDEuMCAvIChzcXJ0KDIuMCAqIHBpKSAqIHNpZ21hKTtcXG4gIGcueSA9IGV4cCgtMC41IC8gKHNpZ21hICogc2lnbWEpKTtcXG4gIGcueiA9IGcueSAqIGcueTtcXG5cXG4gIHZlYzQgc3VtID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAwLjApO1xcbiAgZmxvYXQgd2VpZ2h0ID0gMC4wO1xcblxcbiAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKSAqIGcueDtcXG4gIHdlaWdodCArPSBnLng7XFxuICBnLnh5ICo9IGcueXo7XFxuXFxuICBmb3IgKGZsb2F0IGkgPSAxLjA7IGkgPD0gcmFkaXVzOyBpKyspIHtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkIC0gaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgc3VtICs9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkICsgaSAqIHNpemUueHkgKiBheGlzKSAqIGcueDtcXG4gICAgd2VpZ2h0ICs9IDIuMCAqIGcueDtcXG4gICAgZy54eSAqPSBnLnl6O1xcbiAgfVxcblxcbiAgZ2xfRnJhZ0NvbG9yID0gc3VtIC8gd2VpZ2h0O1xcbn1cXG5cIixcbiAgZ2F1c3NpYW4yNTY6IFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxudW5pZm9ybSBmbG9hdCBzaWdtYTtcXG51bmlmb3JtIHZlYzIgYXhpcztcXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XFxudW5pZm9ybSB2ZWM0IHNpemU7XFxudmFyeWluZyB2ZWMyIGNvb3JkO1xcbmNvbnN0IGZsb2F0IHBpID0gMy4xNDE1OTI2NTtcXG5jb25zdCBmbG9hdCByYWRpdXMgPSAyNTYuMDtcXG5cXG52b2lkIG1haW4oKSB7XFxuICAvLyBpbmNyZW1lbnRhbCBnYXVzc2lhbiAoR1BVIEdlbXMgMyBwcC4gODc3IC0gODg5KVxcbiAgdmVjMyBnO1xcbiAgZy54ID0gMS4wIC8gKHNxcnQoMi4wICogcGkpICogc2lnbWEpO1xcbiAgZy55ID0gZXhwKC0wLjUgLyAoc2lnbWEgKiBzaWdtYSkpO1xcbiAgZy56ID0gZy55ICogZy55O1xcblxcbiAgdmVjNCBzdW0gPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDAuMCk7XFxuICBmbG9hdCB3ZWlnaHQgPSAwLjA7XFxuXFxuICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpICogZy54O1xcbiAgd2VpZ2h0ICs9IGcueDtcXG4gIGcueHkgKj0gZy55ejtcXG5cXG4gIGZvciAoZmxvYXQgaSA9IDEuMDsgaSA8PSByYWRpdXM7IGkrKykge1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgLSBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICBzdW0gKz0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQgKyBpICogc2l6ZS54eSAqIGF4aXMpICogZy54O1xcbiAgICB3ZWlnaHQgKz0gMi4wICogZy54O1xcbiAgICBnLnh5ICo9IGcueXo7XFxuICB9XFxuXFxuICBnbF9GcmFnQ29sb3IgPSBzdW0gLyB3ZWlnaHQ7XFxufVxcblwiXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFRleHR1cmVcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIFRleHR1cmUoZ2wsIHVuaXQsIG5vZGVPcldpZHRoLCBoZWlnaHQpIHtcbiAgdGhpcy5nbCA9IGdsXG4gIHRoaXMudW5pdCA9IHVuaXRcblxuICB0aGlzLnRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKClcbiAgdGhpcy5iaW5kKClcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLkxJTkVBUilcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUilcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSlcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSlcblxuICBpZiAodXRpbHMuaXNOb3RoaW5nKGhlaWdodCkpIHtcbiAgICB2YXIgbm9kZSA9IHV0aWxzLmdldE5vZGUobm9kZU9yV2lkdGgpXG4gICAgdGhpcy53aWR0aCA9IG5vZGUud2lkdGhcbiAgICB0aGlzLmhlaWdodCA9IG5vZGUuaGVpZ2h0XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBub2RlKVxuXG4gIH0gZWxzZSB7XG4gICAgdGhpcy53aWR0aCA9IG5vZGVPcldpZHRoXG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHRcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKVxuXG4gICAgdGhpcy5mcmFtZWJ1ZmZlciA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKClcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZnJhbWVidWZmZXIpXG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUsIDApXG4gIH1cbn1cblxuVGV4dHVyZS5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZ2wgPSB0aGlzLmdsXG4gIGdsLmFjdGl2ZVRleHR1cmUoZ2xbJ1RFWFRVUkUnICsgdGhpcy51bml0XSlcbiAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy50ZXh0dXJlKVxuICBpZiAodGhpcy5mcmFtZWJ1ZmZlcikgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmZyYW1lYnVmZmVyKVxuICByZXR1cm4gdGhpc1xufVxuXG5UZXh0dXJlLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLnRleHR1cmUpXG4gIGlmICh0aGlzLmZyYW1lYnVmZmVyKSB7XG4gICAgdGhpcy5nbC5kZWxldGVGcmFtZWJ1ZmZlcih0aGlzLmZyYW1lYnVmZmVyKVxuICAgIHRoaXMuZnJhbWVidWZmZXIgPSBudWxsXG4gIH1cbiAgdGhpcy50ZXh0dXJlID0gbnVsbFxuICB0aGlzLmdsID0gbnVsbFxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGlzU3RyaW5nOiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBTdHJpbmddJ1xuICB9LFxuXG4gIGlzTnVtYmVyOiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBOdW1iZXJdJ1xuICB9LFxuXG4gIGlzQXJyYXk6IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSdcbiAgfSxcblxuICBpc05vdGhpbmc6IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCdcbiAgfSxcblxuICBnZXROb2RlOiBmdW5jdGlvbihub2RlKSB7XG4gICAgaWYgKHRoaXMuaXNTdHJpbmcobm9kZSkpIHtcbiAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKG5vZGUpXG4gICAgfSBlbHNlIGlmIChub2RlLmlzR2xpbWcpIHtcbiAgICAgIHJldHVybiBub2RlLmNhbnZhc1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZVxuICAgIH1cbiAgfVxufVxuIl19
(3)
});
