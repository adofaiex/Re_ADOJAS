uniform sampler2D tDiffuse;
uniform vec2 u_texelSize;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    // CameraFilterPackLegacy/Blur_Blurry 的 3x3 高斯核。
    // FilterManager 已按官方公式传入 Amount = 2 * intensity。
    float amount = u_intensity;
    vec2 step = u_texelSize * amount;
    vec4 color = texture2D(tDiffuse, vUv) * 4.0;
    color += texture2D(tDiffuse, vUv + vec2(-step.x, -step.y)) * 1.0;
    color += texture2D(tDiffuse, vUv + vec2( 0.0,   -step.y)) * 2.0;
    color += texture2D(tDiffuse, vUv + vec2( step.x, -step.y)) * 1.0;
    color += texture2D(tDiffuse, vUv + vec2(-step.x,  0.0)) * 2.0;
    color += texture2D(tDiffuse, vUv + vec2( step.x,  0.0)) * 2.0;
    color += texture2D(tDiffuse, vUv + vec2(-step.x,  step.y)) * 1.0;
    color += texture2D(tDiffuse, vUv + vec2( 0.0,    step.y)) * 2.0;
    color += texture2D(tDiffuse, vUv + vec2( step.x,  step.y)) * 1.0;
    gl_FragColor = color / 16.0;
}
