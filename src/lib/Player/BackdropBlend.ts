/**
 * BackdropBlend — 需要「读取背景」才能实现的装饰混合模式。
 *
 * 原版 Screen / LinearDodge / Overlay / SoftLight / Difference / Multiply 都是
 * `f(backdrop, source)`；固定管线只能表达其中一部分，而且半透明 alpha 的公式
 * 容易和原版不一致。这里统一按 ADOUAC Decoration.shader：
 *
 *   1. 主场景（不含这些装饰）先渲染进 RenderTarget；
 *   2. 把 RT 贴到屏幕；
 *   3. 这些装饰单独一遍：片元采样 RT 作为 backdrop，按原版公式混合。
 *
 * 装饰自身的 world 变换仍由 three 常规管线处理，只有混合这一步换成着色器。
 *
 * 颜色空间：RT 是线性值，装饰贴图采样后也是线性值；混合在线性空间完成，
 * 最后用 `<colorspace_fragment>` 转回渲染器输出空间。
 */
import {
    ShaderMaterial, Mesh, MeshBasicMaterial, PlaneGeometry, Texture,
    Vector2, Vector4, NoBlending, DoubleSide, Scene,
} from 'three';

export enum BackdropBlendMode {
    None = 0,
    Overlay = 1,
    SoftLight = 2,
    Difference = 3,
    Screen = 4,
    LinearDodge = 5,
    Multiply = 6,
}

/** 装饰的 blendMode 字符串 → 需要 backdrop 的模式（不需要则 None）。 */
export function backdropBlendModeOf(blendMode: unknown): BackdropBlendMode {
    switch (blendMode) {
        case 'Overlay': return BackdropBlendMode.Overlay;
        case 'SoftLight': return BackdropBlendMode.SoftLight;
        case 'Difference': return BackdropBlendMode.Difference;
        case 'Screen': return BackdropBlendMode.Screen;
        case 'LinearDodge': return BackdropBlendMode.LinearDodge;
        case 'Multiply': return BackdropBlendMode.Multiply;
        default: return BackdropBlendMode.None;
    }
}

const VERT = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

/**
 * ADOUAC Decoration.shader 的 BlendColors：
 *   Overlay:     b > 0.5 ? 1 - 2(1-b)(1-s) : 2bs
 *   SoftLight:   (1-b)b s + b(1-(1-b)(1-s))
 *   Difference:  abs(b-s)
 *   Screen:      1-(1-b)(1-s)
 *   LinearDodge: b+s
 *   Multiply:    b*s
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
    return ( 1.0 - b ) * b * s + b * ( 1.0 - ( 1.0 - b ) * ( 1.0 - s ) );
}

vec3 blendForMode( int mode, vec3 b, vec3 s ) {
    if ( mode == 1 ) return blendOverlay( b, s );
    if ( mode == 2 ) return blendSoftLight( b, s );
    if ( mode == 3 ) return abs( b - s );
    if ( mode == 4 ) return 1.0 - ( 1.0 - b ) * ( 1.0 - s );
    if ( mode == 5 ) return min( b + s, vec3( 1.0 ) );
    if ( mode == 6 ) return b * s;
    return s;
}

void main() {
    // 无贴图时 source 就是纯色（原版 uUseMap==0 分支）
    vec4 tex = uUseMap > 0.5 ? texture2D( uMap, vUv ) : vec4( 1.0 );
    vec3 src = tex.rgb * uColor.rgb;
    float alpha = tex.a * uColor.a * uOpacity;

    vec4 bd = texture2D( uBackdrop, gl_FragCoord.xy / uResolution );
    vec3 blended = blendForMode( uMode, bd.rgb, src );

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
