uniform sampler2D tDiffuse;
// 对角 4 抽样偏移（UV 单位）：(4m/3, m/3) 与 (m/3, -4m/3)，m 为当前半径缩放。
uniform vec2 uOffsetA;
uniform vec2 uOffsetB;
// 官方 Pass 0 = 纯模糊（fraction 1）；Pass 1 = mix(原图, 模糊, fraction)，用于半径的小数部分。
uniform float fraction;
varying vec2 vUv;

// 官方 Pass 0/1：center*0.182 + 4 个对角抽样*0.2045（权重和 = 1），
// 然后 lerp(center, blurred, fraction)。
void main() {
    vec4 center = texture2D(tDiffuse, vUv);
    vec4 diag =
        texture2D(tDiffuse, vUv + uOffsetA) +
        texture2D(tDiffuse, vUv - uOffsetA) +
        texture2D(tDiffuse, vUv + uOffsetB) +
        texture2D(tDiffuse, vUv - uOffsetB);
    vec4 blurred = center * 0.182 + diag * 0.2045;
    gl_FragColor = mix(center, blurred, fraction);
}
