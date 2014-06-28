precision mediump float;

uniform sampler2D source;
uniform sampler2D background;
uniform vec4 size;
uniform float highlight;
uniform float shadow;
varying vec2 coord;
varying vec2 maskCoord;

const float e = 10e-10;

float luma(vec3 c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

vec3 softlight(vec3 src, vec3 dst) {
  vec3 color;
  color.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)
    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);
  color.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)
    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);
  color.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)
    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);
  return color;
}

void main() {
  vec4 src = texture2D(source, coord);

  float invl = 1.0 - luma(texture2D(background, coord).rgb);
  vec3 blend = softlight(vec3(invl, invl, invl), src.rgb);

  src.rgb += clamp(blend - src.rgb, -1.0, 0.0) * highlight +
    clamp(blend - src.rgb, 0.0, 1.0) * shadow;
  gl_FragColor = src;
}
