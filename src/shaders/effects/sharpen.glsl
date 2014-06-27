precision mediump float;

uniform float strength;
uniform sampler2D source;
uniform sampler2D background;
uniform vec4 size;
varying vec2 coord;
varying vec2 maskCoord;

const float e = 10e-10;

float luma(vec3 c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

void main() {
  vec4 src = texture2D(source, coord);

  float lsrc = luma(src.rgb);
  float l = luma(texture2D(background, coord).rgb);

  src.rgb *= ((lsrc - l) * strength + l) / (lsrc + e);
  gl_FragColor = src;
}
