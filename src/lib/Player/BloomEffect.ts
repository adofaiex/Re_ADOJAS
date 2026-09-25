/**
 * Bloom Post-Processing Effect for Three.js
 * Full-screen bloom post-processing (threshold, gaussian blur, combine).
 * 
 * Bloom workflow:
 * 1. Threshold pass - extract bright areas (no color tinting here)
 * 2. Blur passes - gaussian blur
 * 3. Combine pass - blend bloom with original, apply color tint here
 */

import { Color, Vector2, WebGLRenderTarget, ShaderMaterial, Scene, OrthographicCamera, PlaneGeometry, Mesh, WebGLRenderer, Texture, LinearFilter, RGBAFormat } from 'three';

import brightVert from '../shaders/pass.vert'
import brightFrag from '../shaders/brightness.frag'
import blurVert from '../shaders/pass.vert'
import blurFrag from '../shaders/blur.frag'
import combineVert from '../shaders/pass.vert'
import combineFrag from '../shaders/combine.frag'

/**
 * Bloom Effect class
 */
export class BloomEffect {
    /**
     * 把 bloom 缓冲固定到 **198px 高**：
     *   `float num = 198f / source.height;` 然后所有 RT 都按这个比例建立。
     * 这个大幅降采样是关键 —— 细亮线/高光会被平均掉，叠加后不会整屏发白；
     * 我们原来在全分辨率做阈值提取、只把模糊降到半分辨率，峰值几乎等于原图 → 过曝。
     */
    private static readonly BLOOM_HEIGHT = 198;

    private enabled: boolean = false;
    private threshold: number = 0.5;
    private intensity: number = 0.7;  // 70% 强度（避免过曝）
    private bloomColor: Color = new Color(1, 1, 1);
    private quality: number = 1;

    private resolution: Vector2;

    // Render targets
    private rtBrightness: WebGLRenderTarget;
    private rtBlurH: WebGLRenderTarget;
    private rtBlurV: WebGLRenderTarget;

    // Materials
    private brightnessMaterial: ShaderMaterial;
    private blurMaterial: ShaderMaterial;
    private combineMaterial: ShaderMaterial;

    // Full-screen quad
    private fsQuad: Mesh;
    private scene: Scene;
    private camera: OrthographicCamera;

    constructor() {
        this.resolution = new Vector2(512, 512);

        const width = 256;
        const height = 256;

        this.rtBrightness = new WebGLRenderTarget(width, height, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
        });

