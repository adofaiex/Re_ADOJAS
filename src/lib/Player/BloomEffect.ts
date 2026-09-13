/**
 * Bloom Post-Processing Effect for Three.js
 * Based on Unity's VideoBloom shader
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
    private enabled: boolean = false;
    private threshold: number = 0.5;
    private intensity: number = 0.7;  // Reduced to 70% of original strength
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

        // Initialize intensity uniform to 0.7 (70% of original strength)
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

        // Adjust render target size based on quality
        // Low quality: quarter-res blur targets; High quality: half-res
        const w = Math.floor(this.resolution.x / (this.quality > 0 ? 2 : 4));
        const h = Math.floor(this.resolution.y / (this.quality > 0 ? 2 : 4));

        this.rtBlurH.setSize(w, h);
        this.rtBlurV.setSize(w, h);
        this.blurMaterial.uniforms.resolution.value.set(w, h);
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
        // Apply color in combine shader (like Unity's _Param1)
        this.combineMaterial.uniforms.bloomColor.value.copy(this.bloomColor);

        // Debug log
        console.log('BloomEffect.setColor:', colorHex, '-> normalized:', normalizedHex, '-> r:', this.bloomColor.r, 'g:', this.bloomColor.g, 'b:', this.bloomColor.b);
    }

    getDebugColor(): { r: number; g: number; b: number } {
        return { r: this.bloomColor.r, g: this.bloomColor.g, b: this.bloomColor.b };
    }

    setSize(width: number, height: number): void {
        this.resolution.set(width, height);

        // Pass 1 (Brightness) should be high-res to capture thin lines
        this.rtBrightness.setSize(width, height);

        // Blur passes can be half-res (high quality) or quarter-res (low quality)
        const div = this.quality > 0 ? 2 : 4;
        const w = Math.floor(width / div);
        const h = Math.floor(height / div);

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
