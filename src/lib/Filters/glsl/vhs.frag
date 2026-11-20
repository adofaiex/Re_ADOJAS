uniform sampler2D tDiffuse;
uniform float u_intensity;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 vUv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    float amount = u_intensity;
    float t = u_time;
    vec2 uv = vUv;

    // VHS 的轻微横向抖动、扫描线、色差和颗粒。
    uv.x += sin(uv.y * 180.0 + t * 18.0) * 0.0012 * amount;
    uv.x += (hash(vec2(floor(uv.y * 48.0), floor(t * 12.0))) - 0.5) * 0.003 * amount;

    float ab = 0.0025 * amount;
    float r = texture2D(tDiffuse, uv + vec2(ab, 0.0)).r;
    vec4 g = texture2D(tDiffuse, uv);
    float b = texture2D(tDiffuse, uv - vec2(ab, 0.0)).b;
    vec3 color = vec3(r, g.g, b);

    float scan = 0.92 + 0.08 * sin(uv.y * u_resolution.y * 1.7 + t * 8.0);
    color *= mix(1.0, scan, amount);
    color += (hash(floor(vUv * u_resolution.xy) + floor(t * 30.0)) - 0.5) * 0.08 * amount;
    gl_FragColor = vec4(color, g.a);
}
