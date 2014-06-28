module.exports = Texture

var utils = require('./utils')

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
