/**
 * BloomEffect — 官方 ADOFAI `Hidden/VideoBloom` 的忠实移植。
 *
 * 官方链路（VideoBloom.cs / ffxBloomPlus.cs / Compiled-Hidden-VideoBloom.shader）：
 *   num        = 198 / sourceHeight              （BloomBlit 的缩放基准）
 *   Pass 2     = 阈值：lum = dot(rgb,(0.3,0.59,0.11)); lum < Threshold ? 0 : 原色
 *   BloomBlit  = 对角 5 抽样模糊：center*0.182 + 4 个对角抽样*0.2045（权重和=1），
 *                迭代 floor(x) 次、半径 m 每次 ×√2，x = videoBlurGetMaxScaleFor(50*num)；
 *                最后一次用小数部分 (x-floor(x)) 做 mix(原图, 模糊, 小数)
 *   Pass 3     = Add 合成：out = 原图 + tint * medium * (0.5*MasterAmount*MediumAmount)
 *   Pass 4     = Screen 合成：max(原图+sum-原图*sum, 原图)（BlendMode 默认 Add）
 *
 * 色彩空间：官方 RT 是 ARGB32（gamma/显示参考），所以整条链在 sRGB 空间做，
 * 场景 RT（线性）在阈值/合成入口各转一次 —— 这样最终画面与官方一致。
 */

import { Color, Vector2, WebGLRenderTarget, ShaderMaterial, Scene, OrthographicCamera, PlaneGeometry, Mesh, WebGLRenderer, Texture, LinearFilter, RGBAFormat } from 'three';

import passVert from '../shaders/pass.vert'
import thresholdFrag from '../shaders/bloomThreshold.frag'
import blurFrag from '../shaders/bloomBlur.frag'
import compositeFrag from '../shaders/bloomComposite.frag'
import copyFrag from '../shaders/copy.frag'

/** VideoBloom.OnRenderImage 的固定降采样高度。 */
const BLOOM_HEIGHT = 198;
/** VideoBloom 组件默认参数（ffxBloomPlus 只改 Threshold/MasterAmount/Tint）。
 *  MediumAmount/KernelSize/MediumKernelScale 在 ADOFAI 的 prefab 里可能被改过 —— 反编译
 *  读不到，所以做成可调（见 setMediumAmount / __adojasBloomAmount）。 */
const KERNEL_SIZE = 50;
const MEDIUM_KERNEL_SCALE = 1;
const SQRT2 = Math.SQRT2;

/**
 * 官方 VideoBloom.videoBlurGetMaxScaleFor(radius)：
 * 半径 → 模糊"最大缩放"，整数部分 = 迭代次数，小数部分 = 最后一次 mix 的插值。
 */
function videoBlurGetMaxScaleFor(radius: number): number {
    const num = radius;
    const num2 = num < 10
        ? 0.1 * num * 1.468417
        : (num < 36.3287 ? 0.127368 * num + 0.194737 : 0.8 * Math.sqrt(num));
    return num2 > 0 ? num2 : 0;
}

export class BloomEffect {
    private enabled: boolean = false;
    /** 官方 Threshold（0..1）。 */
    private threshold: number = 0.75;
    /** 官方 MasterAmount（= 事件 intensity/100）。 */
    private intensity: number = 0.5;
    /** 官方 Tint（sRGB 分量）。 */
    private bloomColor: Color = new Color(1, 1, 1);
    /** 官方 VideoBloom.MediumAmount（prefab 值未知 → 可调，默认 1）。 */
    private mediumAmount: number = 1;
    private quality: number = 1;

    private width: number = 1;
    private height: number = 1;

    /** 198px 档的工作缓冲（模糊乒乓）。 */
    private rtWorkA: WebGLRenderTarget | null = null;
    private rtWorkB: WebGLRenderTarget | null = null;
    /** 官方在 num<=0.99 时先 Blit 到 2× 缓冲再降采样。 */
    private rtDownsample: WebGLRenderTarget | null = null;

    private thresholdMaterial: ShaderMaterial;
    private blurMaterial: ShaderMaterial;
    private compositeMaterial: ShaderMaterial;
    private copyMaterial: ShaderMaterial;

