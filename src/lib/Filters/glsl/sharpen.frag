uniform sampler2D tDiffuse;
uniform vec2 u_texelSize;
uniform float u_intensity;
varying vec2 vUv;

void main() {
    // CameraFilterPackLegacy/Sharpen_Sharpen 的 5 点核：
    // Value2 决定采样半径；Value 固定为 4（场景默认值）。
    float amount = u_intensity;
    vec2 d = u_texelSize * amount;
    vec4 center = texture2D(tDiffuse, vUv);
    vec4 sum = texture2D(tDiffuse, vUv + vec2(d.x, 0.0))
             + texture2D(tDiffuse, vUv - vec2(d.x, 0.0))
             + texture2D(tDiffuse, vUv + vec2(0.0, d.y))
             + texture2D(tDiffuse, vUv - vec2(0.0, d.y));
    vec3 sharpened = center.rgb + (center.rgb * 4.0 - sum.rgb) * amount;
    gl_FragColor = vec4(sharpened, center.a);
}
