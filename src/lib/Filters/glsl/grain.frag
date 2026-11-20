uniform sampler2D tDiffuse;
uniform float u_intensity;
uniform float u_time;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    // Legacy Film_Grain：按像素位置 + TimeX 生成噪声，乘 Value（SetFilter = 32*intensity）。
    float n = fract(sin(dot(vUv * 1024.0 + u_time * 60.0, vec2(12.9898, 78.233))) * 43758.547);
    n = (n - 0.5) * 0.02;
    gl_FragColor = vec4(color.rgb + n * u_intensity, color.a);
}
