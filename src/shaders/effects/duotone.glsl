precision mediump float;

uniform sampler2D source;
uniform vec4 size;
uniform vec3 highlight;
uniform vec3 shadow;
varying vec2 coord;
varying vec2 maskCoord;

const float e = 10e-10;

float luma(vec3 c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

void main() {
  vec4 src = texture2D(source, coord);

  float l = luma(src.rgb);

  // highlight and shadow color normalized to same luminance
  vec3 h = (highlight + e) / (luma(highlight) + e) * l;
  vec3 s = (shadow + e) / (luma(shadow) + e) * l;

  // blend based on luminance
  vec3 c = h * l + s * (1.0 - l);

  gl_FragColor = vec4(c, src.a);
}
