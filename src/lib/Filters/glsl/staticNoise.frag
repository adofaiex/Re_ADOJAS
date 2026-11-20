uniform sampler2D tDiffuse;
uniform float u_intensity;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 vUv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.547);
}

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    // Legacy Noise_TV：noise - color，乘 Fade 后加回 color。
    vec2 p = floor(vUv * u_resolution) + floor(u_time * 60.0);
    vec3 noise = vec3(hash(p), hash(p + 17.0), hash(p + 31.0));
    gl_FragColor = vec4(mix(color.rgb, noise, u_intensity), color.a);
}
