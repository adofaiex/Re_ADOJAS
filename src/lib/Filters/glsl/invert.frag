uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    // CameraFilterPackLegacy/Color_Invert 没有强度参数：只要 enabled 就整幅反转。
    gl_FragColor = vec4(vec3(1.0) - color.rgb, color.a);
}
