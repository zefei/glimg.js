precision mediump float;

uniform sampler2D source;
uniform vec4 size;
uniform vec3 highlight;
uniform vec3 shadow;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  vec4 dst = texture2D(source, coord);
  float y = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b + e;
  vec3 color;
  vec3 src = y > 0.5 ? highlight : shadow;

  color.r = src.r < 0.5 ? 2.0 * src.r * dst.r + dst.r * dst.r * (1.0 - 2.0 * src.r)
    : sqrt(dst.r) * (2.0 * src.r - 1.0) + 2.0 * dst.r * (1.0 - src.r);
  color.g = src.g < 0.5 ? 2.0 * src.g * dst.g + dst.g * dst.g * (1.0 - 2.0 * src.g)
    : sqrt(dst.g) * (2.0 * src.g - 1.0) + 2.0 * dst.g * (1.0 - src.g);
  color.b = src.b < 0.5 ? 2.0 * src.b * dst.b + dst.b * dst.b * (1.0 - 2.0 * src.b)
    : sqrt(dst.b) * (2.0 * src.b - 1.0) + 2.0 * dst.b * (1.0 - src.b);

  gl_FragColor = vec4(color, dst.a);
}
