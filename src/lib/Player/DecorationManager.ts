import { Group, Mesh, Sprite, Vector2, Color, Texture, MeshBasicMaterial, SpriteMaterial, Material, CanvasTexture, CircleGeometry, RingGeometry, BufferGeometry, BufferAttribute, SRGBColorSpace, DoubleSide, Scene, TextureLoader, PlaneGeometry, Vector3, WebGLRenderTarget, Float32BufferAttribute, NormalBlending, AdditiveBlending, MultiplyBlending, CustomBlending, AddEquation, ReverseSubtractEquation, LinearFilter, LinearMipMapLinearFilter, Blending } from 'three';
import { EasingFunctions } from './Easing';
import { TimelineManager } from './TimelineManager';
import createTrackMesh from '../Geo/mesh_reserve';
import { isEventActive } from './EventUtils';
import { getIconTexture, getIconTextureForCustomFloor, createIconSprite } from './IconLoader';
import { debugLog } from './DebugLog';
import { DecorationInstancedRenderer, DecoInstanceSlot } from './DecorationInstancedRenderer';

/**
 * Parse ADOFAI hex color which may be #RRGGBBAA (8-digit with alpha).
 * Returns [rgbString, alpha01] where rgbString is #RRGGBB and alpha01 is 0..1.
 * Color only accepts #RRGGBB, so alpha must be split out.
 */
