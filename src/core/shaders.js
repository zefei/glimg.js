var fs = require('fs')

module.exports = {
  core: {
    vertex: fs.readFileSync('src/shaders/core/vertex.glsl', 'utf8'),
    copy: fs.readFileSync('src/shaders/core/copy.glsl', 'utf8'),
    transform: fs.readFileSync('src/shaders/core/transform.glsl', 'utf8'),
    lut: fs.readFileSync('src/shaders/core/lut.glsl', 'utf8')
  },
  adjustments: {
    levels: fs.readFileSync('src/shaders/adjustments/levels.glsl', 'utf8'),
    recover: fs.readFileSync('src/shaders/adjustments/recover.glsl', 'utf8'),
    hueSaturation: fs.readFileSync('src/shaders/adjustments/hueSaturation.glsl', 'utf8')
  },
  blend: {
    normal: fs.readFileSync('src/shaders/blend/normal.glsl', 'utf8'),
    multiply: fs.readFileSync('src/shaders/blend/multiply.glsl', 'utf8'),
    screen: fs.readFileSync('src/shaders/blend/screen.glsl', 'utf8'),
    overlay: fs.readFileSync('src/shaders/blend/overlay.glsl', 'utf8'),
    darken: fs.readFileSync('src/shaders/blend/darken.glsl', 'utf8'),
    lighten: fs.readFileSync('src/shaders/blend/lighten.glsl', 'utf8'),
    colorDodge: fs.readFileSync('src/shaders/blend/colorDodge.glsl', 'utf8'),
    colorBurn: fs.readFileSync('src/shaders/blend/colorBurn.glsl', 'utf8'),
    hardLight: fs.readFileSync('src/shaders/blend/hardLight.glsl', 'utf8'),
    softLight: fs.readFileSync('src/shaders/blend/softLight.glsl', 'utf8'),
    difference: fs.readFileSync('src/shaders/blend/difference.glsl', 'utf8'),
    exclusion: fs.readFileSync('src/shaders/blend/exclusion.glsl', 'utf8'),
    hue: fs.readFileSync('src/shaders/blend/hue.glsl', 'utf8'),
    saturation: fs.readFileSync('src/shaders/blend/saturation.glsl', 'utf8'),
    color: fs.readFileSync('src/shaders/blend/color.glsl', 'utf8'),
    luminosity: fs.readFileSync('src/shaders/blend/luminosity.glsl', 'utf8')
  },
  blur: {
    gaussian2: fs.readFileSync('src/shaders/blur/gaussian2.glsl', 'utf8'),
    gaussian4: fs.readFileSync('src/shaders/blur/gaussian4.glsl', 'utf8'),
    gaussian8: fs.readFileSync('src/shaders/blur/gaussian8.glsl', 'utf8'),
    gaussian16: fs.readFileSync('src/shaders/blur/gaussian16.glsl', 'utf8'),
    gaussian32: fs.readFileSync('src/shaders/blur/gaussian32.glsl', 'utf8'),
    gaussian64: fs.readFileSync('src/shaders/blur/gaussian64.glsl', 'utf8'),
    gaussian128: fs.readFileSync('src/shaders/blur/gaussian128.glsl', 'utf8'),
    gaussian256: fs.readFileSync('src/shaders/blur/gaussian256.glsl', 'utf8')
  },
  effects: {
    splitTone: fs.readFileSync('src/shaders/effects/splitTone.glsl', 'utf8'),
    duotone: fs.readFileSync('src/shaders/effects/duotone.glsl', 'utf8'),
    sharpen: fs.readFileSync('src/shaders/effects/sharpen.glsl', 'utf8'),
    vignette: fs.readFileSync('src/shaders/effects/vignette.glsl', 'utf8')
  }
}
