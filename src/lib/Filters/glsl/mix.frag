uniform sampler2D tOriginal;
uniform sampler2D tFiltered;
uniform float u_effectScale;
varying vec2 vUv;

void main() {
    vec4 original = texture2D(tOriginal, vUv);
    vec4 filtered = texture2D(tFiltered, vUv);
    gl_FragColor = mix(original, filtered, u_effectScale);
}
