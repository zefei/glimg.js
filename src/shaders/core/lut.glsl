precision mediump float;

uniform sampler2D source;
uniform sampler2D lut;
uniform vec4 size;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  vec4 src = texture2D(source, coord);

  src.r = texture2D(lut, vec2(src.r, 0.0)).r;
  src.g = texture2D(lut, vec2(src.g, 0.0)).g;
  src.b = texture2D(lut, vec2(src.b, 0.0)).b;

  gl_FragColor = src;
}
