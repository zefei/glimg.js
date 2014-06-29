precision mediump float;

uniform sampler2D source;
uniform vec4 size;
uniform float matrix[dim * dim];
uniform float divisor;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  vec3 sum = vec3(0.0);

  for (int y = 0; y < dim; y++) {
    for (int x = 0; x < dim; x++) {
      vec2 offset = vec2(x - radius, y - radius);
      sum += texture2D(source, coord + offset * size.xy).rgb * matrix[y * dim + x];
    }
  }

  gl_FragColor = vec4(sum / divisor, texture2D(source, coord).a);
}
