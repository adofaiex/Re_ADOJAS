uniform sampler2D tDiffuse;
uniform float threshold;
varying vec2 vUv;

// 高光提取（soft knee）。保持 **线性** 输出：由 combine 在最后统一做一次
// sRGB 编码。之前在这里就转 sRGB、再于 combine 里做 gamma 空间加法，会把
// 暗部的泛光贡献放大（黑填充被白边框的溢出抬成灰）。
void main() {
    vec4 color = texture2D(tDiffuse, vUv);

    float brightness = max(max(color.r, color.g), color.b);

    // Bloom prefilter: only the amount above the threshold blooms,
    // with a quadratic soft knee so near-threshold pixels contribute little.
    float soft = clamp(brightness - threshold, 0.0, 1.0);
    soft = soft * soft;
    float contribution = max(max(soft, brightness - threshold), 0.0);

    gl_FragColor = vec4(color.rgb * contribution, 1.0);
}
