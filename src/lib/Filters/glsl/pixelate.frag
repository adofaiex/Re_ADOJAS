uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    // CameraFilterPackLegacy/Pixel_Pixelisation:
    //   size = 512 / _Pixelisation; uv = floor(uv * size) / size
    // FilterManager 已按官方公式传入 _Pixelisation = 4 * intensity。
    float pixelSize = u_intensity;
    if (abs(pixelSize) < 1e-5) pixelSize = 1.0;
    float size = 512.0 / pixelSize;
    vec2 uv = floor(vUv * size) / size;
    gl_FragColor = texture2D(tDiffuse, uv);
}
