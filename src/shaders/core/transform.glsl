precision mediump float;

uniform mat3 transform;
uniform sampler2D source;
uniform vec4 size;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  vec2 c = (transform * vec3(coord, 1.0)).xy;
  bool outOfRange = any(greaterThan(abs(c - vec2(0.5)), vec2(0.5)));
  gl_FragColor = outOfRange ? vec4(0.0) : texture2D(source, c);
}
