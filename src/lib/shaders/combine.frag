uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float intensity;
uniform vec3 bloomColor;
varying vec2 vUv;

vec3 linearToSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
    vec4 original = texture2D(tDiffuse, vUv);
    vec4 bloom = texture2D(tBloom, vUv);

    vec3 tintedBloom = bloom.rgb * bloomColor;

    // Medium bloom contribution = 0.5 * MasterAmount * MediumAmount (official VideoBloom).
    // 泛光是**线性**值：先与原图在线性空间相加，再只做一次 sRGB 编码。
    // （在 gamma 空间相加会把暗部泛光放大 —— 黑轨道会被抬成灰。）
    vec3 result = original.rgb + tintedBloom * intensity * 0.5;

    gl_FragColor = vec4(linearToSRGB(clamp(result, 0.0, 1.0)), 1.0);
}
