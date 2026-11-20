uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    // CameraFilterPackLegacy/Color_Chromatic_Aberration:
    //   R 采样 uv + (offset, 0)，B 采样 uv + (0, offset)，G/Alpha 取原图。
    float offset = u_intensity;
    float r = texture2D(tDiffuse, vUv + vec2(offset, 0.0)).r;
    float b = texture2D(tDiffuse, vUv + vec2(0.0, offset)).b;
    vec4 center = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(r, center.g, b, center.a);
}