    private fsQuad: Mesh;
    private scene: Scene;
    private camera: OrthographicCamera;

    /** 当前 medium bloom 纹理（合成用）。 */
    private bloomTexture: Texture | null = null;

    constructor() {
        this.thresholdMaterial = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                threshold: { value: 0.75 },
            },
            vertexShader: passVert,
            fragmentShader: thresholdFrag,
            depthTest: false,
            depthWrite: false,
        });

        this.blurMaterial = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                uOffsetA: { value: new Vector2() },
                uOffsetB: { value: new Vector2() },
                fraction: { value: 1 },
            },
            vertexShader: passVert,
            fragmentShader: blurFrag,
            depthTest: false,
            depthWrite: false,
        });

        this.compositeMaterial = new ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tBloom: { value: null },
                bloomAmount: { value: 1 },
                tint: { value: new Color(1, 1, 1) },
            },
            vertexShader: passVert,
            fragmentShader: compositeFrag,
            depthTest: false,
            depthWrite: false,
        });

        this.copyMaterial = new ShaderMaterial({
            uniforms: { tDiffuse: { value: null } },
            vertexShader: passVert,
            fragmentShader: copyFrag,
            depthTest: false,
            depthWrite: false,
        });

        this.scene = new Scene();
        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new PlaneGeometry(2, 2);
        this.fsQuad = new Mesh(geometry, this.thresholdMaterial);
        this.fsQuad.frustumCulled = false;
        this.scene.add(this.fsQuad);
    }

    setEnabled(enabled: boolean): void { this.enabled = enabled; }
    getEnabled(): boolean { return this.enabled; }

    setThreshold(threshold: number): void {
        this.threshold = Math.max(0, Math.min(1, threshold));
        this.thresholdMaterial.uniforms.threshold.value = this.threshold;
    }

    setIntensity(intensity: number): void {
        this.intensity = intensity;
        this.compositeMaterial.uniforms.bloomAmount.value = 0.5 * intensity * this.mediumAmount;
    }

    /** 官方 VideoBloom.MediumAmount（prefab 值读不到，做成可调以便对照官方定标）。 */
    public setMediumAmount(amount: number): void {
        this.mediumAmount = amount;
        this.compositeMaterial.uniforms.bloomAmount.value = 0.5 * this.intensity * amount;
    }

    public getMediumAmount(): number { return this.mediumAmount; }

    setQuality(quality: number): void {
        this.quality = quality === 0 ? 0 : 1;
        this.resizeTargets();
    }

    setColor(colorHex: string): void {
        let hex = colorHex.startsWith('#') ? colorHex.slice(1) : colorHex;
        if (hex.length === 8) hex = hex.slice(0, 6);
        // 官方 Tint 是 gamma 空间颜色；合成也在 sRGB 空间，所以存原始 sRGB 分量
        this.bloomColor.setRGB(
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255,
        );
        this.compositeMaterial.uniforms.tint.value.copy(this.bloomColor);
    }

    getDebugColor(): { r: number; g: number; b: number } {
        return { r: this.bloomColor.r, g: this.bloomColor.g, b: this.bloomColor.b };
    }

    setSize(width: number, height: number): void {
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.resizeTargets();
    }

    private static makeRT(w: number, h: number): WebGLRenderTarget {
        return new WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            depthBuffer: false,
            stencilBuffer: false,
        });
    }

    /** 按当前画布尺寸重建 198px 档缓冲（对齐 num = 198/sourceHeight）。 */
    private resizeTargets(): void {
        const num = BLOOM_HEIGHT / this.height;
        const bw = Math.max(1, Math.floor(num * this.width));
        const bh = Math.max(1, Math.floor(num * this.height));

        if (this.rtWorkA && this.rtWorkA.width === bw && this.rtWorkA.height === bh) return;

        this.rtWorkA?.dispose();
        this.rtWorkB?.dispose();
        this.rtWorkA = BloomEffect.makeRT(bw, bh);
        this.rtWorkB = BloomEffect.makeRT(bw, bh);

        this.rtDownsample?.dispose();
        this.rtDownsample = null;
        if (num <= 0.99) {
            this.rtDownsample = BloomEffect.makeRT(bw * 2, bh * 2);
        }
    }

    /** 官方 BloomBlit 的对角抽样偏移（UV 单位，基于 198px 档缓冲的纹素）。 */
    private setBlurOffsets(m: number): void {
        const rt = this.rtWorkA!;
        const sx = 1 / rt.width;
        const sy = 1 / rt.height;
        // 官方 _Param0 = (p*m*4/3, m/3, p*m/3, -m*4/3)；模糊 ±A/±B 对称，p 的符号无影响
        (this.blurMaterial.uniforms.uOffsetA.value as Vector2).set(sx * (m * 4 / 3), sy * (m / 3));
        (this.blurMaterial.uniforms.uOffsetB.value as Vector2).set(sx * (m / 3), sy * (-m * 4 / 3));
    }

    render(renderer: WebGLRenderer, sourceTexture: Texture, targetRenderTarget: WebGLRenderTarget | null = null): void {
        if (!this.enabled) return;
        this.resizeTargets();
        const rtA = this.rtWorkA!;
        const rtB = this.rtWorkB!;
        const num = BLOOM_HEIGHT / this.height;

        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        const draw = (material: ShaderMaterial, dest: WebGLRenderTarget | null): void => {
            this.fsQuad.material = material;
            renderer.setRenderTarget(dest);
            renderer.render(this.scene, this.camera);
        };

        // ── 阈值提取：num<=0.99 时先拷到 2× 缓冲再降采样（官方 OnRenderImage 的两条分支）
        let thresholdSource: Texture = sourceTexture;
        if (num <= 0.99 && this.rtDownsample) {
            this.copyMaterial.uniforms.tDiffuse.value = sourceTexture;
            draw(this.copyMaterial, this.rtDownsample);
            thresholdSource = this.rtDownsample.texture;
        }
        this.thresholdMaterial.uniforms.tDiffuse.value = thresholdSource;
        draw(this.thresholdMaterial, rtA);

        // ── 对角模糊：迭代 floor(x) 次、半径 ×√2；最后一次按小数部分 mix
        const radius = KERNEL_SIZE * MEDIUM_KERNEL_SCALE * num;
        const maxScale = videoBlurGetMaxScaleFor(radius);
        const iterations = Math.floor(maxScale);
        const fraction = maxScale - iterations;

        let src = rtA;
        let dst = rtB;
        let m = 1;
        for (let i = 0; i < iterations; i++) {
            this.setBlurOffsets(m);
            this.blurMaterial.uniforms.tDiffuse.value = src.texture;
            this.blurMaterial.uniforms.fraction.value = 1;
            draw(this.blurMaterial, dst);
            const tmp = src; src = dst; dst = tmp;
            m *= SQRT2;
        }
        if (fraction > 0) {
            this.setBlurOffsets(m);
            this.blurMaterial.uniforms.tDiffuse.value = src.texture;
            this.blurMaterial.uniforms.fraction.value = fraction;
            draw(this.blurMaterial, dst);
            const tmp = src; src = dst; dst = tmp;
        }
        this.bloomTexture = src.texture;

        // ── Add 合成：out = 原图 + tint * medium * (0.5*Master*Medium)
        this.compositeMaterial.uniforms.tDiffuse.value = sourceTexture;
        this.compositeMaterial.uniforms.tBloom.value = this.bloomTexture;
        this.compositeMaterial.uniforms.bloomAmount.value = 0.5 * this.intensity * this.mediumAmount;
        this.compositeMaterial.uniforms.tint.value.copy(this.bloomColor);
        draw(this.compositeMaterial, targetRenderTarget);

        renderer.autoClear = oldAutoClear;
    }

    getBloomTexture(): Texture | null {
        return this.bloomTexture;
    }

    dispose(): void {
        this.rtWorkA?.dispose(); this.rtWorkA = null;
        this.rtWorkB?.dispose(); this.rtWorkB = null;
        this.rtDownsample?.dispose(); this.rtDownsample = null;
        this.thresholdMaterial.dispose();
        this.blurMaterial.dispose();
        this.compositeMaterial.dispose();
        this.copyMaterial.dispose();
        this.fsQuad.geometry.dispose();
        this.bloomTexture = null;
    }
}

export default BloomEffect;
