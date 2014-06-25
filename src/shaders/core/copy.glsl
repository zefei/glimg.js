precision mediump float;

uniform sampler2D source;
uniform vec4 size;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  gl_FragColor = texture2D(source, coord);
}
