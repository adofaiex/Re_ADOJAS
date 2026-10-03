uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float bloomAmount;   // 官方 _Param0.x = 0.5 * MasterAmount * MediumAmount
uniform vec3 tint;           // 官方 _Param1.rgb
varying vec2 vUv;

vec3 linearToSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

// 官方 Pass 3（Add）：out = 原图 + tint * bloom * _Param0.x
// 原图与泛光都在显示参考（sRGB）空间相加 —— 与官方 ARGB32 RT 一致。
void main() {
    vec3 base = linearToSRGB(texture2D(tDiffuse, vUv).rgb);
    vec3 bloom = texture2D(tBloom, vUv).rgb * tint;
    gl_FragColor = vec4(base + bloom * bloomAmount, 1.0);
}
