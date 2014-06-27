precision mediump float;

uniform sampler2D source;
uniform sampler2D foreground;
uniform sampler2D mask;
uniform vec4 size;
uniform float opacity;
varying vec2 coord;
varying vec2 maskCoord;

vec3 rgb2hcl(vec3 c) {
  vec4 p = c.r > c.g ? vec4(c.rgb, 0.0) : vec4(c.gbr, 2.0);
  vec4 q = c.b > p.x ? vec4(c.brg, 4.0) : p;

  float M = q.x;
  float m = min(q.y, q.z);
  float C = M - m;

  float H = C == 0.0 ? 0.0 : mod((q.y - q.z) / C + q.w, 6.0);
  float L = 0.5 * (M + m);

  return vec3(H, C, L);
}

vec3 hcl2rgb(vec3 c) {
  float H = c.x;

  float R = abs(H - 3.0) - 1.0;
  float G = 2.0 - abs(H - 2.0);
  float B = 2.0 - abs(H - 4.0);
  vec3 rgb = clamp(vec3(R, G, B), 0.0, 1.0);

  return (rgb - 0.5) * c.y + c.z;
}

void main() {
  vec4 dst = texture2D(source, coord);
  vec4 src = texture2D(foreground, maskCoord);
  vec4 blend;

  vec3 hcl = rgb2hcl(dst.rgb);
  blend.rgb = hcl2rgb(vec3(rgb2hcl(src.rgb).x, hcl.y, hcl.z));

  blend.a = src.a;
  blend *= opacity * texture2D(mask, maskCoord).a;
  gl_FragColor = blend + dst * (1.0 - blend.a);
}
