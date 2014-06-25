precision mediump float;

uniform float strength;
uniform sampler2D source;
uniform vec4 size;
varying vec2 coord;

void main() {
  vec4 color = texture2D(source, coord);
  float i = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;
  vec3 gray = vec3(i, i, i);
  gl_FragColor = vec4(i * strength + color.rgb * (1.0 - strength), color.a);
}
