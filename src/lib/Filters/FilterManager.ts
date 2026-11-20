import {
    ClampToEdgeWrapping,
    LinearFilter,
    Mesh,
    NoBlending,
    OrthographicCamera,
    PlaneGeometry,
    RGBAFormat,
    RawShaderMaterial,
    Scene,
    ShaderMaterial,
    SRGBColorSpace,
    Texture,
    TextureLoader,
    Vector2,
    Vector3,
    Vector4,
    WebGLRenderTarget,
    WebGLRenderer,
    GLSL3,
} from 'three'

import passVert from './glsl/filter.vert'
import copyFrag from './glsl/copy.frag'
import linearToSRGBFrag from './glsl/linearToSRGB.frag'
import mixFrag from './glsl/mix.frag'
import grayscaleFrag from './glsl/grayscale.frag'
import sepiaFrag from './glsl/sepia.frag'
import invertFrag from './glsl/invert.frag'
import pixelateFrag from './glsl/pixelate.frag'
import blurFrag from './glsl/blur.frag'
import glitchFrag from './glsl/glitch.frag'
import vhsFrag from './glsl/vhs.frag'
import warpFrag from './glsl/warp.frag'
import radialBlurFrag from './glsl/radialBlur.frag'
import contrastFrag from './glsl/contrast.frag'
import aberrationFrag from './glsl/aberration.frag'
import sharpenFrag from './glsl/sharpen.frag'
import posterizeFrag from './glsl/posterize.frag'
import staticNoiseFrag from './glsl/staticNoise.frag'
import grainFrag from './glsl/grain.frag'
import fisheyeFrag from './glsl/fisheye.frag'
import { EasingFunctions } from '../Player/Easing'
import {
    FilterKind,
    normalizeFilterKind,
    normalizeIntensity,
    parseEnabled,
} from './FilterTypes'
import {
    BLOOM_FILTER_ORDER,
    applySetFilterIntensity,
    defaultSetFilterIntensity,
    filterPropertyOf,
    getFilterDefinition,
    getFilterFieldDefaults,
    parseFilterFieldValue,
    parseFilterProperties,
    setFilterNameOfComponent,
    setFilterOrderOf,
} from './FilterCatalog'
import type { FilterFieldValue, GeneratedFilterDefinition } from './FilterCatalog'
import {
    GENERATED_FILTER_BINDINGS,
    GENERATED_FILTER_MANIFEST,
    GENERATED_FILTER_SOURCES,
} from './generated'
import type { FilterBinding } from './generated'

export interface FilterBloomChain {
    /** BLOOM_FILTER_ORDER by default; supplied explicitly for clarity. */
    order: number
    enabled: boolean
    render: (renderer: WebGLRenderer, source: Texture, target: WebGLRenderTarget | null) => Texture | null
}

interface FilterState {
    /** Official CameraFilterPack component name when resolved, otherwise kind. */
    key: string
    officialName: string | null
    definition: GeneratedFilterDefinition | null
    fields: FilterFieldValue[]
    order: number
    kind: FilterKind
    enabled: boolean
    intensity: number
    startIntensity: number
    targetIntensity: number
    startTime: number
    duration: number
    easing: string
    /** SetFilter enum name (Grayscale/VHS/...) when this is a legacy slot. */
    setFilterName: string | null
    /** Exact ADOUAC-generated GLSL program, when available. */
    shaderMaterial: RawShaderMaterial | null
}

// 顺序参考原版主相机上的组件顺序（FilterTimeline.ForegroundOrder）。
const FILTER_ORDER: FilterKind[] = [
    'warp', 'fisheye', 'glitch', 'static', 'blur', 'sepia', 'sharpen',
    'pixelate', 'invert', 'grain', 'grayscale', 'aberration', 'vhs',
    'contrast', 'posterize', 'radialBlur',
]

