var fs = require('fs')

module.exports = {
  core: {
    vertex: fs.readFileSync('src/shaders/core/vertex.glsl', 'utf8'),
    copy: fs.readFileSync('src/shaders/core/copy.glsl', 'utf8'),
    transform: fs.readFileSync('src/shaders/core/transform.glsl', 'utf8')
  },
  blend: {
    normal: fs.readFileSync('src/shaders/blend/normal.glsl', 'utf8'),
    multiply: fs.readFileSync('src/shaders/blend/multiply.glsl', 'utf8'),
    screen: fs.readFileSync('src/shaders/blend/screen.glsl', 'utf8'),
    overlay: fs.readFileSync('src/shaders/blend/overlay.glsl', 'utf8'),
    darken: fs.readFileSync('src/shaders/blend/darken.glsl', 'utf8'),
    lighten: fs.readFileSync('src/shaders/blend/lighten.glsl', 'utf8'),
    'color-dodge': fs.readFileSync('src/shaders/blend/color-dodge.glsl', 'utf8'),
    'color-burn': fs.readFileSync('src/shaders/blend/color-burn.glsl', 'utf8'),
    'hard-light': fs.readFileSync('src/shaders/blend/hard-light.glsl', 'utf8'),
    'soft-light': fs.readFileSync('src/shaders/blend/soft-light.glsl', 'utf8'),
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
    'brightness-contrast': fs.readFileSync('src/shaders/effects/brightness-contrast.glsl', 'utf8'),
    'hue-saturation': fs.readFileSync('src/shaders/effects/hue-saturation.glsl', 'utf8'),
    'split-tone': fs.readFileSync('src/shaders/effects/split-tone.glsl', 'utf8'),
    duotone: fs.readFileSync('src/shaders/effects/duotone.glsl', 'utf8'),
    sharpen: fs.readFileSync('src/shaders/effects/sharpen.glsl', 'utf8'),
    vignette: fs.readFileSync('src/shaders/effects/vignette.glsl', 'utf8')
  }
}
