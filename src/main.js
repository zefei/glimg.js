module.exports = glimg

var Glimg = require('./core/glimg')

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

  glimg.shaders = require('./core/shaders')
}
