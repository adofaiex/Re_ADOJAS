uniform sampler2D tHistory;
varying vec2 vUv;

vec3 srgbToLinear(vec3 c) {
    vec3 lo = c / 12.92;
    vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(lo, hi, step(vec3(0.04045), c));
}

void main() {
    gl_FragColor = vec4(srgbToLinear(texture2D(tHistory, vUv).rgb), 1.0);
}
