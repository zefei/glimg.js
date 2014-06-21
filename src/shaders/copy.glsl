precision mediump float;

uniform sampler2D source;
uniform vec4 size;
varying vec2 coord;

void main() {
  gl_FragColor = texture2D(source, coord);
}
