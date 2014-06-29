module.exports = Shader

var utils = require('./utils')

function Shader(glimg, source) {
  this.glimg = glimg
  var gl = this.gl = glimg.gl
  var vertex = require('./shaders').core.vertex
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
