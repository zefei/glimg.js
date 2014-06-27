precision mediump float;

uniform sampler2D source;
uniform vec4 size;
uniform float brightness;
uniform float contrast;
varying vec2 coord;
varying vec2 maskCoord;

const float e = 10e-10;

float luma(vec3 c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

void main() {
  vec4 src = texture2D(source, coord);

  /*
  float l = luma(src.rgb);
  src.rgb *= ((l + brightness - 0.5) * contrast + 0.5) / (l + e);
  */

  src.rgb = (src.rgb + brightness - 0.5) * contrast + 0.5;

  gl_FragColor = src;
}
