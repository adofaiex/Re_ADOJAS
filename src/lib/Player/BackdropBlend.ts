/**
 * BackdropBlend — 需要「读取背景」才能实现的混合模式（Overlay / SoftLight）。
 *
 * 这两种模式的结果取决于**背景像素**（`f(backdrop, source)`），固定管线（blendFunc /
 * blendEquation）表达不了，必须把已经画好的画面当成纹理采样：
 *
 *   1. 主场景（不含这些装饰）先渲染进一个 RenderTarget；
 *   2. 把该 RT 贴到屏幕；
 *   3. 把这些装饰**单独一遍**画上去：片元着色器按屏幕坐标采样步骤 1 的 RT 作为
 *      backdrop，算出 Overlay/SoftLight 结果，再按装饰自身 alpha 与 backdrop 混合。
 *
 * 装饰自身的 world 变换仍由 three 的常规管线处理（它就是一个普通 Mesh），
 * 所以位置/旋转/缩放/视差/跟随砖块全部沿用既有逻辑，只有"混合"这一步换成着色器。
 *
 * 颜色空间：RT 用 NoColorSpace（存线性值），装饰贴图由 GPU 采样即得到线性值，
 * 于是混合在线性空间完成；最后用 `<colorspace_fragment>` 转回渲染器的输出空间。
 */
import {
    ShaderMaterial, Mesh, MeshBasicMaterial, PlaneGeometry, Texture,
    Vector2, Vector4, NoBlending, DoubleSide, Scene,
} from 'three';

export enum BackdropBlendMode {
    None = 0,
    Overlay = 1,
    SoftLight = 2,
}

/** 装饰的 blendMode 字符串 → 需要 backdrop 的模式（不需要则 None）。 */
export function backdropBlendModeOf(blendMode: unknown): BackdropBlendMode {
    if (blendMode === 'Overlay') return BackdropBlendMode.Overlay;
    if (blendMode === 'SoftLight') return BackdropBlendMode.SoftLight;
    return BackdropBlendMode.None;
}

const VERT = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

/**
 * Overlay（b: backdrop, s: source）：
 *   b <= 0.5 ? 2*b*s : 1 - 2*(1-b)*(1-s)
 * SoftLight（W3C/Photoshop 近似）：
 *   d = b <= 0.25 ? ((16b-12)b+4)b : sqrt(b)
 *   s <= 0.5 ? b - (1-2s)*b*(1-b) : b + (2s-1)*(d-b)
 */
const FRAG = `
uniform sampler2D uMap;
uniform sampler2D uBackdrop;
uniform vec2  uResolution;
uniform vec4  uColor;
uniform float uOpacity;
uniform int   uMode;
uniform float uUseMap;
varying vec2 vUv;

vec3 blendOverlay( vec3 b, vec3 s ) {
    return mix( 2.0 * b * s, 1.0 - 2.0 * ( 1.0 - b ) * ( 1.0 - s ), step( 0.5, b ) );
}

vec3 blendSoftLight( vec3 b, vec3 s ) {
    vec3 d = mix( ( ( 16.0 * b - 12.0 ) * b + 4.0 ) * b, sqrt( b ), step( 0.25, b ) );
    return mix( b - ( 1.0 - 2.0 * s ) * b * ( 1.0 - b ),
                b + ( 2.0 * s - 1.0 ) * ( d - b ),
                step( 0.5, s ) );
}

void main() {
    // 无贴图时 source 就是纯色（原版 uUseMap==0 分支）
    vec4 tex = uUseMap > 0.5 ? texture2D( uMap, vUv ) : vec4( 1.0 );
    vec3 src = tex.rgb * uColor.rgb;
    float alpha = tex.a * uColor.a * uOpacity;

    vec4 bd = texture2D( uBackdrop, gl_FragCoord.xy / uResolution );
    vec3 blended = ( uMode == 1 ) ? blendOverlay( bd.rgb, src ) : blendSoftLight( bd.rgb, src );

    gl_FragColor = vec4( mix( bd.rgb, blended, alpha ), bd.a );
    #include <colorspace_fragment>
}
`;

/** 背景混合材质：一个带贴图的普通 Mesh 用它渲染即可（world 变换走 three 常规管线）。 */
export function createBackdropBlendMaterial(map: Texture | null, mode: BackdropBlendMode): ShaderMaterial {
    return new ShaderMaterial({
        uniforms: {
            uMap: { value: map },
            uUseMap: { value: map ? 1 : 0 },
            uBackdrop: { value: null },
            uResolution: { value: new Vector2(1, 1) },
            uColor: { value: new Vector4(1, 1, 1, 1) },
            uOpacity: { value: 1 },
            uMode: { value: mode },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        // 结果已经和 backdrop 混好 → 直接覆盖写入（不要再走固定管线混合）
        transparent: false,
        blending: NoBlending,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
    });
}

/** 把一张渲染结果原样贴到当前渲染目标（全屏四边形）。 */
export class BlitPass {
    public readonly scene: Scene;
    private readonly mesh: Mesh;
    private readonly material: MeshBasicMaterial;

    constructor() {
        this.scene = new Scene();
        this.material = new MeshBasicMaterial({
            depthTest: false,
            depthWrite: false,
        });
        this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
        this.mesh.frustumCulled = false;
        this.mesh.position.z = -0.5;
        this.scene.add(this.mesh);
    }

    public render(
        renderer: import('three').WebGLRenderer,
        texture: Texture,
        camera: import('three').OrthographicCamera,
    ): void {
        if (this.material.map !== texture) {
            this.material.map = texture;
            this.material.needsUpdate = true;
        }
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(this.scene, camera);
        renderer.autoClear = oldAutoClear;
    }

    public dispose(): void {
        this.mesh.geometry.dispose();
        this.material.dispose();
    }
}
