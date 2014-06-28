precision mediump float;

uniform sampler2D source;
uniform sampler2D foreground;
uniform sampler2D mask;
uniform vec4 size;
uniform float opacity;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  vec4 dst = texture2D(source, coord);
  vec4 src = texture2D(foreground, maskCoord);
  vec4 blend;

  blend.r = src.r < 0.5 ? 2.0 * src.r * dst.r : 1.0 - 2.0 * (1.0 - src.r) * (1.0 - dst.r);
  blend.g = src.g < 0.5 ? 2.0 * src.g * dst.g : 1.0 - 2.0 * (1.0 - src.g) * (1.0 - dst.g);
  blend.b = src.b < 0.5 ? 2.0 * src.b * dst.b : 1.0 - 2.0 * (1.0 - src.b) * (1.0 - dst.b);

  blend.a = src.a;
  blend *= opacity * texture2D(mask, maskCoord).a;
  gl_FragColor = blend + dst * (1.0 - blend.a);
}
