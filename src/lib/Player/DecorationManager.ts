import { Group, Mesh, Sprite, Vector2, Color, Texture, MeshBasicMaterial, SpriteMaterial, Material, CanvasTexture, CircleGeometry, RingGeometry, BufferGeometry, BufferAttribute, SRGBColorSpace, DoubleSide, Scene, TextureLoader, PlaneGeometry, Vector3, WebGLRenderTarget, Float32BufferAttribute, NormalBlending, AdditiveBlending, MultiplyBlending, CustomBlending, AddEquation, ReverseSubtractEquation, LinearFilter, LinearMipMapLinearFilter, Blending, Points, PointsMaterial, AlwaysStencilFunc, EqualStencilFunc, NotEqualStencilFunc, ReplaceStencilOp, KeepStencilOp } from 'three';
import { TimelineManager } from './TimelineManager';
import createTrackMesh from '../Geo/mesh_reserve';
import { isEventActive, isEnabled } from './EventUtils';
import { getIconTexture, getIconTextureForCustomFloor, createIconSprite } from './IconLoader';
import { debugLog } from './DebugLog';
import { DecorationInstancedRenderer, DecoInstanceSlot } from './DecorationInstancedRenderer';
import { ParticleDecorationSystem } from './ParticleDecoration';
import type { ParticleConfig } from './ParticleDecoration';

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
        case DecorationBlendMode.Additive: return AdditiveBlending;
        case DecorationBlendMode.Multiply: return MultiplyBlending;
        case DecorationBlendMode.Screen:
        case DecorationBlendMode.Overlay:
        case DecorationBlendMode.Subtract:
        case DecorationBlendMode.Divide:
            return CustomBlending;
        default: return NormalBlending;
    }
}

function maskReference(value: string): number {
    let hash = 17;
    for (let index = 0; index < value.length; index++) hash = (hash * 31 + value.charCodeAt(index)) | 0;
    return (Math.abs(hash) % 254) + 1;
}

export enum DecorationType {
    Image = 'Image',
    Text = 'Text',
    Object = 'Object',
    Particle = 'Particle',
    Prefab = 'Prefab'
}

export enum DecPlacementType {
    Tile = 'Tile',
    Camera = 'Camera',
    CameraAspect = 'CameraAspect',
    Global = 'Global',
    LastPosition = 'LastPosition',
    RedPlanet = 'RedPlanet',
    BluePlanet = 'BluePlanet',
    GreenPlanet = 'GreenPlanet'
}

export enum DecorationBlendMode {
    None = 'None',
    Additive = 'Additive',
    Screen = 'Screen',
    Multiply = 'Multiply',
    Overlay = 'Overlay',
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
    floor?: number;
    objectType?: string;
    planetColorType?: string;
    planetColor?: string;
    planetTailColor?: string;
    trackColor?: string;
    trackColor2?: string;
    trackOpacity?: number;
    trackStyle?: string;
    trackIcon?: string;
    blendMode: DecorationBlendMode;
    maskingType: MaskingType;
    maskingTarget?: string;
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

    /**
     * Returns decorations in cells overlapping [minX, minY] – [maxX, maxY].
     * The same decoration may be reported once even if it spans multiple cells,
     * because we only index by its anchor world position.
     */
    public query(minX: number, minY: number, maxX: number, maxY: number): DecorationInstance[] {
        const startCX = Math.floor(minX / this.cellSize);
        const endCX = Math.floor(maxX / this.cellSize);
        const startCY = Math.floor(minY / this.cellSize);
        const endCY = Math.floor(maxY / this.cellSize);
        const out: DecorationInstance[] = [];
        for (let cx = startCX; cx <= endCX; cx++) {
            for (let cy = startCY; cy <= endCY; cy++) {
                const bucket = this.cells.get(this.key(cx, cy));
                if (bucket) {
                    for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
                }
            }
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
    blendMode: DecorationBlendMode.None,
    maskingType: MaskingType.None,
    maskingTarget: '',
    imageSmoothing: false,
};

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
    public instSlot: DecoInstanceSlot | null = null;
    public particles: ParticleDecorationSystem | null = null;
    public planetTrailParticles: Points | null = null;
    public sourceEvent: any = null;
    private instRenderer: DecorationInstancedRenderer | null = null;
    private originalVisible: boolean = true;
    private originalDepth: number = 0;
    private _isStaticWorld = true;
    // 真正生效的可见性 = culling 视锥可见 && 用户/事件 visible
    private _instVisible = true;
    private _culledVisible = true;
    // 时间轴采样缓存：避免每帧重复触发 image load 或相同值导致的 transform 重算
    public _manager: any = null;
    private _lastImage: string | null = null;
    private _lastText: string | null = null;
    private _lastPlanetColor: string | null = null;
    private _lastPlanetTailColor: string | null = null;
    private _lastTrackColor: string | null = null;
    private _lastTrackOpacity: number | null = null;
    private _lastTrackIcon: string | null = null;

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
        // 粒子装饰：scale 只控制发射区域（shape.scale），transform 不缩放（官方 SetScale 仅设 shape）
        if (this.config.decorationType === DecorationType.Particle) {
            this.currentScale.set(1, 1);
        }
        this.currentRotation = this.config.rotation + this.config.rotationOffset;
        // Parse color with alpha: #RRGGBBAA → color=#RRGGBB, alpha extracted
        const [colorHex, colorAlpha] = parseDecoColor(this.config.color);
        this.currentColor.set(colorHex);
        this.currentOpacity = (this.config.opacity / 100) * colorAlpha;
        this.currentPosition.set(this.config.position[0], this.config.position[1]);
        this.currentParallax.set(this.config.parallax[0] / 100, this.config.parallax[1] / 100);
        this.currentParallaxOffset.set(this.config.parallaxOffset[0], this.config.parallaxOffset[1]);
        this.originalVisible = this.config.visible;
        this.originalDepth = this.config.depth;
        const c = this.config;
        this._isStaticWorld = (c.relativeTo === DecPlacementType.Tile
            || c.relativeTo === DecPlacementType.Global
            || c.relativeTo === DecPlacementType.LastPosition)
            && c.parallax[0] === 0 && c.parallax[1] === 0
            && c.parallaxOffset[0] === 0 && c.parallaxOffset[1] === 0
            && !c.lockRotation && !c.lockScale
            && !c.stickToFloor;
    }