function parseDecoColor(hex: string | undefined, fallback: string = 'ffffff'): [string, number] {
    const raw = (hex || fallback).replace(/^#/, '');
    if (raw.length >= 8) {
        const alpha = parseInt(raw.slice(6, 8), 16) / 255;
        return ['#' + raw.slice(0, 6), alpha];
    }
    return ['#' + raw.slice(0, 6), 1];
}

/**
 * Parse event.visible matching official ADOFAI logic:
 *   - Key missing → true
 *   - Bool value → use it
 *   - Non-bool (string, etc.) → true
 */
function parseEventVisible(val: any): boolean {
    if (val === undefined || val === null) return true;
    if (typeof val === 'boolean') return val;
    return true;
}

function getBlendMode(mode: DecorationBlendMode): number {
    switch (mode) {
        case DecorationBlendMode.Additive: return AdditiveBlending;
        case DecorationBlendMode.Multiply: return MultiplyBlending;
        case DecorationBlendMode.Screen: return CustomBlending;
        case DecorationBlendMode.Subtract: return CustomBlending;
        default: return NormalBlending;
    }
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
    animating: boolean;
    animationStart: number;
    animationDuration: number;
    animationStartValues: Partial<DecorationConfig>;
    animationTargetValues: Partial<DecorationConfig>;
    animationEase: string;
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
    animating: false,
    animationStart: 0,
    animationDuration: 0,
    animationStartValues: {},
    animationTargetValues: {},
    animationEase: 'Linear'
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
    private instRenderer: DecorationInstancedRenderer | null = null;
    private originalVisible: boolean = true;
    private originalDepth: number = 0;
    private animStartR = 0;
    private animStartG = 0;
    private animStartB = 0;
    private animTargetR = 0;
    private animTargetG = 0;
    private animTargetB = 0;
    private animHasColor = false;
    private _isStaticWorld = true;
    private _instVisible = true;

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
            const g = new PlaneGeometry(1, 1);
            const m = new MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5, side: DoubleSide, depthWrite: false });
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
                this.sprite = new Sprite(mat);
                this.sprite.scale.set(this.baseSizeX, this.baseSizeY, 1);
                this.sprite.center.set(0.5, 0.5);
                if (this.config.maskingType === MaskingType.Mask) {
                    (this.sprite as any).mask = null;
                    this.sprite.visible = false;
                }
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

    private syncInstance(): void {
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

    public updatePosition(camPos: Vector3, camRot: number, camZoom: number, tilePositions?: Map<number, { x: number; y: number; z: number; rotation: number }>, adoZoom?: number): void {
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
            const aspect = (typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth / window.innerHeight : 16 / 9;
            const viewW = viewH * aspect;
            const aspectCorrection = ct === DecPlacementType.CameraAspect ? viewH / viewW : 1;
            let worldOffsetX = this.currentPosition.x * aspectCorrection / 20 * viewW;
            let worldOffsetY = this.currentPosition.y / 20 * viewH;
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
                // followPlanet position would be added here if planet positions were tracked
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
        if (this.container.visible !== vis) this.container.visible = vis;
        this._instVisible = vis;
        if (this.instSlot) this.syncInstance();
    }

    public updateAnimation(now: number, tm?: TimelineManager): void {
        if (tm && this.config.tag) {
            const kv = `deco:${this.config.tag}`;
            let dirty = false;
            const px = tm.sample(kv, 'positionX', now);
            if (px !== undefined) { this.currentPosition.x = px; this.pivotPos.x = px; dirty = true; }
            const py = tm.sample(kv, 'positionY', now);
            if (py !== undefined) { this.currentPosition.y = py; this.pivotPos.y = py; dirty = true; }
            const rot = tm.sample(kv, 'rotation', now);
            if (rot !== undefined) { this.currentRotation = this.config.rotation + rot; dirty = true; }
            const sx = tm.sample(kv, 'scaleX', now);
            if (sx !== undefined) { this.currentScale.x = sx; dirty = true; }
            const sy = tm.sample(kv, 'scaleY', now);
            if (sy !== undefined) { this.currentScale.y = sy; dirty = true; }
            const op = tm.sample(kv, 'opacity', now);
            if (op !== undefined) { this.currentOpacity = op; dirty = true; }
            const parX = tm.sample(kv, 'parallaxX', now);
            if (parX !== undefined) { this.currentParallax.x = parX; dirty = true; }
            const parY = tm.sample(kv, 'parallaxY', now);
            if (parY !== undefined) { this.currentParallax.y = parY; dirty = true; }
            const pox = tm.sample(kv, 'parallaxOffsetX', now);
            if (pox !== undefined) { this.currentParallaxOffset.x = pox; dirty = true; }
            const poy = tm.sample(kv, 'parallaxOffsetY', now);
            if (poy !== undefined) { this.currentParallaxOffset.y = poy; dirty = true; }
            if (dirty) this.updateTransform();
            return;
        }
        if (!this.config.animating) return;
        const el = now - this.config.animationStart;
        const dur = this.config.animationDuration;
        if (dur <= 0) { this.config.animating = false; this.applyAnimationTarget(); return; }
        if (el >= dur) { this.config.animating = false; this.applyAnimationTarget(); return; }
        const p = Math.max(0, Math.min(1, el / dur));
        const ease = (EasingFunctions as any)[this.config.animationEase] || EasingFunctions.Linear;
        const ep = ease(p);
        const s = this.config.animationStartValues;
        const t = this.config.animationTargetValues;
        if (s.positionOffset && t.positionOffset) {
            this.currentPosition.x = s.positionOffset[0] + (t.positionOffset[0] - s.positionOffset[0]) * ep;
            this.currentPosition.y = s.positionOffset[1] + (t.positionOffset[1] - s.positionOffset[1]) * ep;
            this.pivotPos.copy(this.currentPosition);
        }
        if (s.rotationOffset !== undefined && t.rotationOffset !== undefined) {
            this.currentRotation = this.config.rotation + s.rotationOffset + (t.rotationOffset - s.rotationOffset) * ep;
        }
        if (s.scale && t.scale) {
            this.currentScale.x = (s.scale[0] + (t.scale[0] - s.scale[0]) * ep) / 100;
            this.currentScale.y = (s.scale[1] + (t.scale[1] - s.scale[1]) * ep) / 100;
        }
        if (s.opacity !== undefined && t.opacity !== undefined) {
            this.currentOpacity = (s.opacity + (t.opacity - s.opacity) * ep) / 100;
        }
        if (this.animHasColor) {
            this.currentColor.r = this.animStartR + (this.animTargetR - this.animStartR) * ep;
            this.currentColor.g = this.animStartG + (this.animTargetG - this.animStartG) * ep;
            this.currentColor.b = this.animStartB + (this.animTargetB - this.animStartB) * ep;
        }
        if (s.parallax && t.parallax) {
            this.currentParallax.x = (s.parallax[0] + (t.parallax[0] - s.parallax[0]) * ep) / 100;
            this.currentParallax.y = (s.parallax[1] + (t.parallax[1] - s.parallax[1]) * ep) / 100;
        }
        if (s.parallaxOffset && t.parallaxOffset) {
            this.currentParallaxOffset.x = s.parallaxOffset[0] + (t.parallaxOffset[0] - s.parallaxOffset[0]) * ep;
            this.currentParallaxOffset.y = s.parallaxOffset[1] + (t.parallaxOffset[1] - s.parallaxOffset[1]) * ep;
        }
        if (s.pivotOffset && t.pivotOffset) {
            const px = s.pivotOffset[0] + (t.pivotOffset[0] - s.pivotOffset[0]) * ep;
            const py = s.pivotOffset[1] + (t.pivotOffset[1] - s.pivotOffset[1]) * ep;
            this.visualGroup.position.set(px, py, 0);
        }
        this.updateTransform();
    }

    private applyAnimationTarget(): void {
        const t = this.config.animationTargetValues;
        if (t.positionOffset) { this.currentPosition.set(t.positionOffset[0], t.positionOffset[1]); this.pivotPos.copy(this.currentPosition); }
        if (t.rotationOffset !== undefined) this.currentRotation = this.config.rotation + t.rotationOffset;
        if (t.scale) { this.currentScale.x = t.scale[0] / 100; this.currentScale.y = t.scale[1] / 100; }
        if (t.opacity !== undefined) this.currentOpacity = t.opacity / 100;
        if (t.color) {
            const [hex, alpha] = parseDecoColor(t.color);
            this.currentColor.set(hex);
            this.currentOpacity *= alpha;
        }
        if (t.parallax) { this.currentParallax.x = t.parallax[0] / 100; this.currentParallax.y = t.parallax[1] / 100; }
        if (t.parallaxOffset) { this.currentParallaxOffset.set(t.parallaxOffset[0], t.parallaxOffset[1]); }
        if (t.pivotOffset) {
            this.config.pivotOffset = [t.pivotOffset[0], t.pivotOffset[1]];
            this.visualGroup.position.set(t.pivotOffset[0], t.pivotOffset[1], 0);
            if (this.instSlot && this.instRenderer) this.instRenderer.updatePivot(this.instSlot, t.pivotOffset[0], t.pivotOffset[1]);
        }
        if (t.depth !== undefined) this.config.depth = t.depth;
        if (t.visible !== undefined) { this.config.visible = t.visible; this.container.visible = t.visible; this._instVisible = t.visible; }
        this.updateTransform();
    }

    public startAnimation(targetValues: Partial<DecorationConfig>, duration: number, ease: string, startTime: number, movementType: DecPlacementType): void {
        if (this.config.animating) { this.config.animating = false; }
        const animStartPos = movementType === DecPlacementType.LastPosition ? this.currentPosition : this.startPos;
        this.config.animationStartValues = {
            positionOffset: [this.currentPosition.x, this.currentPosition.y],
            rotationOffset: this.currentRotation - this.config.rotation,
            scale: [this.currentScale.x * 100, this.currentScale.y * 100],
            color: '#' + this.currentColor.getHexString(),
            opacity: this.currentOpacity * 100,
            parallax: [this.currentParallax.x * 100, this.currentParallax.y * 100],
            parallaxOffset: [this.currentParallaxOffset.x, this.currentParallaxOffset.y],
            pivotOffset: [this.config.pivotOffset[0], this.config.pivotOffset[1]],
        };
        this.config.animationTargetValues = { ...targetValues };
        if (targetValues.positionOffset) {
            this.config.animationTargetValues.positionOffset = [
                animStartPos.x + targetValues.positionOffset[0],
                animStartPos.y + targetValues.positionOffset[1]
            ];
        }
        if (targetValues.rotationOffset !== undefined) {
            this.config.animationTargetValues.rotationOffset = (this.currentRotation - this.config.rotation) + targetValues.rotationOffset;
        }
        const sc = this.config.animationStartValues.color;
        if (sc) { this.animStartR = parseInt(sc.slice(1, 3), 16) / 255; this.animStartG = parseInt(sc.slice(3, 5), 16) / 255; this.animStartB = parseInt(sc.slice(5, 7), 16) / 255; }
        const tc = targetValues.color;
        if (tc) { const tr = tc.replace(/^#/,'').slice(0,6); this.animTargetR = parseInt(tr.slice(0, 2), 16) / 255; this.animTargetG = parseInt(tr.slice(2, 4), 16) / 255; this.animTargetB = parseInt(tr.slice(4, 6), 16) / 255; }
        this.animHasColor = !!(sc && tc);
        this.config.animating = true;
        this.config.animationStart = startTime;
        this.config.animationDuration = duration;
        this.config.animationEase = ease;
    }

    public reset(): void {
        this.config.animating = false;
        this.animHasColor = false;
        this.config.animationStartValues = {};
        this.config.animationTargetValues = {};
        this.config.visible = this.originalVisible;
        this.config.depth = this.originalDepth;
        this.currentScale.set(this.config.scale[0] / 100, this.config.scale[1] / 100);
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
    private lastDecorationEventIndex: number = -1;
    private pendingDecorationEvents: any[] = [];
    private tileSize: number = 1.0;
    private textureLoader: TextureLoader;
    private textureCache: Map<string, Texture> = new Map();
    private floorGeoCache: Map<string, { positions: Float32Array; indices: Uint32Array; mask: Float32Array; vertexCount: number }> = new Map();
    private customImages: Map<string, string> = new Map();
    private texturesLoading: Set<string> = new Set();
    private texturesLoaded: Set<string> = new Set();
    private placeholderTexture: Texture | null = null;
    private _lastCamX = 0; private _lastCamY = 0; private _lastCamZoom = 0;
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
            if (dec.eventType === 'AddDecoration' || dec.eventType === 'AddText' || dec.eventType === 'AddObject') {
                this.tryCreateDecoration(dec);
            }
        }
        for (const tile of tiles) {
            if (tile.addDecorations) {
                for (const dec of tile.addDecorations) {
                    if (dec.eventType === 'AddDecoration' || dec.eventType === 'AddText' || dec.eventType === 'AddObject') {
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
        const initState = new Map<string, {
            posX: number; posY: number;
            rot: number;
            scX: number; scY: number;
            op: number;
            parX: number; parY: number;
            parOffX: number; parOffY: number;
        }>();

        for (const [tag, list] of this.taggedDecorations) {
            if (list.length === 0) continue;
            const d = list[0];

            const startX = d.startPos.x;
            const startY = d.startPos.y;
            const baseRot = d.config.rotation;
            const baseScX = d.config.scale[0];
            const baseScY = d.config.scale[1];
            const baseOp = d.config.opacity;
            const baseParX = d.config.parallax[0];
            const baseParY = d.config.parallax[1];
            const baseParOffX = d.config.parallaxOffset[0];
            const baseParOffY = d.config.parallaxOffset[1];

            tm.addKeyframe(`deco:${tag}`, 'positionX', 0, startX, null);
            tm.addKeyframe(`deco:${tag}`, 'positionY', 0, startY, null);
            tm.addKeyframe(`deco:${tag}`, 'rotation', 0, d.currentRotation - baseRot, null);
            tm.addKeyframe(`deco:${tag}`, 'scaleX', 0, baseScX / 100, null);
            tm.addKeyframe(`deco:${tag}`, 'scaleY', 0, baseScY / 100, null);
            tm.addKeyframe(`deco:${tag}`, 'opacity', 0, baseOp / 100, null);
            tm.addKeyframe(`deco:${tag}`, 'parallaxX', 0, baseParX / 100, null);
            tm.addKeyframe(`deco:${tag}`, 'parallaxY', 0, baseParY / 100, null);
            tm.addKeyframe(`deco:${tag}`, 'parallaxOffsetX', 0, baseParOffX, null);
            tm.addKeyframe(`deco:${tag}`, 'parallaxOffsetY', 0, baseParOffY, null);

            initState.set(tag, {
                posX: startX, posY: startY,
                rot: 0,
                scX: baseScX / 100, scY: baseScY / 100,
                op: baseOp / 100,
                parX: baseParX / 100, parY: baseParY / 100,
                parOffX: baseParOffX, parOffY: baseParOffY,
            });
        }

        const ts = this.tileSize;
        for (const entry of this.decorationEventsTimeline) {
            const { time: eventTime, event } = entry;
            if (event.eventType !== 'MoveDecorations') continue;
            if (!isEventActive(event)) continue;

            const tagStr = event.tag || '';
            if (!tagStr) continue;
            const tags = tagStr.split(/\s+/).filter(Boolean);
            const floor = event.floor ?? 0;
            const bpm = this.tileBPM[floor] || 100;
            const duration = (event.duration || 0) * 60 / bpm;
            const ease = event.ease || 'Linear';
            const movementType = this.parsePlacement(event.relativeTo);
            const isLastPos = movementType === DecPlacementType.LastPosition;

            for (const tag of tags) {
                const kv = `deco:${tag}`;
                const state = initState.get(tag);
                if (!state) continue;

                const endTime = eventTime + duration;
                const hasDur = duration > 0;

                if (event.positionOffset !== undefined && !event.disabled?.positionOffset) {
                    const pos = this.parseVec2(event.positionOffset, [0, 0]);
                    const offX = pos[0] * ts;
                    const offY = pos[1] * ts;
                    const startX = tm.sample(kv, 'positionX', eventTime) ?? state.posX;
                    const startY = tm.sample(kv, 'positionY', eventTime) ?? state.posY;
                    const endX = isLastPos ? startX + offX : (state.posX - 0) + offX;
                    const endY = isLastPos ? startY + offY : (state.posY - 0) + offY;
                    // Actually for non-LastPosition, the target is startPos (from AddObject) + offset.
                    // state stores the initial position. But after events, posX/posY are stale.
                    // For keyframes, we let addTween handle the interpolation.
                    if (hasDur) {
                        tm.addTween(kv, 'positionX', eventTime, endTime, startX, endX, ease);
                        tm.addTween(kv, 'positionY', eventTime, endTime, startY, endY, ease);
                    } else {
                        tm.addKeyframe(kv, 'positionX', eventTime, endX, null);
                        tm.addKeyframe(kv, 'positionY', eventTime, endY, null);
                    }
                }

                if (event.rotationOffset !== undefined && !event.disabled?.rotationOffset) {
                    const rotOff = event.rotationOffset; // keep in degrees to match keyframe unit
                    const startRot = tm.sample(kv, 'rotation', eventTime) ?? state.rot;
                    const endRot = isLastPos ? startRot + rotOff : rotOff;
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
                    const startSX = tm.sample(kv, 'scaleX', eventTime) ?? state.scX;
                    const startSY = tm.sample(kv, 'scaleY', eventTime) ?? state.scY;
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
                    const startOp = tm.sample(kv, 'opacity', eventTime) ?? state.op;
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
                    const startParX = tm.sample(kv, 'parallaxX', eventTime) ?? state.parX;
                    const startParY = tm.sample(kv, 'parallaxY', eventTime) ?? state.parY;
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
                    const startPOX = tm.sample(kv, 'parallaxOffsetX', eventTime) ?? state.parOffX;
                    const startPOY = tm.sample(kv, 'parallaxOffsetY', eventTime) ?? state.parOffY;
                    if (hasDur) {
                        tm.addTween(kv, 'parallaxOffsetX', eventTime, endTime, startPOX, endPOX, ease);
                        tm.addTween(kv, 'parallaxOffsetY', eventTime, endTime, startPOY, endPOY, ease);
                    } else {
                        tm.addKeyframe(kv, 'parallaxOffsetX', eventTime, endPOX, null);
                        tm.addKeyframe(kv, 'parallaxOffsetY', eventTime, endPOY, null);
                    }
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
        const rawParallaxOffset = this.parseVec2(event.parallaxOffset, [0, 0]);
        const rawPivotOffset = this.parseVec2(event.pivotOffset, [0, 0]);
        const ts = this.tileSize;
        const isCam = relativeTo === DecPlacementType.Camera || relativeTo === DecPlacementType.CameraAspect;

        const floor = event.floor !== undefined ? event.floor
            : event.parentFloorNum !== undefined ? event.parentFloorNum
                : 0;
        const decoType = event.eventType === 'AddText' ? DecorationType.Text
            : event.eventType === 'AddObject' ? DecorationType.Object
                : DecorationType.Image;

        const config: Partial<DecorationConfig> = {
            decorationType: decoType,
            id: `dec_${event.eventType}_${floor ?? 0}_${Math.random().toString(36).slice(2, 6)}`,
            tag: event.tag || '',
            decorationImage: event.decorationImage || '',
            decText: event.decText || '',
            position: rawPos,
            positionOffset: this.parseVec2(event.positionOffset, [0, 0]),
            relativeTo,
            rotation: event.rotation || 0,
            rotationOffset: event.rotationOffset || 0,
            scale: this.parseVec2(event.scale, [100, 100]),
            parallax: this.parseVec2(event.parallax, [100, 100]),
            parallaxOffset: [rawParallaxOffset[0] * ts, rawParallaxOffset[1] * ts],
            pivotOffset: [rawPivotOffset[0] * (isCam ? 1 : ts), rawPivotOffset[1] * (isCam ? 1 : ts)],
            depth: event.depth || 0,
            color: event.color || 'ffffff',
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
        deco.setInstancedRenderer(this.instancedRenderer);
        deco.startPos.copy(this.computeStartPos(rawPos, relativeTo, floor));
        deco.pivotPos.copy(deco.startPos);
        deco.currentPosition.copy(deco.startPos);

        if (decoType === DecorationType.Text) {
            if (!this.setupTextVisual(deco, event)) { deco.dispose(); return null; }
        } else if (decoType === DecorationType.Object) {
            if (!this.setupObjectVisual(deco, event)) { deco.dispose(); return null; }
            deco.updateTransform();
        } else {
            if (!config.decorationImage) { deco.dispose(); return null; }
            if (!this.loadDecoTexture(config.decorationImage, deco)) { deco.dispose(); return null; }
        }

        this.registerDecoration(deco);
        return deco;
    }

    private setupTextVisual(deco: DecorationInstance, event: any): boolean {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 1024, 256);
        const [textColor] = parseDecoColor(event.color, 'ffffff');
        ctx.fillStyle = textColor;
        ctx.font = `bold ${event.fontSize || 48}px ${event.font || 'Arial'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = event.decText || '';
        const lines = text.split('\n');
        const lineH = (event.fontSize || 48) * 1.3;
        const startY = 128 - (lines.length - 1) * lineH / 2;
        lines.forEach((l: string, i: number) => {
            ctx.fillText(l, 512, startY + i * lineH);
        });
        const texture = new CanvasTexture(canvas);
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
            g.add(sphere);
            if (event.planetTailColor) {
                const [tColor, tAlpha] = parseDecoColor(event.planetTailColor, 'ffffff');
                const tailMat = new MeshBasicMaterial({ color: new Color(tColor), transparent: true, opacity: tAlpha * 0.5 });
                const tail = new Mesh(new RingGeometry(0.35, 0.5, 32), tailMat);
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

    private loadDecoTexture(filename: string, deco: DecorationInstance): boolean {
        const cached = this.textureCache.get(filename);
        if (cached) { deco.setupVisual(cached); return true; }
        const url = this.findImageUrl(filename);
        if (!url) return false;
        // Already loading: keep deco alive; callback will setupVisual for all matching
        if (this.texturesLoading.has(filename)) return true;
        this.texturesLoading.add(filename);
        this.textureLoader.load(url, (tex) => {
            tex.colorSpace = SRGBColorSpace;
            this.textureCache.set(filename, tex);
            this.texturesLoaded.add(filename);
            this.texturesLoading.delete(filename);
            const apply = (d: DecorationInstance) => {
                if (d.config.decorationImage === filename && !d.isInstanced && !d.sprite && !d.mesh) d.setupVisual(tex);
            };
            for (const d of this.decoList) apply(d);
            if (!this.decoList.includes(deco)) apply(deco);
            this.instancedRenderer.flush();
        }, undefined, () => {
            this.texturesLoading.delete(filename);
        });
        return true;
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
        this.retryPending();
    }

    private retryPending(): void {
        const remaining: any[] = [];
        for (const event of this.pendingDecorationEvents) {
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
        const MAX_CONCURRENT = 4;
        const queue = [...filenames];
        let resolved = 0;
        const loadNext = (): Promise<void> => {
            if (resolved >= queue.length) return Promise.resolve();
            const batch = queue.slice(resolved, resolved + MAX_CONCURRENT);
            resolved += batch.length;
            return Promise.all(batch.map(fn => new Promise<void>((resolve) => {
                if (this.textureCache.has(fn)) { resolve(); return; }
                const url = this.findImageUrl(fn);
                if (!url) { resolve(); return; }
                this.texturesLoading.add(fn);
                this.textureLoader.load(url, (tex) => {
                    tex.colorSpace = SRGBColorSpace;
                    this.textureCache.set(fn, tex);
                    this.texturesLoaded.add(fn);
                    this.texturesLoading.delete(fn);
                    resolve();
                }, undefined, () => { this.texturesLoading.delete(fn); resolve(); });
            }))).then(loadNext);
        };
        await loadNext();
        this.retryPending();
        this.decoList.forEach(d => {
            if (d.config.decorationImage) {
                const tex = this.textureCache.get(d.config.decorationImage);
                if (tex && !d.isInstanced && !d.sprite && !d.mesh) { d.setupVisual(tex); }
            }
        });
        this.instancedRenderer.flush();
        return this.texturesLoaded.size;
    }

    public update(elapsedTime: number, cameraPosition: Vector3, cameraRotation: number, cameraZoom: number, timelineManager?: TimelineManager, adoZoom?: number): void {
        const now = elapsedTime / 1000;
        this.processEvents(now);
        const camX = cameraPosition.x;
        const camY = cameraPosition.y;
        const camZ = cameraZoom;
        const camMoved = Math.abs(camX - this._lastCamX) > 0.01 || Math.abs(camY - this._lastCamY) > 0.01 || Math.abs(camZ - this._lastCamZoom) > 0.001;
        if (camMoved) { this._lastCamX = camX; this._lastCamY = camY; this._lastCamZoom = camZ; }
        const list = this.decoList;
        const len = list.length;
        let animCount = 0;
        let needsTilePositions = false;
        for (let i = 0; i < len; i++) {
            const d = list[i];
            if (d.config.animating || (this._timelineManager && d.config.tag)) { d.updateAnimation(now, this._timelineManager!); animCount++; }
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
        const aspect = (typeof window !== 'undefined' && window.innerWidth > 0) ? window.innerWidth / window.innerHeight : 16 / 9;
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
            if ((d.config.animating || (this._timelineManager && d.config.tag)) && !this._visibleStaticSet.has(d)) {
                visibleStatic.push(d);
            }
        }
        const dLen = this._dynamicDecos.length;
        for (let i = 0; i < dLen; i++) {
            const d = this._dynamicDecos[i];
            if (d.config.visible !== false) {
                d.updatePosition(cameraPosition, cameraRotation, camZ, tilePositions, adoZoom);
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
                d.updatePosition(cameraPosition, cameraRotation, camZ, tilePositions, adoZoom);
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

    private processEvents(now: number): void {
        if (this.lastDecorationEventIndex >= 0 && this.lastDecorationEventIndex < this.decorationEventsTimeline.length) {
            const last = this.decorationEventsTimeline[this.lastDecorationEventIndex];
            if (last && now < last.time) {
                const list = this.decoList;
                for (let i = 0; i < list.length; i++) list[i].reset();
                this.lastDecorationEventIndex = -1;
            }
        }
        let safety = 0;
        while (safety < (this.decorationEventsTimeline.length + 10) &&
            this.lastDecorationEventIndex + 1 < this.decorationEventsTimeline.length &&
            this.decorationEventsTimeline[this.lastDecorationEventIndex + 1].time <= now) {
            this.lastDecorationEventIndex++;
            const entry = this.decorationEventsTimeline[this.lastDecorationEventIndex];
            if (entry) this.processEvent(entry.event, now);
            safety++;
        }
    }

    private processEvent(event: any, now: number): void {
        if (!isEventActive(event)) return;
        if (event.eventType === 'MoveDecorations') {
            this.processMoveDecorations(event, now);
        } else if (event.eventType === 'SetText') {
            this.processSetText(event);
        } else if (event.eventType === 'SetObject') {
            this.processSetObject(event);
        }
    }

    private processMoveDecorations(event: any, now: number): void {
        const tagStr = event.tag || '';
        if (!tagStr) return;
        const tags = tagStr.split(/\s+/).filter(Boolean);
        const floor = event.floor;
        const bpm = this.tileBPM[floor] || 100;
        const duration = (event.duration || 0) * 60 / bpm;
        const movementType = this.parsePlacement(event.relativeTo);
        const ts = this.tileSize;

        for (const tag of tags) {
            const list = this.taggedDecorations.get(tag);
            if (!list) continue;

            if (this._timelineManager && duration > 0) {
                // Timeline mode: only apply instant (non-keyframed) properties
                for (const deco of list) {
                    if (event.decorationImage !== undefined && !event.disabled?.decorationImage) {
                        deco.config.decorationImage = event.decorationImage;
                    }
                    if (event.depth !== undefined && !event.disabled?.depth) {
                        deco.config.depth = event.depth;
                    }
                    if (event.visible !== undefined && !event.disabled?.visible) {
                        deco.config.visible = parseEventVisible(event.visible);
                        deco.setCulledVisible(deco.config.visible);
                    }
                    if (event.pivotOffset !== undefined && !event.disabled?.pivotOffset) {
                        const piv = this.parseVec2(event.pivotOffset, [0, 0]);
                        deco.config.pivotOffset = [piv[0] * ts, piv[1] * ts];
                        deco.visualGroup.position.set(deco.config.pivotOffset[0], deco.config.pivotOffset[1], 0);
                        if (deco.instSlot) this.instancedRenderer.updatePivot(deco.instSlot, deco.config.pivotOffset[0], deco.config.pivotOffset[1]);
                        deco.updateTransform();
                    }
                    // Color: only apply if no keyframe (color not yet in keyframe system)
                    if (event.color !== undefined && !event.disabled?.color) {
                        deco.config.color = event.color;
                        const [hex, alpha] = parseDecoColor(event.color);
                        deco.currentColor.set(hex);
                        deco.currentOpacity = (deco.config.opacity / 100) * alpha;
                        deco.updateTransform();
                    }
                }
                continue;
            }

            for (const deco of list) {
                const target: Partial<DecorationConfig> = {};

                if (event.positionOffset !== undefined && !event.disabled?.positionOffset) {
                    const pos = this.parseVec2(event.positionOffset, [0, 0]);
                    target.positionOffset = [pos[0] * ts, pos[1] * ts];
                }
                if (event.rotationOffset !== undefined && !event.disabled?.rotationOffset) {
                    target.rotationOffset = event.rotationOffset;
                }
                if (event.scale !== undefined && !event.disabled?.scale) {
                    const s = this.parseVec2(event.scale, [100, 100]);
                    target.scale = [s[0], s[1]];
                }
                if (event.color !== undefined && !event.disabled?.color) {
                    target.color = event.color;
                }
                if (event.opacity !== undefined && !event.disabled?.opacity) {
                    target.opacity = event.opacity;
                }
                if (event.parallax !== undefined && !event.disabled?.parallax) {
                    const p = this.parseVec2(event.parallax, [100, 100]);
                    target.parallax = [p[0], p[1]];
                }
                if (event.parallaxOffset !== undefined && !event.disabled?.parallaxOffset) {
                    const po = this.parseVec2(event.parallaxOffset, [0, 0]);
                    target.parallaxOffset = [po[0] * ts, po[1] * ts];
                }
                if (event.pivotOffset !== undefined && !event.disabled?.pivotOffset) {
                    const piv = this.parseVec2(event.pivotOffset, [0, 0]);
                    target.pivotOffset = [piv[0] * ts, piv[1] * ts];
                }
                if (event.depth !== undefined && !event.disabled?.depth) {
                    target.depth = event.depth;
                }
                if (event.visible !== undefined && !event.disabled?.visible) {
                    deco.config.visible = parseEventVisible(event.visible);
                    deco.setCulledVisible(deco.config.visible);
                }
                if (event.decorationImage !== undefined && !event.disabled?.decorationImage) {
                    target.decorationImage = event.decorationImage;
                }

                deco.startAnimation(target, duration, event.ease || 'Linear', now, movementType);
            }
        }
    }

    private processSetText(event: any): void {
        const tags = (event.tag || '').split(/\s+/).filter(Boolean);
        const text = event.decText || '';
        for (const tag of tags) {
            const list = this.taggedDecorations.get(tag);
            if (!list) continue;
            for (const deco of list) {
                if (deco.config.decorationType !== DecorationType.Text) continue;
                deco.config.decText = text;
                this.setupTextVisual(deco, event);
            }
        }
    }

    private processSetObject(event: any): void {
        const tags = (event.tag || '').split(/\s+/).filter(Boolean);
        for (const tag of tags) {
            const list = this.taggedDecorations.get(tag);
            if (!list) continue;
            for (const deco of list) {
                if (deco.config.decorationType !== DecorationType.Object) continue;
                if (deco.config.objectType === 'Planet') {
                    if (event.planetColor !== undefined && !event.disabled?.planetColor) {
                        const [hex, alpha] = parseDecoColor(event.planetColor, 'ffffff');
                        deco.config.planetColor = event.planetColor;
                        deco.currentColor.set(hex);
                        deco.currentOpacity *= alpha;
                    }
                    if (event.planetTailColor !== undefined && !event.disabled?.planetTailColor) {
                        deco.config.planetTailColor = event.planetTailColor;
                    }
                } else if (deco.config.objectType === 'Floor') {
                    if (event.trackColor !== undefined && !event.disabled?.trackColor) {
                        deco.config.trackColor = event.trackColor;
                    }
                    if (event.trackOpacity !== undefined && !event.disabled?.opacity) {
                        deco.config.trackOpacity = event.trackOpacity;
                        deco.currentOpacity = event.trackOpacity / 100;
                    }
                    if (event.trackIcon !== undefined && !event.disabled?.trackIcon) {
                        deco.config.trackIcon = event.trackIcon;
                        this.rebuildFloorIcon(deco);
                    }
                }
                deco.updateTransform();
            }
        }
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
        for (let i = 0; i < list.length; i++) list[i].reset();
        this.lastDecorationEventIndex = -1;
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
        this.lastDecorationEventIndex = -1;
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
