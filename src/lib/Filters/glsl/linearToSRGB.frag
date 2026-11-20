uniform sampler2D tDiffuse;
varying vec2 vUv;

vec3 linearToSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(linearToSRGB(color.rgb), color.a);
}
