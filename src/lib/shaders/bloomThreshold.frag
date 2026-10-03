uniform sampler2D tDiffuse;
uniform float threshold;
varying vec2 vUv;

// sRGB 传递函数：场景 RT 是线性值，而官方 VideoBloom 工作在 Unity 的
// ARGB32（gamma/显示参考）RT 上，所以这里先转成 sRGB 再做阈值/模糊/相加。
vec3 linearToSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

// 官方 Pass 2：硬阈值（Rec.601 亮度），低于阈值 → 全透明，否则**原色原样输出**
// （注意：不是 color * luminance）。
void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    vec3 srgb = linearToSRGB(c.rgb);
    float lum = dot(srgb, vec3(0.3, 0.59, 0.11));
    gl_FragColor = lum < threshold ? vec4(0.0, 0.0, 0.0, 0.0) : vec4(srgb, c.a);
}
