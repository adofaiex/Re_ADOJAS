uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    // CameraFilterPackLegacy/Color_Contrast: (color - 0.5) * Contrast + 0.5
    gl_FragColor = vec4((color.rgb - 0.5) * u_intensity + 0.5, 1.0);
}
