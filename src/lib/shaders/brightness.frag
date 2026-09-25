uniform sampler2D tDiffuse;
uniform float threshold;
varying vec2 vUv;

// 场景 RT 是线性值；阈值比较保持线性（与既有 bloom 覆盖范围一致），
// 但输出转成 gamma/sRGB —— 后续模糊与合成都在 gamma 空间进行，
// 避免线性小值经最终 sRGB 编码后把黑色轨道抬成可见的灰。
vec3 linearToSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    float brightness = max(max(color.r, color.g), color.b);

    // Bloom prefilter (pass 2): only the amount above the threshold
    // blooms, with a quadratic soft knee — so near-threshold pixels contribute
    // little instead of their full color (which caused the over-exposure).
    float soft = clamp(brightness - threshold, 0.0, 1.0);
    soft = soft * soft;
    float contribution = max(max(soft, brightness - threshold), 0.0);

    gl_FragColor = vec4(linearToSRGB(color.rgb * contribution), 1.0);
}
