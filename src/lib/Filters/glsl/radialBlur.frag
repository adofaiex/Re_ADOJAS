uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    float amount = clamp(u_intensity, 0.0, 1.0);
    vec2 dir = vUv - vec2(0.5);
    vec4 sum = vec4(0.0);
    float total = 0.0;

    // 从中心向外做 8 次采样，越靠外模糊越强。
    for (int i = 0; i < 8; i++) {
        float f = float(i) / 7.0;
        float weight = 1.0 - f * 0.65;
        sum += texture2D(tDiffuse, vUv - dir * f * 0.12 * amount) * weight;
        total += weight;
    }
    gl_FragColor = sum / total;
}
