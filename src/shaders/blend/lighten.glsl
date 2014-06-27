precision mediump float;

uniform sampler2D source;
uniform sampler2D foreground;
uniform sampler2D mask;
uniform vec4 size;
uniform float opacity;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
  vec4 dst = texture2D(source, coord);
  vec4 src = texture2D(foreground, maskCoord);
  vec4 blend;

  blend = max(src, dst);

  blend.a = src.a;
  blend *= opacity * texture2D(mask, maskCoord).a;
  gl_FragColor = blend + dst * (1.0 - blend.a);
}