        this.rtBlurH = new WebGLRenderTarget(width, height, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
        });

        this.rtBlurV = new WebGLRenderTarget(width, height, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
        });

        this.brightnessMaterial = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                threshold: { value: 0.5 },
            },
            vertexShader: brightVert,
            fragmentShader: brightFrag,
        });

        this.blurMaterial = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                direction: { value: new Vector2(1, 0) },
                resolution: { value: new Vector2(1, 1) },
                quality: { value: 1 },
                // 模糊半径很小（≈1.3 个 bloom 缓冲像素）；我们原来用满
                // ±4 texel 导致峰值被摊薄、"绽放感"变弱。这里收到 ~0.4 倍。
                spread: { value: 0.4 },
            },
            vertexShader: blurVert,
            fragmentShader: blurFrag,
        });

        this.combineMaterial = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tBloom: { value: null },
                intensity: { value: 1.0 },
                bloomColor: { value: new Color(1, 1, 1) },
            },
            vertexShader: combineVert,
            fragmentShader: combineFrag,
        });

        // Initialize intensity uniform to 0.7
        this.combineMaterial.uniforms.intensity.value = 0.7;

        this.scene = new Scene();
        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const geometry = new PlaneGeometry(2, 2);
        this.fsQuad = new Mesh(geometry, this.brightnessMaterial);
        this.scene.add(this.fsQuad);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    getEnabled(): boolean {
        return this.enabled;
    }

    setThreshold(threshold: number): void {
        this.threshold = Math.max(0, Math.min(1, threshold));
        this.brightnessMaterial.uniforms.threshold.value = this.threshold;
    }

    setIntensity(intensity: number): void {
        this.intensity = intensity;
        this.combineMaterial.uniforms.intensity.value = this.intensity;
    }

    setQuality(quality: number): void {
        this.quality = quality === 0 ? 0 : 1;
        this.blurMaterial.uniforms.quality.value = this.quality;
        this.resizeTargets(this.resolution.x, this.resolution.y);
    }

    setColor(colorHex: string): void {
        // Strip # prefix if present
        let hex = colorHex.startsWith('#') ? colorHex.slice(1) : colorHex;

        // Handle 8-character hex (RRGGBBAA) - strip alpha channel
        if (hex.length === 8) {
            hex = hex.slice(0, 6);
        }

        // Now create proper hex format for Color
        const normalizedHex = `#${hex}`;
        // 合成在 gamma 空间进行（见 combine.frag），这里必须存原始 sRGB 分量；
        // Color.set() 会做 sRGB→linear 转换导致染色偏亮
        this.bloomColor.setRGB(
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255
        );
        // Apply color tint in combine shader
        this.combineMaterial.uniforms.bloomColor.value.copy(this.bloomColor);

        // Debug log
        console.log('BloomEffect.setColor:', colorHex, '-> normalized:', normalizedHex, '-> r:', this.bloomColor.r, 'g:', this.bloomColor.g, 'b:', this.bloomColor.b);
    }

    getDebugColor(): { r: number; g: number; b: number } {
        return { r: this.bloomColor.r, g: this.bloomColor.g, b: this.bloomColor.b };
    }

    setSize(width: number, height: number): void {
        this.resolution.set(width, height);
        this.resizeTargets(width, height);
    }

    /**
     * 重建 bloom 缓冲：高度固定为 198px 等比缩放（源比 198 矮时按比例放大，
     * 与 `198f / source.height` 一致）。亮度阈值提取与模糊都在这个低分辨率缓冲上做。
     */
    private resizeTargets(width: number, height: number): void {
        const s = height > 0 ? BloomEffect.BLOOM_HEIGHT / height : 1;
        const bw = Math.max(1, Math.round(width * s));
        const bh = Math.max(1, Math.round(height * s));

        // 先 blit 到 2× 缓冲、再在 198px 缓冲上做阈值提取。
        // 这里用"阈值提取缓冲 = 2×198px"等价这一步：细亮线保留更多、绽放更明显，
        // 但仍是低分辨率 → 不会像全分辨率那样过曝。
        this.rtBrightness.setSize(
            Math.max(1, Math.round(bw * 2)),
            Math.max(1, Math.round(bh * 2)),
        );

        // 模糊：High 用 198px；Low 再减半
        const div = this.quality > 0 ? 1 : 2;
        const w = Math.max(1, Math.floor(bw / div));
        const h = Math.max(1, Math.floor(bh / div));

        this.rtBlurH.setSize(w, h);
        this.rtBlurV.setSize(w, h);
        this.blurMaterial.uniforms.resolution.value.set(w, h);
    }

    render(renderer: WebGLRenderer, sourceTexture: Texture, targetRenderTarget: WebGLRenderTarget | null = null): void {
        if (!this.enabled) {
            return;
        }

        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        // Pass 1: Extract bright areas (threshold only, no color)
        this.fsQuad.material = this.brightnessMaterial;
        this.brightnessMaterial.uniforms.tDiffuse.value = sourceTexture;
        renderer.setRenderTarget(this.rtBrightness);
        renderer.render(this.scene, this.camera);

        // Pass 2: Horizontal blur
        this.fsQuad.material = this.blurMaterial;
        this.blurMaterial.uniforms.tDiffuse.value = this.rtBrightness.texture;
        this.blurMaterial.uniforms.direction.value.set(1, 0);
        renderer.setRenderTarget(this.rtBlurH);
        renderer.render(this.scene, this.camera);

        // Pass 3: Vertical blur
        this.blurMaterial.uniforms.tDiffuse.value = this.rtBlurH.texture;
        this.blurMaterial.uniforms.direction.value.set(0, 1);
        renderer.setRenderTarget(this.rtBlurV);
        renderer.render(this.scene, this.camera);

        // Pass 4: Combine - apply color tint here
        this.fsQuad.material = this.combineMaterial;
        this.combineMaterial.uniforms.tDiffuse.value = sourceTexture;
        this.combineMaterial.uniforms.tBloom.value = this.rtBlurV.texture;
        renderer.setRenderTarget(targetRenderTarget);
        renderer.render(this.scene, this.camera);

        renderer.autoClear = oldAutoClear;
    }

    getBloomTexture(): Texture {
        return this.rtBlurV.texture;
    }

    dispose(): void {
        this.rtBrightness.dispose();
        this.rtBlurH.dispose();
        this.rtBlurV.dispose();
        this.brightnessMaterial.dispose();
        this.blurMaterial.dispose();
        this.combineMaterial.dispose();
        this.fsQuad.geometry.dispose();
    }
}

export default BloomEffect;
