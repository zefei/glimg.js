precision mediump float;

uniform mat2 transform;
uniform sampler2D source;
uniform vec4 size;
varying vec2 coord;

void main() {
  // first -0.5 is applied to center image
  // then width:height ratio is applied to keep aspect
  // then transform is applied
  // then pre-transforms are reversed
  //
  vec2 r = vec2(size.p / size.q, 1.0);
  gl_FragColor = texture2D(source, transform * ((coord - 0.5) * r) / r + 0.5);
}
