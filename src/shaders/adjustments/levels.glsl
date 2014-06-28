precision mediump float;

uniform sampler2D source;
uniform vec4 size;
uniform float black;
uniform float midpoint;
uniform float white;
varying vec2 coord;
varying vec2 maskCoord;

float interpolate(float value) {
  return (value - black) / (white - black);
}

vec3 interpolate(vec3 value) {
  return (value - black) / (white - black);
}

void main() {
  vec4 src = texture2D(source, coord);

  vec3 streched = interpolate(src.rgb);
  float m = interpolate(midpoint);
  float gamma = log(0.5) / log(m);
  src.rgb = pow(streched, vec3(gamma, gamma, gamma));

  gl_FragColor = src;
}