const FILTER_GLSL3_VERT = `
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/** ADOUAC FilterLibrary resources used by legacy SetFilter shaders. */
const LEGACY_FILTER_TEXTURES: Record<string, Record<string, string>> = {
    CameraFilterPackLegacy_AAA_WaterDrop: {
        _MainTex2: 'CameraFilterPack_WaterDrop',
    },
    CameraFilterPackLegacy_Atmosphere_Rain: {
        Texture2: 'CameraFilterPack_Atmosphere_Rain_FX',
    },
    CameraFilterPackLegacy_Blizzard: {
        _MainTex2: 'CameraFilterPack_Blizzard1',
    },
    CameraFilterPackLegacy_Drawing_Paper: {
        _MainTex2: 'CameraFilterPack_Paper1',
    },
    CameraFilterPackLegacy_Real_VHS: {
        VHS: 'CameraFilterPack_VHS1',
        VHS2: 'CameraFilterPack_VHS2',
    },
    CameraFilterPack_Real_VHS: {
        VHS: 'CameraFilterPack_VHS1',
        VHS2: 'CameraFilterPack_VHS2',
    },
}

const FRAGMENT_BY_KIND: Record<FilterKind, string> = {
    grayscale: grayscaleFrag,
    sepia: sepiaFrag,
    invert: invertFrag,
    pixelate: pixelateFrag,
    blur: blurFrag,
    glitch: glitchFrag,
    vhs: vhsFrag,
    warp: warpFrag,
    radialBlur: radialBlurFrag,
    contrast: contrastFrag,
    aberration: aberrationFrag,
    sharpen: sharpenFrag,
    posterize: posterizeFrag,
    static: staticNoiseFrag,
    grain: grainFrag,
    fisheye: fisheyeFrag,
}

/**
 * 原版 ffxSetFilterPlus.SetFilter 的强度 → 组件字段换算。
 * 公式与参数来自 ADOUAC 的 FilterTimeline.IntensityMapOf / FilterCatalog：
 *   .adofai/ADOUAC/Assets/Adouac/Core/Effects/FilterTimeline.cs
 *   .adofai/ADOUAC/Assets/Adouac/Core/Effects/FilterCatalog.Generated.cs
 * 返回值直接写进 shader 的 u_intensity；负数/大于 1 也保留。
 */
function mapFilterIntensity(kind: FilterKind, intensity: number): number {
    switch (kind) {
        case 'pixelate': return intensity * 4
        case 'blur': return intensity * 2
        case 'vhs': return intensity * 0.212
        case 'warp': return intensity * 10
        case 'contrast': return intensity + 1
        case 'aberration': return intensity * 0.04 - 0.02
        case 'posterize': return intensity * 20
        case 'grain': return intensity * 32
        // Glitch 在原版没有按 intensity 缩放的字段，固定使用场景默认值。
        case 'glitch': return 1
        case 'invert': return 1
        default: return intensity
    }
}

function easeValue(name: string, t: number): number {
    const fn = EasingFunctions[name] ?? EasingFunctions.Linear
    return fn(Math.max(0, Math.min(1, t)))
}

/**
 * ADOFAI 滤镜链（独立于 Player 的渲染目录）。
 *
 * 职责：
 * 1. 接收 SetFilter 事件，按 duration/ease 补间 intensity；
 * 2. 管理 source / ping-pong render target；
 * 3. 把主场景纹理依次跑过启用的 GLSL 滤镜，输出到屏幕或 backdrop RT。
 *
 * Player 只负责在 render 阶段调用 getInputTarget() / render()，
 * 不把滤镜实现混进 Player.ts。
 */
export class FilterManager {
    private width = 1
    private height = 1
    private inputTarget: WebGLRenderTarget | null = null
    private bloomTarget: WebGLRenderTarget | null = null
    private pingTarget: WebGLRenderTarget | null = null
    private pongTarget: WebGLRenderTarget | null = null
    private originalTarget: WebGLRenderTarget | null = null
    private resultTarget: WebGLRenderTarget | null = null
    /** Bloom inside the ordered filter chain (ADOUAC VideoBloom slot). */
    private bloomChainTarget: WebGLRenderTarget | null = null

    private readonly scene = new Scene()
    private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    private readonly quad: Mesh
    private readonly materials = new Map<FilterKind, ShaderMaterial>()
    private readonly filterTextures = new Map<string, Texture>()
    private readonly textureLoader = new TextureLoader()
    private readonly copyMaterial: ShaderMaterial
    private readonly linearToSRGBMaterial: ShaderMaterial
    private readonly mixMaterial: ShaderMaterial
    private readonly states = new Map<string, FilterState>()
    /** Advanced filters are appended in first-seen order, matching ADOUAC. */
    private advancedOrder = 0
    private now = 0

    /**
     * 全局 wet/dry 强度。1 = 原版滤镜全强度；0 = 完全原图。
     * 先临时降到 0.3 做视觉校准；之后可恢复 1。
     */
    public effectScale = 0.3

    /** SetFilter 里出现 Bloom 时交给 Player 的现有 BloomEffect，避免两套 bloom。 */
    public onBloom: ((enabled: boolean, intensity: number) => void) | null = null
    /** Player 注入：Bloom 在滤镜链中的固定槽位。 */
    public bloomChain: FilterBloomChain | null = null

    constructor() {
        this.quad = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial())
        this.quad.frustumCulled = false
        this.scene.add(this.quad)

        this.copyMaterial = this.createMaterial(copyFrag)
        this.linearToSRGBMaterial = this.createMaterial(linearToSRGBFrag)
        this.mixMaterial = this.createMaterial(mixFrag)
        this.mixMaterial.uniforms.tOriginal = { value: null as Texture | null }
        this.mixMaterial.uniforms.tFiltered = { value: null as Texture | null }
        this.mixMaterial.uniforms.u_effectScale = { value: this.effectScale }
        for (const kind of FILTER_ORDER) {
            this.materials.set(kind, this.createMaterial(FRAGMENT_BY_KIND[kind]))
        }
    }

    private createMaterial(fragmentShader: string): ShaderMaterial {
        return new ShaderMaterial({
            vertexShader: passVert,
            fragmentShader,
            uniforms: {
                tDiffuse: { value: null as Texture | null },
                u_intensity: { value: 1 },
                u_time: { value: 0 },
                u_resolution: { value: new Vector2(1, 1) },
                u_texelSize: { value: new Vector2(1, 1) },
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
        if (w === this.width && h === this.height && this.inputTarget) return
        this.width = w
        this.height = h
        this.disposeTargets()
        this.inputTarget = this.createTarget(w, h, true)
        this.bloomTarget = this.createTarget(w, h, false)
        this.pingTarget = this.createTarget(w, h, false)
        this.pongTarget = this.createTarget(w, h, false)
        this.originalTarget = this.createTarget(w, h, false)
        this.resultTarget = this.createTarget(w, h, false)
        this.bloomChainTarget = this.createTarget(w, h, false)
        for (const material of this.materials.values()) this.setMaterialSize(material)
        this.setMaterialSize(this.copyMaterial)
        this.setMaterialSize(this.linearToSRGBMaterial)
        this.setMaterialSize(this.mixMaterial)
    }

    private createTarget(width: number, height: number, stencil: boolean): WebGLRenderTarget {
        const target = new WebGLRenderTarget(width, height, {
            stencilBuffer: stencil,
            depthBuffer: true,
            format: RGBAFormat,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            wrapS: ClampToEdgeWrapping,
            wrapT: ClampToEdgeWrapping,
            generateMipmaps: false,
        })
        target.texture.generateMipmaps = false
        target.texture.minFilter = LinearFilter
        target.texture.magFilter = LinearFilter
        return target
    }

    private setMaterialSize(material: ShaderMaterial): void {
        // ShaderMaterial 会复制 uniforms；不要假设复制后仍是同一个 Vector2 实例。
        // 直接替换 value 最稳，也避免 HMR/Three 版本差异下 value 变成普通对象。
        material.uniforms.u_resolution.value = new Vector2(this.width, this.height)
        material.uniforms.u_texelSize.value = new Vector2(1 / this.width, 1 / this.height)
    }

    public getInputTarget(): WebGLRenderTarget {
        if (!this.inputTarget) this.setSize(this.width, this.height)
        return this.inputTarget!
    }

    public getBloomTarget(): WebGLRenderTarget {
        if (!this.bloomTarget) this.setSize(this.width, this.height)
        return this.bloomTarget!
    }

    public setEffectScale(scale: number): number {
        this.effectScale = Math.max(0, Math.min(1, Number.isFinite(scale) ? scale : 0.3))
        return this.effectScale
    }

    public hasActive(): boolean {
        // 官方 intensity 没有 clamp：谱面里确实存在负值（如 Sepia -16）和
        // 远大于 100 的值（如 Waves 999999）。只要 filter 处于 enabled 状态，
        // 就不能用 intensity > 0 作为“是否要绘制”的判据。
        for (const state of this.states.values()) {
            if (state.enabled) return true
        }
        return false
    }

    /** 调试探针：__adojasFilterState() 用。 */
    public debugSnapshot(): any {
        return {
            size: [this.width, this.height],
            active: this.hasActive(),
            effectScale: this.effectScale,
            now: this.now,
            filters: [...this.states.values()].map(s => ({
                key: s.key,
                officialName: s.officialName,
                shader: s.definition?.shader ?? null,
                kind: s.kind,
                generated: !!s.shaderMaterial,
                order: s.order,
                enabled: s.enabled,
                intensity: s.intensity,
                target: s.targetIntensity,
                duration: s.duration,
                easing: s.easing,
                fields: s.fields.map(f => ({ name: f.field.name, kind: f.field.kind, value: f.value })),
            })),
        }
    }

    /** Catalog probe: resolve a filter name and its default fields. */
    public resolveFilterInfo(raw: unknown): any {
        const definition = getFilterDefinition(raw)
        return {
            resolved: definition?.name ?? null,
            shader: definition?.shader ?? null,
            fields: definition
                ? getFilterFieldDefaults(definition).map(f => ({
                    name: f.field.name,
                    kind: f.field.kind,
                    value: f.value,
                }))
                : [],
            kind: normalizeFilterKind(raw),
            order: setFilterOrderOf(raw),
        }
    }

    public reset(): void {
        for (const state of this.states.values()) state.shaderMaterial?.dispose()
        this.states.clear()
        this.advancedOrder = 0
        this.now = 0
    }

    /**
     * 处理一个 SetFilter 事件。
     * @param now 当前歌曲时间（秒）
     * @param secPerBeat 当前砖的 60/BPM（秒）
     */
    public handleEvent(event: any, now: number, secPerBeat: number): void {
        const raw = event?.filter ?? event?.filterType
        const definition = getFilterDefinition(raw)
        const officialName = definition?.name ?? (typeof raw === 'string' ? raw.trim() : null)
        const setFilterName = definition ? setFilterNameOfComponent(definition.name) : null
        const kind = normalizeFilterKind(raw)
        const stateKey = officialName ?? kind ?? ''
        const enabled = parseEnabled(event?.enabled, true)
        // 和官方 ffxSetFilterPlus 一样：intensity = 原始值 / 100，不做 0..1 clamp。
        // 负 intensity 和 >100 的超强 intensity 都是有意义的谱面参数。
        const intensity = normalizeIntensity(event?.intensity, 1)

        if (String(raw).toLowerCase() === 'bloom') {
            this.onBloom?.(enabled, intensity)
            return
        }
        // Custom / unknown filters stay inert. Advanced filters with no legacy
        // kind are still valid when we have a converted GLSL program.
        const hasGeneratedShader = !!(definition && GENERATED_FILTER_SOURCES[definition.name])
        if (!stateKey || (!kind && !hasGeneratedShader)) return

        if (parseEnabled(event?.disableOthers, false)) {
            for (const [other, state] of this.states) {
                if (other === stateKey) continue
                state.enabled = false
                state.intensity = 0
                state.targetIntensity = 0
                state.duration = 0
            }
        }

        let state = this.states.get(stateKey)
        if (!state) {
            const catalogOrder = setFilterOrderOf(raw)
            state = {
                key: stateKey,
                officialName,
                definition,
                fields: definition ? getFilterFieldDefaults(definition) : [],
                order: catalogOrder !== Number.MAX_SAFE_INTEGER
                    ? catalogOrder
                    : 1000 + this.advancedOrder++,
                kind: kind ?? 'grayscale',
                enabled: false,
                intensity: 0,
                startIntensity: 0,
                targetIntensity: 0,
                startTime: now,
                duration: 0,
                easing: 'Linear',
                setFilterName,
                shaderMaterial: this.createGeneratedMaterial(stateKey, definition),
            }
            this.states.set(stateKey, state!)
        } else {
            state.officialName = officialName
            state.definition = definition
            state.setFilterName = setFilterName
            state.kind = kind ?? 'grayscale'
            if (!state.fields.length && definition) state.fields = getFilterFieldDefaults(definition)
        }
        if (!state) return

        // SetFilterAdvanced: 把 filterProperties 按 catalog 字段类型落到四 float 槽位。
        // 目前只有已有 GLSL 的 kind 会真正参与绘制，但参数语义先完整保留。
        if (definition) {
            const props = parseFilterProperties(event?.filterProperties)
            if (props) {
                state.fields = state.fields.map((fv) => {
                    const parsed = parseFilterFieldValue(fv.field, filterPropertyOf(props, fv.field))
                    return parsed ? { field: fv.field, value: parsed } : fv
                })
            }
        }

        const duration = Math.max(0, Number(event?.duration) || 0) * Math.max(0, secPerBeat)
        // 原版 scrVfxPlus.filterDefaultValues：组件关着时开始补间，从这些
        // 默认强度起步（其余滤镜为 0）。Pixelate 初始 0.01 可避免 0 像素。
        const startIntensity = state.enabled
            ? state.intensity
            : (definition
                ? defaultSetFilterIntensity(setFilterName)
                : (kind === 'pixelate' ? 0.01 : kind === 'aberration' || kind === 'fisheye' ? 0.5 : 0))
        // Standard SetFilter has no filterProperties: intensity writes its one
        // public field. With duration > 0 start from the current intensity and
        // let update() move the field together with the intensity tween.
        if (definition && setFilterName) {
            state.fields = applySetFilterIntensity(
                definition,
                setFilterName,
                duration > 0 ? (state.enabled ? state.intensity : startIntensity) : intensity,
            )
        }
        state.enabled = enabled
        state.easing = typeof event?.ease === 'string' ? event.ease : 'Linear'
        state.startTime = now
        state.duration = duration
        state.startIntensity = enabled ? startIntensity : state.intensity
        state.targetIntensity = enabled ? intensity : 0

        if (!enabled) {
            state.enabled = false
            state.intensity = 0
            state.targetIntensity = 0
            state.duration = 0
        } else if (duration <= 0) {
            state.intensity = state.targetIntensity
        }
    }

    /** 每帧推进所有正在补间的滤镜。 */
    public update(now: number): void {
        this.now = now
        for (const state of this.states.values()) {
            if (!state.enabled) {
                state.intensity = 0
                continue
            }
            if (state.duration <= 0) {
                state.intensity = state.targetIntensity
                if (state.setFilterName && state.definition) {
                    state.fields = applySetFilterIntensity(state.definition, state.setFilterName, state.intensity)
                }
                continue
            }
            const p = Math.max(0, Math.min(1, (now - state.startTime) / state.duration))
            const e = easeValue(state.easing, p)
            state.intensity = state.startIntensity + (state.targetIntensity - state.startIntensity) * e
            if (state.setFilterName && state.definition) {
                state.fields = applySetFilterIntensity(state.definition, state.setFilterName, state.intensity)
            }
            if (p >= 1) {
                state.intensity = state.targetIntensity
                state.duration = 0
            }
        }
    }

    private createGeneratedMaterial(
        officialName: string,
        definition: GeneratedFilterDefinition | null,
    ): RawShaderMaterial | null {
        const source = GENERATED_FILTER_SOURCES[officialName]
        if (!source) return null
        const manifest = GENERATED_FILTER_MANIFEST[officialName]
        const uniforms: Record<string, { value: unknown }> = {
            _MainTex: { value: null },
            _MainTex2: { value: null },
            Texture2: { value: null },
            _VHS: { value: null },
            _VHS2: { value: null },
            _ValTex: { value: null },
            _VelTex: { value: null },
            _Time: { value: new Vector4() },
            _ScreenParams: { value: new Vector4() },
            _TimeX: { value: 0 },
        }
        // Cache default values for every generated uniform. Bindings applied
        // after this loop override only material-declared uniforms.
        for (const u of manifest?.uniforms ?? []) {
            if (u.name.startsWith('sampler')) continue
            if (uniforms[u.name]) continue
            if (u.texture) uniforms[u.name] = { value: null }
            else if (u.rawType === 'float2') uniforms[u.name] = { value: new Vector2() }
            else if (u.rawType === 'float3') uniforms[u.name] = { value: new Vector3() }
            else if (u.rawType === 'float4') uniforms[u.name] = { value: new Vector4() }
            else if (u.rawType === 'int') uniforms[u.name] = { value: 0 }
            else if (u.rawType === 'bool') uniforms[u.name] = { value: false }
            else uniforms[u.name] = { value: 0 }
        }
        const material = new RawShaderMaterial({
            vertexShader: FILTER_GLSL3_VERT,
            fragmentShader: source,
            uniforms,
            glslVersion: GLSL3,
            depthTest: false,
            depthWrite: false,
            transparent: false,
            blending: NoBlending,
            toneMapped: false,
        })
        material.name = `filter:${officialName}`
        if (definition) material.userData.filterDefinition = definition
        return material
    }

    private setUniform(name: string, value: unknown): void {
        if (!this.activeMaterial?.uniforms[name]) return
        this.activeMaterial.uniforms[name].value = value
    }

    private activeMaterial: RawShaderMaterial | null = null

    /** Load an ADOUAC FilterLibrary texture from public/filters once. */
    private filterTexture(name: string): Texture {
        const cached = this.filterTextures.get(name)
        if (cached) return cached
        const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
        const texture = this.textureLoader.load(`${base}filters/${name}.png`)
        texture.colorSpace = SRGBColorSpace
        texture.generateMipmaps = false
        texture.minFilter = LinearFilter
        texture.magFilter = LinearFilter
        texture.wrapS = ClampToEdgeWrapping
        texture.wrapT = ClampToEdgeWrapping
        this.filterTextures.set(name, texture)
        return texture
    }

    private filterTextureName(
        officialName: string,
        uniform: string,
        bindingName: string | null,
    ): string | null {
        if (bindingName) return bindingName
        return LEGACY_FILTER_TEXTURES[officialName]?.[uniform] ?? null
    }

    private bindGeneratedUniforms(
        state: FilterState,
        material: RawShaderMaterial,
        source: Texture,
    ): void {
        this.activeMaterial = material
        const w = this.width || 1
        const h = this.height || 1
        this.setUniform('_MainTex', source)
        this.setUniform('_Time', new Vector4(this.now / 20, this.now, this.now * 2, this.now * 3))
        this.setUniform('_TimeX', this.now)
        this.setUniform('_ScreenResolution', new Vector4(w, h, 0, 0))
        this.setUniform('_ScreenParams', new Vector4(w, h, 1 + 1 / w, 1 + 1 / h))
        for (const [name] of Object.entries(material.uniforms)) {
            if (/TexelSize$/i.test(name) && !name.includes('_CameraDepthTexture')) {
                this.setUniform(name, new Vector4(1 / w, 1 / h, w, h))
            }
        }

        const official = state.officialName ?? ''
        const bindings = GENERATED_FILTER_BINDINGS[official]
            ?? GENERATED_FILTER_BINDINGS[official.replace(/^CameraFilterPackLegacy_/, 'CameraFilterPack_')]
            ?? GENERATED_FILTER_BINDINGS[official.replace(/^CameraFilterPack_/, 'CameraFilterPackLegacy_')]
        if (bindings) {
            for (const [uniform, binding] of Object.entries(bindings) as Array<[string, FilterBinding]>) {
                if (!material.uniforms[uniform]) continue
                if (binding.kind === 'field') {
                    const field = state.fields[binding.index]
                    if (!field) continue
                    if (binding.uniformKind === 'float') this.setUniform(uniform, field.value[0])
                    else this.setUniform(uniform, new Vector4(...field.value))
                } else if (binding.kind === 'constant') {
                    if (binding.uniformKind === 'float') this.setUniform(uniform, binding.value)
                    else this.setUniform(uniform, new Vector4(binding.value, binding.value, binding.value, binding.value))
                } else if (binding.kind === 'time') {
                    this.setUniform(uniform, this.now)
                } else if (binding.kind === 'screenResolution') {
                    this.setUniform(uniform, new Vector4(w, h, 0, 0))
                } else if (binding.kind === 'screenSize') {
                    const current = material.uniforms[uniform]?.value
                    this.setUniform(uniform, current instanceof Vector4 ? new Vector4(w, h, 0, 0) : new Vector2(w, h))
                } else if (binding.kind === 'texture') {
                    const name = this.filterTextureName(official, uniform, binding.name)
                    this.setUniform(uniform, name ? this.filterTexture(name) : null)
                }
            }
        }

        // Bind every remaining sampler to an ADOUAC FilterLibrary resource.
        // A missing resource stays null (Unity default texture), never the
        // current framebuffer, otherwise e.g. Drawing_Paper samples the scene
        // as paper texture.
        const manifest = GENERATED_FILTER_MANIFEST[official]
            ?? GENERATED_FILTER_MANIFEST[official.replace(/^CameraFilterPackLegacy_/, 'CameraFilterPack_')]
        for (const u of manifest?.uniforms ?? []) {
            if (!u.texture || u.name === '_MainTex' || !material.uniforms[u.name]) continue
            const binding = bindings?.[u.name]
            const bindingName = binding?.kind === 'texture' ? binding.name : null
            const name = this.filterTextureName(official, u.name, bindingName)
            this.setUniform(u.name, name ? this.filterTexture(name) : null)
        }
        this.activeMaterial = null
    }

    private draw(
        renderer: WebGLRenderer,
        material: ShaderMaterial | RawShaderMaterial,
        source: Texture,
        destination: WebGLRenderTarget | null,
    ): void {
        if (material.uniforms.tDiffuse) material.uniforms.tDiffuse.value = source
        this.quad.material = material
        renderer.setRenderTarget(destination)
        renderer.render(this.scene, this.camera)
    }

    /**
     * 对 sourceTexture 依次执行启用的滤镜。
     * destination = null 表示直接输出到屏幕；否则输出到指定 RT（如 backdropRT）。
     */
    public render(
        renderer: WebGLRenderer,
        sourceTexture: Texture,
        destination: WebGLRenderTarget | null = null,
        sourceIsLinear = true,
    ): void {
        if (!this.inputTarget) this.setSize(this.width, this.height)
        const active = [...this.states.values()]
            .filter(s => s.enabled)
            .sort((a, b) => a.order !== b.order ? a.order - b.order : a.key.localeCompare(b.key))

        const oldAutoClear = renderer.autoClear
        renderer.autoClear = false
        try {
            if (active.length === 0) {
                this.copyMaterial.uniforms.tDiffuse.value = sourceTexture
                this.quad.material = this.copyMaterial
                renderer.setRenderTarget(destination)
                renderer.render(this.scene, this.camera)
                return
            }

            const effectScale = Math.max(0, Math.min(1, this.effectScale))
            const wetDry = effectScale < 0.999
            let source: Texture = sourceTexture

            if (sourceIsLinear) {
                // 官方滤镜在 sRGB/gamma 空间工作；Three 的主场景 RT 是线性值。
                // 先把线性图像转到 sRGB，否则 Grayscale/Sepia/Contrast 等强度会明显偏亮。
                // wet/dry 模式需要把原始图单独留在 originalTarget，不能占用 ping/pong。
                const preTarget = wetDry ? this.originalTarget! : this.pongTarget!
                this.setMaterialSize(this.linearToSRGBMaterial)
                this.draw(renderer, this.linearToSRGBMaterial, source, preTarget)
                source = preTarget.texture
            } else if (wetDry) {
                // Bloom 已经输出了 sRGB，直接复制一份作为 wet/dry 的原始图。
                this.setMaterialSize(this.copyMaterial)
                this.draw(renderer, this.copyMaterial, source, this.originalTarget!)
                source = this.originalTarget!.texture
            }

            const finalTarget = wetDry ? this.resultTarget! : destination
            const bloom = this.bloomChain && this.bloomChain.enabled ? this.bloomChain : null
            let bloomDone = !bloom

            // Bloom is a fixed slot inside the chain (ADOUAC VideoBloom), not
            // an always-last effect. Apply it exactly when the next active
            // filter has passed its order.
            for (let i = 0; i < active.length; i++) {
                const state = active[i]
                if (!bloomDone && state.order >= bloom!.order) {
                    const bloomed = bloom!.render(renderer, source, this.bloomChainTarget)
                    if (bloomed) source = bloomed
                    bloomDone = true
                }

                const nativeMaterial = state.shaderMaterial
                const material = nativeMaterial ?? this.materials.get(state.kind)!
                if (nativeMaterial) {
                    this.bindGeneratedUniforms(state, nativeMaterial, source)
                } else {
                    material.uniforms.u_intensity.value = mapFilterIntensity(state.kind, state.intensity)
                    material.uniforms.u_time.value = this.now
                    this.setMaterialSize(material as ShaderMaterial)
                }

                const last = i === active.length - 1
                const bloomAfterAll = last && !bloomDone
                const intermediate = (i % 2 === 0 ? this.pingTarget : this.pongTarget)!
                const target = last ? (bloomAfterAll ? intermediate : finalTarget) : intermediate
                this.draw(renderer, material, source, target)
                if (!last) source = intermediate.texture
                else if (bloomAfterAll) source = intermediate.texture
            }

            if (!bloomDone && bloom) {
                bloom.render(renderer, source, finalTarget)
                bloomDone = true
            }

            if (wetDry) {
                this.mixMaterial.uniforms.tOriginal.value = this.originalTarget!.texture
                this.mixMaterial.uniforms.tFiltered.value = this.resultTarget!.texture
                this.mixMaterial.uniforms.u_effectScale.value = effectScale
                this.setMaterialSize(this.mixMaterial)
                this.draw(renderer, this.mixMaterial, this.originalTarget!.texture, destination)
            }
        } finally {
            renderer.autoClear = oldAutoClear
        }
    }

    private disposeTargets(): void {
        this.inputTarget?.dispose()
        this.bloomTarget?.dispose()
        this.pingTarget?.dispose()
        this.pongTarget?.dispose()
        this.originalTarget?.dispose()
        this.resultTarget?.dispose()
        this.bloomChainTarget?.dispose()
        this.inputTarget = null
        this.bloomTarget = null
        this.pingTarget = null
        this.pongTarget = null
        this.originalTarget = null
        this.resultTarget = null
        this.bloomChainTarget = null
    }

    public dispose(): void {
        this.disposeTargets()
        this.quad.geometry.dispose()
        for (const state of this.states.values()) state.shaderMaterial?.dispose()
        for (const texture of this.filterTextures.values()) texture.dispose()
        this.filterTextures.clear()
        for (const material of this.materials.values()) material.dispose()
        ;(this.copyMaterial as any)?.dispose?.()
        ;(this.linearToSRGBMaterial as any)?.dispose?.()
        ;(this.mixMaterial as any)?.dispose?.()
        ;(this.quad.material as any)?.dispose?.()
        this.materials.clear()
        this.states.clear()
    }
}
