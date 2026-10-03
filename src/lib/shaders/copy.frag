uniform sampler2D tDiffuse;
varying vec2 vUv;

// 官方 VideoBloom.OnRenderImage：降采样中间步（Graphics.Blit(source, val3) 无材质拷贝），
// 之后阈值 pass 从这个 2× 缓冲采样（等于"先 2× 再降到 198px"）。
void main() {
    gl_FragColor = texture2D(tDiffuse, vUv);
}
