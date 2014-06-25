precision mediump float;

uniform float sigma;
uniform vec2 axis;
uniform sampler2D source;
uniform vec4 size;
varying vec2 coord;
varying vec2 maskCoord;
const float pi = 3.14159265;
const float radius = 32.0;

void main() {
  // incremental gaussian (GPU Gems 3 pp. 877 - 889)
  vec3 g;
  g.x = 1.0 / (sqrt(2.0 * pi) * sigma);
  g.y = exp(-0.5 / (sigma * sigma));
  g.z = g.y * g.y;

  vec4 sum = vec4(0.0, 0.0, 0.0, 0.0);
  float weight = 0.0;

  sum += texture2D(source, coord) * g.x;
  weight += g.x;
  g.xy *= g.yz;

  for (float i = 1.0; i <= radius; i++) {
    sum += texture2D(source, coord - i * size.xy * axis) * g.x;
    sum += texture2D(source, coord + i * size.xy * axis) * g.x;
    weight += 2.0 * g.x;
    g.xy *= g.yz;
  }

  gl_FragColor = sum / weight;
}
