uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    // TV_Posterize: levels = 256 / _Distortion（SetFilter 把 _Distortion 设为 intensity*20）。
    float levels = 256.0 / max(abs(u_intensity), 1e-4);
    vec3 outColor = floor(color.rgb * levels) / levels;
    gl_FragColor = vec4(outColor, color.a);
}
