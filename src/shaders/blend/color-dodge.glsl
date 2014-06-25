precision mediump float;

uniform sampler2D source;
uniform sampler2D foreground;
uniform sampler2D mask;
uniform vec4 size;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  vec4 dst = texture2D(source, coord);
  vec4 src = texture2D(foreground, maskCoord);
  vec4 blend;

  blend.r = src.r == 1.0 ? 1.0 : dst.r / (1.0 - src.r);
  blend.g = src.g == 1.0 ? 1.0 : dst.g / (1.0 - src.g);
  blend.b = src.b == 1.0 ? 1.0 : dst.b / (1.0 - src.b);

  blend.a = src.a;
  blend *= texture2D(mask, maskCoord);
  gl_FragColor = blend + dst * (1.0 - blend.a);
}
