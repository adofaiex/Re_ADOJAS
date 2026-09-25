uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float intensity;
uniform vec3 bloomColor;
varying vec2 vUv;

// 场景 RT 是线性值；bloom 纹理已是 gamma 值（见 brightness.frag）。
// 在 gamma 空间做加法后直接输出（与渲染管线的 gamma 约定一致）：
// 线性空间加法会把黑色区域上的模糊长尾抬成明显的灰。
vec3 linearToSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
    vec4 original = texture2D(tDiffuse, vUv);
    vec4 bloom = texture2D(tBloom, vUv);

    vec3 tintedBloom = bloom.rgb * bloomColor;

    // Medium bloom contribution = 0.5 * MasterAmount * MediumAmount,
    // so the event intensity is
    // halved before being added.
    vec3 result = linearToSRGB(original.rgb) + tintedBloom * intensity * 0.5;

    gl_FragColor = vec4(result, 1.0);
}
