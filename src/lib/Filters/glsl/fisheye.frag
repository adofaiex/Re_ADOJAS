uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    // CameraFilterPackLegacy/Distortion_FishEye：围绕 0.5 的径向畸变。
    vec2 p = vUv - 0.5;
    float r = length(p);
    float distortion = u_intensity - 0.5;
    if (abs(distortion) > 1e-4 && r > 1e-5) {
        float scale = (distortion > 0.0)
            ? tan(r * distortion * 4.442894) / (r * tan(distortion * 2.221447))
            : 1.0 + distortion * (1.0 - r * r);
        p *= scale;
    }
    gl_FragColor = texture2D(tDiffuse, p + 0.5);
}
