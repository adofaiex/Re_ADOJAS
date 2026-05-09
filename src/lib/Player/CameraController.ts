import * as THREE from 'three';
import { EasingFunctions } from './Easing';
import { isEventActive } from './TileColorManager';

// ──── 类型定义 ──────────────────────────────────────────────────────────────

export const CamMovementTypes = {
    Player: 'Player',
    Tile: 'Tile',
    Global: 'Global',
    LastPosition: 'LastPosition',
    LastPositionNoRotation: 'LastPositionNoRotation',
} as const;

export type CamMovementType = (typeof CamMovementTypes)[keyof typeof CamMovementTypes];

const MOVEMENT_TYPES: CamMovementType[] = ['Player', 'Tile', 'Global', 'LastPosition', 'LastPositionNoRotation'];

export interface CameraMode {
    relativeTo: CamMovementType;
    anchorTileIndex: number;
    position: { x: number; y: number };
    zoom: number;
    rotation: number;
    angleOffset: number;
    lastEventRelativePosition: { x: number; y: number };
    lastUsedMovementType: CamMovementType;
    lastTileCamFloor: number;
    followMode: boolean;
}

export interface PropertyTransition<T> {
    active: boolean;
    startTime: number;
    duration: number;
    startValue: T;
    endValue: T;
    ease: string;
}

export interface CameraTimelineEntry {
    time: number;
    event: any;
}

// ──── 工具函数 ────────────────────────────────────────────────────────────

function parseMovementType(raw: any): CamMovementType | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === 'string') return raw as CamMovementType;
    if (typeof raw === 'number') return MOVEMENT_TYPES[raw] || 'Player';
    return undefined;
}

function getTilePosition(levelData: any, floorIndex: number): { x: number; y: number } {
    const tile = levelData.tiles?.[floorIndex];
    return tile?.position ? { x: tile.position[0], y: tile.position[1] } : { x: 0, y: 0 };
}

function isNaNv(v: number): boolean { return v === undefined || v === null || isNaN(v); }

// ──── CameraController ─────────────────────────────────────────────────────

export class CameraController {
    private cameraMode: CameraMode;
    private cameraTimeline: CameraTimelineEntry[] = [];
    private lastCameraTimelineIndex = -1;

    private posXTween!: PropertyTransition<number>;
    private posYTween!: PropertyTransition<number>;
    private rotTween!: PropertyTransition<number>;
    private zoomTween!: PropertyTransition<number>;

    private levelData: any;
    private tileStartTimes: number[];
    private tileBPM: number[];

    constructor(levelData: any, tileStartTimes: number[], tileBPM: number[]) {
        this.levelData = levelData;
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
        this.cameraMode = this.defaultCameraMode();
        this.resetTransitions();
    }

    private defaultCameraMode(): CameraMode {
        return {
            relativeTo: 'Player',
            anchorTileIndex: 0,
            position: { x: 0, y: 0 },
            zoom: 100,
            rotation: 0,
            angleOffset: 0,
            lastEventRelativePosition: { x: 0, y: 0 },
            lastUsedMovementType: 'Player',
            lastTileCamFloor: -1,
            followMode: true,
        };
    }

    private resetTransitions(): void {
        this.posXTween = { active: false, startTime: 0, duration: 0, startValue: 0, endValue: 0, ease: 'Linear' };
        this.posYTween = { active: false, startTime: 0, duration: 0, startValue: 0, endValue: 0, ease: 'Linear' };
        this.rotTween = { active: false, startTime: 0, duration: 0, startValue: 0, endValue: 0, ease: 'Linear' };
        this.zoomTween = { active: false, startTime: 0, duration: 0, startValue: 0, endValue: 0, ease: 'Linear' };
    }

    // ── 公开访问器 ────────────────────────────────────────────────────────

    public getCameraMode(): CameraMode { return this.cameraMode; }
    public getCameraTimeline(): CameraTimelineEntry[] { return this.cameraTimeline; }
    public getLastCameraTimelineIndex(): number { return this.lastCameraTimelineIndex; }
    public setLastCameraTimelineIndex(i: number): void { this.lastCameraTimelineIndex = i; }

    // ── 状态重置 ──────────────────────────────────────────────────────────

