import { Group, Mesh, Sprite, Vector2, Color, Texture, MeshBasicMaterial, SpriteMaterial, Material, CanvasTexture, CircleGeometry, BufferGeometry, BufferAttribute, SRGBColorSpace, DoubleSide, Scene, PlaneGeometry, Vector3, WebGLRenderTarget, Float32BufferAttribute, NormalBlending, AdditiveBlending, MultiplyBlending, CustomBlending, AddEquation, ReverseSubtractEquation, OneFactor, OneMinusSrcColorFactor, OneMinusSrcAlphaFactor, LinearFilter, LinearMipMapLinearFilter, NearestFilter, RepeatWrapping, ClampToEdgeWrapping, Blending, AlwaysStencilFunc, EqualStencilFunc, NotEqualStencilFunc, ReplaceStencilOp, KeepStencilOp } from 'three';
import { TimelineManager } from './TimelineManager';
import createTrackMesh, { DECO_SIZE_SCALE, DECO_POSITION_SCALE } from '../Geo/mesh_reserve';
import { isEventActive, isEnabled } from './EventUtils';
import { getIconTexture, getIconTextureForCustomFloor, createIconSprite, getPlanetTexture, planetPresetColor, configurePlanetTexture, applyPlanetFrame } from './IconLoader';
import type { IconType } from './IconLoader';
import { debugLog } from './DebugLog';
import { DecorationInstancedRenderer, DecoInstanceSlot } from './DecorationInstancedRenderer';
import { ParticleDecorationSystem } from './ParticleDecoration';
import type { ParticleConfig } from './ParticleDecoration';
import { DecorationTextureStore } from './DecorationTextures';
import { ObjectFloorBatchManager } from './ObjectFloorBatch';

/**
 * Object(Floor) 装饰是否走实例化批次（true）还是每个装饰各建 mesh（false）。
 * 实例化：9107 块 → 几个 InstancedMesh，描边/填充/透明度/朝向只有一份实现。
 * 出问题时把这里改成 false 即可回到旧路径（保留旧实现以便回退）。
 */
const USE_OBJECT_FLOOR_BATCH = true;

/**
 * 动态装饰"按视差预测位置再剔除"的预筛。
 *
 * 这个启发式只在锚点为 Tile/Global（位置=基准+视差线性）时成立；一旦涉及
 * LastPosition / SetPlacementType / 跟随偏移 / 补间，预测就会偏，表现为
 * **视野内本该显示的装饰被剔除（消失）**。WAD 没有这种预筛，所以默认关闭；
 * 需要那几毫秒时再开（开着的话要先把预测做成精确的）。
 */
const USE_DYNAMIC_PRECULL = false;
import { PlanetTrail } from './PlanetTrail';
import { backdropBlendModeOf, createBackdropBlendMaterial, BackdropBlendMode } from './BackdropBlend';
import type { ShaderMaterial } from 'three';
import { TileColorManager } from './TileColorManager';
import type { TileColorConfig } from './TileColorManager';



// ── Object 装饰物 Planet：与玩家 Planet 一致的球体 + 拖尾参数 ──
/** 粒子装饰（AddParticle）临时禁用开关：置 true 恢复创建/更新。
 *  禁用时 AddParticle 事件完全跳过（不入 pending，避免反复重试）。 */
const PARTICLES_ENABLED = false;
/** 行星本体半径（拖尾宽度用），取值 0.22。 */
const PLANET_BODY_RADIUS = 0.22;
/** 行星本体贴图四边形尺寸 = 直径（半径 × 2）。 */
const PLANET_SPRITE_SIZE = PLANET_BODY_RADIUS * 2;
/** 拖尾时间窗口（秒），与 Player.computePlanetTrails 一致 */
const PLANET_TRAIL_DURATION = 0.74; // 拖尾寿命 yf = 74e4 µs
/** 拖尾最多采样点数 */
const PLANET_TRAIL_MAX_POINTS = 120;
/** 拖尾位置历史环大小 */
const PLANET_TRAIL_HIST = 256;


/**
 * Parse ADOFAI hex color which may be #RRGGBBAA (8-digit with alpha).
 * Returns [rgbString, alpha01] where rgbString is #RRGGBB and alpha01 is 0..1.
 * Color only accepts #RRGGBB, so alpha must be split out.
 */
