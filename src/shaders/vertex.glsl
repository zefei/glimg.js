attribute vec2 sourceCoord;
attribute vec2 targetCoord;
uniform float flipY;
varying vec2 coord;

void main() {
   gl_Position = vec4((targetCoord * 2.0 - 1.0) * vec2(1, flipY), 0.0, 1.0);
   coord = sourceCoord;
}
