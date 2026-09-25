uniform sampler2D tDiffuse;
uniform vec2 direction;
uniform vec2 resolution;
uniform int quality;
uniform float spread;
varying vec2 vUv;

void main() {
    vec4 color = vec4(0.0);
    vec2 texelSize = (direction / resolution) * spread;

    float weights[5];
    weights[0] = 0.227027;
    weights[1] = 0.1945946;
    weights[2] = 0.1216216;
    weights[3] = 0.054054;
    weights[4] = 0.016216;

    if (quality == 0) {
        color += texture2D(tDiffuse, vUv) * weights[0];
        for (int i = 1; i < 3; i++) {
            vec2 offset = texelSize * float(i);
            color += texture2D(tDiffuse, vUv + offset) * weights[i];
            color += texture2D(tDiffuse, vUv - offset) * weights[i];
        }
    } else {
        color += texture2D(tDiffuse, vUv) * weights[0];
        for (int i = 1; i < 5; i++) {
            vec2 offset = texelSize * float(i);
            color += texture2D(tDiffuse, vUv + offset) * weights[i];
            color += texture2D(tDiffuse, vUv - offset) * weights[i];
        }
    }

    gl_FragColor = color;
}
