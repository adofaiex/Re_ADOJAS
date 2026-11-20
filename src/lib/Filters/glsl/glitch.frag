uniform sampler2D tDiffuse;
uniform float u_intensity;
uniform float u_time;
varying vec2 vUv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    // 官方 ffxSetFilterPlus 的 Glitch 分支没有按 intensity 缩放，
    // intensity 只负责 enable/disable 和补间时间；这里保持固定强度。
    float amount = 1.0;
    float seed = floor(u_time * 15.0);
    float band = floor(vUv.y * 24.0);
    float n = hash(vec2(band, seed));

    // 横向块偏移 + RGB 分离；时间片决定哪一条带发生跳变。
    float bandOffset = (n - 0.5) * 0.09 * amount * step(0.72, n);
    vec2 uv = vUv + vec2(bandOffset, 0.0);

    float ab = 0.0025 * amount;
    float r = texture2D(tDiffuse, uv + vec2(ab, 0.0)).r;
    vec4 g = texture2D(tDiffuse, uv);
    float b = texture2D(tDiffuse, uv - vec2(ab, 0.0)).b;

    vec3 color = vec3(r, g.g, b);
    // 偶发黑白雪花，强度越高越明显。
    float noise = hash(floor(uv * vec2(640.0, 360.0)) + seed);
    color = mix(color, vec3(noise), amount * 0.12 * step(0.94, noise));
    gl_FragColor = vec4(color, g.a);
}
