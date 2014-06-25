attribute vec2 aSourceCoord;
attribute vec2 aTargetCoord;
attribute vec2 aMaskCoord;
uniform float flipY;
varying vec2 coord;
varying vec2 maskCoord;

void main() {
   gl_Position = vec4((aTargetCoord * 2.0 - 1.0) * vec2(1, flipY), 0.0, 1.0);
   coord = aSourceCoord;
   maskCoord = aMaskCoord;
}