function parseDecoColor(hex: any, fallback: string = 'ffffff'): [string, number] {
    if (typeof hex === 'string') {
        const raw = hex.replace(/^#/, '');
        if (raw.length >= 8) {
            const alpha = parseInt(raw.slice(6, 8), 16) / 255;
            return ['#' + raw.slice(0, 6), alpha];
        }
        return ['#' + raw.slice(0, 6), 1];
    }
    if (typeof hex === 'number') {
        // 0xRRGGBB / 0xRRGGBBAA
        const n = hex >>> 0;
        if (n > 0xffffff) {
            const alpha = ((n >>> 24) & 0xff) / 255;
            return ['#' + ((n >>> 16) & 0xff).toString(16).padStart(2, '0')
                + ((n >>> 8) & 0xff).toString(16).padStart(2, '0')
                + (n & 0xff).toString(16).padStart(2, '0'), alpha];
        }
        return ['#' + (n & 0xff).toString(16).padStart(2, '0') + ((n >>> 8) & 0xff).toString(16).padStart(2, '0') + ((n >>> 16) & 0xff).toString(16).padStart(2, '0'), 1];
    }
    if (Array.isArray(hex)) {
        // [r, g, b] 或 [r, g, b, a]（0..1）
        const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
        const alpha = hex.length >= 4 && typeof hex[3] === 'number' ? hex[3] : 1;
        return ['#' + toHex(hex[0]) + toHex(hex[1]) + toHex(hex[2]), alpha];
    }
    if (hex && typeof hex === 'object' && typeof (hex as any).r === 'number') {
        // {r, g, b} / {r, g, b, a}（0..1）
        const o = hex as any;
        const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
        return ['#' + toHex(o.r) + toHex(o.g) + toHex(o.b), typeof o.a === 'number' ? o.a : 1];
    }
    // 粒子等特殊对象 → 默认白
    return ['#' + fallback.replace(/^#/, '').slice(0, 6), 1];
}

/** 将 #RRGGBB 解析为 [r,g,b]（0..1）。 */
function hexToRGB01(hex: string): [number, number, number] {
    const h = hex.replace(/^#/, '');
    return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
    ];
}

/**
 * Parse event.visible matching ADOFAI-JS isEnabled semantics:
 *   - Key missing → true（默认可见）
 *   - Bool → 原样
 *   - "Enabled"/"true"（字符串）→ true；"Disabled"/"false"/其他 → false
 */
function parseEventVisible(val: any): boolean {
    return isEnabled(val, true);
}

function getBlendMode(mode: DecorationBlendMode): number {
    switch (mode) {
        case DecorationBlendMode.LinearDodge:
        case DecorationBlendMode.Additive:
            return AdditiveBlending;
        case DecorationBlendMode.Multiply: return MultiplyBlending;
        case DecorationBlendMode.Screen:
        case DecorationBlendMode.Overlay:
        case DecorationBlendMode.SoftLight:
        case DecorationBlendMode.Difference:
        case DecorationBlendMode.Subtract:
        case DecorationBlendMode.Divide:
            return CustomBlending;
        default: return NormalBlending;
    }
}

/** 能否安全进入 instanced 批次：只用固定管线的三种混合（批次的材质是共享的）。 */
function isBatchableBlendMode(mode: DecorationBlendMode): boolean {
    return mode === DecorationBlendMode.None
        || mode === DecorationBlendMode.Multiply
        || mode === DecorationBlendMode.LinearDodge
        || mode === DecorationBlendMode.Additive;
}

/**
 * 把 DecorationBlendMode 落到 three 的材质混合状态。
 * 部分混合模式需要抓屏取底 + blend 公式才能精确实现，固定管线只能精确表达
 * 一部分：None/Multiply/LinearDodge 精确，Screen 用标准 screen 公式，
 * Difference 用 reverse-subtract 近似；Overlay/SoftLight 无法表达 → 退化为 Normal。
 */
function applyDecoBlendMode(mat: any, mode: DecorationBlendMode): void {
    switch (mode) {
        case DecorationBlendMode.Screen:
            // 1-(1-a)(1-b) = a + b(1-a)
            mat.blending = CustomBlending;
            mat.blendSrc = OneFactor;
            mat.blendDst = OneMinusSrcColorFactor;
            mat.blendSrcAlpha = OneFactor;
            mat.blendDstAlpha = OneMinusSrcAlphaFactor;
            break;
        case DecorationBlendMode.Difference:
            mat.blending = CustomBlending;
            mat.blendEquation = ReverseSubtractEquation;
            mat.blendSrc = OneFactor;
            mat.blendDst = OneFactor;
            break;
        case DecorationBlendMode.Subtract:
            mat.blending = CustomBlending;
            mat.blendEquation = ReverseSubtractEquation;
            break;
        case DecorationBlendMode.Divide:
            mat.blending = CustomBlending;
            break;
        case DecorationBlendMode.LinearDodge:
        case DecorationBlendMode.Additive:
            mat.blending = AdditiveBlending;
            break;
        case DecorationBlendMode.Multiply:
            mat.blending = MultiplyBlending;
            break;
        case DecorationBlendMode.Overlay:
        case DecorationBlendMode.SoftLight:
        default:
            mat.blending = NormalBlending;
            break;
    }
}

/**
 * 遮罩 stencil key：目标名（+ 深度范围）。
 * 对齐 WAD 的 `resolveMaskStencilKeyForInstance`：
 * `useMaskingDepth ? `${name}:${front}:${back}` : name` —— 同一目标名但不同深度范围
 * 必须是**不同的**遮罩，用深度范围拼进 key 才能分开。
 */
const NO_TAG_MASK = 'NO TAG';

export enum DecorationType {
    Image = 'Image',
    Text = 'Text',
    Object = 'Object',
    Particle = 'Particle',
    Prefab = 'Prefab'
}

export enum DecPlacementType {
    Tile = 'Tile',
    /** 相对"玩家正在控制的球"定位（原版 relativeTo: Player / <n>ThisTile 之外的默认锚点）。 */
    Player = 'Player',
    Camera = 'Camera',
    CameraAspect = 'CameraAspect',
    Global = 'Global',
    LastPosition = 'LastPosition',
    /** 同 LastPosition，但不继承相机旋转。 */
    LastPositionNoRotation = 'LastPositionNoRotation',
    RedPlanet = 'RedPlanet',
    BluePlanet = 'BluePlanet',
    GreenPlanet = 'GreenPlanet'
}

/** DecorationBlendMode 枚举：None/Screen/LinearDodge/Overlay/SoftLight/Difference/Multiply。
 *  另外保留 Additive/Subtract/Divide 以兼容其它编辑器写出的关卡数据。 */
export enum DecorationBlendMode {
    None = 'None',
    Screen = 'Screen',
    LinearDodge = 'LinearDodge',
    Overlay = 'Overlay',
    SoftLight = 'SoftLight',
    Difference = 'Difference',
    Multiply = 'Multiply',
    // 兼容旧数据 / 其它实现
    Additive = 'Additive',
    Subtract = 'Subtract',
    Divide = 'Divide',
}

export enum MaskingType {
    None = 'None',
    Mask = 'Mask',
    VisibleInsideMask = 'VisibleInsideMask',
    VisibleOutsideMask = 'VisibleOutsideMask',
}

export interface DecorationRuntimeContext {
    viewportWidth: number;
    viewportHeight: number;
    planetPositions?: Partial<Record<DecPlacementType.RedPlanet | DecPlacementType.BluePlanet | DecPlacementType.GreenPlanet, Vector2>>;
    /** 玩家正在控制的那颗球的世界坐标（relativeTo: Player 的锚点）。 */
    playerPosition?: Vector2;
    /** Editor mouse-wheel zoom (view-zoom factor, 1 = default). Equivalent to:
     *  userSizeMultiplier = 1 / this value. Participates in lockScale
     *  decorations' camScaleMultiplier exactly like MoveCamera zoom does. */
    editorWheelZoom?: number;
    /** 暂停时（`!paused && followPlanet != null` 的情形）
     *  planet follow 偏移归零，装饰停在 startPos，而不是继续贴在被冻结的行星上。 */
    paused?: boolean;
    /** 每块砖当前的层级 z（Player.updateVisibleTiles 写入）。syncFloorDepth 装饰继承它。 */
    tileLayerZ?: ArrayLike<number>;
}

export interface DecorationConfig {
    id?: string;
    tag: string;
    decorationType: DecorationType;
    decorationImage: string;
    decText?: string;
    position: [number, number];
    positionOffset: [number, number];
    relativeTo: DecPlacementType;
    rotation: number;
    rotationOffset: number;
    scale: [number, number];
    parallax: [number, number];
    parallaxOffset: [number, number];
    pivotOffset: [number, number];
    depth: number;
    color: string;
    opacity: number;
    lockScale: boolean;
    lockRotation: boolean;
    visible: boolean;
    scaleMultiplier: number;
    stickToFloor: boolean;
    /** syncFloorDepth：Image/Object 装饰继承父砖的 sorting layer/order。 */
    syncFloorDepth: boolean;
    floor?: number;
    /** 位置锚点所在的砖（Tile/ThisTile 用；ThisTile 的 [n,ThisTile] 会偏移到 floor+n）。 */
    anchorFloor?: number;
    objectType?: string;
    planetColorType?: string;
    planetColor?: string;
    planetTailColor?: string;
    trackColor?: string;
    trackColor2?: string;
    trackColorType?: string;
    trackColorAnimDuration?: number;
    trackColorPulse?: string;
    trackPulseLength?: number;
    trackOpacity?: number;
    trackStyle?: string;
    trackIcon?: string;
    trackAngle?: number;
    trackIconAngle?: number;
    trackIconFlipped?: boolean;
    trackRedSwirl?: boolean;
    trackGraySetSpeedIcon?: boolean;
    trackGlowEnabled?: boolean;
    trackGlowColor?: string;
    trackIconOutlines?: boolean;
    /** AddDecoration 的平铺行列（WAD 的 texture cache key 也带这个）。*/
    tile?: [number, number];
    blendMode: DecorationBlendMode;
    maskingType: MaskingType;
    maskingTarget?: string;
    /** SetMaskingDepth 的 custom range（useMaskingDepth + front/back depth）。 */
    useMaskingDepth?: boolean;
    maskingFrontDepth?: number;
    maskingBackDepth?: number;
    imageSmoothing?: boolean;
}

/**
 * Uniform spatial grid for static decorations.
 * Static decorations have a fixed world position (no parallax / lock / stickToFloor),
 * so they can be culled cheaply by skipping cells outside the camera view.
 * Cell size is chosen relative to typical camera view height (~8 / camZoom units)
 * to keep visible cell count low (single-digit typically).
 */
class DecorationSpatialGrid {
    private cellSize: number;
    private cells: Map<string, DecorationInstance[]> = new Map();
    public lastQueryCount: number = 0;

    constructor(cellSize: number = 32) {
        this.cellSize = cellSize;
    }

    private key(cx: number, cy: number): string {
        return cx + ',' + cy;
    }

    public clear(): void {
        this.cells.clear();
        this.lastQueryCount = 0;
    }

    public insert(deco: DecorationInstance, worldX: number, worldY: number): void {
        const cx = Math.floor(worldX / this.cellSize);
        const cy = Math.floor(worldY / this.cellSize);
        const k = this.key(cx, cy);
        let bucket = this.cells.get(k);
        if (!bucket) { bucket = []; this.cells.set(k, bucket); }
        bucket.push(deco);
    }

    /** 从网格移除（参考系变化后重新插入用；只在 reclassify 时调用，频率极低）。 */
    public remove(deco: DecorationInstance): void {
        for (const [, bucket] of this.cells) {
            const i = bucket.indexOf(deco);
            if (i >= 0) { bucket.splice(i, 1); return; }
        }
    }

    /**
     * Returns decorations in cells overlapping [minX, minY] – [maxX, maxY].
     * The same decoration may be reported once even if it spans multiple cells,
     * because we only index by its anchor world position.
     *
     * 注意：不要按单元格区间双重循环——调用方会用巨大的 `_staticQueryPad`（超大型装饰）
     * 外扩查询范围，区间可能覆盖成千上万格导致每帧卡顿。改为只遍历【实际存在装饰】的格子，
     * 非空格子数 ≤ 装饰数，复杂度稳定为 O(装饰数)。
     */
    public query(minX: number, minY: number, maxX: number, maxY: number): DecorationInstance[] {
        const out: DecorationInstance[] = [];
        const cs = this.cellSize;
        for (const [k, bucket] of this.cells) {
            const comma = k.indexOf(',');
            const cx = +k.slice(0, comma);
            const cy = +k.slice(comma + 1);
            const cellMinX = cx * cs, cellMaxX = cellMinX + cs;
            const cellMinY = cy * cs, cellMaxY = cellMinY + cs;
            if (cellMaxX < minX || cellMinX > maxX || cellMaxY < minY || cellMinY > maxY) continue;
            for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
        this.lastQueryCount = out.length;
        return out;
    }
}

const defaultDecorationConfig: DecorationConfig = {
    tag: '',
    decorationType: DecorationType.Image,
    decorationImage: '',
    decText: '',
    position: [0, 0],
    positionOffset: [0, 0],
    relativeTo: DecPlacementType.Tile,
    rotation: 0,
    rotationOffset: 0,
    scale: [100, 100],
    parallax: [100, 100],
    parallaxOffset: [0, 0],
    pivotOffset: [0, 0],
    depth: 0,
    color: 'ffffff',
    opacity: 100,
    lockScale: false,
    lockRotation: false,
    visible: true,
    scaleMultiplier: 1,
    stickToFloor: false,
    syncFloorDepth: false,
    blendMode: DecorationBlendMode.None,
    maskingType: MaskingType.None,
    maskingTarget: '',
    imageSmoothing: false,
};

// Throttled rendered-position probe (only for debugging specific tags).

class DecorationInstance {
    public config: DecorationConfig;
    public container: Group;
    public visualGroup: Group;
    public mesh: Mesh | null = null;
    public sprite: Sprite | null = null;
    public objectGroup: Group | null = null;
    public iconSprite: Sprite | null = null;
    public startPos: Vector2 = new Vector2();
    public pivotPos: Vector2 = new Vector2();
    public currentPosition: Vector2 = new Vector2();
    public currentScale: Vector2 = new Vector2(1, 1);
    public currentRotation: number = 0;
    public currentColor: Color = new Color(0xffffff);
    public currentOpacity: number = 1;
    public currentParallax: Vector2 = new Vector2(1, 1);
    public currentParallaxOffset: Vector2 = new Vector2();
    /** Base texture size in world units (texW/100, texH/100) for culling */
    public baseSizeX = 1;
    public baseSizeY = 1;
    /** alpha 裁剪后的内容中心偏移（世界单位），加到 mesh / instance 位置上 */
    public cropOffX = 0;
    public cropOffY = 0;
    public instSlot: DecoInstanceSlot | null = null;
    public particles: ParticleDecorationSystem | null = null;
    public planetTrail: PlanetTrail | null = null;
    // 拖尾位置历史（世界坐标），供 PlanetTrail 重建 ribbon
    private _trailHist: Float64Array = new Float64Array(PLANET_TRAIL_HIST * 2);
    private _trailHistTime: Float64Array = new Float64Array(PLANET_TRAIL_HIST);
    private _trailHead = 0;
    private _trailCount = 0;
    // 上一次真正构建成 ribbon 的点数（用于跳过无变化帧的重建）
    private _trailBuilt = false;
    private _trailBuiltN = 0;
    public sourceEvent: any = null;
    private instRenderer: DecorationInstancedRenderer | null = null;
    private originalVisible: boolean = true;
    private originalDepth: number = 0;
    // SetPlacementType 状态快照：死亡重开时恢复原参考系与原 startPos
    private _placementChanged = false;
    private _originalRelativeTo: DecPlacementType = DecPlacementType.Tile;
    private _originalStartPos: Vector2 = new Vector2();
    // SetPlacementType 的行星跟随重绑（followPlanet）。
    private _followOverride: DecPlacementType | null = null;
    // 运行期 SetPlacementType 的当前参考系（config.relativeTo 会被同步更新，
    // 这里记录"已完成迁移"的帧，避免每帧重复 re-derive）。
    private _currentPlacement: DecPlacementType | null = null;
    private _isStaticWorld = true;
    // 真正生效的可见性 = culling 视锥可见 && 用户/事件 visible
    private _instVisible = true;
    private _culledVisible = true;
    // 最近一次 updatePosition 计算出的 scale 乘数（camScaleMultiplier × floorScale）
    private _scaleMul = 1;
    // 与 _scaleMul 对应，用于 stickToFloor 的非等比地板缩放（SetScale 逐轴相乘）
    private _scaleMulY = 1;
    // syncFloorDepth：父砖当前层级 z（每帧 updatePosition 从 runtime.tileLayerZ 取）
    private _syncFloorZ: number | null = null;
    // Object(Floor) 顶点色：保留 tile mesh + mask，供 SetObject 颜色 tween 逐帧重算
    public objTileMesh: Mesh | null = null;
    public objMask: Float32Array | null = null;
    // Object(Floor) 实例化批次用的几何定义（与 objTileMesh 二选一）
    public objGeoKey: string | null = null;
    public objTpl: { positions: Float32Array; indices: Uint32Array; mask: Float32Array; vertexCount: number } | null = null;
    // 每帧算出的填充/描边（实例属性）
    public objFill: Color = new Color(1, 1, 1);
    public objStroke: Color = new Color(1, 1, 1);
    public objColor1: Color = new Color(1, 1, 1);
    public objColor2: Color = new Color(1, 1, 1);
    public objColorType: string = 'Single';
    // SetFloorColor 的其余参数（供 TileColorManager.getTileRenderer 复用）
    public objTrackStyle: string = 'Standard';
    public objColorPulse: string = 'None';
    public objColorAnimDuration: number = 2;
    public objColorPulseLength: number = 10;
    /** Object(Planet) 本体贴图（11 帧 sprite sheet），用于逐帧推进。 */
    public objPlanetTex: Texture | null = null;

    /** 颜色是否随时间变化（用到 pulse 相位的类型）。 */
    public get objColorAnimated(): boolean {
        return this.objColorType === 'Glow' || this.objColorType === 'Blink'
            || this.objColorType === 'Switch' || this.objColorType === 'Rainbow'
            || this.objColorType === 'Volume';
    }
    // 同深度平局的排名偏移（updateZRank 每帧按创建序分配）
    private _zRankOffset = 0;
    // currentOpacity = _opacityProp × _colorAlpha（ApplyColor 的语义）：
    // 是 `color.WithAlpha(color.a * opacity * num)`，两个因子各自可被 MoveDecorations
    // tween（opacity / color 的 alpha 通道），互不吞掉。分开存。
    private _opacityProp: number = 1;
    private _colorAlpha: number = 1;
    // 时间轴采样缓存：避免每帧重复触发 image load 或相同值导致的 transform 重算
    public _manager: any = null;
    private _lastImage: string | null = null;
    // 该装饰实际拥有时间轴的属性（惰性缓存，供逐帧采样跳过不存在的属性）
    private _animProps: Set<string> | null = null;
    private _lastText: string | null = null;
    private _lastPlanetColor: string | null = null;
    private _lastPlanetTailColor: string | null = null;
    private _lastTrackColor: string | null = null;
    private _lastTrackOpacity: number | null = null;
    private _lastTrackIcon: string | null = null;

    /** Overlay / SoftLight：固定管线表达不了，需在独立的一遍里采样背景（见 BackdropBlend）。 */
    public backdropMode: BackdropBlendMode = BackdropBlendMode.None;
    public backdropMat: ShaderMaterial | null = null;
    /** 该装饰是否有逐帧时间轴（建时间轴时预算，避免每帧查表）。 */
    public hasTimeline = false;
    /**
     * 纹理请求号：每次请求递增。异步加载回来时若号已变（换过图/已重建），
     * 就丢弃这次回调 —— 避免旧图糊到新装饰上（WebADOFAI 同款做法）。
     */
    public textureRequestId = 0;

    public get isStaticWorld(): boolean {
        return this._isStaticWorld;
    }
    public get isInstanced(): boolean {
        return this.instSlot !== null;
    }

    public setInstancedRenderer(r: DecorationInstancedRenderer | null): void {
        this.instRenderer = r;
    }

    constructor(config: Partial<DecorationConfig>) {
        this.config = { ...defaultDecorationConfig, ...config };
        this.container = new Group();
        this.container.name = `decoration_${this.config.tag || 'untagged'}`;
        this.visualGroup = new Group();
        this.visualGroup.name = 'visual';
        this.visualGroup.position.set(this.config.pivotOffset[0], this.config.pivotOffset[1], 0);
        this.container.add(this.visualGroup);
        this.currentScale.set(this.config.scale[0] / 100, this.config.scale[1] / 100);
        // 粒子装饰：scale 只控制发射区域（shape.scale），transform 不缩放（SetScale 仅设 shape）
        if (this.config.decorationType === DecorationType.Particle) {
            this.currentScale.set(1, 1);
        }
        this.currentRotation = this.config.rotation + this.config.rotationOffset;
        // Parse color with alpha: #RRGGBBAA → color=#RRGGBB, alpha extracted
        const [colorHex, colorAlpha] = parseDecoColor(this.config.color);
        this.currentColor.set(colorHex);
        this._opacityProp = this.config.opacity / 100;
        this._colorAlpha = colorAlpha;
        this.recomputeOpacity();
        this.currentPosition.set(this.config.position[0], this.config.position[1]);
        this.currentParallax.set(this.config.parallax[0] / 100, this.config.parallax[1] / 100);
        this.currentParallaxOffset.set(this.config.parallaxOffset[0], this.config.parallaxOffset[1]);
        this.originalVisible = this.config.visible;
        this.originalDepth = this.config.depth;
        this.refreshStaticWorld();
    }

    /** 由 opacity 属性值 × 颜色 alpha 合成最终不透明度（Object 走 trackOpacity，不调用）。 */
    public recomputeOpacity(): void {
        this.currentOpacity = this._opacityProp * this._colorAlpha;
    }

    /** Object(Planet) 的 sprite sheet 逐帧推进（用 unscaledTime）。 */
    public tickPlanetFrame(): void {
        if (this.objPlanetTex) applyPlanetFrame(this.objPlanetTex, performance.now() * 0.001);
    }

    /** Re-evaluate the static-world fast path (call after relativeTo/parallax changes). */
    public refreshStaticWorld(): void {
        const c = this.config;
        // 每帧重算位置（没有静态快速路径），所以判定必须基于【运行期当前值】
        // currentParallax/currentParallaxOffset，而不是初始 config —— 否则一个
        // 初始 parallax=0 的装饰被 MoveDecorations 改了 parallax 后仍走静态分支，
        // 视差/视差偏移完全不生效。
        this._isStaticWorld = (c.relativeTo === DecPlacementType.Tile
            || c.relativeTo === DecPlacementType.Global
            || c.relativeTo === DecPlacementType.LastPosition)
            && this.currentParallax.x === 0 && this.currentParallax.y === 0
            && this.currentParallaxOffset.x === 0 && this.currentParallaxOffset.y === 0
            && !c.lockRotation && !c.lockScale
            && !c.stickToFloor;
    }

    public setupVisual(texture: Texture | null): void {
        this.clearVisual();
        if (this.config.decorationType === DecorationType.Object) return;
        const blend = getBlendMode(this.config.blendMode);
        this.visualGroup.position.set(this.config.pivotOffset[0], this.config.pivotOffset[1], 0);
        // Overlay / SoftLight 即使**没有贴图**也要走 backdrop pass（纯色滤镜，原版 uUseMap==0 分支）
        const bdNoTex = (this._manager?.backdropBlendEnabled
            && this.config.maskingType === MaskingType.None
            && (this.config.depth ?? 0) < 0)
            ? backdropBlendModeOf(this.config.blendMode)
            : BackdropBlendMode.None;
        if (bdNoTex !== BackdropBlendMode.None) {
            const map = texture ?? this._manager?.getPlaceholderTexture() ?? null;
            this.backdropMode = bdNoTex;
            const mat = createBackdropBlendMaterial(map as Texture, bdNoTex);
            (mat.uniforms.uColor.value as any).set(
                this.currentColor.r, this.currentColor.g, this.currentColor.b, 1);
            mat.uniforms.uOpacity.value = this.currentOpacity;
            const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
            mesh.scale.set(this.baseSizeX, this.baseSizeY, 1);
            this.backdropMat = mat;
            this.mesh = mesh;
            this.visualGroup.add(mesh);
            this._manager?.attachToBackdrop(this);
            this.updateTransform();
            return;
        }

        if (!texture) {
            // 无贴图（未导入/未提供）：全透明，不显示占位
            const g = new PlaneGeometry(1, 1);
            const m = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
            this.mesh = new Mesh(g, m);
            this.visualGroup.add(this.mesh);
            this.baseSizeX = 1;
            this.baseSizeY = 1;
        } else {
            if (this.config.imageSmoothing) {
                // 滤镜是采样期状态，无需 needsUpdate（那会强制整张纹理重新上传）。
                // mipmap 只有纹理本身声明了才可用，否则 WebGL2 下会得到未完成纹理（渲染发黑）。
                texture.magFilter = LinearFilter;
                texture.minFilter = texture.generateMipmaps ? LinearMipMapLinearFilter : LinearFilter;
            }
            // 用【原图】像素尺寸（sprite 原始尺寸）。texture.image 可能是被
            // TextureCompress 缩放过的版本，直接用它会把超限大图算小。
            const texW = (texture.userData as any)?.origWidth || texture.image?.width || 100;
            const texH = (texture.userData as any)?.origHeight || texture.image?.height || 100;
            this.baseSizeX = (texW / 100) * DECO_SIZE_SCALE;
            this.baseSizeY = (texH / 100) * DECO_SIZE_SCALE;

            // alpha 裁剪的**分析结果已经算好**（texture.userData.alphaCrop，见
            // analyzeAlphaCrop）；但启用它必须同时处理四条渲染路径（实例化的 pivot
            // 单位还没确认），否则会出现"UV 裁了、四边形没缩"的拉伸。先备好不动。
            this.cropOffX = 0;
            this.cropOffY = 0;

            // Overlay / SoftLight：需要采样背景，单独一遍渲染（见 BackdropBlend）。
            // 用普通 Mesh + 自定义 ShaderMaterial；world 变换仍由 three 常规管线处理。
            // backdrop pass 是在主场景之后整层叠上去的，所以只处理**轨道之前**（depth < 0）
            // 且无遮罩的装饰；背景层（depth ≥ 0）的仍走 Sprite 路径（退回 Normal 混合）。
            const bdMode = (this._manager?.backdropBlendEnabled
                && this.config.maskingType === MaskingType.None
                && (this.config.depth ?? 0) < 0)
                ? backdropBlendModeOf(this.config.blendMode)
                : BackdropBlendMode.None;
            if (bdMode !== BackdropBlendMode.None) {
                this.backdropMode = bdMode;
                const mat = createBackdropBlendMaterial(texture, bdMode);
                // Color 只有 RGB；颜色 alpha 已经并进 currentOpacity（= opacityProp × colorAlpha）
                (mat.uniforms.uColor.value as any).set(
                    this.currentColor.r, this.currentColor.g, this.currentColor.b, 1);
                mat.uniforms.uOpacity.value = this.currentOpacity;
                const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
                mesh.scale.set(this.baseSizeX, this.baseSizeY, 1);
                this.backdropMat = mat;
                this.mesh = mesh;
                this.visualGroup.add(mesh);
                this._manager?.attachToBackdrop(this);
                this._manager?.noteDecoExtent(
                    this.baseSizeX * Math.abs(this.config.scale[0]) / 200,
                    this.baseSizeY * Math.abs(this.config.scale[1]) / 200,
                );
                this.updateTransform();
                return;
            }

            // Instanced path for Image/Text (no masking). Mask decorations keep Sprite fallback.
            // Batch by texture+blend+renderOrder(-depth) so layering matches the sprite path.
            const canInstance = this.instRenderer
                && this.config.maskingType === MaskingType.None
                && isBatchableBlendMode(this.config.blendMode)
                && (this.config.decorationType === DecorationType.Image
                    || this.config.decorationType === DecorationType.Text);
            if (canInstance) {
                const [, ro] = this.depthZ();
                this.instSlot = this.instRenderer!.alloc(
                    texture, blend as Blending, ro,
                    this.baseSizeX, this.baseSizeY,
                    this.config.pivotOffset[0], this.config.pivotOffset[1],
                );
            } else {
                // 用 **Mesh（world 空间四边形）**，不用 Sprite：Sprite 永远面向相机、
                // 且**忽略父级/世界旋转** —— 装饰自身的 rotation、lockRotation、
                // 以及相机旋转都会失效（与 WebADOFAI/原版观感不同）。
                const mat = new MeshBasicMaterial({
                    map: texture, color: 0xffffff, transparent: true, opacity: this.currentOpacity,
                    blending: blend as Blending, depthWrite: false, side: DoubleSide,
                    // Silence THREE's MultiplyBlending premultipliedAlpha warning.
                    premultipliedAlpha: blend === MultiplyBlending,
                });
                // DecorationBlendMode → 固定管线可实现的部分（详见 applyDecoBlendMode）
                applyDecoBlendMode(mat, this.config.blendMode);
                // maskingTarget 为空时取 "NO TAG"（未打 tag 的那一组），不是"没有遮罩"。
                // → 空目标等价于 "NO TAG"（即"没有 tag 的装饰"这一组），不是"没有遮罩"。
                // 遮罩是否命中由 stencil（Mask 装饰写 ref、被遮罩的测 ref）决定：
                // 若该组里没有 Mask 装饰，测试永远失败 → 整张被裁掉（空 alpha mask 同理）。
                // stencil ref：按 key（目标名 + 深度范围）顺序分配（对齐 WAD）
                const stencilRef = this.maskStencilRef();
                if (this.config.maskingType === MaskingType.Mask) {
                    mat.colorWrite = false;
                    mat.depthWrite = false;
                    mat.stencilWrite = true;
                    mat.stencilRef = stencilRef;
                    mat.stencilFunc = AlwaysStencilFunc;
                    mat.stencilZPass = ReplaceStencilOp;
                } else if (this.config.maskingType === MaskingType.VisibleInsideMask) {
                    mat.stencilWrite = true;
                    mat.stencilRef = stencilRef;
                    mat.stencilFunc = EqualStencilFunc;
                    mat.stencilZPass = KeepStencilOp;
                } else if (this.config.maskingType === MaskingType.VisibleOutsideMask) {
                    mat.stencilWrite = true;
                    mat.stencilRef = stencilRef;
                    mat.stencilFunc = NotEqualStencilFunc;
                    mat.stencilZPass = KeepStencilOp;
                }
                const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
                mesh.scale.set(this.baseSizeX, this.baseSizeY, 1);
                this.mesh = mesh;
                this.visualGroup.add(mesh);
            }
        }
        // 贴图到位后真实尺寸已知 → 让静态网格查询外扩覆盖该装饰的画布范围
        this._manager?.noteDecoExtent(
            this.baseSizeX * Math.abs(this.config.scale[0]) / 200,
            this.baseSizeY * Math.abs(this.config.scale[1]) / 200,
        );
        this.updateTransform();
    }

    private clearVisual(): void {
        if (this.backdropMat) this._manager?.detachFromBackdrop(this);
        this.backdropMat = null;
        this.backdropMode = BackdropBlendMode.None;
        if (this.instSlot && this.instRenderer) {
            this.instRenderer.free(this.instSlot);
            this.instSlot = null;
        }
        if (this.mesh) { this.visualGroup.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as Material).dispose(); this.mesh = null; }
        if (this.sprite) { this.visualGroup.remove(this.sprite); (this.sprite.material as Material).dispose(); this.sprite = null; }
        if (this.objectGroup) { this.visualGroup.remove(this.objectGroup); this.objectGroup = null; }
        this.objTileMesh = null;
        this.objMask = null;
        this.objGeoKey = null;
        this.objTpl = null;
        this.objPlanetTex = null;
        if (this.iconSprite) { (this.iconSprite.material as Material).dispose(); this.iconSprite = null; }
        if (this.particles) { this.particles.dispose(); this.particles = null; }
        this.disposePlanetTrail();
    }

    /** Compute depth z + renderOrder from config.depth.
     *  SetDepth model: SortingLayer "Bg" (depth>=0) behind "Default"
     *  (depth<0); within a layer sortingOrder = -depth.
     *  Re maps the layer pair to renderOrder tiers around the tiles' 0
     *  (bg below, fg above) and the depth itself to a continuous z that the depth
     *  buffer resolves against tiles and other decorations — same mechanism as the
     *  per-instance tile layers (Player.setTileLayer).
     *  Bands (see also InstancedMeshManager.setTileLayer doc):
     *    bg:  z ∈ [-0.09 - d*0.1 .. -0.01 - d*0.1]  (top edge -0.01 stays below tiles)
     *    fg:  z ∈ [0.1 - d*0.1 .. 0.18 - d*0.1]     (bottom edge 0.1 stays above tiles)
     *  The ±0.08 rank span inside each step (updateZRank) never crosses a neighbouring
     *  depth step (gap 0.02). */
    /** 遮罩 stencil key（目标名 + 深度范围）。 */
    private maskStencilKey(): string {
        const name = (this.config.maskingTarget || NO_TAG_MASK).trim() || NO_TAG_MASK;
        if (this.config.useMaskingDepth) {
            const f = this.config.maskingFrontDepth ?? 0;
            const b = this.config.maskingBackDepth ?? 0;
            return `${name}:${Math.min(f, b)}:${Math.max(f, b)}`;
        }
        return name;
    }

    /** 该装饰的 stencil ref（0 = 不参与遮罩）。 */
    private maskStencilRef(): number {
        if (this.config.maskingType === MaskingType.None) return 0;
        return this._manager?.stencilRefFor?.(this.maskStencilKey()) ?? 0;
    }

    /**
     * 带遮罩分组的 renderOrder：
     * 无遮罩 → 原样；有遮罩 → 叠加 `ref * 0.001`（把同一 ref 的遮罩/被遮罩装饰聚在一起，
     * 对齐 WAD 的 `depth - 0.5 + ref*vx`），Mask 自身再低 0.0005 以保证先写入 stencil。
     * 基础值仍用我们原有的层级（不整体换空间，避免动到已经对的层叠）。
     */
    private maskedRenderOrder(roBase: number): number {
        const ref = this.maskStencilRef();
        if (ref <= 0) return roBase;
        return roBase + ref * 0.001 - (this.config.maskingType === MaskingType.Mask ? 0.0005 : 0);
    }

    public depthZ(): [number, number] {
        // SetDepth：switch 只处理 Floor / Planet，
        // PlayerBubble 不做任何排序变更（保持默认层级/顺序）。
        if (this.config.decorationType === DecorationType.Object
            && this.config.objectType === 'PlayerBubble') {
            return [0, 0];
        }
        // syncFloorDepth：继承父砖 sorting layer/order（复刻：贴父砖 z、归砖层 renderOrder）
        if (this._syncFloorZ !== null) return [this._syncFloorZ, 0];
        const d = this.config.depth;
        if (d < 0) return [0.1 - d * 0.1, -d];
        // Bg tier: strictly below the tiles' renderOrder 0, preserving -depth ordering.
        const tiles = this._manager?.levelData?.tiles;
        const n = Array.isArray(tiles) ? tiles.length : 0;
        const base = n > 0 ? -(n + 1) : -100000;
        return [-0.09 - d * 0.1, base - d];
    }

    /** Tie-break for decorations sharing the exact same base z (same depth value).
     *  Called once per frame for every decoration in creation order; the k-th
     *  decoration of a z-group gets k small upward steps so equal-depth overlaps
     *  deterministically render later-creation-on-top (creation-order
     *  stability), independent of batch allocation/migration order.
     *  Step 2e-4 ≫ ortho depth resolution (~6e-5); capped spread 0.08 fits inside
     *  each 0.1 depth step without crossing into the neighbouring band. */
    public updateZRank(counters: Map<number, number>): void {
        const [z] = this.depthZ();
        const rank = counters.get(z) ?? 0;
        counters.set(z, rank + 1);
        const off = Math.min(rank, 400) * 2e-4;
        if (off !== this._zRankOffset) {
            this._zRankOffset = off;
            this.container.position.z = z + off;
            if (this.instSlot) this.syncInstance();
        }
    }

    public syncInstance(): void {
        if (!this.instSlot || !this.instRenderer) return;
        const [z, ro] = this.depthZ();
        // depth changed (e.g. MoveDecorations) → migrate to correct renderOrder batch
        if (this.instSlot.renderOrder !== ro) {
            this.instSlot = this.instRenderer.ensureLayer(this.instSlot, ro);
        }
        const p = this.container.position;
        // Use currentScale × the multiplier last computed in updatePosition.
        // This keeps instanced writes in sync with the animated currentScale even if
        // updatePosition hasn't run this frame yet (static/culled decorations).
        const mulX = this._scaleMul;
        const mulY = this._scaleMulY;
        const sx = this.currentScale.x * mulX;
        const sy = this.currentScale.y * mulY;
        const rot = this.container.rotation.z;
        const vis = this._instVisible && (this.config.visible !== false);
        this.instRenderer.write(
            this.instSlot,
            p.x, p.y, z + this._zRankOffset,
            rot,
            sx, sy,
            this.currentColor,
            this.currentOpacity,
            vis,
        );
    }

    public updateTransform(): void {
        this.container.rotation.z = this.currentRotation * Math.PI / 180;
        const [z, roBase] = this.depthZ();
        const ro = this.maskedRenderOrder(roBase);
        this.container.position.set(this.currentPosition.x, this.currentPosition.y, z + this._zRankOffset);
        if (this.instSlot) {
            this.syncInstance();
            return;
        }
        if (this.mesh) {
            this.mesh.renderOrder = ro;
            if (this.backdropMat) {
                (this.backdropMat.uniforms.uColor.value as any).set(
                    this.currentColor.r, this.currentColor.g, this.currentColor.b, 1);
                this.backdropMat.uniforms.uOpacity.value = this.currentOpacity;
            } else {
                (this.mesh.material as MeshBasicMaterial).color.copy(this.currentColor);
                (this.mesh.material as MeshBasicMaterial).opacity = this.currentOpacity;
            }
        }
        if (this.sprite) { this.sprite.renderOrder = ro; (this.sprite.material as SpriteMaterial).color.copy(this.currentColor); (this.sprite.material as SpriteMaterial).opacity = this.currentOpacity; }
        if (this.iconSprite) {
            // 实例化模式下轨道本身在批次里（renderOrder 0），图标必须排在它之后；
            // 其余情况沿用按深度派生的层级。深度缓冲负责它和砖块的遮挡关系。
            this.iconSprite.renderOrder = this.objTpl ? 1 : ro + 1;
            (this.iconSprite.material as SpriteMaterial).opacity = this.currentOpacity;
        }
        // SetDepth：粒子 renderer 的 sortingOrder = -depth
        if (this.particles) this.particles.setRenderOrder(ro);
        // SetDepth：Planet 拖尾继承装饰的层级/顺序
        if (this.planetTrail) this.planetTrail.setDepthTier(z + this._zRankOffset, ro);
        // Object decorations: children renderers must inherit the decoration's
        // sorting tier (every child renderer's
        // sortingOrder = -depth); otherwise they default to 0 and draw in the
        // tile tier instead of their depth layer.
        if (this.objectGroup) {
            // Planet：本体 renderOrder 比拖尾高 1（拖尾 depthTest:false，否则会盖住球）。
            const childOrder = (this.config.decorationType === DecorationType.Object
                && this.config.objectType === 'Planet') ? ro + 1 : ro;
            for (const child of this.objectGroup.children) {
                (child as Mesh).renderOrder = childOrder;
            }
        }
    }

    public updatePosition(camPos: Vector3, camRot: number, camZoom: number, tilePositions?: Map<number, { x: number; y: number; z: number; sx: number; sy: number; rotation: number }>, adoZoom?: number, runtime?: DecorationRuntimeContext): void {
        // syncFloorDepth：继承父砖当前层级 z（SetDepth 用 parentFloor.sortingOrder）。
        if (this.config.syncFloorDepth && runtime?.tileLayerZ && this.config.floor !== undefined) {
            const tz = runtime.tileLayerZ[this.config.floor];
            this._syncFloorZ = (typeof tz === 'number' && isFinite(tz)) ? tz + 1e-4 : null;
        } else {
            this._syncFloorZ = null;
        }
        if (this._isStaticWorld) {
            // Parallax=0 → world-fixed: no camera displacement
            // (lockScale is guaranteed false here — see _isStaticWorld — so the
            // camScaleMul formula below never applies; keep scaleMultiplier only.)
            this.container.position.x = this.currentPosition.x;
            this.container.position.y = this.currentPosition.y;
            let camScaleMul = 1;
            camScaleMul *= this.config.scaleMultiplier;
            let floorScaleX = 1, floorScaleY = 1;
            if (this.config.stickToFloor && tilePositions?.has(this.config.floor ?? -1)) {
                const ts = tilePositions!.get(this.config.floor ?? -1)!;
                floorScaleX = ts.sx;
                floorScaleY = ts.sy;
            }
            this._scaleMul = camScaleMul * floorScaleX;
            this._scaleMulY = camScaleMul * floorScaleY;
            this.container.scale.set(this.currentScale.x * this._scaleMul, this.currentScale.y * this._scaleMulY, 1);
            if (this.instSlot) this.syncInstance();
            return;
        }
        // Camera model:
        //   orthographicSize = camsizenormal(5) × userSizeMultiplier × zoomSize
        //   - userSizeMultiplier: editor mouse-wheel "observer" zoom. Re's zoomMultiplier
        //     is a view-zoom factor (bigger = closer), while u is a size factor
        //     (smaller = closer) → userSizeMultiplier = 1 / editorWheelZoom.
        //   - zoomSize = current ADOFAI zoom (level settings baseline + MoveCamera
        //     events) ÷ 100.
        // Decoration lockScale (camScaleMultiplier):
        //   csm = orthoSize × 0.2 / (settingsCamZoom / 100) = adoZoom/(settingsZoom×wheel)
        const settingsZoom = this._manager?.levelData?.settings?.zoom || 100;
        const wheel = runtime?.editorWheelZoom && runtime.editorWheelZoom > 0 ? runtime.editorWheelZoom : 1;
        let camScaleMul = 1;
        if (this.config.lockScale && adoZoom && adoZoom > 0) {
            camScaleMul = adoZoom / (settingsZoom * wheel);
        }
        camScaleMul *= this.config.scaleMultiplier;
        let floorScaleX = 1, floorScaleY = 1;
        if (this.config.stickToFloor && tilePositions?.has(this.config.floor ?? -1)) {
            const ts = tilePositions!.get(this.config.floor ?? -1)!;
            floorScaleX = ts.sx;
            floorScaleY = ts.sy;
        }
        // SetScale: pivotTrans.localScale = scale × camScaleMultiplier × (stickToFloor ?
        // parentFloor.transform.localScale : 1)，逐轴相乘（非等比缩放的砖不能压成标量）。
        this._scaleMul = camScaleMul * floorScaleX;
        this._scaleMulY = camScaleMul * floorScaleY;
        // Parallax offset multiplier = decoration.camScaleMultiplier
        const parallaxOffsetMul = camScaleMul;
        const ct = this.config.relativeTo;
        let posX = 0, posY = 0;
        if (ct === DecPlacementType.Camera || ct === DecPlacementType.CameraAspect) {
            // 相机定位：像素坐标 → 世界坐标（UpdateScreenClamp + SetTrans 的屏幕锚定分支）
            // pixelX / 20 * viewWidth, then rotate by camera angle
            const viewH = 8 / camZoom;
            const aspect = runtime && runtime.viewportHeight > 0
                ? runtime.viewportWidth / runtime.viewportHeight
                : 16 / 9;
            const viewW = viewH * aspect;
            // UpdateScreenClamp + SetTrans(clampToScreen):
            //   screenRelativePos.x = pivotX/20 (+aspect pre-division for CameraAspect),
            //   worldOffsetX = screenRelX × pixelWidth × worldPerPixel.
            // Camera → X extent is the FULL view width; CameraAspect's pre-divided X makes
            // its effective X extent equal the view HEIGHT.
            const xExtent = ct === DecPlacementType.Camera ? viewW : viewH;
            // UpdateScreenClamp: screenRelativePos = (pivotPosVec + pivotOffsetVec)/20 + 0.5
            // —— 屏幕锚点用的是 pivotPos 与 pivotOffset 的【和】（复刻原来漏了 pivotOffset）。
            const screenX = this.currentPosition.x + this.config.pivotOffset[0];
            const screenY = this.currentPosition.y + this.config.pivotOffset[1];
            const worldOffsetX = screenX / 20 * xExtent;
            const worldOffsetY = screenY / 20 * viewH;
            const cosR = Math.cos(camRot);
            const sinR = Math.sin(camRot);
            const rotatedX = worldOffsetX * cosR - worldOffsetY * sinR;
            const rotatedY = worldOffsetX * sinR + worldOffsetY * cosR;
            posX = camPos.x + rotatedX + this.currentParallaxOffset.x * parallaxOffsetMul;
            posY = camPos.y + rotatedY + this.currentParallaxOffset.y * parallaxOffsetMul;
            // 旋转优先级与 SetRotation 相同：stickToFloor > lockRotation > 无
            if (this.config.stickToFloor && tilePositions?.has(this.config.floor ?? -1)) {
                const tp = tilePositions!.get(this.config.floor ?? -1)!;
                this.container.rotation.z = tp.rotation + this.currentRotation * Math.PI / 180;
            } else if (this.config.lockRotation) {
                this.container.rotation.z = camRot + this.currentRotation * Math.PI / 180;
            } else {
                this.container.rotation.z = this.currentRotation * Math.PI / 180;
            }
        } else {
            let followOffsetX = 0, followOffsetY = 0;
            const followCt = this._followOverride ?? ct;
            if (followCt === DecPlacementType.Player) {
                // 原版 relativeTo: Player → 跟随玩家控制的球（position 是相对球的偏移）
                const pp = runtime?.playerPosition;
                if (pp && !runtime?.paused) {
                    followOffsetX = pp.x;
                    followOffsetY = pp.y;
                }
            } else if (followCt === DecPlacementType.RedPlanet || followCt === DecPlacementType.BluePlanet || followCt === DecPlacementType.GreenPlanet) {
                const planet = runtime?.planetPositions?.[followCt];
                // paused 时 planet follow 归零。
                if (planet && !runtime?.paused) {
                    followOffsetX = planet.x;
                    followOffsetY = planet.y;
                }
            }
            let stickOffsetX = 0, stickOffsetY = 0;
            if (this.config.stickToFloor && tilePositions?.has(this.config.floor ?? -1)) {
                const tp = tilePositions!.get(this.config.floor ?? -1)!;
                stickOffsetX = tp.x - this.startPos.x;
                stickOffsetY = tp.y - this.startPos.y;
            }
            // UpdatePosition + SetTrans:
            //   decoBase = pivotPos + planetFollow + stickToFloor offset;
            //   final = decoBase + (camPos − decoBase) × parallax + parallaxOffset × csm
            // Both interpolation anchors are decoBase itself (posCamAtStart == startPosition).
            const baseX = this.currentPosition.x + followOffsetX + stickOffsetX;
            const baseY = this.currentPosition.y + followOffsetY + stickOffsetY;
            const px = (camPos.x - baseX) * this.currentParallax.x;
            const py = (camPos.y - baseY) * this.currentParallax.y;
            posX = baseX + px + this.currentParallaxOffset.x * parallaxOffsetMul;
            posY = baseY + py + this.currentParallaxOffset.y * parallaxOffsetMul;
            // Rotation priority: stickToFloor (floor rot) > lockRotation (camera rot) > none
            if (this.config.stickToFloor && tilePositions?.has(this.config.floor ?? -1)) {
                const tp = tilePositions!.get(this.config.floor ?? -1)!;
                this.container.rotation.z = tp.rotation + this.currentRotation * Math.PI / 180;
            } else if (this.config.lockRotation) {
                this.container.rotation.z = camRot + this.currentRotation * Math.PI / 180;
            } else {
                this.container.rotation.z = this.currentRotation * Math.PI / 180;
            }
        }
        this.container.position.x = posX;
        this.container.position.y = posY;
        this.container.scale.set(this.currentScale.x * this._scaleMul, this.currentScale.y * this._scaleMulY, 1);
        if (this.instSlot) this.syncInstance();
    }

    public setCulledVisible(vis: boolean): void {
        this._culledVisible = vis;
        const effective = vis && (this.config.visible !== false) && this.currentOpacity > 0.001;
        if (this._instVisible !== effective) {
            this._instVisible = effective;
            this.container.visible = effective;
            // 只有可见性**变化**时才需要重写实例数据：可见装饰的变换由 updatePosition
            // 里的 syncInstance 负责，长期被剔除的装饰不必每帧再写一遍。
            if (this.instSlot) this.syncInstance();
        }
        // Planet 装饰拖尾（世界坐标，独立于 container 变换）
        if (this.planetTrail && effective) {
            this._updatePlanetTrail(this._manager ? (this._manager.currentTime || 0) : 0);
        } else if (this.planetTrail) {
            if (this._trailBuilt) { this.planetTrail.clear(); this._trailBuilt = false; this._trailBuiltN = 0; }
        }
    }

    /** 创建与玩家 Planet 相同的拖尾（ribbon 挂在 manager 容器，使用世界坐标）。 */
    public initPlanetTrail(color: Color, parent: Group): void {
        this.disposePlanetTrail();
        const trail = new PlanetTrail(color, PLANET_BODY_RADIUS);
        parent.add(trail.mesh);
        this.planetTrail = trail;
        this._trailHead = 0;
        this._trailCount = 0;
        this._trailBuilt = false;
        this._trailBuiltN = 0;
    }

    public setPlanetTrailColor(color: Color): void {
        this.planetTrail?.setColor(color);
    }

    public disposePlanetTrail(): void {
        if (!this.planetTrail) return;
        const mesh = this.planetTrail.mesh;
        if (mesh.parent) mesh.parent.remove(mesh);
        this.planetTrail.dispose();
        this.planetTrail = null;
        this._trailHead = 0;
        this._trailCount = 0;
        this._trailBuilt = false;
        this._trailBuiltN = 0;
    }

    public resetPlanetTrail(): void {
        this._trailHead = 0;
        this._trailCount = 0;
        this._trailBuilt = false;
        this._trailBuiltN = 0;
        this.planetTrail?.clear();
    }

    /** 记录本帧世界位置并按 Player.computePlanetTrails 的窗口重建拖尾。 */
    private _updatePlanetTrail(now: number): void {
        const trail = this.planetTrail;
        if (!trail) return;
        const x = this.container.position.x;
        const y = this.container.position.y;
        // 只在位置有明显变化时记录，避免静止时堆叠成退化“坨”
        const lastIdx0 = this._trailCount > 0 ? (this._trailHead - 1 + PLANET_TRAIL_HIST) % PLANET_TRAIL_HIST : -1;
        const moved = lastIdx0 < 0
            || Math.abs(this._trailHist[lastIdx0 * 2] - x) > 0.0005
            || Math.abs(this._trailHist[lastIdx0 * 2 + 1] - y) > 0.0005;
        if (moved) {
            const head = this._trailHead;
            this._trailHist[head * 2] = x;
            this._trailHist[head * 2 + 1] = y;
            this._trailHistTime[head] = now;
            this._trailHead = (head + 1) % PLANET_TRAIL_HIST;
            if (this._trailCount < PLANET_TRAIL_HIST) this._trailCount++;
        }
        const minT = now - PLANET_TRAIL_DURATION;
        const lastIdx = (this._trailHead - 1 + PLANET_TRAIL_HIST) % PLANET_TRAIL_HIST;
        let n = 0;
        for (let i = 0; i < this._trailCount && n < PLANET_TRAIL_MAX_POINTS; i++) {
            const idx = (lastIdx - i + PLANET_TRAIL_HIST) % PLANET_TRAIL_HIST;
            if (this._trailHistTime[idx] < minT) break;
            n++;
        }
        if (n < 2) {
            if (this._trailBuilt) { trail.clear(); this._trailBuilt = false; this._trailBuiltN = 0; }
            return;
        }
        // 未移动且采样点数不变时输出完全相同，跳过重建（避免每帧重复分配）
        if (!moved && this._trailBuilt && n === this._trailBuiltN) return;
        const arr = new Float64Array(n * 2);
        for (let i = 0; i < n; i++) {
            const idx = (lastIdx - i + PLANET_TRAIL_HIST) % PLANET_TRAIL_HIST;
            const k = (n - 1 - i) * 2;
            arr[k] = this._trailHist[idx * 2];
            arr[k + 1] = this._trailHist[idx * 2 + 1];
        }
        trail.setPoints(arr);
        trail.mesh.position.set(0, 0, 0);
        this._trailBuilt = true;
        this._trailBuiltN = n;
    }

    public updateAnimation(now: number, tm?: TimelineManager): void {
        if (!tm) return;
        try {
            this.updateAnimationInner(now, tm);
        } catch (err) {
            // 单个装饰物采样异常不影响整体
            console.error('[Decoration] updateAnimation error', this.config.tag, err);
        }
    }

    private updateAnimationInner(now: number, tm: TimelineManager): void {
        // 每装饰独立时间轴：deco:{id}
        const kv = this.config.id ? `deco:${this.config.id}` : '';
        if (!kv) return;
        // 该装饰实际拥有时间轴的属性（惰性缓存）。完全没有时间轴时直接跳过，
        // 避免每帧对 2 万+ 装饰各做数十次无用的 Map 查找/二分。
        if (this._animProps === null) this._animProps = tm.getProperties(kv);
        const props = this._animProps;
        if (props.size === 0) return;
        const has = (p: string): boolean => props.has(p);
        let dirty = false;

        const sampleAny = (prop: string): number | undefined => has(prop) ? tm.sample(kv, prop, now) : undefined;
        const sampleAnyDiscrete = (prop: string): string | boolean | number | undefined => has(prop) ? tm.sampleDiscrete(kv, prop, now) : undefined;

        // 数值动画属性
        const px = sampleAny('positionX');
        if (px !== undefined) { this.currentPosition.x = px; this.pivotPos.x = px; dirty = true; }
        const py = sampleAny('positionY');
        if (py !== undefined) { this.currentPosition.y = py; this.pivotPos.y = py; dirty = true; }
        const rot = sampleAny('rotation');
        if (rot !== undefined) { this.currentRotation = this.config.rotation + rot; dirty = true; }
        const sx = sampleAny('scaleX');
        const sy = sampleAny('scaleY');
        if (this.config.decorationType === DecorationType.Particle) {
            // SetScale：粒子 scale 只改 shape.scale（发射区域），
            // transform 不缩放。原来这里直接 skip，导致 MoveDecorations 缩放粒子无效。
            if ((sx !== undefined || sy !== undefined) && this.particles) {
                this.particles.setShapeScale(sx, sy);
            }
        } else {
            if (sx !== undefined) { this.currentScale.x = sx; dirty = true; }
            if (sy !== undefined) { this.currentScale.y = sy; dirty = true; }
        }
        const op = sampleAny('opacity');
        if (op !== undefined) {
            this._opacityProp = op;
            // Object 的最终 alpha 走 trackOpacity/planetColor（GetAlpha），
            // Image/Text/Particle 才用 color.a × opacity 合成。
            if (this.config.decorationType === DecorationType.Object) this.currentOpacity = op;
            else this.recomputeOpacity();
            dirty = true;
        }
        const parX = sampleAny('parallaxX');
        if (parX !== undefined) { this.currentParallax.x = parX; dirty = true; }
        const parY = sampleAny('parallaxY');
        if (parY !== undefined) { this.currentParallax.y = parY; dirty = true; }
        const pox = sampleAny('parallaxOffsetX');
        if (pox !== undefined) { this.currentParallaxOffset.x = pox; dirty = true; }
        const poy = sampleAny('parallaxOffsetY');
        if (poy !== undefined) { this.currentParallaxOffset.y = poy; dirty = true; }
        // 运行期 parallax/parallaxOffset 变化可能改变静态/动态归类（每帧重算）。
        if (parX !== undefined || parY !== undefined || pox !== undefined || poy !== undefined) {
            const wasStatic = this._isStaticWorld;
            this.refreshStaticWorld();
            if (wasStatic !== this._isStaticWorld) this._manager?.reclassify(this);
        }

        // color (RGB) + alpha 通道（tween 的是整个 Color，含 a）
        const cr = sampleAny('colorR');
        const cg = sampleAny('colorG');
        const cb = sampleAny('colorB');
        if (cr !== undefined) { this.currentColor.r = cr; dirty = true; }
        if (cg !== undefined) { this.currentColor.g = cg; dirty = true; }
        if (cb !== undefined) { this.currentColor.b = cb; dirty = true; }
        const ca = sampleAny('colorA');
        if (ca !== undefined) {
            this._colorAlpha = ca;
            if (this.config.decorationType !== DecorationType.Object) this.recomputeOpacity();
            dirty = true;
        }

        // pivot offset（视觉支点，决定 visualGroup 的偏移）
        const pvx = sampleAny('pivotOffsetX');
        const pvy = sampleAny('pivotOffsetY');
        if (pvx !== undefined) { this.visualGroup.position.x = pvx; dirty = true; }
        if (pvy !== undefined) { this.visualGroup.position.y = pvy; dirty = true; }
        if ((pvx !== undefined || pvy !== undefined) && this.instSlot && this.instRenderer) {
            this.instRenderer.updatePivot(this.instSlot, this.visualGroup.position.x, this.visualGroup.position.y);
        }

        // 离散即时属性
        const img = sampleAnyDiscrete('image');
        if (typeof img === 'string' && img !== this._lastImage) {
            this._lastImage = img;
            this.config.decorationImage = img;
            if (this._manager && (this.config.decorationType === DecorationType.Image
                || this.config.decorationType === DecorationType.Particle
                || this.config.decorationType === DecorationType.Text)) {
                this._manager.applyImageTo(this, img);
            }
        }
        const dpt = sampleAnyDiscrete('depth');
        if (typeof dpt === 'number' && dpt !== this.config.depth) {
            this.config.depth = dpt;
            dirty = true;
        }
        // SetPlacementType (MoveDecorations: movementTypeUsed &&
        // movementType != LastPosition → dec.SetPlacementType(movementType)): a
        // MoveDecorations event re-parents the decoration mid-level. startPos is
        // re-derived from the SOURCE event's position interpreted in the NEW frame,
        // and the RENDER branch follows: SetPlacementType changes placementType, and
        // the position/pivot tweens call SetPosition → UpdateScreenClamp, which flips
        // parallax.clampToScreen for Camera/CameraAspect. So the screen- vs
        // world-anchored branch MUST switch with the event.
        const plc = sampleAnyDiscrete('placement');
        if (typeof plc === 'string' && this._manager) {
            const np = this._manager.parsePlacement(plc);
            const cur = this._currentPlacement ?? this.config.relativeTo;
            if (np !== cur || this._followOverride !== null) {
                if (!this._placementChanged) {
                    this._originalRelativeTo = this.config.relativeTo;
                    this._originalStartPos.copy(this.startPos);
                    this._placementChanged = true;
                }
                if (np !== cur) {
                    const ev: any = this.sourceEvent || {};
                    const rawPos: [number, number] = Array.isArray(ev.position)
                        ? [Number(ev.position[0]) || 0, Number(ev.position[1]) || 0]
                        : [0, 0];
                    // Tile 参考系要用运行期地板位置（transform.position，含 MoveTrack）
                    let liveTile: { x: number; y: number } | null = null;
                    if (np === DecPlacementType.Tile && this.config.floor !== undefined) {
                        const lx = tm.sample(`tile:${this.config.floor}`, 'positionX', now);
                        const ly = tm.sample(`tile:${this.config.floor}`, 'positionY', now);
                        if (lx !== undefined && ly !== undefined) liveTile = { x: lx, y: ly };
                    }
                    this.startPos.copy(this._manager.computeStartPos(
                        rawPos, np, this.config.anchorFloor ?? this.config.floor, liveTile));
                }
                this._currentPlacement = np;
                // 同步参考系 → refreshStaticWorld/updatePosition 的渲染分支随之变化
                if (this.config.relativeTo !== np) this.config.relativeTo = np;
                this._followOverride = (np === DecPlacementType.RedPlanet
                    || np === DecPlacementType.BluePlanet
                    || np === DecPlacementType.GreenPlanet) ? np : null;
                this.refreshStaticWorld();
                this._manager.reclassify(this);
                dirty = true;
            }
        }
        const vis = sampleAnyDiscrete('visible');
        if (typeof vis === 'boolean' && vis !== this.config.visible) {
            this.config.visible = vis;
            // 重新合成可见性（culling && user-visible）
            this.setCulledVisible(this._culledVisible);
            if (this.particles) {
                this.particles.setVisible(vis);
                if (vis) { this.particles.play(); }
                else { this.particles.stop(); }
            }
        }
        // 遮罩：MoveDecorations 可改 maskingType / useMaskingDepth /
        // maskingFrontDepth / maskingBackDepth（maskingTarget 的 Decode 从未赋值 → 死字段）。
        const mT = sampleAnyDiscrete('maskingType');
        const mUd = sampleAnyDiscrete('useMaskingDepth');
        const mFd = sampleAnyDiscrete('maskingFrontDepth');
        const mBd = sampleAnyDiscrete('maskingBackDepth');
        let maskDirty = false;
        if (typeof mT === 'string' && mT !== this.config.maskingType) { this.config.maskingType = mT as MaskingType; maskDirty = true; }
        if (typeof mUd === 'boolean' && mUd !== this.config.useMaskingDepth) { this.config.useMaskingDepth = mUd; maskDirty = true; }
        if (typeof mFd === 'number' && mFd !== this.config.maskingFrontDepth) { this.config.maskingFrontDepth = mFd; maskDirty = true; }
        if (typeof mBd === 'number' && mBd !== this.config.maskingBackDepth) { this.config.maskingBackDepth = mBd; maskDirty = true; }
        if (maskDirty && this._manager) this._manager.applyMaskTo(this);

        // SetText / SetObject 离散属性
        const txt = sampleAnyDiscrete('text');
        if (typeof txt === 'string' && txt !== this._lastText) {
            this._lastText = txt;
            if (this._manager && this.config.decorationType === DecorationType.Text) {
                this._manager.applyTextTo(this, txt);
            }
        }
        // SetObject 颜色组：tween 的 6 条 RGB 通道 → 逐帧重算 Object(Floor) 顶点色
        const tcR = sampleAny('trackColorR');
        const tcG = sampleAny('trackColorG');
        const tcB = sampleAny('trackColorB');
        const tc2R = sampleAny('trackColor2R');
        const tc2G = sampleAny('trackColor2G');
        const tc2B = sampleAny('trackColor2B');
        if (tcR !== undefined || tcG !== undefined || tcB !== undefined
            || tc2R !== undefined || tc2G !== undefined || tc2B !== undefined) {
            if (tcR !== undefined) this.objColor1.r = tcR;
            if (tcG !== undefined) this.objColor1.g = tcG;
            if (tcB !== undefined) this.objColor1.b = tcB;
            if (tc2R !== undefined) this.objColor2.r = tc2R;
            if (tc2G !== undefined) this.objColor2.g = tc2G;
            if (tc2B !== undefined) this.objColor2.b = tc2B;
            // 同步 config，供后续 SetObject 重建时保持当前色
            this.config.trackColor = '#' + this.objColor1.getHexString();
            this.config.trackColor2 = '#' + this.objColor2.getHexString();
            if (this._manager) this._manager.applyObjectFloorColors(this);
            dirty = true;
        }
        // Object(Floor) 的动画颜色类型（Glow/Blink/Switch/Rainbow/Volume）随时间变化，
        // 需要每帧用 TileColorManager 的相位模型重算顶点色（地板的脉冲）。
        if (this.config.decorationType === DecorationType.Object && this.objColorAnimated && this.objTileMesh) {
            this._manager?.applyObjectFloorColors(this);
        }

        // SetObject：统一收集所有变化的属性，一次性重建 Object 视觉。
        // 比较对象是 config（applyObjectPropsTo 会写回 config），无需额外缓存字段。
        const objProps: Record<string, unknown> = {};
        const setObj = (prop: string, key: string): void => {
            const v = sampleAnyDiscrete(prop);
            if (v === undefined) return;
            if ((this.config as any)[key] === v) return;
            objProps[key] = v;
        };
        setObj('planetColor', 'planetColor');
        setObj('planetTailColor', 'planetTailColor');
        setObj('trackColor', 'trackColor');
        setObj('trackColor2', 'trackColor2');
        setObj('trackOpacity', 'trackOpacity');
        setObj('trackIcon', 'trackIcon');
        setObj('trackStyle', 'trackStyle');
        setObj('trackAngle', 'trackAngle');
        setObj('trackColorType', 'trackColorType');
        setObj('trackColorAnimDuration', 'trackColorAnimDuration');
        setObj('trackIconAngle', 'trackIconAngle');
        setObj('trackIconFlipped', 'trackIconFlipped');
        setObj('trackRedSwirl', 'trackRedSwirl');
        setObj('trackGraySetSpeedIcon', 'trackGraySetSpeedIcon');
        setObj('trackGlowEnabled', 'trackGlowEnabled');
        setObj('trackGlowColor', 'trackGlowColor');
        setObj('trackIconOutlines', 'trackIconOutlines');
        if (Object.keys(objProps).length > 0 && this._manager) {
            this._manager.applyObjectPropsTo(this, objProps as any);
        }

        if (dirty) this.updateTransform();
    }

    public reset(): void {
        this.config.visible = this.originalVisible;
        this.config.depth = this.originalDepth;
        // 恢复 SetPlacementType 变更前的参考系与 startPos
        if (this._placementChanged) {
            this.config.relativeTo = this._originalRelativeTo;
            this.startPos.copy(this._originalStartPos);
            this._followOverride = null;
            this._currentPlacement = null;
            this.refreshStaticWorld();
            this._placementChanged = false;
        }
        this.currentScale.set(this.config.scale[0] / 100, this.config.scale[1] / 100);
        if (this.config.decorationType === DecorationType.Particle) this.currentScale.set(1, 1);
        this.currentRotation = this.config.rotation + this.config.rotationOffset;
        const [colorHex, colorAlpha] = parseDecoColor(this.config.color);
        this.currentColor.set(colorHex);
        this._opacityProp = this.config.opacity / 100;
        this._colorAlpha = colorAlpha;
        this.recomputeOpacity();
        this.currentPosition.copy(this.startPos);
        this.pivotPos.copy(this.startPos);
        this.currentParallax.set(this.config.parallax[0] / 100, this.config.parallax[1] / 100);
        this.currentParallaxOffset.set(this.config.parallaxOffset[0], this.config.parallaxOffset[1]);
        this.visualGroup.position.set(this.config.pivotOffset[0], this.config.pivotOffset[1], 0);
        if (this.instSlot && this.instRenderer) {
            this.instRenderer.updatePivot(this.instSlot, this.config.pivotOffset[0], this.config.pivotOffset[1]);
        }
        // 清采样缓存：重置后下一帧 updateAnimation 会重新采样应用到当前状态
        this._lastImage = null;
        this._lastText = null;
        this._lastPlanetColor = null;
        this._lastPlanetTailColor = null;
        this._lastTrackColor = null;
        this._lastTrackOpacity = null;
        this._lastTrackIcon = null;
        this.resetPlanetTrail();
        this.container.visible = this.originalVisible;
        this._instVisible = this.originalVisible;
        this.updateTransform();
    }

    public dispose(): void {
        this.clearVisual();
    }
}

export class DecorationManager {
    private scene: Scene;
    private container: Group;
    private levelData: any;
    private tileStartTimes: number[];
    private tileBPM: number[];
    private decorations: Map<string, DecorationInstance> = new Map();
    private decoList: DecorationInstance[] = [];
    /**
     * Overlay / SoftLight 装饰单独放一个场景：它们不能和主场景一起画（那时背景还没画完），
     * 必须在主场景渲染完、背景可作为纹理采样之后，再单独渲染一遍。
     */
    private backdropScene: Scene = new Scene();
    private backdropGroup: Group = new Group();
    private backdropDecos: DecorationInstance[] = [];
    /** 是否启用 backdrop pass（Player 按渲染后端设置：仅 WebGL 支持）。 */
    public backdropBlendEnabled = false;
    /** 有逐帧时间轴的装饰（refreshAnimatedDecos 预算；每帧只遍历这一小撮）。 */
    private _animatedDecos: DecorationInstance[] = [];

    /**
     * 预算「哪些装饰有逐帧时间轴」。
     * 必须在所有装饰创建完成、且 _timelineManager 赋值之后调用（Player 在
     * buildTimelineKeyframes 之后调用）。
     */
    public refreshAnimatedDecos(): void {
        this._animatedDecos = [];
        if (!this._timelineManager) return;
        const list = this.decoList;
        for (let i = 0; i < list.length; i++) {
            const d = list[i];
            const has = this._timelineManager.hasAnyTimeline(`deco:${d.config.id}`);
            d.hasTimeline = has;
            if (has) this._animatedDecos.push(d);
        }
    }
    private taggedDecorations: Map<string, DecorationInstance[]> = new Map();
    private decorationEventsTimeline: { time: number; event: any }[] = [];
    private pendingDecorationEvents: any[] = [];
    // 装饰事件源（AddDecoration/AddText/AddObject/AddParticle）与分帧创建游标
    private _decoSources: any[] = [];
    private _materializeIndex = 0;
    private tileSize: number = 1.0;
    /**
     * 歌曲 pitch（settings.pitch 百分比，默认 1）。
     * crotchet = 60/(bpm*pitch*speed)，tileBPM 只含 speed，
     * 所以 MoveDecorations 的 duration 要再 /pitch（见 buildDecorationEventsTimeline）。
     */
    private songPitch: number = 1.0;
    /** 装饰纹理仓：兜底贴图 + 代次 + 限并发（见 DecorationTextures.ts）。 */
    private textures = new DecorationTextureStore();
    /** Object(Floor) 的实例化批次（见 ObjectFloorBatch.ts）。 */
    public objectFloorBatch: ObjectFloorBatchManager | null = null;
    /** 批次需要重刷一次（新建装饰后，即使相机没动也要写一遍实例数据）。 */
    private _objFloorDirty = true;
    private floorGeoCache: Map<string, { positions: Float32Array; indices: Uint32Array; mask: Float32Array; vertexCount: number }> = new Map();
    private trailGeoCache: Map<string, Mesh> = new Map();
    private customImages: Map<string, string> = new Map();
    private _lastCamX = 0; private _lastCamY = 0; private _lastCamZoom = 0;
    /** 上一帧相机旋转（屏幕锚定/lockRotation 装饰必须随旋转重算）。 */
    private _lastCamRot = NaN;
    private _lastNow = 0;
    /** 当前播放时间（秒），供 DecorationInstance 的 Planet 拖尾采样使用 */
    public currentTime = 0;
    /** Object(Floor) 装饰的颜色类型/脉冲复用主 TileColorManager 的颜色模型（Player 注入）。 */
    public tileColorManager: TileColorManager | null = null;
    /** Object(Floor) 的旋转图标（Swirl/Twirl）贴图变体 + 角度（Player 注入，与普通砖同源）。 */
    public tileTwirlIconInfoProvider: ((floor: number) => { texture: IconType; angle: number }) | null = null;
    private _particlesStarted: Set<DecorationInstance> = new Set();
    private _timelineManager: TimelineManager | null = null;
    private _staticGrid: DecorationSpatialGrid = new DecorationSpatialGrid(32);
    private _staticDecos: DecorationInstance[] = [];
    private _dynamicDecos: DecorationInstance[] = [];
    // 网格按锚点索引：锚点在视口外但画布巨大的装饰必须靠查询范围外扩才不会被
    // 误剔除。该值随观察到的最大半宽/半高增长（美术图常达数千单位）。
    private _staticQueryPad = 8;
    private _tilePositions: Map<number, { x: number; y: number; z: number; sx: number; sy: number; rotation: number }> = new Map();
    // Floors referenced by stickToFloor decorations this frame (avoids sampling all tiles)
    private _stickFloors: Set<number> = new Set();
    private _visibleStaticSet: Set<DecorationInstance> = new Set();
    // base z → rank counter, rebuilt each frame for same-depth tie-breaking
    private _rankCounters: Map<number, number> = new Map();
    private instancedRenderer: DecorationInstancedRenderer;

    /** 记录观察到的装饰最大半宽/半高，用于扩展静态网格查询范围。 */
    public noteDecoExtent(hw: number, hh: number): void {
        const need = Math.max(hw, hh) * 1.2 + 2;
        if (need > this._staticQueryPad) this._staticQueryPad = need;
    }

    constructor(scene: Scene, levelData: any, tileStartTimes: number[], tileBPM: number[]) {
        this.scene = scene;
        this.levelData = levelData;
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
        const s = levelData.settings || {};
        // 装饰物的所有世界单位（position / positionOffset / parallaxOffset / pivotOffset）
        // 都由 tileSize 推导，统一乘换算系数（世界→ADOJAS），和装饰尺寸保持一致。
        this.tileSize = (s.tileShape === 'Long' ? 1.5 : 1.0) * DECO_POSITION_SCALE;
        this.songPitch = s.pitch != null && isFinite(Number(s.pitch))
            ? Math.max(0.1, Number(s.pitch) / 100)
            : 1.0;
        this.container = new Group();
        this.container.name = 'DecorationContainer';
        this.scene.add(this.container);
        this.instancedRenderer = new DecorationInstancedRenderer(this.container);
        if (USE_OBJECT_FLOOR_BATCH) {
            this.objectFloorBatch = new ObjectFloorBatchManager(this.container);
        }
        // 背景混合（Overlay/SoftLight）装饰的独立场景，单独渲染一遍。
        this.backdropGroup.name = 'BackdropBlendContainer';
        this.backdropScene.add(this.backdropGroup);
    }

    private static isDecoEvent(dec: any): boolean {
        return !!dec && (dec.eventType === 'AddDecoration' || dec.eventType === 'AddText'
            || dec.eventType === 'AddObject' || dec.eventType === 'AddParticle');
    }

    /** 收集所有装饰事件源（只登记，不创建 THREE 实例）。 */
    public collectDecoSources(): void {
        this._decoSources = [];
        this._materializeIndex = 0;
        const rootDecos = this.levelData.decorations || (this.levelData as any).__decorations || [];
        const tiles = this.levelData.tiles || [];

        for (const dec of rootDecos) {
            if (DecorationManager.isDecoEvent(dec)) this._decoSources.push(dec);
        }
        for (const tile of tiles) {
            if (tile.addDecorations) {
                const floor = tile.seqID ?? tiles.indexOf(tile);
                for (const dec of tile.addDecorations) {
                    if (DecorationManager.isDecoEvent(dec)) {
                        this._decoSources.push({ ...dec, floor: dec.floor ?? floor });
                    }
                }
            }
        }
    }

    public get decoSourceCount(): number { return this._decoSources.length; }
    public get materializedCount(): number { return this._materializeIndex; }

    /** 控制整棵装饰物容器的可见性（分帧加载期间隐藏，避免半成品闪现在原点）。 */
    public setRootVisible(v: boolean): void {
        this.container.visible = v;
    }

    /** 分帧创建：最多创建 count 个装饰实例，返回是否仍有剩余。 */
    public materializeChunk(count: number): boolean {
        const end = Math.min(this._decoSources.length, this._materializeIndex + Math.max(1, count));
        for (; this._materializeIndex < end; this._materializeIndex++) {
            this.tryCreateDecoration(this._decoSources[this._materializeIndex]);
        }
        return this._materializeIndex < this._decoSources.length;
    }

    /** 创建完成后收尾：构建装饰事件时间轴 + 日志。 */
    public finishMaterialize(): void {
        this.buildDecorationEventsTimeline();
        debugLog('[DecorationManager] Spatial grid Patch: enabled | total=' + this.decoList.length
            + ' static=' + this._staticDecos.length
            + ' dynamic=' + this._dynamicDecos.length
            + ' cells=' + this._staticGrid.lastQueryCount
            + ' cellSize=' + 32);
    }

    public init(): void {
        this.clear();
        this.collectDecoSources();
        while (this.materializeChunk(4096)) { /* drain synchronously */ }
        this.finishMaterialize();
    }

    public buildTimelineKeyframes(tm: TimelineManager): void {
        const ts = this.tileSize;
        const entries = this.decorationEventsTimeline;

        // tag → 事件索引。否则每个装饰都要扫描完整事件表，复杂度 O(decos × events)，
        // 大关卡（上万装饰 × 数万事件）会直接卡死。事件顺序与 entries 一致；
        // 单个事件含多个 tag 时会进入多个列表。
        const byTag = new Map<string, { time: number; event: any }[]>();
        for (const entry of entries) {
            const event = entry.event;
            if (!isEventActive(event)) continue;
            const tags = (event.tag || 'NO TAG').split(/\s+/).filter(Boolean);
            for (const tg of tags) {
                let list = byTag.get(tg);
                if (!list) { list = []; byTag.set(tg, list); }
                list.push(entry);
            }
        }

        // 每个装饰独立时间轴（deco:{id}），事件按 tag 匹配展开到各装饰，
        // 目标值基于装饰自身初始值计算——同 tag 不同 scale/position 的装饰互不影响。
        for (const deco of this.decoList) {
            const kv = `deco:${deco.config.id}`;
            const decoTags = (deco.config.tag || 'NO TAG').split(/\s+/).filter(Boolean);
            // 该装饰匹配到的事件（多 tag 时合并去重并按时间排序）
            let matched: { time: number; event: any }[];
            if (decoTags.length === 1) {
                matched = byTag.get(decoTags[0]) || [];
            } else {
                const seen = new Set<any>();
                matched = [];
                for (const tg of decoTags) {
                    const list = byTag.get(tg);
                    if (!list) continue;
                    for (const e of list) {
                        if (seen.has(e)) continue;
                        seen.add(e);
                        matched.push(e);
                    }
                }
                matched.sort((a, b) => a.time - b.time);
            }

            const [baseColorHex] = parseDecoColor(deco.config.color, 'ffffff');
            const [baseCR, baseCG, baseCB] = hexToRGB01(baseColorHex);
            // opacity 与 color 的 alpha 是两条独立时间轴（前者 SetOpacity、后者 color.a），
            // 最终 alpha 时相乘（见 DecorationInstance.recomputeOpacity）。
            const baseCA = parseDecoColor(deco.config.color, 'ffffff')[1];
            const baseOp0 = deco.config.opacity / 100;
            const basePosX = deco.startPos.x;
            const basePosY = deco.startPos.y;
            // Events trigger chronologically at runtime: once a SetPlacementType
            // changes the reference frame, later position tweens end at the
            // RE-DERIVED startPos (SetPlacementType),
            // not the original spawn one. Track it while building.
            let curStartX = basePosX;
            let curStartY = basePosY;

            for (const entry of matched) {
                const { time: eventTime, event } = entry;

                // SetText / SetObject：离散轨（decText / 物体属性）
                if (event.eventType === 'SetText') {
                    tm.addDiscreteKeyframe(kv, 'text', eventTime, String(event.decText ?? ''));
                    continue;
                }
                if (event.eventType === 'SetObject') {
                    // SetObject 解码：duration = duration * crotchet。
                    const soBpm = this.tileBPM[event.floor ?? 0] || 100;
                    const soDur = ((event.duration || 0) * 60 / soBpm) / this.songPitch;
                    const soHasDur = soDur > 0;
                    const soEnd = eventTime + soDur;
                    const soEase = event.ease || 'Linear';
                    // SetFloorColor：trackColor/secondaryTrackColor 是颜色组 tween
                    // （先 kill-complete 旧 Color tween）。复刻用 6 条 RGB keyframe，
                    // 逐帧重算 Object(Floor) 顶点色（applyObjectFloorColors）。
                    const t1Used = event.trackColor !== undefined && !event.disabled?.trackColor;
                    const t2Used = event.secondaryTrackColor !== undefined && !event.disabled?.secondaryTrackColor;
                    if ((t1Used || t2Used) && deco.config.decorationType === DecorationType.Object) {
                        const base1 = parseDecoColor(deco.config.trackColor, 'ffffff')[0];
                        const base2 = parseDecoColor(deco.config.trackColor2 ?? deco.config.trackColor, 'ffffff')[0];
                        const e1 = hexToRGB01(t1Used ? parseDecoColor(event.trackColor, 'ffffff')[0] : base1);
                        const e2 = hexToRGB01(t2Used ? parseDecoColor(event.secondaryTrackColor, 'ffffff')[0] : base2);
                        const b1 = hexToRGB01(base1);
                        const b2 = hexToRGB01(base2);
                        const defs: [string, number, number][] = [
                            ['trackColorR', e1[0], b1[0]], ['trackColorG', e1[1], b1[1]], ['trackColorB', e1[2], b1[2]],
                            ['trackColor2R', e2[0], b2[0]], ['trackColor2G', e2[1], b2[1]], ['trackColor2B', e2[2], b2[2]],
                        ];
                        for (const [prop, end, base] of defs) {
                            const start = tm.sample(kv, prop, eventTime) ?? base;
                            if (soHasDur) tm.addTweenKillComplete(kv, prop, eventTime, soEnd, start, end, soEase);
                            else tm.addInstantEvent(kv, prop, eventTime, end);
                        }
                    }
                    // SetObject 解码的全部字段（含 disabled[key] 门控）。
                    // 字符串类走 String()，数值/布尔原样/解析。
                    const strFields: [string, string][] = [
                        ['planetColor', 'planetColor'],
                        ['planetTailColor', 'planetTailColor'],
                        ['trackColorType', 'trackColorType'],
                        ['trackStyle', 'trackStyle'],
                        ['trackIcon', 'trackIcon'],
                        ['trackGlowColor', 'trackGlowColor'],
                    ];
                    for (const [evKey, prop] of strFields) {
                        if (event[evKey] !== undefined && !event.disabled?.[evKey]) {
                            tm.addDiscreteKeyframe(kv, prop, eventTime, String(event[evKey]));
                        }
                    }
                    const numFields: [string, string][] = [
                        ['trackOpacity', 'trackOpacity'],
                        ['trackAngle', 'trackAngle'],
                        ['trackColorAnimDuration', 'trackColorAnimDuration'],
                        ['trackIconAngle', 'trackIconAngle'],
                    ];
                    for (const [evKey, prop] of numFields) {
                        if (event[evKey] !== undefined && !event.disabled?.[evKey]) {
                            tm.addDiscreteKeyframe(kv, prop, eventTime, event[evKey]);
                        }
                    }
                    const boolFields: [string, string][] = [
                        ['trackIconFlipped', 'trackIconFlipped'],
                        ['trackRedSwirl', 'trackRedSwirl'],
                        ['trackGraySetSpeedIcon', 'trackGraySetSpeedIcon'],
                        ['trackGlowEnabled', 'trackGlowEnabled'],
                        ['trackIconOutlines', 'trackIconOutlines'],
                    ];
                    for (const [evKey, prop] of boolFields) {
                        if (event[evKey] !== undefined && !event.disabled?.[evKey]) {
                            tm.addDiscreteKeyframe(kv, prop, eventTime, parseEventVisible(event[evKey]));
                        }
                    }
                    continue;
                }
                if (event.eventType !== 'MoveDecorations') continue;

                const floor = event.floor ?? 0;
                const bpm = this.tileBPM[floor] || 100;
                // crotchet = 60/(bpm*pitch*speed)；tileBPM 只含 speed，故再 /pitch。
                const duration = ((event.duration || 0) * 60 / bpm) / this.songPitch;
                const ease = event.ease || 'Linear';
                const movementType = this.parsePlacement(event.relativeTo);
                const isLastPos = movementType === DecPlacementType.LastPosition;
                const endTime = eventTime + duration;
                const hasDur = duration > 0;

                // SetPlacementType: a non-disabled relativeTo (≠ LastPosition)
                // re-parents the decoration at trigger time, re-deriving startPos
                // from the decoration's OWN source-event position in the new frame.
                if (event.relativeTo !== undefined && !event.disabled?.relativeTo && !isLastPos) {
                    tm.addDiscreteKeyframe(kv, 'placement', eventTime, String(event.relativeTo));
                    const sp = this.computeStartPos(
                        deco.config.position, movementType,
                        deco.config.anchorFloor ?? deco.config.floor);
                    curStartX = sp.x;
                    curStartY = sp.y;
                }

                if (event.positionOffset !== undefined && !event.disabled?.positionOffset) {
                    // [null, x] = "这一轴不改"（原版 schema 是 nullable）。不能把 null 当 0：
                    // 否则每次带 [null,null] 的 MoveDecorations 都会把装饰位置重置回基准。
                    const npos = this.parseVec2Nullable(event.positionOffset);
                    const startX = tm.sample(kv, 'positionX', eventTime) ?? basePosX;
                    const startY = tm.sample(kv, 'positionY', eventTime) ?? basePosY;
                    if (npos[0] !== null) {
                        const endX = (isLastPos ? startX : curStartX) + npos[0] * ts;
                        if (hasDur) tm.addTweenKillComplete(kv, 'positionX', eventTime, endTime, startX, endX, ease);
                        else tm.addInstantEvent(kv, 'positionX', eventTime, endX);
                    }
                    if (npos[1] !== null) {
                        const endY = (isLastPos ? startY : curStartY) + npos[1] * ts;
                        if (hasDur) tm.addTweenKillComplete(kv, 'positionY', eventTime, endTime, startY, endY, ease);
                        else tm.addInstantEvent(kv, 'positionY', eventTime, endY);
                    }
                }

                if (event.rotationOffset !== undefined && !event.disabled?.rotationOffset) {
                    const endRot = event.rotationOffset;
                    const startRot = tm.sample(kv, 'rotation', eventTime) ?? 0;
                    if (hasDur) {
                        tm.addTweenKillComplete(kv, 'rotation', eventTime, endTime, startRot, endRot, ease);
                    } else {
                        tm.addInstantEvent(kv, 'rotation', eventTime, endRot);
                    }
                }

                if (event.scale !== undefined && !event.disabled?.scale) {
                    // scale 也是逐轴 nullable：[null,x] 表示该轴不改。
                    // 当成 0 会把装饰整块缩没（"装饰莫名消失"的元凶）。
                    const s = this.parseVec2Nullable(event.scale);
                    const startSX = tm.sample(kv, 'scaleX', eventTime) ?? (deco.config.scale[0] / 100);
                    const startSY = tm.sample(kv, 'scaleY', eventTime) ?? (deco.config.scale[1] / 100);
                    if (s[0] !== null) {
                        const endSX = s[0] / 100;
                        if (hasDur) tm.addTweenKillComplete(kv, 'scaleX', eventTime, endTime, startSX, endSX, ease);
                        else tm.addInstantEvent(kv, 'scaleX', eventTime, endSX);
                    }
                    if (s[1] !== null) {
                        const endSY = s[1] / 100;
                        if (hasDur) tm.addTweenKillComplete(kv, 'scaleY', eventTime, endTime, startSY, endSY, ease);
                        else tm.addInstantEvent(kv, 'scaleY', eventTime, endSY);
                    }
                }

                // opacity 虽然 schema 是 optional（非 nullable），但编辑器/转换器偶尔写 null，
                // 不挡的话 `null/100 = 0` 会让装饰直接透明掉。
                if (event.opacity !== undefined && event.opacity !== null && !event.disabled?.opacity) {
                    const endOp = event.opacity / 100;
                    const startOp = tm.sample(kv, 'opacity', eventTime) ?? baseOp0;
                    if (hasDur) {
                        tm.addTweenKillComplete(kv, 'opacity', eventTime, endTime, startOp, endOp, ease);
                    } else {
                        tm.addInstantEvent(kv, 'opacity', eventTime, endOp);
                    }
                }

                if (event.parallax !== undefined && !event.disabled?.parallax) {
                    const p = this.parseVec2(event.parallax, [100, 100]);
                    const endParX = p[0] / 100;
                    const endParY = p[1] / 100;
                    const startParX = tm.sample(kv, 'parallaxX', eventTime) ?? (deco.config.parallax[0] / 100);
                    const startParY = tm.sample(kv, 'parallaxY', eventTime) ?? (deco.config.parallax[1] / 100);
                    if (hasDur) {
                        tm.addTweenKillComplete(kv, 'parallaxX', eventTime, endTime, startParX, endParX, ease);
                        tm.addTweenKillComplete(kv, 'parallaxY', eventTime, endTime, startParY, endParY, ease);
                    } else {
                        tm.addInstantEvent(kv, 'parallaxX', eventTime, endParX);
                        tm.addInstantEvent(kv, 'parallaxY', eventTime, endParY);
                    }
                }

                if (event.parallaxOffset !== undefined && !event.disabled?.parallaxOffset) {
                    const po = this.parseVec2Nullable(event.parallaxOffset);
                    const startPOX = tm.sample(kv, 'parallaxOffsetX', eventTime) ?? deco.config.parallaxOffset[0];
                    const startPOY = tm.sample(kv, 'parallaxOffsetY', eventTime) ?? deco.config.parallaxOffset[1];
                    if (po[0] !== null) {
                        const endPOX = po[0] * ts;
                        if (hasDur) tm.addTweenKillComplete(kv, 'parallaxOffsetX', eventTime, endTime, startPOX, endPOX, ease);
                        else tm.addInstantEvent(kv, 'parallaxOffsetX', eventTime, endPOX);
                    }
                    if (po[1] !== null) {
                        const endPOY = po[1] * ts;
                        if (hasDur) tm.addTweenKillComplete(kv, 'parallaxOffsetY', eventTime, endTime, startPOY, endPOY, ease);
                        else tm.addInstantEvent(kv, 'parallaxOffsetY', eventTime, endPOY);
                    }
                }

                if (event.pivotOffset !== undefined && !event.disabled?.pivotOffset) {
                    const pv = this.parseVec2Nullable(event.pivotOffset);
                    const startPVX = tm.sample(kv, 'pivotOffsetX', eventTime) ?? deco.config.pivotOffset[0];
                    const startPVY = tm.sample(kv, 'pivotOffsetY', eventTime) ?? deco.config.pivotOffset[1];
                    if (pv[0] !== null) {
                        const endPVX = pv[0] * ts;
                        if (hasDur) tm.addTweenKillComplete(kv, 'pivotOffsetX', eventTime, endTime, startPVX, endPVX, ease);
                        else tm.addInstantEvent(kv, 'pivotOffsetX', eventTime, endPVX);
                    }
                    if (pv[1] !== null) {
                        const endPVY = pv[1] * ts;
                        if (hasDur) tm.addTweenKillComplete(kv, 'pivotOffsetY', eventTime, endTime, startPVY, endPVY, ease);
                        else tm.addInstantEvent(kv, 'pivotOffsetY', eventTime, endPVY);
                    }
                }

                if (event.color !== undefined && !event.disabled?.color) {
                    const [cHex, cAlpha] = parseDecoColor(event.color, 'ffffff');
                    const [eR, eG, eB] = hexToRGB01(cHex);
                    const sR = tm.sample(kv, 'colorR', eventTime) ?? baseCR;
                    const sG = tm.sample(kv, 'colorG', eventTime) ?? baseCG;
                    const sB = tm.sample(kv, 'colorB', eventTime) ?? baseCB;
                    const sA = tm.sample(kv, 'colorA', eventTime) ?? baseCA;
                    if (hasDur) {
                        tm.addTweenKillComplete(kv, 'colorR', eventTime, endTime, sR, eR, ease);
                        tm.addTweenKillComplete(kv, 'colorG', eventTime, endTime, sG, eG, ease);
                        tm.addTweenKillComplete(kv, 'colorB', eventTime, endTime, sB, eB, ease);
                        tm.addTweenKillComplete(kv, 'colorA', eventTime, endTime, sA, cAlpha, ease);
                    } else {
                        tm.addInstantEvent(kv, 'colorR', eventTime, eR);
                        tm.addInstantEvent(kv, 'colorG', eventTime, eG);
                        tm.addInstantEvent(kv, 'colorB', eventTime, eB);
                        tm.addInstantEvent(kv, 'colorA', eventTime, cAlpha);
                    }
                }

                // 离散即时属性
                if (event.decorationImage !== undefined && !event.disabled?.decorationImage) {
                    tm.addDiscreteKeyframe(kv, 'image', eventTime, String(event.decorationImage));
                }
                if (event.depth !== undefined && !event.disabled?.depth) {
                    tm.addDiscreteKeyframe(kv, 'depth', eventTime, event.depth);
                }
                if (event.visible !== undefined && !event.disabled?.visible) {
                    tm.addDiscreteKeyframe(kv, 'visible', eventTime, parseEventVisible(event.visible));
                }
                if (event.maskingType !== undefined && !event.disabled?.maskingType) {
                    tm.addDiscreteKeyframe(kv, 'maskingType', eventTime, String(event.maskingType));
                }
                if (event.useMaskingDepth !== undefined && !event.disabled?.useMaskingDepth) {
                    tm.addDiscreteKeyframe(kv, 'useMaskingDepth', eventTime, parseEventVisible(event.useMaskingDepth));
                }
                if (event.maskingFrontDepth !== undefined && !event.disabled?.maskingFrontDepth) {
                    tm.addDiscreteKeyframe(kv, 'maskingFrontDepth', eventTime, event.maskingFrontDepth);
                }
                if (event.maskingBackDepth !== undefined && !event.disabled?.maskingBackDepth) {
                    tm.addDiscreteKeyframe(kv, 'maskingBackDepth', eventTime, event.maskingBackDepth);
                }
                // MoveDecorations 解码从不给 maskingTarget 赋值
                // （maskingTargetUsed 恒为 false），所以运行期不改 maskingTarget。
            }

            // 诊断：把带运行期"离散变化"（换图 visible/maskingType/depth）的装饰时间轴打出来，
            // 便于排查"该消失/该换图却一直不变"这类问题。
            const dbgProps = tm.getProperties(kv);
            if (dbgProps.has('image') || dbgProps.has('visible') || dbgProps.has('maskingType') || dbgProps.has('depth')) {
                debugLog('[DecoBuild] ' + kv + ' tag=' + JSON.stringify(deco.config.tag)
                    + ' img=' + deco.config.decorationImage + ' ' + tm.debugKeyframes(kv));
            }
        }
    }


    private tryCreateDecoration(event: any): DecorationInstance | null {
        if (!isEventActive(event)) return null;
        // 粒子装饰暂时禁用：直接跳过（返回 null 但不再 push 到 pending，避免反复重试）
        if (!PARTICLES_ENABLED && event.eventType === 'AddParticle') return null;
        const deco = this.createDecoration(event);
        if (!deco) this.pendingDecorationEvents.push(event);
        return deco;
    }

    private computeStartPos(position: [number, number], relativeTo: DecPlacementType, floor?: number, liveTile?: { x: number; y: number } | null): Vector2 {
        const tiles = this.levelData.tiles;
        const ts = this.tileSize;
        let pos = new Vector2(position[0] * ts, position[1] * ts);
        if (relativeTo === DecPlacementType.Tile && floor !== undefined) {
            // SetPlacementType 用 listFloors[floor].transform.position（运行期，含
            // MoveTrack/PositionTrack），不是关卡静态 position —— 有 liveTile 就用它。
            const tp = liveTile
                ?? (tiles?.[floor]?.position ? { x: tiles[floor].position[0], y: tiles[floor].position[1] } : null);
            if (tp) { pos.x += tp.x; pos.y += tp.y; }
        } else if (relativeTo === DecPlacementType.Camera || relativeTo === DecPlacementType.CameraAspect) {
            pos.x /= ts; pos.y /= ts;
        }
        // Global/LastPosition/Planet: startPos = position * tileSize (no floor offset)
        return pos;
    }

    private createDecoration(event: any): DecorationInstance | null {
        if (!isEventActive(event)) return null;

        const relativeTo = this.parsePlacement(event.relativeTo);
        const rawPos = this.parseVec2(event.position, [0, 0]);
        const rawPositionOffset = this.parseVec2(event.positionOffset, [0, 0]);
        const rawParallaxOffset = this.parseVec2(event.parallaxOffset, [0, 0]);
        const rawPivotOffset = this.parseVec2(event.pivotOffset, [0, 0]);
        const ts = this.tileSize;
        const isCam = relativeTo === DecPlacementType.Camera || relativeTo === DecPlacementType.CameraAspect;

        // ADOFAI LevelEvent.FixDefaultValues: AddDecoration/AddText without an
        // explicit `parallax` inherit it from `depth` (with ±1 collapsed to 0).
        const getsDepthParallax = event.eventType === 'AddDecoration' || event.eventType === 'AddText';
        const rawDepth = Number(event.depth ?? 0);
        const derivedParallax = (rawDepth === 1 || rawDepth === -1) ? 0 : rawDepth;
        const decoParallax: [number, number] = (event.parallax !== undefined && event.parallax !== null)
            ? this.parseVec2(event.parallax, [100, 100])
            : (getsDepthParallax ? [derivedParallax, derivedParallax] : [100, 100]);
        // parallax 为 0 时 parallaxOffset 归零（Setup 语义）。
        const parallaxZero = decoParallax[0] === 0 && decoParallax[1] === 0;

        const floor = event.floor !== undefined ? event.floor
            : event.parentFloorNum !== undefined ? event.parentFloorNum
                : 0;
        // relativeTo 的元组形式 [n, 参考]：$n = 偏移、参考取 [1]。
        // 原版 eh() 里**只有 ThisTile 会用到这个偏移**（锚点砖 = 事件砖 + n），
        // Tile 时偏移被忽略。事件砖（floor）仍用于 stickToFloor / 事件归属，
        // 锚点砖（anchorFloor）只决定位置。
        const relRef = Array.isArray(event.relativeTo) ? event.relativeTo[1] : event.relativeTo;
        const relOffset = Array.isArray(event.relativeTo) ? (Number(event.relativeTo[0]) || 0) : 0;
        const anchorFloor = (relRef === 'ThisTile')
            ? Math.max(0, Math.min((this.levelData.tiles?.length ?? 1) - 1, floor + relOffset))
            : floor;
        const decoType = event.eventType === 'AddText' ? DecorationType.Text
            : event.eventType === 'AddObject' ? DecorationType.Object
                : event.eventType === 'AddParticle' ? DecorationType.Particle
                    : DecorationType.Image;

        const config: Partial<DecorationConfig> = {
            decorationType: decoType,
            id: `dec_${event.eventType}_${floor ?? 0}_${Math.random().toString(36).slice(2, 6)}`,
            tag: event.tag || '',
            decorationImage: event.decorationImage || '',
            decText: event.decText || '',
            position: rawPos,
            positionOffset: rawPositionOffset,
            relativeTo,
            rotation: event.rotation || 0,
            rotationOffset: event.rotationOffset || 0,
            scale: (() => {
                // ADD 的 scale 若写了 null（schema 允许），按默认 100 处理，不能变 0
                const sc = this.parseVec2Nullable(event.scale);
                return [sc[0] ?? 100, sc[1] ?? 100] as [number, number];
            })(),
            parallax: decoParallax,
            parallaxOffset: parallaxZero ? [0, 0] : [rawParallaxOffset[0] * ts, rawParallaxOffset[1] * ts],
            pivotOffset: [rawPivotOffset[0] * (isCam ? 1 : ts), rawPivotOffset[1] * (isCam ? 1 : ts)],
            depth: event.depth || 0,
            color: (() => {
                // v15 某些事件（如 AddParticle）的 color 是对象/数组结构 → 归一化为字符串
                const c = event.color;
                if (typeof c === 'string') return c;
                if (c && typeof c === 'object' && typeof (c as any).color1 === 'string') return (c as any).color1;
                if (typeof c === 'number') return '#' + (c >>> 0).toString(16).padStart(8, '0').slice(0, 6);
                if (Array.isArray(c) || (c && typeof c === 'object' && typeof (c as any).r === 'number')) {
                    const [h, a] = parseDecoColor(c, 'ffffff');
                    return a >= 1 ? h : h + Math.round(a * 255).toString(16).padStart(2, '0');
                }
                return 'ffffff';
            })(),
            opacity: event.opacity !== undefined ? event.opacity : 100,
            lockScale: isEnabled(event.lockScale),
            lockRotation: isEnabled(event.lockRotation),
            visible: parseEventVisible(event.visible),
            scaleMultiplier: event.scaleMultiplier !== undefined ? event.scaleMultiplier : 1,
            stickToFloor: isEnabled(event.stickToFloor),
            syncFloorDepth: isEnabled(event.syncFloorDepth),
            floor,
            objectType: event.objectType,
            planetColorType: event.planetColorType,
            planetColor: event.planetColor,
            planetTailColor: event.planetTailColor,
            trackColor: event.trackColor,
            trackColor2: event.trackColor2 || event.trackColor,
            trackColorType: event.trackColorType,
            trackColorAnimDuration: event.trackColorAnimDuration,
            trackColorPulse: event.trackColorPulse,
            trackPulseLength: event.trackPulseLength,
            trackOpacity: event.trackOpacity,
            trackStyle: event.trackStyle,
            trackIcon: event.trackIcon,
            trackAngle: event.trackAngle ?? 0,
            trackIconAngle: event.trackIconAngle ?? 0,
            trackIconFlipped: isEnabled(event.trackIconFlipped),
            trackRedSwirl: isEnabled(event.trackRedSwirl),
            trackGraySetSpeedIcon: isEnabled(event.trackGraySetSpeedIcon),
            trackGlowEnabled: isEnabled(event.trackGlowEnabled),
            trackGlowColor: event.trackGlowColor,
            trackIconOutlines: isEnabled(event.trackIconOutlines),
            blendMode: event.blendMode || DecorationBlendMode.None,
            maskingType: event.maskingType || MaskingType.None,
            maskingTarget: event.maskingTarget || '',
            useMaskingDepth: isEnabled(event.useMaskingDepth),
            maskingFrontDepth: event.maskingFrontDepth ?? 0,
            maskingBackDepth: event.maskingBackDepth ?? 0,
            imageSmoothing: isEnabled(event.imageSmoothing),
            tile: (() => {
                const t = this.parseVec2Nullable(event.tile);
                const x = t[0] ?? 1, y = t[1] ?? 1;
                return [x, y] as [number, number];
            })(),
            anchorFloor,
        };

        const deco = new DecorationInstance(config);
        deco.sourceEvent = { ...event };
        deco.setInstancedRenderer(this.instancedRenderer);
        const initialPosition: [number, number] = [rawPos[0] + rawPositionOffset[0], rawPos[1] + rawPositionOffset[1]];
        deco.startPos.copy(this.computeStartPos(initialPosition, relativeTo, anchorFloor));
        deco.pivotPos.copy(deco.startPos);
        deco.currentPosition.copy(deco.startPos);

        if (decoType === DecorationType.Text) {
            if (!this.setupTextVisual(deco, event)) { deco.dispose(); return null; }
        } else if (decoType === DecorationType.Object) {
            if (!this.setupObjectVisual(deco, event)) { deco.dispose(); return null; }
            deco.updateTransform();
        } else if (decoType === DecorationType.Particle) {
            if (!config.decorationImage) { deco.dispose(); return null; }
            this.setupParticle(deco, event);
        } else {
            if (!config.decorationImage) { deco.dispose(); return null; }
            if (!this.loadDecoTexture(config.decorationImage, deco)) { deco.dispose(); return null; }
        }

        this.registerDecoration(deco);
        return deco;
    }

    private setupTextVisual(deco: DecorationInstance, event: any): boolean {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        const fontSize = Math.max(8, Number(event.fontSize) || 48);
        const fontFamily = event.font && typeof event.font === 'string' ? event.font : 'Arial';
        const fontWeight = event.fontWeight || 'bold';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const lines = String(event.decText ?? '').split('\n');
        const lineHeight = fontSize * 1.25;
        const measuredWidth = Math.max(fontSize, ...lines.map((line) => ctx.measureText(line).width));
        const padding = Math.ceil(fontSize * 0.35);
        canvas.width = Math.ceil(measuredWidth + padding * 2);
        canvas.height = Math.ceil(lines.length * lineHeight + padding * 2);
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Sprite 的颜色由 DecorationInstance 统一相乘，文字纹理保持白色，避免重复染色。
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = event.textAlign === 'Left' ? 'left' : event.textAlign === 'Right' ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        const x = ctx.textAlign === 'left' ? padding : ctx.textAlign === 'right' ? canvas.width - padding : canvas.width / 2;
        lines.forEach((line, index) => ctx.fillText(line, x, padding + lineHeight * (index + 0.5)));
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        deco.setupVisual(texture);
        return true;
    }

    /** Planet 装饰拖尾：复用已存在的 trail（仅改色），否则新建。 */
    private attachPlanetTrail(deco: DecorationInstance, colorStr: string | undefined): void {
        const [hex] = parseDecoColor(colorStr, 'ffffff');
        const color = new Color(hex);
        if (deco.planetTrail) {
            deco.setPlanetTrailColor(color);
            return;
        }
        deco.initPlanetTrail(color, this.container);
    }

    private setupObjectVisual(deco: DecorationInstance, event: any): boolean {
        const g = new Group();
        const objType = event.objectType || 'Planet';
        if (objType === 'Planet') {
            // planetColorType 是【预设】（DefaultRed/DefaultBlue/
            // Gold/Overseer），非 Custom 时本体/拖尾颜色来自预设而非 planetColor。
            // 本体 = 0.44 单位的行星贴图四边形：
            //   DefaultRed/DefaultBlue → 对应贴图、不染色；其余（含 Custom）→ 红贴图 × planetColor。
            const pType = event.planetColorType as string | undefined;
            const preset = planetPresetColor(pType);
            const isPresetTex = pType === 'DefaultRed' || pType === 'DefaultBlue';
            const bodyColorHex = preset ?? event.planetColor ?? event.color ?? '#ffffff';
            // 贴图是 11 帧横排 sprite sheet：必须配成单帧采样（否则整条 11 个球压成方块）
            const bodyTex = configurePlanetTexture(getPlanetTexture(pType));
            applyPlanetFrame(bodyTex, performance.now() * 0.001);
            deco.objPlanetTex = bodyTex;
            const mat = new MeshBasicMaterial({
                map: bodyTex,
                color: new Color(isPresetTex ? '#ffffff' : bodyColorHex),
                transparent: true,
                side: DoubleSide,
                depthWrite: false,
            });
            const body = new Mesh(new PlaneGeometry(PLANET_SPRITE_SIZE, PLANET_SPRITE_SIZE), mat);
            body.name = 'planetBody';
            g.add(body);
            // 与玩家相同的拖尾 ribbon；拖尾颜色同预设优先，否则 planetTailColor/planetColor
            this.attachPlanetTrail(deco, preset ?? event.planetTailColor ?? event.planetColor ?? event.color);
        } else if (objType === 'Floor') {
            const trackAngle = event.trackAngle ?? 0;
            const angle0 = -180;
            const angle1 = 180 - trackAngle;
            const isMidspin = event.trackType === 'Midspin' || event.trackType === 'midspin';
            const trackStyle = event.trackStyle || 'Standard';
            const geoKey = angle0 + '|' + angle1 + '|' + isMidspin + '|' + trackStyle;
            let tpl = this.floorGeoCache.get(geoKey);
            if (!tpl) {
                const meshData = isMidspin
                    ? createTrackMesh(-180, 0, true, undefined, undefined, undefined, trackStyle)
                    : createTrackMesh(angle0, angle1, false, undefined, undefined, undefined, trackStyle);
                if (meshData && meshData.faces && meshData.faces.length > 0) {
                    tpl = {
                        positions: new Float32Array(meshData.vertices),
                        indices: new Uint32Array(meshData.faces),
                        mask: new Float32Array(meshData.colors),
                        vertexCount: meshData.vertices.length / 3
                    };
                    this.floorGeoCache.set(geoKey, tpl);
                }
            }
            const trackOpacity = event.trackOpacity !== undefined ? event.trackOpacity / 100 : 1;
            if (tpl) {
                const trackColor = event.trackColor;
                const trackColor2 = event.trackColor2 || trackColor;
                deco.objMask = tpl.mask;
                deco.objColor1 = new Color(parseDecoColor(trackColor, 'ffffff')[0]);
                deco.objColor2 = new Color(parseDecoColor(trackColor2, 'ffffff')[0]);
                deco.objColorType = String(event.trackColorType || 'Single');
                deco.objTrackStyle = String(event.trackStyle || 'Standard');
                deco.objColorPulse = String(event.trackColorPulse || 'None');
                deco.objColorAnimDuration = event.trackColorAnimDuration ?? 2;
                deco.objColorPulseLength = event.trackPulseLength ?? 10;

                if (USE_OBJECT_FLOOR_BATCH) {
                    // 实例化：只登记几何定义；每帧由批次写实例矩阵/填充/描边/透明度。
                    deco.objGeoKey = geoKey;
                    deco.objTpl = tpl;
                    this.applyObjectFloorColors(deco);
                    this._objFloorDirty = true;
                } else {
                    const geometry = new BufferGeometry();
                    geometry.setIndex(new BufferAttribute(tpl.indices, 1));
                    geometry.setAttribute('position', new BufferAttribute(tpl.positions, 3));
                    const colorArray = new Float32Array(tpl.vertexCount * 3);
                    geometry.setAttribute('color', new BufferAttribute(colorArray, 3));
                    // 材质是 MeshBasicMaterial（不受光）→ 法线完全用不到。
                    // 上万块 Object(Floor) 每块都算一遍 computeVertexNormals 是纯浪费（加载卡顿来源）。
                    const mat = new MeshBasicMaterial({ vertexColors: true, transparent: trackOpacity < 1, opacity: trackOpacity, side: DoubleSide });
                    const tileMesh = new Mesh(geometry, mat);
                    // SetFloorColor：颜色是带 duration/ease 的 tween。保留 mask + 顶点色缓冲，
                    // SetObject 颜色 keyframe 每帧调 applyObjectFloorColors 重算。
                    deco.objTileMesh = tileMesh;
                    this.applyObjectFloorColors(deco);
                    g.add(tileMesh);
                }
            }

            // Track icon overlay using PNG sprites (matching ADOFAI CustomFloorIcon)
            const trackIcon = event.trackIcon;
            if (trackIcon && trackIcon !== 'None') {
                // SetFloorIcon：图标“类型”由事件决定（CustomFloorIcon），但**贴图变体
                // 与旋转角度由地板的 swirl 逻辑算**（UpdateIconSprite 用
                // entry/exit angle + isCCW）。复刻就是普通砖的 getTwirlTexture +
                // getFloorIconAngle —— 通过 Player 注入的 provider 拿同一份结果。
                const floorIdx = deco.config.floor;
                const twirlInfo = (trackIcon === 'Swirl' && floorIdx !== undefined && this.tileTwirlIconInfoProvider)
                    ? this.tileTwirlIconInfoProvider(floorIdx)
                    : null;
                const texType: IconType | null = twirlInfo
                    ? twirlInfo.texture
                    : getIconTextureForCustomFloor(trackIcon);
                if (texType) {
                    let iconAngle = twirlInfo ? twirlInfo.angle : 0;
                    const tex = getIconTexture(texType);
                    const sprite = createIconSprite(tex, trackOpacity, 0.44);
                    sprite.position.set(0, 0, 0.005);
                    // SetFloorIconAngle：事件给了角度就直接用（覆盖默认朝向）
                    if (event.trackIconAngle !== undefined && event.trackIconAngle !== null) {
                        iconAngle = Number(event.trackIconAngle) * Math.PI / 180;
                    }
                    // 注意符号：普通砖的图标角度由 instanced.frag 里 `iconAngle = -vFloorIconAngle`
                    // 取负后再旋转；Sprite 的 material.rotation 是直接旋转，所以这里同样取负，
                    // 才能和普通轨道朝向一致（图标角度取负，等于 SetIconAngle(-angle) 的语义）。
                    (sprite.material as SpriteMaterial).rotation = -iconAngle;
                    // SetFloorIconFlipped
                    if (isEnabled(event.trackIconFlipped)) {
                        sprite.scale.x = -Math.abs(sprite.scale.x);
                    }
                    // SetFloorRedSwirl / SetFloorGraySetSpeedIcon → 图标染色
                    if (isEnabled(event.trackRedSwirl)) {
                        (sprite.material as SpriteMaterial).color = new Color(0xff4444);
                    } else if (isEnabled(event.trackGraySetSpeedIcon)) {
                        (sprite.material as SpriteMaterial).color = new Color(0x9a9a9a);
                    }
                    g.add(sprite);
                    deco.iconSprite = sprite;
                }
            }
        } else if (objType === 'PlayerBubble') {
            const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
            const bubble = new Mesh(new CircleGeometry(0.3, 16), mat);
            g.add(bubble);
        }
        deco.objectGroup = g;
        deco.visualGroup.add(g);
        return true;
    }

    /** AddParticle：创建 CPU 粒子系统（纹理可能未加载，异步创建）。 */
    private setupParticle(deco: DecorationInstance, event: any): void {
        deco.sourceEvent = event;
        const filename = deco.config.decorationImage;
        const url = this.findImageUrl(filename);
        if (!url) {
            this.pendingDecorationEvents.push(event);
            return;
        }
        const reqId = ++deco.textureRequestId;
        this.textures.request(filename, url, tex => {
            if (deco.textureRequestId !== reqId) return;
            this.applyTextureOptions(filename, tex);
            if (!deco.particles) this.createParticleSystem(deco, event, tex);
        });
    }

    private parseVelocity(v: any): [[number, number], [number, number]] {
        if (Array.isArray(v) && Array.isArray(v[0]) && Array.isArray(v[1])) {
            return [
                [Number(v[0][0]) || 0, Number(v[0][1]) || 0],
                [Number(v[1][0]) || 0, Number(v[1][1]) || 0],
            ];
        }
        return [[0, 0], [0, 0]];
    }

    private createParticleSystem(deco: DecorationInstance, event: any, tex: Texture): void {
        const cfg: ParticleConfig = {
            decorationImage: deco.config.decorationImage,
            scale: [deco.config.scale[0], deco.config.scale[1]],
            shapeType: event.shapeType || 'Rectangle',
            shapeRadius: event.shapeRadius ?? 1,
            arc: event.arc ?? 360,
            arcMode: event.arcMode || 'Random',
            emissionRate: this.parseVec2(event.emissionRate, [10, 10]),
            particleLifetime: this.parseVec2(event.particleLifetime, [1, 2]),
            particleSize: this.parseVec2(event.particleSize, [1, 1]),
            velocity: this.parseVelocity(event.velocity),
            velocityLimitOverLifetime: this.parseVec2(event.velocityLimitOverLifetime, [0, 0]),
            sizeOverLifetime: this.parseVec2(event.sizeOverLifetime, [1, 1]),
            colorOverLifetime: event.colorOverLifetime,
            startRotation: this.parseVec2(event.startRotation, [0, 0]),
            rotationOverTime: this.parseVec2(event.rotationOverTime, [0, 0]),
            randomTextureTiling: this.parseVec2(event.randomTextureTiling, [1, 1]),
            maxParticles: event.maxParticles ?? 100,
            loop: isEnabled(event.loop),
            playDuration: event.playDuration ?? 5,
            simulationSpeed: event.simulationSpeed ?? 100,
            randomSeed: event.randomSeed ?? 0,
            autoPlay: event.autoPlay !== false,
            simulationSpace: event.simulationSpace || 'Local',
            tileSize: this.tileSize,
            // 粒子 mesh 位于装饰 transform 下，缩放由父级统一应用，不能重复乘相机倍率。
            camScaleMultiplier: 1,
        };
        const sys = new ParticleDecorationSystem(deco.visualGroup, cfg, tex);
        deco.particles = sys;
        if (deco.config.visible === false) sys.setVisible(false);
    }

    /**
     * 纹理按需生成 mipmap（+33% 显存）：只有显式开启 imageSmoothing 的消费者才付这笔成本。
     * 必须在纹理首次上传前决定。
     */
    private applyTextureOptions(filename: string, tex: Texture): void {
        // 与 WebADOFAI 一致：imageSmoothing=true → Linear，false → Nearest（mag/min 都是）。
        // 默认 true；只有明确写了 false 的消费者才用 Nearest（像素风不应被插值糊掉）。
        // 也不生成 mipmap：原版就是直接采样，mipmap 会让缩小后的图偏糊、和原版观感不一致。
        const smooth = !this.decoList.some(
            d => d.config.decorationImage === filename && d.config.imageSmoothing === false);
        // 只取 WAD 的**过滤选择**（smoothing→Linear / 否则 Nearest），
        // 但保留我们原有的 mipmap：大图（被压到 2048）再缩小很多时，
        // 没有 mipmap 会明显闪烁/锯齿 —— 那才是"看起来变怪"的主因。
        tex.generateMipmaps = smooth;
        tex.minFilter = smooth ? LinearMipMapLinearFilter : NearestFilter;
        tex.magFilter = smooth ? LinearFilter : NearestFilter;
    }

    /**
     * 取纹理并挂到装饰上。
     * 用每装饰的 requestId 过滤过期回调：换过图 / 已重置的装饰不会被旧回调覆盖。
     * 图未导入 → 全透明占位；加载失败 → NotFound 兜底（仍然可见，方便排查）。
     */
    /**
     * 纹理缓存键：文件名 + 平滑 + 平铺（对应 WAD 的 getDecorationCacheKey）。
     * 平铺必须有自己的纹理实例，否则 repeat 会串到别的装饰上。
     */
    private decoTextureKey(deco: DecorationInstance, filename: string): string {
        const tx = deco.config.tile?.[0] ?? 1;
        const ty = deco.config.tile?.[1] ?? 1;
        const smooth = deco.config.imageSmoothing !== false ? 1 : 0;
        if (tx === 1 && ty === 1 && smooth === 1) return filename;   // 默认变体沿用文件名
        return `${filename}|${smooth}|${tx}x${ty}`;
    }

    /** tile != 1 时用 Repeat 平铺（原版 configureDecorationTexture）。 */
    private configureTextureRepeat(tex: Texture, deco: DecorationInstance): void {
        const tx = deco.config.tile?.[0] ?? 1;
        const ty = deco.config.tile?.[1] ?? 1;
        const needRepeat = tx !== 1 || ty !== 1;
        tex.wrapS = needRepeat ? RepeatWrapping : ClampToEdgeWrapping;
        tex.wrapT = needRepeat ? RepeatWrapping : ClampToEdgeWrapping;
        tex.repeat.set(tx, ty);
        // 平铺时不做 alpha 裁剪（原版同）；否则分析一次并让 UV 只落在内容区。
        // 标准材质（Mesh/Sprite 路径）会应用 texture.offset/repeat；
        // 实例化路径用批次 uniform（见 DecorationInstancedRenderer）。
        if (!needRepeat) this.analyzeAlphaCrop(tex);
        // 注意：暂不把 texture.offset/repeat 改成裁剪区域 —— 必须四条渲染路径
        // 一起切换（否则有的裁有的没裁，反而更不一致）。分析结果先缓存备用。
    }

    /**
     * 贴图 alpha 裁剪（对齐 WAD 的 analyzeDecorationTextureAlphaCrop）：
     * 扫描 alpha 求非透明包围盒，把透明边距从采样中去掉，避免缩小时边缘渗色发脏。
     * 只做一次（结果缓存在 texture.userData.alphaCrop）。
     */
    private analyzeAlphaCrop(tex: Texture): void {
        const ud: any = tex.userData;
        if (ud.alphaCrop !== undefined) return;
        ud.alphaCrop = null;
        const img: any = tex.image;
        const n: number = img?.naturalWidth ?? img?.width;
        const m: number = img?.naturalHeight ?? img?.height;
        if (!n || !m || typeof document === 'undefined') return;
        let data: Uint8ClampedArray | null = null;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = n;
            canvas.height = m;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, n, m);
            data = ctx.getImageData(0, 0, n, m).data;
        } catch { return; }
        if (!data) return;
        let left = n, top = m, right = -1, bottom = -1;
        for (let y = 0; y < m; y++) {
            const row = y * n * 4;
            for (let x = 0; x < n; x++) {
                if ((data[row + x * 4 + 3] ?? 0) <= 0) continue;
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
        if (right < left || bottom < top) return;
        const w = right - left + 1;
        const h = bottom - top + 1;
        if (w >= n && h >= m) return;   // 没有透明边距
        const sx = w / n, sy = h / m;
        ud.alphaCrop = {
            uvOffsetX: left / n,
            uvOffsetY: (m - bottom - 1) / m,
            uvRepeatX: sx,
            uvRepeatY: sy,
            scaleX: sx,
            scaleY: sy,
            offsetX: (left + w / 2) / n - 0.5,
            offsetY: 0.5 - (top + h / 2) / m,
        };
    }

    private loadDecoTexture(filename: string, deco: DecorationInstance): boolean {
        const key = this.decoTextureKey(deco, filename);
        const cached = this.textures.get(key);
        if (cached) { this.configureTextureRepeat(cached, deco); deco.setupVisual(cached); return true; }

        const url = this.findImageUrl(filename);
        if (!url) { deco.setupVisual(this.textures.transparent); return true; }

        const reqId = ++deco.textureRequestId;
        this.textures.request(key, url, tex => {
            if (deco.textureRequestId !== reqId) return;   // 已过期：丢弃
            this.applyTextureOptions(filename, tex);
            this.configureTextureRepeat(tex, deco);
            deco.setupVisual(tex);
            deco.syncInstance();
            this.instancedRenderer.flush();
        });
        return true;
    }

    private findImageUrl(filename: string): string | undefined {
        let u = this.customImages.get(filename);
        if (u) return u;
        const base = filename.split(/[/\\]/).pop()!;
        u = this.customImages.get(base);
        if (u) return u;
        // 兜底后缀匹配：候选可能多个（同名文件散布子目录），取确定性最优——
        // 路径段最少（越接近根）优先，其次字典序，避免依赖 Map 插入顺序。
        let bestK: string | null = null;
        for (const k of this.customImages.keys()) {
            if (!(k.endsWith(filename) || filename.endsWith(k) || k.endsWith('/' + base))) continue;
            if (bestK === null
                || k.split(/[/\\]/).length < bestK.split(/[/\\]/).length
                || (k.split(/[/\\]/).length === bestK.split(/[/\\]/).length && k.toLowerCase() < bestK.toLowerCase())) {
                bestK = k;
            }
        }
        return bestK !== null ? this.customImages.get(bestK) : undefined;
    }

    /**
     * 参考系/视差等运行期变化后，把装饰在静态网格与动态列表之间迁移。
     * 每帧重算位置、没有空间索引，所以索引必须跟着 startPos 走，
     * 否则 Culling 会按旧锚点格子误裁（复刻特有问题）。
     */
    public reclassify(deco: DecorationInstance): void {
        const wasStatic = this._staticDecos.indexOf(deco) >= 0;
        const nowStatic = deco.isStaticWorld;
        if (wasStatic && !nowStatic) {
            const i = this._staticDecos.indexOf(deco);
            if (i >= 0) this._staticDecos.splice(i, 1);
            this._staticGrid.remove(deco);
            this._dynamicDecos.push(deco);
        } else if (!wasStatic && nowStatic) {
            const i = this._dynamicDecos.indexOf(deco);
            if (i >= 0) this._dynamicDecos.splice(i, 1);
            this._staticDecos.push(deco);
            this._staticGrid.insert(deco, deco.startPos.x, deco.startPos.y);
        } else if (wasStatic && nowStatic) {
            this._staticGrid.remove(deco);
            this._staticGrid.insert(deco, deco.startPos.x, deco.startPos.y);
        }
    }

    private registerDecoration(deco: DecorationInstance): void {
        deco.setInstancedRenderer(this.instancedRenderer);
        deco._manager = this;
        this.decorations.set(deco.config.id!, deco);
        this.decoList.push(deco);
        // Keep logical container for position tracking; instanced visuals live on InstancedMesh
        this.container.add(deco.container);
        if (deco.isStaticWorld) {
            this._staticDecos.push(deco);
            this._staticGrid.insert(deco, deco.startPos.x, deco.startPos.y);
        } else {
            this._dynamicDecos.push(deco);
        }
        if (deco.config.tag) {
            const tags = deco.config.tag.split(/\s+/).filter(Boolean);
            for (const t of tags) {
                if (!this.taggedDecorations.has(t)) this.taggedDecorations.set(t, []);
                this.taggedDecorations.get(t)!.push(deco);
            }
        }
        deco.container.visible = deco.config.visible ?? true;

        // 动画标记必须在**创建时**就算出来。装饰可能在贴图加载完成后才被创建
        // （pending 重试路径），那些不会经过 refreshAnimatedDecos()；漏标就会让它
        // 永远停在初始状态 —— 表现为"该显示的装饰不出现"（本关初始 visible:false，
        // 全靠 MoveDecorations 打开，漏标就是永远不显示）。
        if (this._timelineManager && this._timelineManager.hasAnyTimeline(`deco:${deco.config.id}`)) {
            deco.hasTimeline = true;
            if (!this._animatedDecos.includes(deco)) this._animatedDecos.push(deco);
        }
    }

    /* ── 背景混合（Overlay / SoftLight）────────────────────────────── */

    /** 把装饰的容器挂到背景混合场景（它不能和主场景一起渲染）。 */
    public attachToBackdrop(deco: DecorationInstance): void {
        this.backdropGroup.add(deco.container);
        if (!this.backdropDecos.includes(deco)) this.backdropDecos.push(deco);
    }

    public detachFromBackdrop(deco: DecorationInstance): void {
        const i = this.backdropDecos.indexOf(deco);
        if (i >= 0) this.backdropDecos.splice(i, 1);
    }

    /** 由 Player 在主场景渲染完之后单独渲染。 */
    public getBackdropScene(): Scene { return this.backdropScene; }

    /**
     * 装饰检查快照 —— 我们自己的"UnityExplorer"。
     * 在浏览器控制台执行 `__adojasDeco()`（或 `__adojasDeco({visibleOnly:false})`）
     * 就能拿到现场每个装饰的实际状态：锚点/位置/尺寸/透明度/可见性/深度/混合/
     * 贴图键/是否有动画/是否进了 Object(Floor) 批次。把它发给开发者即可精确定位。
     */
    public debugSnapshot(opts?: { visibleOnly?: boolean; limit?: number }): any[] {
        const visibleOnly = opts?.visibleOnly ?? true;
        const limit = opts?.limit ?? 400;
        const out: any[] = [];
        for (const d of this.decoList) {
            const effVisible = d.container.visible;
            if (visibleOnly && !effVisible) continue;
            const [z, ro] = d.depthZ();
            out.push({
                id: d.config.id,
                tag: d.config.tag,
                type: d.config.decorationType,
                objectType: d.config.objectType,
                image: d.config.decorationImage,
                textureKey: d.config.decorationImage
                    ? this.decoTextureKey(d, d.config.decorationImage) : null,
                relativeTo: d.config.relativeTo,
                anchorFloor: d.config.anchorFloor,
                floor: d.config.floor,
                configPos: d.config.position,
                configScale: d.config.scale,
                parallax: [d.currentParallax.x, d.currentParallax.y],
                currentPos: [d.currentPosition.x, d.currentPosition.y],
                worldPos: [d.container.position.x, d.container.position.y, d.container.position.z],
                worldScale: [d.container.scale.x, d.container.scale.y],
                baseSize: [d.baseSizeX, d.baseSizeY],
                opacity: d.currentOpacity,
                configVisible: d.config.visible,
                effVisible,
                depth: d.config.depth,
                z, renderOrder: ro,
                blend: d.config.blendMode,
                masking: d.config.maskingType,
                hasTimeline: d.hasTimeline,
                inBatch: !!d.objTpl,
            });
            if (out.length >= limit) break;
        }
        return out;
    }

    /** 纯色装饰（无贴图但需要采样）用的 1x1 白纹理。 */
    public getPlaceholderTexture(): Texture { return this.textures.placeholder; }

    /**
     * stencil ref 分配（对齐 WAD 的 stencilRefForMaskingTarget）：
     * 按 key 去重后**顺序**分配 1..254。原来的哈希实现会碰撞 —— 两个不同的遮罩
     * 拿到同一个 ref 就会互相串（本该被遮掉的露出来 / 反之）。
     */
    private maskStencilRefs: Map<string, number> = new Map();
    public stencilRefFor(key: string): number {
        const k = (key || '').trim() || NO_TAG_MASK;
        const hit = this.maskStencilRefs.get(k);
        if (hit != null) return hit;
        const ref = (this.maskStencilRefs.size % 254) + 1;
        this.maskStencilRefs.set(k, ref);
        return ref;
    }

    /** 是否存在可见、需要背景混合的装饰。 */
    public hasActiveBackdropBlend(): boolean {
        for (const d of this.backdropDecos) {
            const mat = d.backdropMat;
            if (!d.container.visible || !mat) continue;
            if ((mat.uniforms.uOpacity.value as number) > 0.0005) return true;
        }
        return false;
    }

    /** 每帧把「主场景渲染结果」与分辨率喂给所有背景混合材质。 */
    public updateBackdropUniforms(texture: Texture, width: number, height: number): void {
        for (const d of this.backdropDecos) {
            const mat = d.backdropMat;
            if (!mat) continue;
            mat.uniforms.uBackdrop.value = texture;
            (mat.uniforms.uResolution.value as Vector2).set(width, height);
        }
    }

    private buildDecorationEventsTimeline(): void {
        this.decorationEventsTimeline = [];
        const actions = this.levelData.actions || [];

        const totalTiles = this.tileStartTimes.length;

        // ── RepeatEvents 表 ────────────────────────────────────────────
        // ApplyEventsToFloors 对【所有】事件统一做重复展开（含
        // MoveDecorations/SetText/SetObject），复刻原来只处理 MoveTrack，装饰
        // 的重复事件只触发一次。
        const repeatTable = new Map<number, Map<string, {
            repetitions: number; interval: number; executeOnCurrentFloor: boolean; gapLength: number;
        }>>();
        for (const action of actions) {
            if (!isEventActive(action)) continue;
            if (action.eventType !== 'RepeatEvents') continue;
            const floor = action.floor ?? 0;
            if (!repeatTable.has(floor)) repeatTable.set(floor, new Map());
            const sub = repeatTable.get(floor)!;
            const isBeat = action.repeatType === 'Beat';
            const repetitions = isBeat ? (action.repetitions ?? 0) : (action.floorCount ?? 0);
            const interval = isBeat ? (action.interval ?? 1) : -1;
            const executeOnCurrentFloor = action.executeOnCurrentFloor ?? false;
            const gapLength = action.gapLength ?? 1;
            const tags = (action.tag ?? '').split(' ').filter((t: string) => t);
            for (const tag of tags) sub.set(tag, { repetitions, interval, executeOnCurrentFloor, gapLength });
        }

        // ── 收集装饰事件（含 RepeatEvents 展开）并按"宿主 floor"分组 ──
        const byFloor = new Map<number, { event: any; angleOffset: number }[]>();
        const pushEntry = (floor: number, event: any, angleOffset: number): void => {
            if (!byFloor.has(floor)) byFloor.set(floor, []);
            byFloor.get(floor)!.push({ event, angleOffset });
        };
        for (const action of actions) {
            if (action.eventType !== 'MoveDecorations' && action.eventType !== 'SetText' && action.eventType !== 'SetObject') continue;
            const baseFloor = action.floor ?? 0;
            const baseAo = action.angleOffset || 0;
            // eventTag 是空格分隔的多个 tag → 拆开后逐个匹配（原版行为），命中最先的一个
            let info: { repetitions: number; interval: number; executeOnCurrentFloor: boolean; gapLength: number } | undefined;
            const sub = repeatTable.get(baseFloor);
            if (sub) {
                const tagList = (action.eventTag ?? '').split(' ').filter((t: string) => t);
                for (const tg of tagList) {
                    const found = sub.get(tg);
                    if (found) { info = found; break; }
                }
            }
            if (!info) { pushEntry(baseFloor, action, baseAo); continue; }

            const isBeatMode = info.interval > 0;
            for (let rep = 0; rep <= info.repetitions; rep++) {
                const targetFloor = baseFloor + rep * info.gapLength;
                if (targetFloor >= totalTiles) break;
                let hostFloor: number;
                let repAngle: number;
                if (isBeatMode) {
                    // Beat 模式：事件留在原 floor，角偏移 = interval×rep×180
                    hostFloor = baseFloor;
                    repAngle = info.interval * rep * 180;
                } else if (info.executeOnCurrentFloor) {
                    // Floor 模式 + 落在目标 floor：事件搬到目标 floor
                    hostFloor = targetFloor;
                    repAngle = 0;
                } else {
                    // Floor 模式：事件留原 floor，角偏移 = 两 floor 的节拍差×180
                    hostFloor = baseFloor;
                    const baseTime = this.tileStartTimes[baseFloor] || 0;
                    const targetTime = this.tileStartTimes[targetFloor] || 0;
                    const secPerBeat = 60 / (this.tileBPM[baseFloor] || 100);
                    repAngle = ((targetTime - baseTime) / secPerBeat) * 180;
                }
                pushEntry(hostFloor, action, baseAo + repAngle);
            }
        }

        const entries: { time: number; event: any }[] = [];

        byFloor.forEach((events, floor) => {
            const startTime = this.tileStartTimes[floor] || 0;
            const bpm = this.tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;

            // Sort by event id for stable ordering within same floor
            const sorted = [...events].sort((a, b) => (a.event.id ?? Infinity) - (b.event.id ?? Infinity));
            const zeroOffsetEvents = sorted.filter(e => (e.angleOffset || 0) === 0);

            sorted.forEach(({ event, angleOffset: ao }) => {
                let offset = (ao / 180) * secPerBeat;
                // Micro-offset for multiple zero-angleOffset events (matching camera)
                if (ao === 0 && zeroOffsetEvents.length > 1) {
                    const order = zeroOffsetEvents.findIndex(e => e.event.id === event.id);
                    offset += order * 0.0001;
                }
                entries.push({ time: startTime + offset, event });
            });
        });

        // Global sort by time, then by id for ties
        entries.sort((a, b) => {
            const dt = a.time - b.time;
            return Math.abs(dt) < 0.0001
                ? ((a.event.id ?? Infinity) - (b.event.id ?? Infinity))
                : (dt > 0 ? 1 : -1);
        });

        this.decorationEventsTimeline = entries;
    }

    public registerCustomImage(filename: string, url: string): void {
        this.customImages.set(filename, url);
        const base = filename.split(/[/\\]/).pop()!;
        // basename 别名只允许"空位复用或同文件重注册"，不同文件不得借别名互相覆盖
        // （例：a/0.png 与 a/[Dynamic Decoration 1]/0.png 是两张不同的图）
        if (base !== filename) {
            const cur = this.customImages.get(base);
            if (cur === undefined || cur === url) this.customImages.set(base, url);
        }
        // 同名图被重新导入/覆盖：让旧纹理失效
        this.textures.invalidate(filename);
        // 立刻触发所有用这张图的装饰重新取纹理 —— 每个装饰按自己的变体键
        // （smoothing/tile）请求。**这一步不能省**：省了的话，等图注册的装饰会
        // 永远停在"透明兜底"，表现为"该显示的装饰不出现（消失）"。
        for (const d of this.decoList) {
            if (d.config.decorationImage === filename) this.loadDecoTexture(filename, d);
        }
        this.retryPending();
    }

    private retryPending(): void {
        const remaining: any[] = [];
        for (const event of this.pendingDecorationEvents) {
            // 避免重复创建：若已有同 eventType+decorationImage 的装饰则跳过
            const dup = this.decoList.find(d => d.sourceEvent === event);
            if (dup) continue;
            const deco = this.createDecoration(event);
            if (!deco) remaining.push(event);
        }
        this.pendingDecorationEvents = remaining;
    }

    public async preloadTextures(): Promise<number> {
        const filenames = new Set<string>();
        this.decoList.forEach(d => { if (d.config.decorationImage) filenames.add(d.config.decorationImage); });
        this.pendingDecorationEvents.forEach((e: any) => { if (e.decorationImage) filenames.add(e.decorationImage); });
        if (filenames.size === 0) return 0;
        // 触发加载（限并发在纹理仓内部）
        const kick = (fn: string): void => {
            const url = this.findImageUrl(fn);
            if (url && !this.textures.has(fn)) {
                this.textures.request(fn, url, tex => this.applyTextureOptions(fn, tex));
            }
        };
        for (const fn of filenames) kick(fn);
        // 等待排空（轮询）
        while (this.textures.pendingCount > 0) {
            await new Promise(r => setTimeout(r, 16));
        }
        // 排空后再补一次：确保每张图都落到缓存（含 NotFound 兜底）
        for (const fn of filenames) kick(fn);
        this.retryPending();
        this.decoList.forEach(d => {
            if (d.config.decorationImage && d.config.decorationType !== DecorationType.Particle) {
                const tex = this.textures.get(this.decoTextureKey(d, d.config.decorationImage));
                if (tex && !d.isInstanced && !d.sprite && !d.mesh) {
                    this.configureTextureRepeat(tex, d);
                    d.setupVisual(tex);
                }
            }
        });
        this.instancedRenderer.flush();
        return this.textures.loadedCount;
    }

    public update(elapsedTime: number, cameraPosition: Vector3, cameraRotation: number, cameraZoom: number, timelineManager?: TimelineManager, adoZoom?: number, runtime?: DecorationRuntimeContext): void {
        const now = elapsedTime / 1000;
        const dt = Math.min(0.1, Math.max(0, now - this._lastNow));
        this._lastNow = now;
        this.currentTime = now;
        const camZ = cameraZoom;
        // 粒子系统驱动（暂时禁用：PARTICLES_ENABLED=false）
        for (const d of this.decoList) {
            if (!PARTICLES_ENABLED || !d.particles) continue;
            const vis = d.config.visible !== false;
            d.particles.setVisible(vis);
            if (vis) {
                try {
                    if (this._lastNow > 0 && !this._particlesStarted.has(d)) {
                        d.particles.play();
                        this._particlesStarted.add(d);
                    }
                    // 粒子实例使用装饰局部坐标；container 已包含位置、旋转与锁定缩放。
                    d.particles.setCamScaleMultiplier(1);
                    d.particles.update(dt, { x: 0, y: 0 }, 0, 1);
                } catch (err) {
                    // 粒子异常不应中断整个装饰物渲染
                    d.particles = null;
                    console.error('[Decoration] particle update error', err);
                }
            }
        }
        const camX = cameraPosition.x;
        const camY = cameraPosition.y;
        const camMoved = Math.abs(camX - this._lastCamX) > 0.01 || Math.abs(camY - this._lastCamY) > 0.01 || Math.abs(camZ - this._lastCamZoom) > 0.001
            // 相机旋转：Camera/CameraAspect 位置偏移要按 camRot 旋转、lockRotation 装饰
            // 的朝向也取 camRot → 只转不移动时同样必须重算。
            || Math.abs(cameraRotation - this._lastCamRot) > 1e-4;
        if (camMoved) { this._lastCamX = camX; this._lastCamY = camY; this._lastCamZoom = camZ; this._lastCamRot = cameraRotation; }
        const list = this.decoList;
        const len = list.length;
        let animCount = 0;
        let needsTilePositions = false;
        // Same-depth tie-break ranks: rebuilt every frame in creation order so
        // equal-depth overlaps resolve deterministically (later creation on top).
        this._rankCounters.clear();
        this._stickFloors.clear();
        for (let i = 0; i < len; i++) {
            const d = list[i];
            // 只有真正拥有时间轴的装饰才需要逐帧采样（tag 本身不代表有动画）。
            // hasTimeline 是建时间轴时预算好的布尔量：省掉每帧上万次 `deco:${id}` 模板串
            // 拼接 + Map 查表（大关卡里这就是几毫秒）。
            if (d.hasTimeline) {
                d.updateAnimation(now, this._timelineManager!);
                animCount++;
            }
            // Object(Planet) 的 sprite sheet 切帧（LateUpdate 每帧推进）
            d.tickPlanetFrame();
            d.updateZRank(this._rankCounters);
            if (d.config.stickToFloor) {
                needsTilePositions = true;
                this._stickFloors.add(d.config.floor ?? -1);
            }
        }
        // Build current tile positions for stickToFloor/followPlanet decorations
        let needsStickRotation = false;
        if (needsTilePositions) {
            for (let i = 0; i < len; i++) {
                const d = list[i];
                if (d.config.stickToFloor) { needsStickRotation = true; break; }
            }
        }
        const tilePositions = needsTilePositions && timelineManager ? this._tilePositions : undefined;
        if (tilePositions) {
            this._tilePositions.clear();
            for (const floor of this._stickFloors) {
                const pos = timelineManager!.samplePosition(`tile:${floor}`, now);
                if (!pos) continue;
                const sx = timelineManager!.sample(`tile:${floor}`, 'scaleX', now);
                const sy = timelineManager!.sample(`tile:${floor}`, 'scaleY', now);
                const scale = sx !== undefined ? ((sx + (sy ?? sx)) / 2) : 1;
                const rot = needsStickRotation ? (timelineManager!.sample(`tile:${floor}`, 'rotation', now) ?? 0) : 0;
                this._tilePositions.set(floor, {
                    x: pos.x, y: pos.y, z: scale, rotation: rot,
                    sx: sx !== undefined ? sx : 1,
                    sy: sy !== undefined ? sy : (sx !== undefined ? sx : 1),
                });
            }
        }
        if (!camMoved && animCount === 0 && !tilePositions && !this._objFloorDirty) {
            this.instancedRenderer.flush();
            return;
        }
        // Compute camera visible area in world units
        const viewH = 8 / camZ;
        const aspect = runtime && runtime.viewportHeight > 0
            ? runtime.viewportWidth / runtime.viewportHeight
            : 16 / 9;
        const halfW = viewH * aspect * 0.5;
        const halfH = viewH * 0.5;
        const minX = camX - halfW, maxX = camX + halfW;
        const minY = camY - halfH, maxY = camY + halfH;
        // Spatial grid: query static decorations in cells overlapping the camera
        // view, EXPANDED by the largest known decoration half-extent — grid cells
        // index anchor points only, so a huge canvas anchored off-screen would
        // otherwise be culled while still covering the viewport.
        const pad = this._staticQueryPad;
        const visibleStatic = this._staticGrid.query(minX - pad, minY - pad, maxX + pad, maxY + pad);
        this._visibleStaticSet.clear();
        for (let i = 0; i < visibleStatic.length; i++) this._visibleStaticSet.add(visibleStatic[i]);
        // Include animated statics even if outside original cell.
        // 只遍历「有动画」的那一小撮，而不是全部静态装饰（否则每帧又是上万次查表）。
        const animatedList = this._animatedDecos;
        for (let i = 0; i < animatedList.length; i++) {
            const d = animatedList[i];
            if (d.isStaticWorld && !this._visibleStaticSet.has(d)) {
                visibleStatic.push(d);
            }
        }
        const dLen = this._dynamicDecos.length;
        // 预筛范围：视口再外扩半个视口（视差 ≤ 1 时，单帧相机位移不会超过这个量级）
        const preMinX = minX - halfW, preMaxX = maxX + halfW;
        const preMinY = minY - halfH, preMaxY = maxY + halfH;
        for (let i = 0; i < dLen; i++) {
            const d = this._dynamicDecos[i];
            if (d.config.visible !== false) {
                // 便宜预筛：非动画、非贴砖、非相机/行星锚定的装饰，位置只随相机视差线性
                // 变化 —— 先用同一公式算个大概位置，远离视口的直接跳过。
                // 大关卡里绝大多数装饰都远离视口，而 updatePosition（含实例矩阵写入）很贵，
                // 这一条就是几毫秒的差别。
                const rt = d.config.relativeTo;
                if (USE_DYNAMIC_PRECULL
                    && !d.hasTimeline && !d.config.stickToFloor
                    && rt !== DecPlacementType.Camera && rt !== DecPlacementType.CameraAspect
                    && rt !== DecPlacementType.Player
                    && rt !== DecPlacementType.RedPlanet && rt !== DecPlacementType.BluePlanet
                    && rt !== DecPlacementType.GreenPlanet) {
                    const bx = d.currentPosition.x, by = d.currentPosition.y;
                    const px = d.currentParallax.x, py = d.currentParallax.y;
                    const predX = bx + (camX - bx) * px;
                    const predY = by + (camY - by) * py;
                    const padP = (d.baseSizeX * Math.abs(d.config.scale[0]) + d.baseSizeY * Math.abs(d.config.scale[1])) / 100 + 8;
                    if (predX + padP < preMinX || predX - padP > preMaxX
                        || predY + padP < preMinY || predY - padP > preMaxY) {
                        d.setCulledVisible(false);
                        continue;
                    }
                }
                d.updatePosition(cameraPosition, cameraRotation, camZ, tilePositions, adoZoom, runtime);
                const p = d.container.position;
                const csx = Math.abs(d.container.scale.x);
                const csy = Math.abs(d.container.scale.y);
                let hw: number, hh: number;
                if (d.isInstanced) {
                    hw = d.baseSizeX * csx * 0.5;
                    hh = d.baseSizeY * csy * 0.5;
                } else if (d.sprite) {
                    hw = Math.abs(d.sprite.scale.x) * csx * 0.5;
                    hh = Math.abs(d.sprite.scale.y) * csy * 0.5;
                } else if (d.mesh) {
                    // 图片/文字装饰现在是 1x1 平面 × mesh.scale（= 原始像素尺寸）
                    hw = Math.abs(d.mesh.scale.x) * csx * 0.5;
                    hh = Math.abs(d.mesh.scale.y) * csy * 0.5;
                } else {
                    hw = csx * 0.5; hh = csy * 0.5;
                }
                if (hw > this._staticQueryPad || hh > this._staticQueryPad) this.noteDecoExtent(hw, hh);
                const vis = p.x + hw >= minX && p.x - hw <= maxX && p.y + hh >= minY && p.y - hh <= maxY;
                d.setCulledVisible(vis);
                this.collectObjectFloor(d, vis);
            } else {
                d.setCulledVisible(false);
            }
        }
        for (let i = 0; i < visibleStatic.length; i++) {
            const d = visibleStatic[i];
            if (d.config.visible !== false) {
                d.updatePosition(cameraPosition, cameraRotation, camZ, tilePositions, adoZoom, runtime);
                const p = d.container.position;
                const csx = Math.abs(d.container.scale.x);
                const csy = Math.abs(d.container.scale.y);
                let hw: number, hh: number;
                if (d.isInstanced) {
                    hw = d.baseSizeX * csx * 0.5;
                    hh = d.baseSizeY * csy * 0.5;
                } else if (d.sprite) {
                    hw = Math.abs(d.sprite.scale.x) * csx * 0.5;
                    hh = Math.abs(d.sprite.scale.y) * csy * 0.5;
                } else if (d.mesh) {
                    // 图片/文字装饰现在是 1x1 平面 × mesh.scale（= 原始像素尺寸）
                    hw = Math.abs(d.mesh.scale.x) * csx * 0.5;
                    hh = Math.abs(d.mesh.scale.y) * csy * 0.5;
                } else {
                    hw = csx * 0.5; hh = csy * 0.5;
                }
                if (hw > this._staticQueryPad || hh > this._staticQueryPad) this.noteDecoExtent(hw, hh);
                const vis = p.x + hw >= minX && p.x - hw <= maxX && p.y + hh >= minY && p.y - hh <= maxY;
                d.setCulledVisible(vis);
                this.collectObjectFloor(d, vis);
            } else {
                d.setCulledVisible(false);
            }
        }
        // Object(Floor) 实例化批次：本帧可见的块写进实例缓冲
        if (this.objectFloorBatch) {
            this.objectFloorBatch.flush();
            this._objFloorDirty = false;
        }
        this.instancedRenderer.flush();
    }

    /**
     * 把一个**最终可见**的 Object(Floor) 装饰登记进实例化批次。
     * 注意不能用"是否在视口内"来判断：AddObject 的 `visible:false` / `opacity:0`
     * 也必须挡住（container.visible 是 setCulledVisible 算出来的合成可见性）。
     */
    private collectObjectFloor(deco: DecorationInstance, _inView: boolean): void {
        const batch = this.objectFloorBatch;
        if (!batch) return;
        if (!deco.container.visible) return;
        const tpl = deco.objTpl;
        const geoKey = deco.objGeoKey;
        if (!tpl || !geoKey) return;
        // 轨道 mesh 原先挂在 objectGroup / visualGroup 下（两者间无额外变换）
        const node = deco.objectGroup ?? deco.visualGroup;
        node.updateWorldMatrix(true, false);
        batch.add({
            geoKey,
            positions: tpl.positions,
            indices: tpl.indices,
            mask: tpl.mask,
            vertexCount: tpl.vertexCount,
            matrixWorld: node.matrixWorld,
            fill: deco.objFill,
            stroke: deco.objStroke,
            opacity: deco.currentOpacity,
        });
    }

    /** 时间轴采样驱动：切换 decorationImage 贴图。 */
    public applyImageTo(deco: DecorationInstance, filename: string): void {
        deco.config.decorationImage = filename;
        if (deco.config.decorationType === DecorationType.Image
            || deco.config.decorationType === DecorationType.Particle) {
            if (!filename) { deco.setupVisual(null); return; }
            this.loadDecoTexture(filename, deco);
        }
    }

    /** MoveDecorations 可在播放中切换 stencil 角色，需从实例批次迁移到独立 sprite。 */
    public applyMaskTo(deco: DecorationInstance): void {
        if (deco.config.decorationType !== DecorationType.Image && deco.config.decorationType !== DecorationType.Text) return;
        const texture = this.textures.get(this.decoTextureKey(deco, deco.config.decorationImage));
        if (texture) { this.configureTextureRepeat(texture, deco); deco.setupVisual(texture); }
    }

    /** 时间轴采样驱动：SetText。 */
    public applyTextTo(deco: DecorationInstance, text: string): void {
        deco.config.decText = text;
        const ev: any = { decText: text, color: deco.config.color, fontSize: 48, font: undefined };
        this.setupTextVisual(deco, ev);
    }

    /**
     * Object(Floor) 顶点色重算。mask 决定 fill/border；Stripes 按父砖 parity 交换
     * color1/color2（按 `(seqID - startOfColorChange) % 2` 交换）。Glow/Blink/Rainbow/Volume
     * 等动画类型暂按 Single 处理，但基色仍随 SetObject 的 duration/ease tween。
     */
    public applyObjectFloorColors(deco: DecorationInstance): void {
        const mesh = deco.objTileMesh;
        const mask = deco.objMask;
        if (!mask || (!mesh && !deco.objTpl)) return;

        // 复用 TileColorManager 的颜色模型（ColorFloor / RGBcolor）：
        // 颜色类型 Single/Stripes/Glow/Blink/Switch/Rainbow/Volume + trackStyle 的
        // fill/border + trackColorPulse 相位 + Volume 振幅。对象地板就是"一块地板"，
        // 直接调 getTileRenderer 即可，不需要自己重写相位逻辑。
        let fill = deco.objColor1;
        let stroke = deco.objColor2;
        const tcm = this.tileColorManager;
        if (tcm) {
            const floor = deco.config.floor ?? 0;
            const cfg: TileColorConfig = {
                trackStyle: deco.objTrackStyle,
                trackColorType: deco.objColorType,
                trackColor: '#' + deco.objColor1.getHexString(),
                secondaryTrackColor: '#' + deco.objColor2.getHexString(),
                trackColorPulse: deco.objColorPulse,
                trackColorAnimDuration: deco.objColorAnimDuration,
                trackPulseLength: deco.objColorPulseLength,
                trackOpacity: 1,
                startFloor: floor,
                recolorTriggerTime: 0,
            };
            const rendered = tcm.getTileRenderer(floor, this.currentTime || 0, cfg);
            fill = new Color(parseDecoColor(rendered.color, 'ffffff')[0]);
            stroke = new Color(parseDecoColor(rendered.bgcolor, 'ffffff')[0]);
        }

        if (deco.objTpl) {
            // 实例化模式：记下每实例的填充/描边，由 ObjectFloorBatch 写进实例属性
            deco.objFill.copy(fill);
            deco.objStroke.copy(stroke);
            return;
        }

        const attr = mesh!.geometry.getAttribute('color') as BufferAttribute | undefined;
        if (!attr) return;
        const arr = attr.array as Float32Array;
        const len = Math.min(arr.length, mask.length * 3);
        for (let i = 0; i < len; i += 3) {
            if (mask[i / 3] < 0.5) { arr[i] = stroke.r; arr[i + 1] = stroke.g; arr[i + 2] = stroke.b; }
            else { arr[i] = fill.r; arr[i + 1] = fill.g; arr[i + 2] = fill.b; }
        }
        attr.needsUpdate = true;
    }

    /** 时间轴采样驱动：SetObject（Planet / Floor 属性）。 */
    public applyObjectPropsTo(deco: DecorationInstance, props: Partial<DecorationConfig>): void {
        if (deco.config.decorationType !== DecorationType.Object) return;
        // SetPlanetColor/SetPlanetTailColor：
        // 只有 planetColorType == Custom 时 planetColor/planetTailColor 才生效，
        // 预设类型（DefaultRed/DefaultBlue/Gold/Overseer）用预设颜色。
        const presetType = deco.config.planetColorType;
        const planetCustom = presetType == null || presetType === 'Custom';
        if (props.planetColor !== undefined) {
            deco.config.planetColor = props.planetColor;
            if (planetCustom) {
                const [hex, alpha] = parseDecoColor(props.planetColor, 'ffffff');
                deco.currentColor.set(hex);
                deco.currentOpacity = (deco.config.opacity / 100) * alpha;
            }
        }
        if (props.planetTailColor !== undefined) {
            deco.config.planetTailColor = props.planetTailColor;
            if (planetCustom) {
                const [tailC] = parseDecoColor(props.planetTailColor, 'ffffff');
                deco.setPlanetTrailColor(new Color(tailC));
            }
        }
        if (props.trackColor !== undefined) {
            deco.config.trackColor = props.trackColor;
        }
        if (props.trackOpacity !== undefined) {
            deco.config.trackOpacity = props.trackOpacity;
            deco.currentOpacity = props.trackOpacity / 100;
        }
        if (props.trackIcon !== undefined) deco.config.trackIcon = props.trackIcon;

        // ResetDecoration 会用更新后的 sourceLevelEvent 重新构建 Object renderer。
        // 同样重建可确保 Planet body/tail 与 Floor 的顶点色、透明度、图标一起更新。
        if (deco.objectGroup) {
            deco.visualGroup.remove(deco.objectGroup);
            deco.objectGroup.traverse((child) => {
                const mesh = child as Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                const material = (mesh as any).material as Material | Material[] | undefined;
                if (Array.isArray(material)) material.forEach((item) => item.dispose());
                else material?.dispose();
            });
            deco.objectGroup = null;
            deco.iconSprite = null;
        }
        deco.sourceEvent = { ...(deco.sourceEvent || {}), ...deco.config, ...props };
        this.setupObjectVisual(deco, deco.sourceEvent);
        deco.updateTransform();
    }

    private rebuildFloorIcon(deco: DecorationInstance): void {
        if (deco.iconSprite && deco.objectGroup) {
            deco.objectGroup.remove(deco.iconSprite);
            (deco.iconSprite.material as Material).dispose();
            deco.iconSprite = null;
        }
        const trackIcon = deco.config.trackIcon;
        if (!trackIcon || trackIcon === 'None' || !deco.objectGroup) return;
        const texType = getIconTextureForCustomFloor(trackIcon);
        if (texType) {
            const tex = getIconTexture(texType);
            const sprite = createIconSprite(tex, deco.currentOpacity, 0.44);
            sprite.position.set(0, 0, 0.005);
            if (texType === 'TwirlB1') {
                const floorIdx = deco.config.floor;
                const tiles = this.levelData.tiles;
                if (floorIdx !== undefined && tiles && floorIdx < tiles.length - 1) {
                    const p = tiles[floorIdx];
                    const n = tiles[floorIdx + 1];
                    const exitAngle = Math.atan2(n.position[1] - p.position[1], n.position[0] - p.position[0]);
                    (sprite.material as SpriteMaterial).rotation = exitAngle - Math.PI / 3;
                }
            }
            deco.objectGroup.add(sprite);
            deco.iconSprite = sprite;
        }
    }

    public reset(): void {
        const list = this.decoList;
        for (let i = 0; i < list.length; i++) {
            list[i].reset();
            const p = list[i].particles;
            if (p) p.stop();
        }
        this._particlesStarted.clear();
    }

    public clear(): void {
        const hadDecos = this.decoList.length > 0;
        const list = this.decoList;
        // 容器可能挂在主容器或 backdrop 场景里 → 用 removeFromParent（两者都能摘掉）
        for (let i = 0; i < list.length; i++) { list[i].dispose(); list[i].container.removeFromParent(); }
        this.backdropDecos.length = 0;
        this.backdropGroup.clear();
        this._animatedDecos.length = 0;
        this.maskStencilRefs.clear();
        this._objFloorDirty = true;
        this.objectFloorBatch?.dispose();
        this.decorations.clear();
        this.decoList.length = 0;
        this._staticDecos.length = 0;
        this._dynamicDecos.length = 0;
        this._staticGrid.clear();
        this.taggedDecorations.clear();
        this.floorGeoCache.clear();
        this.decorationEventsTimeline = [];
        this._decoSources = [];
        this._materializeIndex = 0;
        this.pendingDecorationEvents = [];
        this._tilePositions.clear();
        this.instancedRenderer.clear();
        if (hadDecos) {
            debugLog('[DecorationManager] Spatial grid Patch: disabled (cleared)');
        }
    }

    public dispose(): void {
        this.clear();
        this.instancedRenderer.dispose();
        this.textures.dispose();
        this.scene.remove(this.container);
    }

    private parsePlacement(v: any): DecPlacementType {
        if (!v) return DecPlacementType.Tile;
        // 原版 relativeTo 还支持 [偏移, 参考] 的元组形式（如 <n>ThisTile）。
        // 这里至少把"参考系"取出来，偏移在 resolvePlacementTuple 里另行处理。
        if (Array.isArray(v)) v = v[1];
        switch (v) {
            // 注意：'Tile' 必须显式列出 —— 原版 default 归 Player（Jf），
            // 漏了这个 case 会让所有 Tile 装饰变成"跟随玩家球"。
            case 'Tile':
            case DecPlacementType.Tile:
                return DecPlacementType.Tile;
            case 'Player':
            case DecPlacementType.Player:
                return DecPlacementType.Player;
            case 'ThisTile':
                // ThisTile 与 Tile 的锚点相同（编号差异只在重复事件展开时体现）
                return DecPlacementType.Tile;
            case 'LastPositionNoRotation':
            case DecPlacementType.LastPositionNoRotation:
                return DecPlacementType.LastPositionNoRotation;
            case 'Camera':
            case DecPlacementType.Camera:
                return DecPlacementType.Camera;
            case 'CameraAspect':
            case DecPlacementType.CameraAspect:
                return DecPlacementType.CameraAspect;
            case 'Global':
            case DecPlacementType.Global:
                return DecPlacementType.Global;
            case 'LastPosition':
            case DecPlacementType.LastPosition:
                return DecPlacementType.LastPosition;
            case 'RedPlanet':
            case DecPlacementType.RedPlanet:
                return DecPlacementType.RedPlanet;
            case 'BluePlanet':
            case DecPlacementType.BluePlanet:
                return DecPlacementType.BluePlanet;
            case 'GreenPlanet':
            case DecPlacementType.GreenPlanet:
                return DecPlacementType.GreenPlanet;
            // 原版对无法识别的值一律归到 Player（Jf），不是 Tile
            default: return DecPlacementType.Player;
        }
    }

    /**
     * 逐轴可空的向量：`null` 表示"这一轴不改"（原版 schema 里这些字段是 `v().nullable()`）。
     * MoveDecorations/SetObject 用这个解析，绝不能用 `parseVec2`（它会把 null 变成 0）。
     */
    private parseVec2Nullable(v: any): [number | null, number | null] {
        if (v === undefined || v === null || v === '') return [null, null];
        if (Array.isArray(v)) {
            const a = v[0];
            const b = v.length >= 2 ? v[1] : v[0];
            return [
                (a === null || a === undefined) ? null : Number(a),
                (b === null || b === undefined) ? null : Number(b),
            ];
        }
        if (typeof v === 'string') {
            const m = v.match(/-?\d+\.?\d*/g);
            if (!m || m.length === 0) return [null, null];
            const a = parseFloat(m[0]);
            const b = m.length >= 2 ? parseFloat(m[1]) : a;
            return [a, b];
        }
        const n = Number(v);
        return Number.isFinite(n) ? [n, n] : [null, null];
    }

    private parseVec2(v: any, def: [number, number]): [number, number] {
        if (v === undefined || v === null || v === '') return def;
        if (Array.isArray(v) && v.length >= 2) return [Number(v[0]), Number(v[1])];
        if (Array.isArray(v) && v.length === 1) return [Number(v[0]), Number(v[0])];
        // Handle string vectors like "[1, 2]" or "(1, 2)"
        if (typeof v === 'string') {
            const m = v.match(/-?\d+\.?\d*/g);
            if (m && m.length >= 2) return [parseFloat(m[0]), parseFloat(m[1])];
            if (m && m.length === 1) return [parseFloat(m[0]), parseFloat(m[0])];
        }
        // Handle single number as uniform value (e.g., scale: 50 → [50, 50])
        if (typeof v === 'number') return [v, v];
        return def;
    }
}