uniform sampler2D tDiffuse;
uniform float u_intensity;
uniform float u_time;
varying vec2 vUv;

void main() {
    // CameraFilterPackLegacy/Distortion_Wave_Horizontal:
    //   FilterManager 已按官方公式传入 _WaveIntensity = 10 * intensity
    //   x += sin((wave - 10) * uv.y) * 0.005 + sin(time * 0.1 * wave) * 0.009
    float wave = u_intensity;
    vec2 uv = vUv;
    uv.x += sin((wave - 10.0) * vUv.y) * 0.005
          + sin(u_time * 0.1 * wave) * 0.009;
    gl_FragColor = texture2D(tDiffuse, uv);
}