    public resetCameraState(): void {
        const s = this.levelData.settings;
        if (s) {
            const rt = parseMovementType(s.relativeTo) || 'Player';
            this.cameraMode = this.defaultCameraMode();
            this.cameraMode.relativeTo = rt;
            this.cameraMode.position = s.position ? { x: s.position[0], y: s.position[1] } : { x: 0, y: 0 };
            this.cameraMode.zoom = s.zoom ?? 100;
            this.cameraMode.rotation = s.rotation ?? 0;
            this.cameraMode.angleOffset = s.angleOffset ?? 0;
            this.cameraMode.followMode = rt === 'Player';
            this.cameraMode.lastUsedMovementType = rt;
            if (rt === 'Tile') {
                const p = getTilePosition(this.levelData, 0);
                this.cameraMode.lastEventRelativePosition = p;
                this.cameraMode.lastTileCamFloor = 0;
            }
        } else {
            this.cameraMode = this.defaultCameraMode();
        }
        this.resetTransitions();
    }

    // ── 时间线构建 ────────────────────────────────────────────────────────

    public buildCameraTimeline(tileCameraEvents: Map<number, any[]>): void {
        const entries: CameraTimelineEntry[] = [];

        tileCameraEvents.forEach((events, floor) => {
            const startTime = this.tileStartTimes[floor] || 0;
            const bpm = this.tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;

            const sorted = [...events]
                .filter(e => isEventActive(e))
                .sort((a, b) => (a.id ?? Infinity) - (b.id ?? Infinity));

            const zeroOffsetEvents = sorted.filter(e => (e.angleOffset || 0) === 0);

            sorted.forEach((event) => {
                const ao = event.angleOffset || 0;
                let offset = (ao / 180) * secPerBeat;
                if (ao === 0 && zeroOffsetEvents.length > 1) {
                    const order = zeroOffsetEvents.findIndex(e => e.id === event.id);
                    offset += order * 0.0001;
                }
                entries.push({ time: startTime + offset, event: { ...event, floor } });
            });
        });

        entries.sort((a, b) => {
            const dt = a.time - b.time;
            return Math.abs(dt) < 0.0001
                ? ((a.event.id ?? Infinity) - (b.event.id ?? Infinity))
                : (dt > 0 ? 1 : -1);
        });

        this.cameraTimeline = entries;
    }

    // ── 公开更新入口 ──────────────────────────────────────────────────────

    public update(elapsedTime: number, pivot?: { x: number; y: number }): void {
        const timeline = this.cameraTimeline;
        let idx = this.lastCameraTimelineIndex;
        while (idx + 1 < timeline.length && timeline[idx + 1].time <= elapsedTime) {
            idx++;
            const e = timeline[idx];
            this.processCameraEvent(e.event, e.event.floor || 0, elapsedTime * 1000, undefined, pivot);
        }
        this.lastCameraTimelineIndex = idx;
    }

    // ── 属性插值 ──────────────────────────────────────────────────────────

    public getInterpolatedValues(elapsedTime: number): CameraMode['position'] & { zoom: number; rotation: number } {
        const t = elapsedTime / 1000;
        const res = {
            x: this.cameraMode.position.x,
            y: this.cameraMode.position.y,
            zoom: this.cameraMode.zoom,
            rotation: this.cameraMode.rotation,
        };

        const apply = (tr: PropertyTransition<number>, set: (v: number) => void) => {
            if (!tr.active) return;
            const p = Math.min(Math.max((t - tr.startTime) / tr.duration, 0), 1);
            if (p >= 1) {
                tr.active = false;
                set(tr.endValue);
                return;
            }
            const ease = EasingFunctions[tr.ease] || EasingFunctions.Linear;
            set(tr.startValue + (tr.endValue - tr.startValue) * ease(p));
        };

        apply(this.posXTween, v => res.x = v);
        apply(this.posYTween, v => res.y = v);
        apply(this.rotTween, v => res.rotation = v);
        apply(this.zoomTween, v => res.zoom = v);

        return res;
    }

