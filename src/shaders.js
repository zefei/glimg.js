var fs = require('fs')

module.exports = {
  vertex: fs.readFileSync('src/shaders/vertex.glsl', 'utf8'),
  copy: fs.readFileSync('src/shaders/copy.glsl', 'utf8'),
  transform: fs.readFileSync('src/shaders/transform.glsl', 'utf8'),
  contrast: fs.readFileSync('src/shaders/contrast.glsl', 'utf8'),
  monotone: fs.readFileSync('src/shaders/monotone.glsl', 'utf8'),
  gaussian2: fs.readFileSync('src/shaders/blur/gaussian2.glsl', 'utf8'),
  gaussian4: fs.readFileSync('src/shaders/blur/gaussian4.glsl', 'utf8'),
  gaussian8: fs.readFileSync('src/shaders/blur/gaussian8.glsl', 'utf8'),
  gaussian16: fs.readFileSync('src/shaders/blur/gaussian16.glsl', 'utf8'),
  gaussian32: fs.readFileSync('src/shaders/blur/gaussian32.glsl', 'utf8'),
  gaussian64: fs.readFileSync('src/shaders/blur/gaussian64.glsl', 'utf8'),
  gaussian128: fs.readFileSync('src/shaders/blur/gaussian128.glsl', 'utf8'),
  gaussian256: fs.readFileSync('src/shaders/blur/gaussian256.glsl', 'utf8')
}
