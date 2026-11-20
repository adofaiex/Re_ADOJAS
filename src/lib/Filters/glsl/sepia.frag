uniform sampler2D tDiffuse;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    float gray = dot(color.rgb, vec3(0.222, 0.707, 0.071));
    vec3 desaturated = mix(color.rgb, vec3(gray), u_intensity);
    vec3 sepia = desaturated + u_intensity * vec3(0.437, 0.171, 0.078);
    gl_FragColor = vec4(sepia, color.a);
}
