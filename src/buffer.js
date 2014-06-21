module.exports = Buffer

var utils = require('./utils')

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
