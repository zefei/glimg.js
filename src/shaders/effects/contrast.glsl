precision mediump float;

uniform float strength;
uniform sampler2D source;
uniform vec4 size;
varying vec2 coord;

void main() {
  vec4 color = texture2D(source, coord);
  gl_FragColor = vec4((color.rgb - 0.5) * strength + 0.5, color.a);
}