    public setupVisual(texture: Texture | null): void {
        this.clearVisual();
        if (this.config.decorationType === DecorationType.Object) return;
        const blend = getBlendMode(this.config.blendMode);
        this.visualGroup.position.set(this.config.pivotOffset[0], this.config.pivotOffset[1], 0);
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
                texture.magFilter = LinearFilter;
                texture.minFilter = LinearMipMapLinearFilter;
                texture.needsUpdate = true;
            }
            const texW = texture.image?.width || 100;
            const texH = texture.image?.height || 100;
            this.baseSizeX = texW / 100;
            this.baseSizeY = texH / 100;
            // Instanced path for Image/Text (no masking). Mask decorations keep Sprite fallback.
            // Batch by texture+blend+renderOrder(-depth) so layering matches original sprites.
            const canInstance = this.instRenderer
                && this.config.maskingType === MaskingType.None
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
                const mat = new SpriteMaterial({
                    map: texture, color: 0xffffff, transparent: true, opacity: this.currentOpacity,
                    blending: blend as Blending, depthWrite: false,
                });
                if (this.config.blendMode === DecorationBlendMode.Subtract) mat.blendEquation = ReverseSubtractEquation;
                const target = this.config.maskingTarget || this.config.tag || this.config.id || '';
                const stencilRef = maskReference(target);
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
                this.sprite = new Sprite(mat);
                this.sprite.scale.set(this.baseSizeX, this.baseSizeY, 1);
                this.sprite.center.set(0.5, 0.5);
                this.visualGroup.add(this.sprite);
            }
        }
        this.updateTransform();
    }

    private clearVisual(): void {
        if (this.instSlot && this.instRenderer) {
            this.instRenderer.free(this.instSlot);
            this.instSlot = null;
        }
        if (this.mesh) { this.visualGroup.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as Material).dispose(); this.mesh = null; }
        if (this.sprite) { this.visualGroup.remove(this.sprite); (this.sprite.material as Material).dispose(); this.sprite = null; }
        if (this.objectGroup) { this.visualGroup.remove(this.objectGroup); this.objectGroup = null; }
        if (this.iconSprite) { (this.iconSprite.material as Material).dispose(); this.iconSprite = null; }
        if (this.particles) { this.particles.dispose(); this.particles = null; }
    }

    /** Compute depth z + renderOrder from config.depth.
     *  ADOFAI sorting layers: Bg (depth>=0) < Floor (tiles) < Default (depth<0).
     *  Tiles use renderOrder = -tileIndex (0 to -N+1).
     *  Background decorations get renderOrder << -N so they render behind ALL tiles.
     *  Foreground decorations (depth<0) get positive renderOrder, on top of tiles. */
    private depthZ(): [number, number] {
        const d = this.config.depth;
        if (d < 0) return [0.1 - d * 0.1, -d];
        return [-0.01 - d * 0.1, -d - 2000];
    }

    public syncInstance(): void {
        if (!this.instSlot || !this.instRenderer) return;
        const [z, ro] = this.depthZ();
        // depth changed (e.g. MoveDecorations) → migrate to correct renderOrder batch
        if (this.instSlot.renderOrder !== ro) {
            this.instSlot = this.instRenderer.ensureLayer(this.instSlot, ro);
        }
        const p = this.container.position;
        // container.scale is set by updatePosition to currentScale * multipliers.
        // Before the first updatePosition it stays at (1,1,1) — fall back to currentScale.
        let sx = this.container.scale.x;
        let sy = this.container.scale.y;
        if (sx === 1 && sy === 1 && (this.currentScale.x !== 1 || this.currentScale.y !== 1)) {
            sx = this.currentScale.x;
            sy = this.currentScale.y;
        }
        const rot = this.container.rotation.z;
        const vis = this._instVisible && (this.config.visible !== false);
        this.instRenderer.write(
            this.instSlot,
            p.x, p.y, z,
            rot,
            sx, sy,
            this.currentColor,
            this.currentOpacity,
            vis,
        );
    }

    public updateTransform(): void {
        this.container.rotation.z = this.currentRotation * Math.PI / 180;
        const [z, ro] = this.depthZ();
        this.container.position.set(this.currentPosition.x, this.currentPosition.y, z);
        if (this.instSlot) {
            this.syncInstance();
            return;
        }
        if (this.mesh) { this.mesh.renderOrder = ro; (this.mesh.material as MeshBasicMaterial).color.copy(this.currentColor); (this.mesh.material as MeshBasicMaterial).opacity = this.currentOpacity; }
        if (this.sprite) { this.sprite.renderOrder = ro; (this.sprite.material as SpriteMaterial).color.copy(this.currentColor); (this.sprite.material as SpriteMaterial).opacity = this.currentOpacity; }
        if (this.iconSprite) { this.iconSprite.renderOrder = ro + 1; (this.iconSprite.material as SpriteMaterial).opacity = this.currentOpacity; }
    }

    public updatePosition(camPos: Vector3, camRot: number, camZoom: number, tilePositions?: Map<number, { x: number; y: number; z: number; rotation: number }>, adoZoom?: number, runtime?: DecorationRuntimeContext): void {
        if (this._isStaticWorld) {
            // Parallax=0 → world-fixed: no camera displacement
            this.container.position.x = this.currentPosition.x;
            this.container.position.y = this.currentPosition.y;
            let camScaleMul = 1;
            if (this.config.lockScale && adoZoom && adoZoom > 0) camScaleMul = 100 / adoZoom;
            camScaleMul *= this.config.scaleMultiplier;
            let floorScaleMul = 1;
            if (this.config.stickToFloor && tilePositions?.has(this.config.floor ?? -1)) {
                const ts = tilePositions!.get(this.config.floor ?? -1)!;
                floorScaleMul = ts.z;
            }
            this.container.scale.set(this.currentScale.x * camScaleMul * floorScaleMul, this.currentScale.y * camScaleMul * floorScaleMul, 1);
            if (this.instSlot) this.syncInstance();
            return;
        }
        // camScaleMultiplier: C# = orthoSize * 0.2 / (camZoom / 100), orthoSize=5 → 100/adoZoom
        let camScaleMul = 1;
        if (this.config.lockScale && adoZoom && adoZoom > 0) camScaleMul = 100 / adoZoom;
        camScaleMul *= this.config.scaleMultiplier;
        let floorScaleMul = 1;
        if (this.config.stickToFloor && tilePositions?.has(this.config.floor ?? -1)) {
            const ts = tilePositions!.get(this.config.floor ?? -1)!;
            floorScaleMul = ts.z;
        }
        const totalScaleMul = camScaleMul * floorScaleMul;
        // Parallax offset multiplier: official = decoration.camScaleMultiplier
        const parallaxOffsetMul = camScaleMul;
        const ct = this.config.relativeTo;
        let posX = 0, posY = 0;
        if (ct === DecPlacementType.Camera || ct === DecPlacementType.CameraAspect) {
            // WebADOFAI resolveStatePivotWorldPosition: convert pixel coords → world coords
            // pixelX / 20 * viewWidth, then rotate by camera angle
            const viewH = 8 / camZoom;
            const aspect = runtime && runtime.viewportHeight > 0
                ? runtime.viewportWidth / runtime.viewportHeight
                : 16 / 9;
            const viewW = viewH * aspect;
            // Unity 的 Camera 坐标以屏幕高度为统一基准；CameraAspect 才按实际宽高比扩展 X。
            const xExtent = ct === DecPlacementType.CameraAspect ? viewW : viewH;
            const worldOffsetX = this.currentPosition.x / 20 * xExtent;
            const worldOffsetY = this.currentPosition.y / 20 * viewH;
            const cosR = Math.cos(camRot);
            const sinR = Math.sin(camRot);
            const rotatedX = worldOffsetX * cosR - worldOffsetY * sinR;
            const rotatedY = worldOffsetX * sinR + worldOffsetY * cosR;
            posX = camPos.x + rotatedX + this.currentParallaxOffset.x * parallaxOffsetMul;
            posY = camPos.y + rotatedY + this.currentParallaxOffset.y * parallaxOffsetMul;
            this.container.rotation.z = this.config.lockRotation
                ? camRot + this.currentRotation * Math.PI / 180
                : this.currentRotation * Math.PI / 180;
        } else {
            let followOffsetX = 0, followOffsetY = 0;
            if (ct === DecPlacementType.RedPlanet || ct === DecPlacementType.BluePlanet || ct === DecPlacementType.GreenPlanet) {
                const planet = runtime?.planetPositions?.[ct];
                if (planet) {
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
            const px = (camPos.x - this.pivotPos.x) * this.currentParallax.x;
            const py = (camPos.y - this.pivotPos.y) * this.currentParallax.y;
            posX = this.currentPosition.x + px + this.currentParallaxOffset.x * parallaxOffsetMul + followOffsetX + stickOffsetX;
            posY = this.currentPosition.y + py + this.currentParallaxOffset.y * parallaxOffsetMul + followOffsetY + stickOffsetY;
            // Rotation: official priority: stickToFloor (floor rot) > lockRotation (camera rot) > none
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
        this.container.scale.set(this.currentScale.x * totalScaleMul, this.currentScale.y * totalScaleMul, 1);
        if (this.instSlot) this.syncInstance();
    }

    public setCulledVisible(vis: boolean): void {
        this._culledVisible = vis;
        const effective = vis && (this.config.visible !== false) && this.currentOpacity > 0.001;
        if (this._instVisible !== effective) {
            this._instVisible = effective;
            this.container.visible = effective;
        }
        if (this.instSlot) this.syncInstance();
    }

    public updateAnimation(now: number, tm?: TimelineManager): void {
        if (!tm || !this.config.tag) return;
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
        let dirty = false;

        const sampleAny = (prop: string): number | undefined => tm.sample(kv, prop, now);
        const sampleAnyDiscrete = (prop: string): string | boolean | number | undefined => tm.sampleDiscrete(kv, prop, now);

        // 数值动画属性
        const px = sampleAny('positionX');
        if (px !== undefined) { this.currentPosition.x = px; this.pivotPos.x = px; dirty = true; }
        const py = sampleAny('positionY');
        if (py !== undefined) { this.currentPosition.y = py; this.pivotPos.y = py; dirty = true; }
        const rot = sampleAny('rotation');
        if (rot !== undefined) { this.currentRotation = this.config.rotation + rot; dirty = true; }
        const sx = sampleAny('scaleX');
        if (sx !== undefined && this.config.decorationType !== DecorationType.Particle) { this.currentScale.x = sx; dirty = true; }
        const sy = sampleAny('scaleY');
        if (sy !== undefined && this.config.decorationType !== DecorationType.Particle) { this.currentScale.y = sy; dirty = true; }
        const op = sampleAny('opacity');
        if (op !== undefined) { this.currentOpacity = op; dirty = true; }
        const parX = sampleAny('parallaxX');
        if (parX !== undefined) { this.currentParallax.x = parX; dirty = true; }
        const parY = sampleAny('parallaxY');
        if (parY !== undefined) { this.currentParallax.y = parY; dirty = true; }
        const pox = sampleAny('parallaxOffsetX');
        if (pox !== undefined) { this.currentParallaxOffset.x = pox; dirty = true; }
        const poy = sampleAny('parallaxOffsetY');
        if (poy !== undefined) { this.currentParallaxOffset.y = poy; dirty = true; }

        // color (RGB)
        const cr = sampleAny('colorR');
        const cg = sampleAny('colorG');
        const cb = sampleAny('colorB');
        if (cr !== undefined) { this.currentColor.r = cr; dirty = true; }
        if (cg !== undefined) { this.currentColor.g = cg; dirty = true; }
        if (cb !== undefined) { this.currentColor.b = cb; dirty = true; }

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
        const mT = sampleAnyDiscrete('maskingType');
        const mTgt = sampleAnyDiscrete('maskingTarget');
        if ((typeof mT === 'string' && mT !== this.config.maskingType)
            || (typeof mTgt === 'string' && mTgt !== this.config.maskingTarget)) {
            if (typeof mT === 'string') this.config.maskingType = mT as MaskingType;
            if (typeof mTgt === 'string') this.config.maskingTarget = mTgt;
            if (this._manager) this._manager.applyMaskTo(this);
        }

        // SetText / SetObject 离散属性
        const txt = sampleAnyDiscrete('text');
        if (typeof txt === 'string' && txt !== this._lastText) {
            this._lastText = txt;
            if (this._manager && this.config.decorationType === DecorationType.Text) {
                this._manager.applyTextTo(this, txt);
            }
        }
        const pCol = sampleAnyDiscrete('planetColor');
        if (typeof pCol === 'string' && pCol !== this._lastPlanetColor) {
            this._lastPlanetColor = pCol;
            if (this._manager) this._manager.applyObjectPropsTo(this, { planetColor: pCol });
        }
        const pTail = sampleAnyDiscrete('planetTailColor');
        if (typeof pTail === 'string' && pTail !== this._lastPlanetTailColor) {
            this._lastPlanetTailColor = pTail;
            if (this._manager) this._manager.applyObjectPropsTo(this, { planetTailColor: pTail });
        }
        const tCol = sampleAnyDiscrete('trackColor');
        if (typeof tCol === 'string' && tCol !== this._lastTrackColor) {
            this._lastTrackColor = tCol;
            if (this._manager) this._manager.applyObjectPropsTo(this, { trackColor: tCol });
        }
        const tOp = sampleAnyDiscrete('trackOpacity');
        if (typeof tOp === 'number' && tOp !== this._lastTrackOpacity) {
            this._lastTrackOpacity = tOp;
            if (this._manager) this._manager.applyObjectPropsTo(this, { trackOpacity: tOp });
        }
        const tIcon = sampleAnyDiscrete('trackIcon');
        if (typeof tIcon === 'string' && tIcon !== this._lastTrackIcon) {
            this._lastTrackIcon = tIcon;
            if (this._manager) this._manager.applyObjectPropsTo(this, { trackIcon: tIcon });
        }

        if (dirty) this.updateTransform();
    }

    public reset(): void {
        this.config.visible = this.originalVisible;
        this.config.depth = this.originalDepth;
        this.currentScale.set(this.config.scale[0] / 100, this.config.scale[1] / 100);
        if (this.config.decorationType === DecorationType.Particle) this.currentScale.set(1, 1);
        this.currentRotation = this.config.rotation + this.config.rotationOffset;
        const [colorHex, colorAlpha] = parseDecoColor(this.config.color);
        this.currentColor.set(colorHex);
        this.currentOpacity = (this.config.opacity / 100) * colorAlpha;
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
    private taggedDecorations: Map<string, DecorationInstance[]> = new Map();
    private decorationEventsTimeline: { time: number; event: any }[] = [];
    private pendingDecorationEvents: any[] = [];
    private tileSize: number = 1.0;
    private textureLoader: TextureLoader;
    private textureCache: Map<string, Texture> = new Map();
    private floorGeoCache: Map<string, { positions: Float32Array; indices: Uint32Array; mask: Float32Array; vertexCount: number }> = new Map();
    private trailGeoCache: Map<string, Mesh> = new Map();
    private customImages: Map<string, string> = new Map();
    private texturesLoading: Set<string> = new Set();
    private texturesLoaded: Set<string> = new Set();
    private placeholderTexture: Texture | null = null;
    private _lastCamX = 0; private _lastCamY = 0; private _lastCamZoom = 0;
    private _lastNow = 0;
    private _particlesStarted: Set<DecorationInstance> = new Set();
    private _timelineManager: TimelineManager | null = null;
    private _staticGrid: DecorationSpatialGrid = new DecorationSpatialGrid(32);
    private _staticDecos: DecorationInstance[] = [];
    private _dynamicDecos: DecorationInstance[] = [];
    private _tilePositions: Map<number, { x: number; y: number; z: number; rotation: number }> = new Map();
    private _visibleStaticSet: Set<DecorationInstance> = new Set();
    private instancedRenderer: DecorationInstancedRenderer;

    constructor(scene: Scene, levelData: any, tileStartTimes: number[], tileBPM: number[]) {
        this.scene = scene;
        this.levelData = levelData;
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
        const s = levelData.settings || {};
        this.tileSize = s.tileShape === 'Long' ? 1.5 : 1.0;
        this.container = new Group();
        this.container.name = 'DecorationContainer';
        this.scene.add(this.container);
        this.textureLoader = new TextureLoader();
        this.instancedRenderer = new DecorationInstancedRenderer(this.container);
    }

    public init(): void {
        this.clear();
        const rootDecos = this.levelData.decorations || (this.levelData as any).__decorations || [];
        const tiles = this.levelData.tiles || [];

        for (const dec of rootDecos) {
            if (dec.eventType === 'AddDecoration' || dec.eventType === 'AddText' || dec.eventType === 'AddObject' || dec.eventType === 'AddParticle') {
                this.tryCreateDecoration(dec);
            }
        }
        for (const tile of tiles) {
            if (tile.addDecorations) {
                for (const dec of tile.addDecorations) {
                    if (dec.eventType === 'AddDecoration' || dec.eventType === 'AddText' || dec.eventType === 'AddObject' || dec.eventType === 'AddParticle') {
                        this.tryCreateDecoration({ ...dec, floor: dec.floor ?? tile.seqID ?? tiles.indexOf(tile) });
                    }
                }
            }
        }
        this.buildDecorationEventsTimeline();
        debugLog('[DecorationManager] Spatial grid Patch: enabled | total=' + this.decoList.length
            + ' static=' + this._staticDecos.length
            + ' dynamic=' + this._dynamicDecos.length
            + ' cells=' + this._staticGrid.lastQueryCount
            + ' cellSize=' + 32);
    }

    public buildTimelineKeyframes(tm: TimelineManager): void {
        const ts = this.tileSize;
        const entries = this.decorationEventsTimeline;

        // 每个装饰独立时间轴（deco:{id}），事件按 tag 匹配展开到各装饰，
        // 目标值基于装饰自身初始值计算——同 tag 不同 scale/position 的装饰互不影响。
        for (const deco of this.decoList) {
            const kv = `deco:${deco.config.id}`;
            const decoTags = (deco.config.tag || '').split(/\s+/).filter(Boolean);

            const [baseColorHex] = parseDecoColor(deco.config.color, 'ffffff');
            const [baseCR, baseCG, baseCB] = hexToRGB01(baseColorHex);
            const baseOp0 = (deco.config.opacity / 100) * parseDecoColor(deco.config.color, 'ffffff')[1];
            const basePosX = deco.startPos.x;
            const basePosY = deco.startPos.y;

            for (const entry of entries) {
                const { time: eventTime, event } = entry;
                if (!isEventActive(event)) continue;
                const eventTags = (event.tag || '').split(/\s+/).filter(Boolean);
                if (!decoTags.some(t => eventTags.includes(t))) continue;

                // SetText / SetObject：离散轨（decText / 物体属性）
                if (event.eventType === 'SetText') {
                    tm.addDiscreteKeyframe(kv, 'text', eventTime, String(event.decText ?? ''));
                    continue;
                }
                if (event.eventType === 'SetObject') {
                    if (event.planetColor !== undefined && !event.disabled?.planetColor) {
                        tm.addDiscreteKeyframe(kv, 'planetColor', eventTime, String(event.planetColor));
                    }
                    if (event.planetTailColor !== undefined && !event.disabled?.planetTailColor) {
                        tm.addDiscreteKeyframe(kv, 'planetTailColor', eventTime, String(event.planetTailColor));
                    }
                    if (event.trackColor !== undefined && !event.disabled?.trackColor) {
                        tm.addDiscreteKeyframe(kv, 'trackColor', eventTime, String(event.trackColor));
                    }
                    if (event.trackOpacity !== undefined && !event.disabled?.opacity) {
                        tm.addDiscreteKeyframe(kv, 'trackOpacity', eventTime, event.trackOpacity);
                    }
                    if (event.trackIcon !== undefined && !event.disabled?.trackIcon) {
                        tm.addDiscreteKeyframe(kv, 'trackIcon', eventTime, String(event.trackIcon));
                    }
                    continue;
                }
                if (event.eventType !== 'MoveDecorations') continue;

                const floor = event.floor ?? 0;
                const bpm = this.tileBPM[floor] || 100;
                const duration = (event.duration || 0) * 60 / bpm;
                const ease = event.ease || 'Linear';
                const movementType = this.parsePlacement(event.relativeTo);
                const isLastPos = movementType === DecPlacementType.LastPosition;
                const endTime = eventTime + duration;
                const hasDur = duration > 0;

                if (event.positionOffset !== undefined && !event.disabled?.positionOffset) {
                    const pos = this.parseVec2(event.positionOffset, [0, 0]);
                    const offX = pos[0] * ts;
                    const offY = pos[1] * ts;
                    const startX = tm.sample(kv, 'positionX', eventTime) ?? basePosX;
                    const startY = tm.sample(kv, 'positionY', eventTime) ?? basePosY;
                    const endX = isLastPos ? startX + offX : basePosX + offX;
                    const endY = isLastPos ? startY + offY : basePosY + offY;
                    if (hasDur) {
                        tm.addTween(kv, 'positionX', eventTime, endTime, startX, endX, ease);
                        tm.addTween(kv, 'positionY', eventTime, endTime, startY, endY, ease);
                    } else {
                        tm.addKeyframe(kv, 'positionX', eventTime, endX, null);
                        tm.addKeyframe(kv, 'positionY', eventTime, endY, null);
                    }
                }

                if (event.rotationOffset !== undefined && !event.disabled?.rotationOffset) {
                    const endRot = event.rotationOffset;
                    const startRot = tm.sample(kv, 'rotation', eventTime) ?? 0;
                    if (hasDur) {
                        tm.addTween(kv, 'rotation', eventTime, endTime, startRot, endRot, ease);
                    } else {
                        tm.addKeyframe(kv, 'rotation', eventTime, endRot, null);
                    }
                }

                if (event.scale !== undefined && !event.disabled?.scale) {
                    const s = this.parseVec2(event.scale, [100, 100]);
                    const endSX = s[0] / 100;
                    const endSY = s[1] / 100;
                    const startSX = tm.sample(kv, 'scaleX', eventTime) ?? (deco.config.scale[0] / 100);
                    const startSY = tm.sample(kv, 'scaleY', eventTime) ?? (deco.config.scale[1] / 100);
                    if (hasDur) {
                        tm.addTween(kv, 'scaleX', eventTime, endTime, startSX, endSX, ease);
                        tm.addTween(kv, 'scaleY', eventTime, endTime, startSY, endSY, ease);
                    } else {
                        tm.addKeyframe(kv, 'scaleX', eventTime, endSX, null);
                        tm.addKeyframe(kv, 'scaleY', eventTime, endSY, null);
                    }
                }

                if (event.opacity !== undefined && !event.disabled?.opacity) {
                    const endOp = event.opacity / 100;
                    const startOp = tm.sample(kv, 'opacity', eventTime) ?? baseOp0;
                    if (hasDur) {
                        tm.addTween(kv, 'opacity', eventTime, endTime, startOp, endOp, ease);
                    } else {
                        tm.addKeyframe(kv, 'opacity', eventTime, endOp, null);
                    }
                }

                if (event.parallax !== undefined && !event.disabled?.parallax) {
                    const p = this.parseVec2(event.parallax, [100, 100]);
                    const endParX = p[0] / 100;
                    const endParY = p[1] / 100;
                    const startParX = tm.sample(kv, 'parallaxX', eventTime) ?? (deco.config.parallax[0] / 100);
                    const startParY = tm.sample(kv, 'parallaxY', eventTime) ?? (deco.config.parallax[1] / 100);
                    if (hasDur) {
                        tm.addTween(kv, 'parallaxX', eventTime, endTime, startParX, endParX, ease);
                        tm.addTween(kv, 'parallaxY', eventTime, endTime, startParY, endParY, ease);
                    } else {
                        tm.addKeyframe(kv, 'parallaxX', eventTime, endParX, null);
                        tm.addKeyframe(kv, 'parallaxY', eventTime, endParY, null);
                    }
                }

                if (event.parallaxOffset !== undefined && !event.disabled?.parallaxOffset) {
                    const po = this.parseVec2(event.parallaxOffset, [0, 0]);
                    const endPOX = po[0] * ts;
                    const endPOY = po[1] * ts;
                    const startPOX = tm.sample(kv, 'parallaxOffsetX', eventTime) ?? deco.config.parallaxOffset[0];
                    const startPOY = tm.sample(kv, 'parallaxOffsetY', eventTime) ?? deco.config.parallaxOffset[1];
                    if (hasDur) {
                        tm.addTween(kv, 'parallaxOffsetX', eventTime, endTime, startPOX, endPOX, ease);
                        tm.addTween(kv, 'parallaxOffsetY', eventTime, endTime, startPOY, endPOY, ease);
                    } else {
                        tm.addKeyframe(kv, 'parallaxOffsetX', eventTime, endPOX, null);
                        tm.addKeyframe(kv, 'parallaxOffsetY', eventTime, endPOY, null);
                    }
                }

                if (event.pivotOffset !== undefined && !event.disabled?.pivotOffset) {
                    const pv = this.parseVec2(event.pivotOffset, [0, 0]);
                    const endPVX = pv[0] * ts;
                    const endPVY = pv[1] * ts;
                    const startPVX = tm.sample(kv, 'pivotOffsetX', eventTime) ?? deco.config.pivotOffset[0];
                    const startPVY = tm.sample(kv, 'pivotOffsetY', eventTime) ?? deco.config.pivotOffset[1];
                    if (hasDur) {
                        tm.addTween(kv, 'pivotOffsetX', eventTime, endTime, startPVX, endPVX, ease);
                        tm.addTween(kv, 'pivotOffsetY', eventTime, endTime, startPVY, endPVY, ease);
                    } else {
                        tm.addKeyframe(kv, 'pivotOffsetX', eventTime, endPVX, null);
                        tm.addKeyframe(kv, 'pivotOffsetY', eventTime, endPVY, null);
                    }
                }

                if (event.color !== undefined && !event.disabled?.color) {
                    const [cHex, cAlpha] = parseDecoColor(event.color, 'ffffff');
                    const [eR, eG, eB] = hexToRGB01(cHex);
                    const sR = tm.sample(kv, 'colorR', eventTime) ?? baseCR;
                    const sG = tm.sample(kv, 'colorG', eventTime) ?? baseCG;
                    const sB = tm.sample(kv, 'colorB', eventTime) ?? baseCB;
                    if (hasDur) {
                        tm.addTween(kv, 'colorR', eventTime, endTime, sR, eR, ease);
                        tm.addTween(kv, 'colorG', eventTime, endTime, sG, eG, ease);
                        tm.addTween(kv, 'colorB', eventTime, endTime, sB, eB, ease);
                    } else {
                        tm.addKeyframe(kv, 'colorR', eventTime, eR, null);
                        tm.addKeyframe(kv, 'colorG', eventTime, eG, null);
                        tm.addKeyframe(kv, 'colorB', eventTime, eB, null);
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
                if (event.maskingTarget !== undefined && !event.disabled?.maskingTarget) {
                    tm.addDiscreteKeyframe(kv, 'maskingTarget', eventTime, String(event.maskingTarget));
                }
            }
        }
    }


    private tryCreateDecoration(event: any): DecorationInstance | null {
        if (!isEventActive(event)) return null;
        const deco = this.createDecoration(event);
        if (!deco) this.pendingDecorationEvents.push(event);
        return deco;
    }

    private computeStartPos(position: [number, number], relativeTo: DecPlacementType, floor?: number): Vector2 {
        const tiles = this.levelData.tiles;
        const ts = this.tileSize;
        let pos = new Vector2(position[0] * ts, position[1] * ts);
        if (relativeTo === DecPlacementType.Tile && floor !== undefined && tiles?.[floor]?.position) {
            const tp = tiles[floor].position;
            pos.x += tp[0]; pos.y += tp[1];
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

        const floor = event.floor !== undefined ? event.floor
            : event.parentFloorNum !== undefined ? event.parentFloorNum
                : 0;
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
            scale: this.parseVec2(event.scale, [100, 100]),
            parallax: this.parseVec2(event.parallax, [100, 100]),
            parallaxOffset: [rawParallaxOffset[0] * ts, rawParallaxOffset[1] * ts],
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
            lockScale: event.lockScale === true,
            lockRotation: event.lockRotation === true,
            visible: parseEventVisible(event.visible),
            scaleMultiplier: event.scaleMultiplier !== undefined ? event.scaleMultiplier : 1,
            stickToFloor: event.stickToFloor === true,
            floor,
            objectType: event.objectType,
            planetColorType: event.planetColorType,
            planetColor: event.planetColor,
            planetTailColor: event.planetTailColor,
            trackColor: event.trackColor,
            trackColor2: event.trackColor2 || event.trackColor,
            trackOpacity: event.trackOpacity,
            trackStyle: event.trackStyle,
            trackIcon: event.trackIcon,
            blendMode: event.blendMode || DecorationBlendMode.None,
            maskingType: event.maskingType || MaskingType.None,
            maskingTarget: event.maskingTarget || '',
            imageSmoothing: event.imageSmoothing === true,
        };

        const deco = new DecorationInstance(config);
        deco.sourceEvent = { ...event };
        deco.setInstancedRenderer(this.instancedRenderer);
        const initialPosition: [number, number] = [rawPos[0] + rawPositionOffset[0], rawPos[1] + rawPositionOffset[1]];
        deco.startPos.copy(this.computeStartPos(initialPosition, relativeTo, floor));
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

    private setupObjectVisual(deco: DecorationInstance, event: any): boolean {
        const g = new Group();
        const objType = event.objectType || 'Planet';
        if (objType === 'Planet') {
            const [pColor, pAlpha] = parseDecoColor(event.planetColor, 'ffffff');
            const mat = new MeshBasicMaterial({ color: new Color(pColor), transparent: true, opacity: pAlpha });
            const sphere = new Mesh(new CircleGeometry(0.4, 32), mat);
            sphere.name = 'planetBody';
            g.add(sphere);
            if (event.planetTailColor) {
                const [tColor, tAlpha] = parseDecoColor(event.planetTailColor, 'ffffff');
                const tailMat = new MeshBasicMaterial({ color: new Color(tColor), transparent: true, opacity: tAlpha * 0.5 });
                const tail = new Mesh(new RingGeometry(0.35, 0.5, 32), tailMat);
                tail.name = 'planetTail';
                g.add(tail);
            }
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
                const geometry = new BufferGeometry();
                geometry.setIndex(new BufferAttribute(tpl.indices, 1));
                geometry.setAttribute('position', new BufferAttribute(tpl.positions, 3));
                const colorArray = new Float32Array(tpl.vertexCount * 3);
                geometry.setAttribute('color', new BufferAttribute(colorArray, 3));
                geometry.computeVertexNormals();

                const trackColor = event.trackColor;
                const trackColor2 = event.trackColor2 || trackColor;

                if (trackColor) {
                    const [fillHex] = parseDecoColor(trackColor, 'ffffff');
                    const [borderHex] = parseDecoColor(trackColor2, 'ffffff');
                    const cFillR = parseInt(fillHex.slice(1, 3), 16) / 255;
                    const cFillG = parseInt(fillHex.slice(3, 5), 16) / 255;
                    const cFillB = parseInt(fillHex.slice(5, 7), 16) / 255;
                    const cBorderR = parseInt(borderHex.slice(1, 3), 16) / 255;
                    const cBorderG = parseInt(borderHex.slice(3, 5), 16) / 255;
                    const cBorderB = parseInt(borderHex.slice(5, 7), 16) / 255;
                    const mask = tpl.mask;
                    for (let i = 0; i < colorArray.length; i += 3) {
                        if (mask[i] < 0.5) {
                            colorArray[i] = cBorderR; colorArray[i + 1] = cBorderG; colorArray[i + 2] = cBorderB;
                        } else {
                            colorArray[i] = cFillR; colorArray[i + 1] = cFillG; colorArray[i + 2] = cFillB;
                        }
                    }
                }

                const mat = new MeshBasicMaterial({ vertexColors: true, transparent: trackOpacity < 1, opacity: trackOpacity, side: DoubleSide });
                const tileMesh = new Mesh(geometry, mat);
                g.add(tileMesh);
            }

            // Track icon overlay using PNG sprites (matching ADOFAI CustomFloorIcon)
            const trackIcon = event.trackIcon;
            if (trackIcon && trackIcon !== 'None') {
                const texType = getIconTextureForCustomFloor(trackIcon);
                if (texType) {
                    const tex = getIconTexture(texType);
                    const sprite = createIconSprite(tex, trackOpacity, 0.44);
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
        const cached = this.textureCache.get(filename);
        if (cached) {
            this.createParticleSystem(deco, event, cached);
            return;
        }
        const url = this.findImageUrl(filename);
        if (!url) {
            this.pendingDecorationEvents.push(event);
            return;
        }
        // 走全局纹理队列（限并发），加载完成后 afterTextureLoaded 创建粒子系统
        this.enqueueTextureLoad(filename, url);
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
            loop: event.loop === true,
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

    private loadDecoTexture(filename: string, deco: DecorationInstance): boolean {
        const cached = this.textureCache.get(filename);
        if (cached) { deco.setupVisual(cached); return true; }
        const url = this.findImageUrl(filename);
        if (!url) {
            // 装饰图未导入：使用全透明占位纹理（不显示任何内容）
            if (!this.placeholderTexture) {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const tex = new CanvasTexture(canvas);
                tex.colorSpace = SRGBColorSpace;
                this.placeholderTexture = tex;
            }
            deco.setupVisual(this.placeholderTexture);
            return true;
        }
        this.enqueueTextureLoad(filename, url);
        return true;
    }

    /**
     * 全局纹理加载队列（限并发，防止大图同时解码导致 OOM）。
     * 加载完成后自动回调 setupVisual / createParticleSystem。
     */
    private textureQueue: { filename: string; url: string }[] = [];
    private textureLoadingCount = 0;
    private static readonly MAX_TEX_CONCURRENT = 4;

    private enqueueTextureLoad(filename: string, url: string): void {
        if (this.textureCache.has(filename) || this.texturesLoading.has(filename)) return;
        this.textureQueue.push({ filename, url });
        this.pumpTextureQueue();
    }

    private pumpTextureQueue(): void {
        while (this.textureLoadingCount < DecorationManager.MAX_TEX_CONCURRENT && this.textureQueue.length > 0) {
            const job = this.textureQueue.shift()!;
            if (this.textureCache.has(job.filename) || this.texturesLoading.has(job.filename)) continue;
            this.texturesLoading.add(job.filename);
            this.textureLoadingCount++;
            this.textureLoader.load(job.url, (tex) => {
                tex.colorSpace = SRGBColorSpace;
                this.textureCache.set(job.filename, tex);
                this.texturesLoaded.add(job.filename);
                this.texturesLoading.delete(job.filename);
                this.textureLoadingCount--;
                this.afterTextureLoaded(job.filename, tex);
                this.pumpTextureQueue();
            }, undefined, () => {
                this.texturesLoading.delete(job.filename);
                this.textureLoadingCount--;
                this.pumpTextureQueue();
            });
        }
    }

    private afterTextureLoaded(filename: string, tex: Texture): void {
        for (const d of this.decoList) {
            if (d.config.decorationImage !== filename) continue;
            if (d.config.decorationType === DecorationType.Particle) {
                if (!d.particles && d.sourceEvent) this.createParticleSystem(d, d.sourceEvent, tex);
            } else {
                d.setupVisual(tex);
                d.syncInstance();
            }
        }
        this.instancedRenderer.flush();
    }

    private findImageUrl(filename: string): string | undefined {
        let u = this.customImages.get(filename);
        if (u) return u;
        const base = filename.split(/[/\\]/).pop()!;
        u = this.customImages.get(base);
        if (u) return u;
        for (const [k, v] of this.customImages) {
            if (k.endsWith(filename) || filename.endsWith(k)) return v;
        }
        return undefined;
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
    }

    private buildDecorationEventsTimeline(): void {
        this.decorationEventsTimeline = [];
        const actions = this.levelData.actions || [];

        // Collect all decoration events grouped by floor (matching CameraController.buildCameraTimeline)
        const byFloor = new Map<number, any[]>();
        for (const action of actions) {
            if (action.eventType === 'MoveDecorations' || action.eventType === 'SetText' || action.eventType === 'SetObject') {
                const floor = action.floor ?? 0;
                if (!byFloor.has(floor)) byFloor.set(floor, []);
                byFloor.get(floor)!.push(action);
            }
        }

        const entries: { time: number; event: any }[] = [];

        byFloor.forEach((events, floor) => {
            const startTime = this.tileStartTimes[floor] || 0;
            const bpm = this.tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;

            // Sort by event id for stable ordering within same floor
            const sorted = [...events].sort((a, b) => (a.id ?? Infinity) - (b.id ?? Infinity));
            const zeroOffsetEvents = sorted.filter(e => (e.angleOffset || 0) === 0);

            sorted.forEach((event) => {
                const ao = event.angleOffset || 0;
                let offset = (ao / 180) * secPerBeat;
                // Micro-offset for multiple zero-angleOffset events (matching camera)
                if (ao === 0 && zeroOffsetEvents.length > 1) {
                    const order = zeroOffsetEvents.findIndex(e => e.id === event.id);
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
        if (base !== filename) this.customImages.set(base, url);
        const existing = this.textureCache.get(filename);
        if (existing) { existing.dispose(); this.textureCache.delete(filename); }
        this.texturesLoaded.delete(filename);
        // 图片可用后立即触发相关装饰的纹理加载（不再等 preloadTextures）
        this.enqueueTextureLoad(filename, url);
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
        // 走全局纹理队列（限并发）
        for (const fn of filenames) {
            const url = this.findImageUrl(fn);
            if (url) this.enqueueTextureLoad(fn, url);
        }
        // 等待队列排空（轮询）
        while (this.textureQueue.length > 0 || this.textureLoadingCount > 0) {
            this.pumpTextureQueue();
            await new Promise(r => setTimeout(r, 16));
        }
        this.retryPending();
        this.decoList.forEach(d => {
            if (d.config.decorationImage && d.config.decorationType !== DecorationType.Particle) {
                const tex = this.textureCache.get(d.config.decorationImage);
                if (tex && !d.isInstanced && !d.sprite && !d.mesh) { d.setupVisual(tex); }
            }
        });
        this.instancedRenderer.flush();
        return this.texturesLoaded.size;
    }

    public update(elapsedTime: number, cameraPosition: Vector3, cameraRotation: number, cameraZoom: number, timelineManager?: TimelineManager, adoZoom?: number, runtime?: DecorationRuntimeContext): void {
        const now = elapsedTime / 1000;
        const dt = Math.min(0.1, Math.max(0, now - this._lastNow));
        this._lastNow = now;
        const camZ = cameraZoom;
        // 粒子系统驱动
        for (const d of this.decoList) {
            if (!d.particles) continue;
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
        const camMoved = Math.abs(camX - this._lastCamX) > 0.01 || Math.abs(camY - this._lastCamY) > 0.01 || Math.abs(camZ - this._lastCamZoom) > 0.001;
        if (camMoved) { this._lastCamX = camX; this._lastCamY = camY; this._lastCamZoom = camZ; }
        const list = this.decoList;
        const len = list.length;
        let animCount = 0;
        let needsTilePositions = false;
        for (let i = 0; i < len; i++) {
            const d = list[i];
            if (this._timelineManager && d.config.tag) { d.updateAnimation(now, this._timelineManager!); animCount++; }
            if (d.config.stickToFloor || d.config.relativeTo === DecPlacementType.RedPlanet
                || d.config.relativeTo === DecPlacementType.BluePlanet
                || d.config.relativeTo === DecPlacementType.GreenPlanet) {
                needsTilePositions = true;
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
            for (const [idx, pos] of timelineManager!.sampleAllPosition(now)) {
                const sx = timelineManager!.sample(`tile:${idx}`, 'scaleX', now);
                const sy = timelineManager!.sample(`tile:${idx}`, 'scaleY', now);
                const scale = sx !== undefined ? ((sx + (sy ?? sx)) / 2) : 1;
                const rot = needsStickRotation ? (timelineManager!.sample(`tile:${idx}`, 'rotation', now) ?? 0) : 0;
                this._tilePositions.set(idx, { x: pos.x, y: pos.y, z: scale, rotation: rot });
            }
        }
        if (!camMoved && animCount === 0 && !tilePositions) {
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
        // Spatial grid: query static decorations in cells overlapping the camera view.
        const visibleStatic = this._staticGrid.query(minX, minY, maxX, maxY);
        this._visibleStaticSet.clear();
        for (let i = 0; i < visibleStatic.length; i++) this._visibleStaticSet.add(visibleStatic[i]);
        // Include animated statics even if outside original cell
        const sLen = this._staticDecos.length;
        for (let i = 0; i < sLen; i++) {
            const d = this._staticDecos[i];
            if ((this._timelineManager && d.config.tag) && !this._visibleStaticSet.has(d)) {
                visibleStatic.push(d);
            }
        }
        const dLen = this._dynamicDecos.length;
        for (let i = 0; i < dLen; i++) {
            const d = this._dynamicDecos[i];
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
                    hw = hh = Math.max(csx, csy) * 0.5;
                } else {
                    hw = csx * 0.5; hh = csy * 0.5;
                }
                const vis = p.x + hw >= minX && p.x - hw <= maxX && p.y + hh >= minY && p.y - hh <= maxY;
                d.setCulledVisible(vis);
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
                    hw = hh = Math.max(csx, csy) * 0.5;
                } else {
                    hw = csx * 0.5; hh = csy * 0.5;
                }
                const vis = p.x + hw >= minX && p.x - hw <= maxX && p.y + hh >= minY && p.y - hh <= maxY;
                d.setCulledVisible(vis);
            } else {
                d.setCulledVisible(false);
            }
        }
        this.instancedRenderer.flush();
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
        const texture = this.textureCache.get(deco.config.decorationImage);
        if (texture) deco.setupVisual(texture);
    }

    /** 时间轴采样驱动：SetText。 */
    public applyTextTo(deco: DecorationInstance, text: string): void {
        deco.config.decText = text;
        const ev: any = { decText: text, color: deco.config.color, fontSize: 48, font: undefined };
        this.setupTextVisual(deco, ev);
    }

    /** 时间轴采样驱动：SetObject（Planet / Floor 属性）。 */
    public applyObjectPropsTo(deco: DecorationInstance, props: Partial<DecorationConfig>): void {
        if (deco.config.decorationType !== DecorationType.Object) return;
        if (props.planetColor !== undefined) {
            deco.config.planetColor = props.planetColor;
            const [hex, alpha] = parseDecoColor(props.planetColor, 'ffffff');
            deco.currentColor.set(hex);
            deco.currentOpacity = (deco.config.opacity / 100) * alpha;
        }
        if (props.planetTailColor !== undefined) {
            deco.config.planetTailColor = props.planetTailColor;
            if (deco.planetTrailParticles && deco.planetTrailParticles.geometry) {
                const [tailC] = parseDecoColor(props.planetTailColor, 'ffffff');
                const tailColorRGB = hexToRGB01(tailC);
                const colors = deco.planetTrailParticles.geometry.getAttribute('color');
                if (colors) {
                    for (let i = 0; i < colors.count; i++) {
                        colors.setXYZ(i, tailColorRGB[0], tailColorRGB[1], tailColorRGB[2]);
                    }
                    colors.needsUpdate = true;
                }
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

        // Unity ResetDecoration 会用更新后的 sourceLevelEvent 重新构建 Object renderer。
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
        for (let i = 0; i < list.length; i++) { list[i].dispose(); this.container.remove(list[i].container); }
        this.decorations.clear();
        this.decoList.length = 0;
        this._staticDecos.length = 0;
        this._dynamicDecos.length = 0;
        this._staticGrid.clear();
        this.taggedDecorations.clear();
        this.floorGeoCache.clear();
        this.decorationEventsTimeline = [];
        this._tilePositions.clear();
        this.instancedRenderer.clear();
        if (hadDecos) {
            debugLog('[DecorationManager] Spatial grid Patch: disabled (cleared)');
        }
    }

    public dispose(): void {
        this.clear();
        this.instancedRenderer.dispose();
        this.textureCache.forEach(t => t.dispose());
        this.textureCache.clear();
        if (this.placeholderTexture) { this.placeholderTexture.dispose(); this.placeholderTexture = null; }
        this.scene.remove(this.container);
    }

    private parsePlacement(v: any): DecPlacementType {
        if (!v) return DecPlacementType.Tile;
        switch (v) {
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
            default: return DecPlacementType.Tile;
        }
    }

    private parseVec2(v: any, def: [number, number]): [number, number] {
        if (!v) return def;
        if (Array.isArray(v) && v.length >= 2) return [Number(v[0]), Number(v[1])];
        // Handle string vectors like "[1, 2]" or "(1, 2)"
        if (typeof v === 'string') {
            const m = v.match(/-?\d+\.?\d*/g);
            if (m && m.length >= 2) return [parseFloat(m[0]), parseFloat(m[1])];
        }
        // Handle single number as uniform value (e.g., scale: 50 → [50, 50])
        if (typeof v === 'number') return [v, v];
        return def;
    }
}