precision mediump float;

uniform sampler2D source;
uniform vec4 size;
uniform float darken;
uniform float brighten;
varying vec2 coord;
varying vec2 maskCoord;

const float e = 10e-10;

float luma(vec3 c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

void main() {
  vec4 src = texture2D(source, coord);

  // distance to each border
  float a = coord.x < 0.5 ? coord.x : 1.0 - coord.x;
  float b = coord.y < 0.5 ? coord.y : 1.0 - coord.y;

  // lp norm used as distance, 0.2 seems to be a nice value for p
  float p = 0.2;
  float d = pow(a, p) + pow(b, p);
  float dmax = 2.0 * pow(0.5, p);

  // brighten overall, then darken based on lp distance
  float l = luma(src.rgb);
  src.rgb *= (l + brighten - darken * (1.0 - d / dmax)) / (l + e);

  gl_FragColor = src;
}
