uniform sampler2D tHistory;
varying vec2 vUv;

void main() {
    gl_FragColor = texture2D(tHistory, vUv);
}