    public calculateTargetPosition(
        pivot: { x: number; y: number },
        interpolated?: { x: number; y: number; zoom: number; rotation: number },
    ): { x: number; y: number } {
        const pos = interpolated ?? { x: this.cameraMode.position.x, y: this.cameraMode.position.y } as any;
        const ref = this.getModeReference(this.cameraMode.relativeTo, pivot);
        return { x: ref.x + pos.x, y: ref.y + pos.y };
    }

    // ── 核心事件处理（对应 ffxCameraPlus.StartEffect） ────────────────────
    // C# 调用顺序：Decode() → StartEffect()。合并后步骤为：
    //   1) Decode → 2) Dedup → 3) Conditional Kill → 4) NaN归零 → 5) 有效模式
    //   6) vector2 → 7) 模式切换+finalPos → 8) 记录模式 → 9) 更新cameraMode → 10) 创建tween

    public processCameraEvent(
        event: any,
        floorIndex: number,
        elapsedTime: number,
        cameraSnapshot?: { position: { x: number; y: number }; zoom: number; rotation: number },
        pivotPos?: { x: number; y: number },
    ): void {
        if (!isEventActive(event)) return;

        // Step 1 — 解码事件属性（对应 C# Decode()）
        const TILE_SIZE = 1.0;
        const eventDuration = event.duration ?? 0;
        const eventEase = event.ease || 'Linear';

        const rawPos = event.position;
        const posHasX = Array.isArray(rawPos) && rawPos[0] !== null && rawPos[0] !== undefined;
        const posHasY = Array.isArray(rawPos) && rawPos[1] !== null && rawPos[1] !== undefined;
        // 只要有 position 字段（含 [null,null]）就算 used，匹配 !evnt.disabled["position"]
        const positionUsed = Array.isArray(rawPos);
        const targetPos = { x: posHasX ? rawPos[0] * TILE_SIZE : 0, y: posHasY ? rawPos[1] * TILE_SIZE : 0 };

        const rotationUsed = event.rotation !== undefined && event.rotation !== null;
        const targetRot = rotationUsed ? event.rotation : 0;

        const zoomUsed = event.zoom !== undefined && event.zoom !== null;
        const targetZoom = zoomUsed ? event.zoom : 100;

        const rawMT = event.relativeTo;
        let movementType: CamMovementType | undefined;
        let movementTypeUsed = false;
        if (rawMT !== undefined && rawMT !== null) {
            movementTypeUsed = true;
            movementType = parseMovementType(rawMT);
        }

        const isLastPosition = movementType === 'LastPosition' || movementType === 'LastPositionNoRotation';
        const pivot = pivotPos ?? { x: 0, y: 0 };

        // Step 2 — 去重 movementType
        if (movementTypeUsed &&
            movementType !== CamMovementTypes.Global &&
            !isLastPosition &&
            positionUsed &&
            (isNaN(targetPos.x) || isNaN(targetPos.y)) &&
            movementType === this.cameraMode.lastUsedMovementType &&
            (movementType !== CamMovementTypes.Tile || floorIndex === this.cameraMode.lastTileCamFloor)) {
            movementTypeUsed = false;
        }

        // Step 3 — 条件性 Kill（仅 Kill 当前事件会修改的属性对应的 tween）
        if (positionUsed || movementTypeUsed) {
            if (!isNaN(targetPos.x) || movementTypeUsed) {
                if (this.posXTween.active && !isNaNv(this.posXTween.endValue)) {
                    this.cameraMode.position.x = this.posXTween.endValue;
                }
                this.posXTween.active = false;
            }
            if (!isNaN(targetPos.y) || movementTypeUsed) {
                if (this.posYTween.active && !isNaNv(this.posYTween.endValue)) {
                    this.cameraMode.position.y = this.posYTween.endValue;
                }
                this.posYTween.active = false;
            }
        }
        if (rotationUsed || (movementTypeUsed && isLastPosition)) {
            if (this.rotTween.active && !isNaNv(this.rotTween.endValue)) {
                this.cameraMode.rotation = this.rotTween.endValue;
            }
            this.rotTween.active = false;
        }
        if (zoomUsed) {
            if (this.zoomTween.active && !isNaNv(this.zoomTween.endValue)) {
                this.cameraMode.zoom = this.zoomTween.endValue;
            }
            this.zoomTween.active = false;
        }

        // Step 4 — NaN 位置归零
        const vector = { x: targetPos.x, y: targetPos.y };
        if (movementTypeUsed && !isLastPosition && movementType !== CamMovementTypes.Global) {
            if (isNaN(vector.x)) vector.x = 0;
            if (isNaN(vector.y)) vector.y = 0;
        }

        // Step 5 — 有效参照方式
        const camMovementType: CamMovementType = movementTypeUsed && movementType !== undefined
            ? movementType
            : this.cameraMode.lastUsedMovementType;

        // Step 6 — vector2
        const vector2: { x: number; y: number } = positionUsed
            ? { x: vector.x, y: vector.y }
            : {
                x: this.cameraMode.lastEventRelativePosition.x - this.cameraMode.position.x,
                y: this.cameraMode.lastEventRelativePosition.y - this.cameraMode.position.y,
              };

        // Step 7 — 模式切换 + finalPos
        const oldRef = this.getModeReference(this.cameraMode.relativeTo, pivot);

        let finalPos: { x: number; y: number } = { x: 0, y: 0 };

        switch (camMovementType) {
            case 'Player': {
                if (!this.cameraMode.followMode) {
                    const worldPos = {
                        x: oldRef.x + this.cameraMode.position.x,
                        y: oldRef.y + this.cameraMode.position.y,
                    };
                    this.cameraMode.position.x = worldPos.x - pivot.x;
                    this.cameraMode.position.y = worldPos.y - pivot.y;
                    this.cameraMode.followMode = true;
                }
                finalPos = positionUsed
                    ? { x: vector2.x, y: vector2.y }
                    : { x: this.cameraMode.position.x, y: this.cameraMode.position.y };
                break;
            }
            case 'Tile': {
                if (this.cameraMode.followMode) {
                    const worldPos = {
                        x: oldRef.x + this.cameraMode.position.x,
                        y: oldRef.y + this.cameraMode.position.y,
                    };
                    const fp = getTilePosition(this.levelData, floorIndex);
                    this.cameraMode.position.x = worldPos.x - fp.x;
                    this.cameraMode.position.y = worldPos.y - fp.y;
                    this.cameraMode.followMode = false;
                }
                const floorPos = getTilePosition(this.levelData, floorIndex);
                this.cameraMode.lastEventRelativePosition = { x: floorPos.x, y: floorPos.y };
                this.cameraMode.lastTileCamFloor = floorIndex;
                finalPos = positionUsed
                    ? { x: vector2.x, y: vector2.y }
                    : { x: this.cameraMode.position.x, y: this.cameraMode.position.y };
                break;
            }
            case 'Global': {
                if (this.cameraMode.followMode) {
                    const worldPos = {
                        x: oldRef.x + this.cameraMode.position.x,
                        y: oldRef.y + this.cameraMode.position.y,
                    };
                    const origin = this.getGlobalOrigin();
                    this.cameraMode.position.x = worldPos.x - origin.x;
                    this.cameraMode.position.y = worldPos.y - origin.y;
                    this.cameraMode.followMode = false;
                }
                this.cameraMode.lastEventRelativePosition = { x: 0, y: 0 };
                finalPos = positionUsed
                    ? { x: vector2.x, y: vector2.y }
                    : { x: this.cameraMode.position.x, y: this.cameraMode.position.y };
                break;
            }
            case 'LastPosition':
            case 'LastPositionNoRotation': {
                if (positionUsed) {
                    finalPos = {
                        x: (isNaN(targetPos.x) ? this.cameraMode.position.x : this.cameraMode.position.x + targetPos.x),
                        y: (isNaN(targetPos.y) ? this.cameraMode.position.y : this.cameraMode.position.y + targetPos.y),
                    };
                } else {
                    finalPos = { x: this.cameraMode.position.x, y: this.cameraMode.position.y };
                }
                break;
            }
        }

        // Step 8 — 记录 lastUsedMovementType
        if (movementTypeUsed && movementType !== undefined) {
            this.cameraMode.lastUsedMovementType = movementType;
            if (movementType !== 'LastPosition' && movementType !== 'LastPositionNoRotation') {
                this.cameraMode.relativeTo = movementType;
                this.cameraMode.anchorTileIndex = movementType === 'Tile' ? floorIndex : 0;
            }
        }

        // Step 9 — 更新 cameraMode（pre 值在修改前保存，用于 tween 起始值）
        const prePosX = this.cameraMode.position.x;
        const prePosY = this.cameraMode.position.y;
        const preRotation = this.cameraMode.rotation;
        const preZoom = this.cameraMode.zoom;

        if (positionUsed) {
            if (!movementTypeUsed || (!isLastPosition && movementType !== 'LastPosition')) {
                if (!isNaN(targetPos.x)) this.cameraMode.position.x = targetPos.x;
                if (!isNaN(targetPos.y)) this.cameraMode.position.y = targetPos.y;
            } else if (isLastPosition) {
                if (!isNaN(targetPos.x)) this.cameraMode.position.x = (this.cameraMode.position.x || 0) + targetPos.x;
                if (!isNaN(targetPos.y)) this.cameraMode.position.y = (this.cameraMode.position.y || 0) + targetPos.y;
            }
        } else if (movementTypeUsed) {
            this.cameraMode.position.x = finalPos.x;
            this.cameraMode.position.y = finalPos.y;
        }

        if (rotationUsed) {
            let rotOffset = 0;
            if (camMovementType === 'LastPosition') {
                rotOffset = this.cameraMode.rotation;
            }
            this.cameraMode.rotation = targetRot + rotOffset;
        }

        if (zoomUsed) {
            this.cameraMode.zoom = targetZoom;
        }

        if (event.angleOffset !== undefined && event.angleOffset !== null) {
            this.cameraMode.angleOffset = event.angleOffset;
        }

        // Step 10 — 创建新 tween
        const floorBPM = this.tileBPM?.[floorIndex] || 100;
        let dur = eventDuration;
        if (floorBPM > 20000) {
            const isPlayer = !movementTypeUsed || movementType === 'Player';
            if (isPlayer) dur = 0;
        }
        const durationSeconds = dur * (60 / floorBPM);
        const now = elapsedTime / 1000;

        if (positionUsed || movementTypeUsed) {
            if (durationSeconds > 0 && !isNaN(finalPos.x)) {
                this.posXTween = {
                    active: true, startTime: now, duration: durationSeconds,
                    startValue: prePosX,
                    endValue: finalPos.x,
                    ease: eventEase,
                };
            } else {
                this.posXTween.active = false;
            }

            if (durationSeconds > 0 && !isNaN(finalPos.y)) {
                this.posYTween = {
                    active: true, startTime: now, duration: durationSeconds,
                    startValue: prePosY,
                    endValue: finalPos.y,
                    ease: eventEase,
                };
            } else {
                this.posYTween.active = false;
            }
        }

        if (rotationUsed || (movementTypeUsed && isLastPosition)) {
            if (durationSeconds > 0) {
                this.rotTween = {
                    active: true, startTime: now, duration: durationSeconds,
                    startValue: preRotation,
                    endValue: this.cameraMode.rotation,
                    ease: eventEase,
                };
            } else {
                this.rotTween.active = false;
            }
        }

        if (zoomUsed) {
            if (durationSeconds > 0) {
                this.zoomTween = {
                    active: true, startTime: now, duration: durationSeconds,
                    startValue: preZoom,
                    endValue: this.cameraMode.zoom,
                    ease: eventEase,
                };
            } else {
                this.zoomTween.active = false;
            }
        }
    }

    // ── 内部工具 ──────────────────────────────────────────────────────────

    private getGlobalOrigin(): { x: number; y: number } {
        const t0 = this.levelData.tiles?.[0];
        return t0?.position ? { x: t0.position[0], y: t0.position[1] } : { x: 0, y: 0 };
    }

    private getModeReference(
        mode: CamMovementType,
        pivot: { x: number; y: number },
        tileIndex?: number,
    ): { x: number; y: number } {
        switch (mode) {
            case 'Player':
                return { x: pivot.x, y: pivot.y };
            case 'Tile':
                return getTilePosition(this.levelData, tileIndex ?? this.cameraMode.anchorTileIndex);
            case 'Global':
                return this.getGlobalOrigin();
            default:
                return { x: pivot.x, y: pivot.y };
        }
    }
}
