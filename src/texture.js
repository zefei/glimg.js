module.exports = Texture

var utils = require('./utils')

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
