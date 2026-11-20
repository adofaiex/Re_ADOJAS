uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    float gray = dot(color.rgb, vec3(0.222, 0.707, 0.071));
    gl_FragColor = vec4(mix(color.rgb, vec3(gray), u_intensity), color.a);
}
