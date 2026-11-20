import {
    Mesh,
    NoBlending,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Texture,
    WebGLRenderTarget,
    WebGLRenderer,
} from 'three'

import screenVert from './glsl/screen.vert'
import historyCopyFrag from './glsl/historyCopy.frag'
import historySRGBToLinearFrag from './glsl/historySRGBToLinear.frag'

/**
 * ADOFAI HallOfMirrors：保留上一帧，把它铺在当前帧的背景上。
 *
 * 原版开启 HOM 时背景相机 clearFlags=Depth，不清理颜色，于是上一帧会留在
 * 背景缓冲里；ADOUAC 的 ScreenEffectPass 每帧把最终画面保存到 history，
 * BackgroundPass 在 HOM 开启时先把 history 全屏铺上，再画当前背景层。
 *
 * 这里用独立的 ScreenEffects 目录，不混进 Filters，也不混进 Player。
 */
export class HallOfMirrors {
    private width = 1
    private height = 1
    private history: WebGLRenderTarget | null = null
    /** RT 已存在但还没真正写入过画面时，不能拿它当上一帧铺底。 */
    private captured = false
    private readonly scene = new Scene()
    private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    private readonly quad: Mesh
    private readonly copyMaterial: ShaderMaterial
    private readonly srgbToLinearMaterial: ShaderMaterial

    constructor() {
        this.quad = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial())
        this.quad.frustumCulled = false
        this.scene.add(this.quad)

        this.copyMaterial = this.createMaterial(historyCopyFrag, false)
        this.srgbToLinearMaterial = this.createMaterial(historySRGBToLinearFrag, true)
    }

    private createMaterial(fragmentShader: string, linearTarget: boolean): ShaderMaterial {
        return new ShaderMaterial({
            vertexShader: screenVert,
            fragmentShader,
            uniforms: {
                tHistory: { value: null as Texture | null },
                // 保留字段便于以后统一管理；当前 shader 不使用。
                u_linearTarget: { value: linearTarget ? 1 : 0 },
            },
            depthTest: false,
            depthWrite: false,
            transparent: false,
            blending: NoBlending,
            toneMapped: false,
        })
    }

    public setSize(width: number, height: number): void {
        const w = Math.max(1, Math.floor(width || 1))
        const h = Math.max(1, Math.floor(height || 1))
        if (w === this.width && h === this.height && this.history) return
        this.width = w
        this.height = h
        this.history?.dispose()
        this.history = new WebGLRenderTarget(w, h, {
            depthBuffer: false,
            stencilBuffer: false,
            generateMipmaps: false,
        })
        this.history.texture.generateMipmaps = false
        this.captured = false
    }

    public hasHistory(): boolean {
        return !!this.history && this.captured
    }

    public reset(): void {
        this.history?.dispose()
        this.history = null
        this.captured = false
    }

    /** 把当前屏幕（或当前绑定的 framebuffer）保存成下一帧的 history。 */
    public capture(renderer: WebGLRenderer): void {
        if (!this.history) this.setSize(this.width, this.height)
        const oldTarget = renderer.getRenderTarget()
        // HallOfMirrors 捕获的是最终上屏画面；调用方在调用前应已 setRenderTarget(null)。
        if (oldTarget) renderer.setRenderTarget(null)
        try {
            renderer.copyFramebufferToTexture(this.history!.texture)
            this.captured = true
        } finally {
            renderer.setRenderTarget(oldTarget)
        }
    }

    /**
     * 在当前场景之前铺上一帧。
     * linearTarget=true 时目标是线性 RT（filter input / bloom RT），需要 sRGB→linear；
     * false 时目标是屏幕或 sRGB backdrop，直接原样拷贝。
     */
    public drawHistory(
        renderer: WebGLRenderer,
        target: WebGLRenderTarget | null,
        linearTarget: boolean,
    ): boolean {
        if (!this.history || !this.captured) return false
        const material = linearTarget ? this.srgbToLinearMaterial : this.copyMaterial
        material.uniforms.tHistory.value = this.history.texture
        this.quad.material = material
        const oldAutoClear = renderer.autoClear
        renderer.autoClear = false
        try {
            renderer.setRenderTarget(target)
            renderer.render(this.scene, this.camera)
        } finally {
            renderer.autoClear = oldAutoClear
        }
        return true
    }

    public dispose(): void {
        this.history?.dispose()
        this.history = null
        this.quad.geometry.dispose()
        this.copyMaterial.dispose()
        this.srgbToLinearMaterial.dispose()
        ;(this.quad.material as ShaderMaterial | undefined)?.dispose?.()
    }
}
