import { EasingFunctions } from './Easing';
import { isEventActive, isFieldEnabled } from './EventUtils';

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
const TILE_SIZE = 1.0;

function parseMovementType(raw: any): CamMovementType | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === 'string') {
        return (MOVEMENT_TYPES as readonly string[]).includes(raw) ? (raw as CamMovementType) : undefined;
    }
    if (typeof raw === 'number') return MOVEMENT_TYPES[raw] || 'Player';
    return undefined;
}

function getTilePosition(levelData: any, floorIndex: number): { x: number; y: number } {
    const tile = levelData?.tiles?.[floorIndex];
    return tile?.position ? { x: tile.position[0], y: tile.position[1] } : { x: 0, y: 0 };
}

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * One independent DOTween track. The original game has four:
 * moveX, moveY, rotation (vfx.camAngle), zoom (cam.zoomSize).
 */
interface TweenState {
    active: boolean;
    startTime: number; // seconds (timeInLevel)
    duration: number;  // seconds
    from: number;
    to: number;
    ease: string;
}

function idleTween(): TweenState {
    return { active: false, startTime: 0, duration: 0, from: 0, to: 0, ease: 'Linear' };
}

function evalTween(tw: TweenState, now: number): number {
    if (!tw.active) return tw.to;
    if (tw.duration <= 0) return tw.to;
    const p = clamp01((now - tw.startTime) / tw.duration);
    const ease = EasingFunctions[tw.ease] || EasingFunctions.Linear;
    return tw.from + (tw.to - tw.from) * ease(p);
}

export interface CameraTimelineEntry {
    time: number;
    event: any;
}

export interface CameraUpdateParams {
    /** timeInLevel in seconds (same timeline as tileStartTimes). */
    nowSeconds: number;
    /** Frame delta in seconds. */
    deltaSeconds: number;
    /** Effective BPM for the current tile (tileBPM, already folds in SetSpeed). */
    bpm: number;
    /** Song pitch (settings.pitch / 100). */
    pitch: number;
    /** Current planet / pivot world position (scrCamera.UpdateFollowCam topos). */
    planetWorldPos: { x: number; y: number };
    /** Current tile index (tile-change detection). */
    currentTileIndex: number;
}

// ──── CameraController ─────────────────────────────────────────────────────

/**
 * Faithful port of ADOFAI's two-layer camera:
 *   camParent (rig, absolute world position)  ← MoveCamera DOTween
 *   camera.localPosition (follow layer)       ← Lerp(frompos, topos, timer/camspeed)
 *
 * Reference: scrCamera.cs (Update / UpdateFollowCam / SetToFreeMode)
 *            ffxCameraPlus.cs (Decode / StartEffect)
 *            ffxPlusBase.cs (crotchet / ScrubToTime)
 */
export class CameraController {
    // ── Rig (camParent) — absolute world position ──────────────────────────
    private camParent = { x: 0, y: 0 };

    // ── Camera rotation (vfx.camAngle), degrees ────────────────────────────
    private camAngle = 0;

    // ── Zoom factor (cam.zoomSize), 1 = normal (camZoom 100) ───────────────
    private zoomSize = 1;

    // ── Follow layer (camera.localPosition) ────────────────────────────────
    private frompos = { x: 0, y: 0 };
    private topos = { x: 0, y: 0 };
    private pos = { x: 0, y: 0 };
    private timer = 0;
    private followMode = true;
    private offset = { x: 0, y: 0 };
    private holdOffset = { x: 0, y: 0 };

    // ── Bookkeeping (matches scrCamera fields) ─────────────────────────────
    private lastEventRelativePosition = { x: 0, y: 0 };
    private lastUsedMovementType: CamMovementType = 'Player';
    private lastTileCamFloor = -1;

    // ── Level settings ─────────────────────────────────────────────────────
    private legacyRelativeTo = false;
    private followMovingPlatforms = false;

    // ── Four independent tween tracks ──────────────────────────────────────
    private moveXTween: TweenState = idleTween();
    private moveYTween: TweenState = idleTween();
    private rotationTween: TweenState = idleTween();
    private zoomTween: TweenState = idleTween();

    // ── Timeline ───────────────────────────────────────────────────────────
    private cameraTimeline: CameraTimelineEntry[] = [];
    private lastCameraTimelineIndex = -1;
    private lastFollowTile = -1;

    private levelData: any;
    private tileStartTimes: number[];
    private tileBPM: number[];

    constructor(levelData: any, tileStartTimes: number[], tileBPM: number[]) {
        this.levelData = levelData;
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
        this.resetCameraState();
    }

    // ── Public accessors ───────────────────────────────────────────────────

    public getCameraTimeline(): CameraTimelineEntry[] { return this.cameraTimeline; }
    public getLastCameraTimelineIndex(): number { return this.lastCameraTimelineIndex; }
    public setLastCameraTimelineIndex(i: number): void { this.lastCameraTimelineIndex = i; }
    public isFollowMode(): boolean { return this.followMode; }

    /** Camera world position (un-shaken). */
    public getCameraPosition(): { x: number; y: number } {
        return { x: this.camParent.x + this.pos.x, y: this.camParent.y + this.pos.y };
    }

    /** ADOFAI zoom (100 = normal view). */
    public getCameraZoom(): number {
        return this.zoomSize * 100;
    }

    /** Set the zoom directly (editor zoom controls). */
    public setCameraZoom(adoZoom: number): void {
        this.zoomSize = adoZoom / 100;
        this.zoomTween = idleTween();
    }

    /** Camera rotation in degrees. */
    public getCameraRotation(): number {
        return this.camAngle;
    }

    // ── Timeline ───────────────────────────────────────────────────────────

    public loadCameraTimeline(entries: CameraTimelineEntry[]): void {
        this.cameraTimeline = entries;
    }

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

    // ── State reset ────────────────────────────────────────────────────────

    public resetCameraState(): void {
        const s = this.levelData?.settings ?? {};
        this.legacyRelativeTo = s.legacyCamRelativeTo === true;
        this.followMovingPlatforms = false;

        this.moveXTween = idleTween();
        this.moveYTween = idleTween();
        this.rotationTween = idleTween();
        this.zoomTween = idleTween();

        this.camParent = { x: 0, y: 0 };
        this.camAngle = 0;
        this.zoomSize = 1;

        this.frompos = { x: 0, y: 0 };
        this.topos = { x: 0, y: 0 };
        this.pos = { x: 0, y: 0 };
        this.timer = 0;
        this.followMode = true;
        this.offset = { x: 0, y: 0 };
        this.holdOffset = { x: 0, y: 0 };

        this.lastEventRelativePosition = { x: 0, y: 0 };
        this.lastUsedMovementType = 'Player';
        this.lastTileCamFloor = -1;
        this.lastFollowTile = -1;

        this.lastCameraTimelineIndex = -1;

        // The original game injects a synthetic ffxCameraPlus on floor 0 that
        // applies the level camera settings (scnGame.cs:1084-1093).
        const rt = parseMovementType(s.relativeTo) ?? 'Player';
        const synthetic = {
            eventType: 'MoveCamera',
            duration: 0,
            position: Array.isArray(s.position) ? s.position : [0, 0],
            rotation: s.rotation ?? 0,
            zoom: s.zoom ?? 100,
            relativeTo: rt,
            ease: 'Linear',
            angleOffset: 0,
            floor: 0,
        };
        this.startEffect(
            synthetic,
            0,
            0,
            getTilePosition(this.levelData, 0),
            { x: 0, y: 0 },
            this.tileBPM?.[0] || 100,
            1,
        );
    }

    /** Reset just rotation + zoom (used by editor "reset camera"). */
    public resetRotationAndZoom(): void {
        this.camAngle = 0;
        this.zoomSize = 1;
        this.rotationTween = idleTween();
        this.zoomTween = idleTween();
    }

    // ── Seek ───────────────────────────────────────────────────────────────

    public seek(timeSeconds: number, planetWorldPos: { x: number; y: number }, currentTileIndex: number, pitch: number = 1): void {
        this.resetCameraState();

        let idx = -1;
        for (let i = 0; i < this.cameraTimeline.length; i++) {
            const entry = this.cameraTimeline[i];
            if (entry.time > timeSeconds) break;
            idx = i;
            const floor = entry.event.floor ?? 0;
            this.applyTweens(entry.time);
            // Keep the follow layer at its steady state so Player→free mode
            // switches during the replay see the correct camera world position.
            if (this.followMode) {
                this.frompos = { x: planetWorldPos.x, y: planetWorldPos.y };
                this.topos = { x: planetWorldPos.x, y: planetWorldPos.y };
                this.pos = { x: planetWorldPos.x, y: planetWorldPos.y };
            }
            this.startEffect(
                entry.event,
                floor,
                entry.time,
                getTilePosition(this.levelData, floor),
                planetWorldPos,
                this.tileBPM?.[floor] || 100,
                pitch,
            );
        }
        this.lastCameraTimelineIndex = idx;


        // Evaluate tweens at the seek time.
        this.applyTweens(timeSeconds);

        // Put the follow layer at its steady state so playback resumes cleanly.
        if (this.followMode) {
            this.frompos = { x: planetWorldPos.x, y: planetWorldPos.y };
            this.topos = { x: planetWorldPos.x, y: planetWorldPos.y };
            this.pos = { x: planetWorldPos.x, y: planetWorldPos.y };
            this.timer = 1e9;
        } else {
            this.frompos = { x: 0, y: 0 };
            this.topos = { x: 0, y: 0 };
            this.pos = { x: 0, y: 0 };
            this.timer = 0;
        }
        this.lastFollowTile = currentTileIndex;
    }

    // ── Per-frame update (scrCamera.Update) ────────────────────────────────

    public update(params: CameraUpdateParams): void {
        const { nowSeconds, deltaSeconds, bpm, pitch, planetWorldPos, currentTileIndex } = params;

        // Rewind guard: if time went backwards, restart from settings.
        if (this.lastCameraTimelineIndex >= 0) {
            const cur = this.cameraTimeline[this.lastCameraTimelineIndex];
            if (cur && nowSeconds < cur.time) {
                this.resetCameraState();
            }
        }

        // Process all triggered camera events (ffxCameraPlus.StartEffect).
        let idx = this.lastCameraTimelineIndex;
        while (idx + 1 < this.cameraTimeline.length && this.cameraTimeline[idx + 1].time <= nowSeconds) {
            idx++;
            const entry = this.cameraTimeline[idx];
            const floor = entry.event.floor ?? 0;
            this.applyTweens(entry.time);
            this.startEffect(
                entry.event,
                floor,
                entry.time,
                getTilePosition(this.levelData, floor),
                planetWorldPos,
                this.tileBPM?.[floor] || bpm,
                pitch,
            );
        }
        this.lastCameraTimelineIndex = idx;


        // UpdateFollowCam: called on tile change only (scrCamera.UpdateFollowCam).
        if (currentTileIndex !== this.lastFollowTile) {
            this.lastFollowTile = currentTileIndex;
            this.updateFollowCam(planetWorldPos);
        }

        // camspeed = 60 / (bpm * planetSpeed * pitch) * 2  (custom/editor level).
        // tileBPM already folds in planetSpeed, so use bpm * pitch.
        const effectiveBpm = Math.max(bpm, 1e-6);
        const effectivePitch = Math.max(pitch, 1e-6);
        const camspeed = (60 / (effectiveBpm * effectivePitch)) * 2;

        this.timer += deltaSeconds;

        // Evaluate the four tracks at the current time.
        this.applyTweens(nowSeconds);

        // Follow layer Lerp.
        if (this.followMode) {
            const dist = Math.hypot(this.topos.x - this.frompos.x, this.topos.y - this.frompos.y);
            let num5 = 1;
            if (this.followMovingPlatforms) {
                num5 = (dist > 5 ? Math.min(1, (dist - 5) / 5) : 0) * 0.5 + 1;
            }
            const t = camspeed > 0 ? clamp01(this.timer / (camspeed / num5)) : 1;
            const tx = this.topos.x + this.offset.x + this.holdOffset.x;
            const ty = this.topos.y + this.offset.y + this.holdOffset.y;
            this.pos.x = this.frompos.x + (tx - this.frompos.x) * t;
            this.pos.y = this.frompos.y + (ty - this.frompos.y) * t;
        } else {
            this.pos.x = 0;
            this.pos.y = 0;
        }
    }

    // ── Core event processing (ffxCameraPlus.StartEffect) ──────────────────

    private startEffect(
        event: any,
        floorIndex: number,
        nowSeconds: number,
        floorPos: { x: number; y: number },
        planetWorldPos: { x: number; y: number },
        bpm: number,
        pitch: number,
    ): void {
        if (!isEventActive(event)) return;

        // ── Decode ─────────────────────────────────────────────────────────
        const effectiveBpm = Math.max(bpm, 1e-6);
        const effectivePitch = Math.max(pitch, 1e-6);
        const duration = (Number(event.duration) || 0) * (60 / (effectiveBpm * effectivePitch));
        const ease = event.ease || 'Linear';

        const rawPos = event.position;
        const posArr = Array.isArray(rawPos) ? rawPos : null;
        const positionUsed = posArr !== null && isFieldEnabled(event, 'position');
        const targetPos = {
            x: posArr && posArr[0] !== null && posArr[0] !== undefined ? Number(posArr[0]) * TILE_SIZE : NaN,
            y: posArr && posArr[1] !== null && posArr[1] !== undefined ? Number(posArr[1]) * TILE_SIZE : NaN,
        };

        const rotationUsed = event.rotation !== undefined && event.rotation !== null && isFieldEnabled(event, 'rotation');
        const targetRot = rotationUsed ? Number(event.rotation) : 0;

        const zoomUsed = event.zoom !== undefined && event.zoom !== null && isFieldEnabled(event, 'zoom');
        const targetZoom = (zoomUsed ? Number(event.zoom) : 100) / 100;

        let movementTypeUsed = event.relativeTo !== undefined && event.relativeTo !== null && isFieldEnabled(event, 'relativeTo');
        const movementType = parseMovementType(event.relativeTo);

        // ── Dedup relativeTo ───────────────────────────────────────────────
        if (movementTypeUsed &&
            movementType !== 'Global' &&
            movementType !== 'LastPosition' &&
            movementType !== 'LastPositionNoRotation' &&
            positionUsed &&
            (isNaN(targetPos.x) || isNaN(targetPos.y)) &&
            movementType === this.lastUsedMovementType &&
            (movementType !== 'Tile' || floorIndex === this.lastTileCamFloor)) {
            movementTypeUsed = false;
        }

        const isLastPosition = movementType === 'LastPosition' || movementType === 'LastPositionNoRotation';

        // ── Conditional Kill(complete: true) ───────────────────────────────
        if (positionUsed || movementTypeUsed) {
            if (!isNaN(targetPos.x) || movementTypeUsed) this.killTween(this.moveXTween, v => { this.camParent.x = v; });
            if (!isNaN(targetPos.y) || movementTypeUsed) this.killTween(this.moveYTween, v => { this.camParent.y = v; });
        }
        if (rotationUsed || (movementTypeUsed && isLastPosition)) {
            this.killTween(this.rotationTween, v => { this.camAngle = v; });
        }
        if (zoomUsed) {
            this.killTween(this.zoomTween, v => { this.zoomSize = v; });
        }

        // ── NaN zeroing ────────────────────────────────────────────────────
        const vector = { x: targetPos.x, y: targetPos.y };
        if (movementTypeUsed) {
            if (isNaN(vector.x)) vector.x = 0;
            if (isNaN(vector.y)) vector.y = 0;
        }

        const camMovementType: CamMovementType =
            movementTypeUsed && movementType ? movementType : this.lastUsedMovementType;
        const camParentBefore = { x: this.camParent.x, y: this.camParent.y };
        const vector2 = positionUsed
            ? { x: vector.x, y: vector.y }
            : {
                x: this.lastEventRelativePosition.x - camParentBefore.x,
                y: this.lastEventRelativePosition.y - camParentBefore.y,
            };

        let finalPos = { x: 0, y: 0 };
        let rotationOffset = 0;

        if (this.legacyRelativeTo && !movementTypeUsed) {
            finalPos = positionUsed
                ? { x: vector.x + camParentBefore.x, y: vector.y + camParentBefore.y }
                : { x: camParentBefore.x, y: camParentBefore.y };
        } else {
            switch (camMovementType) {
                case 'Player': {
                    if (!this.followMode) {
                        // C#: camParent.position = cam.transform.position - planet;
                        //     cam.transform.MoveXY(camParent.position_before);
                        //     followMode = true; UpdateFollowCam(force: true)
                        const position = { x: this.camParent.x, y: this.camParent.y };
                        this.camParent.x = position.x - planetWorldPos.x;
                        this.camParent.y = position.y - planetWorldPos.y;
                        this.pos = { x: planetWorldPos.x, y: planetWorldPos.y };
                        this.followMode = true;
                        this.frompos = { x: this.pos.x, y: this.pos.y };
                        this.topos = { x: planetWorldPos.x, y: planetWorldPos.y };
                        this.timer = 0;
                    }
                    finalPos = { x: vector2.x, y: vector2.y };
                    break;
                }
                case 'Tile': {
                    if (this.followMode) {
                        // C#: camParent.position = cam.transform.position; SetToFreeMode()
                        const camWorld = this.cameraWorldPos();
                        this.camParent.x = camWorld.x;
                        this.camParent.y = camWorld.y;
                        this.setToFreeMode();
                    }
                    this.lastEventRelativePosition = { x: floorPos.x, y: floorPos.y };
                    this.lastTileCamFloor = floorIndex;
                    finalPos = { x: vector2.x + floorPos.x, y: vector2.y + floorPos.y };
                    break;
                }
                case 'Global': {
                    if (this.followMode) {
                        const camWorld = this.cameraWorldPos();
                        this.camParent.x = camWorld.x;
                        this.camParent.y = camWorld.y;
                        this.setToFreeMode();
                    }
                    this.lastEventRelativePosition = { x: 0, y: 0 };
                    finalPos = { x: vector2.x, y: vector2.y };
                    break;
                }
                case 'LastPosition':
                case 'LastPositionNoRotation': {
                    const vector4 = { x: this.camParent.x, y: this.camParent.y };
                    if (camMovementType === 'LastPosition') rotationOffset = this.camAngle;
                    finalPos = positionUsed
                        ? { x: vector.x + vector4.x, y: vector.y + vector4.y }
                        : { x: vector4.x, y: vector4.y };
                    break;
                }
            }
        }

        if (movementTypeUsed && movementType) {
            this.lastUsedMovementType = movementType;
        }

        // ── Create the four independent tweens ─────────────────────────────
        if (positionUsed || movementTypeUsed) {
            if (!isNaN(finalPos.x)) {
                this.startTween(this.moveXTween, this.camParent.x, finalPos.x, duration, ease, nowSeconds, v => { this.camParent.x = v; });
            }
            if (!isNaN(finalPos.y)) {
                this.startTween(this.moveYTween, this.camParent.y, finalPos.y, duration, ease, nowSeconds, v => { this.camParent.y = v; });
            }
        }
        if (rotationUsed || (movementTypeUsed && isLastPosition)) {
            this.startTween(this.rotationTween, this.camAngle, targetRot + rotationOffset, duration, ease, nowSeconds, v => { this.camAngle = v; });
        }
        if (zoomUsed) {
            this.startTween(this.zoomTween, this.zoomSize, targetZoom, duration, ease, nowSeconds, v => { this.zoomSize = v; });
        }
    }

    // ── Tween helpers ──────────────────────────────────────────────────────

    private killTween(tw: TweenState, setValue: (v: number) => void): void {
        if (tw.active) {
            setValue(tw.to);
            tw.active = false;
        }
    }

    private startTween(
        tw: TweenState,
        from: number,
        to: number,
        duration: number,
        ease: string,
        now: number,
        setValue: (v: number) => void,
    ): void {
        tw.from = from;
        tw.to = to;
        tw.ease = ease;
        if (duration > 0) {
            tw.active = true;
            tw.startTime = now;
            tw.duration = duration;
        } else {
            tw.active = false;
            tw.startTime = now;
            tw.duration = 0;
            setValue(to);
        }
    }

    private applyTweens(now: number): void {
        if (this.moveXTween.active) {
            this.camParent.x = evalTween(this.moveXTween, now);
            if (now >= this.moveXTween.startTime + this.moveXTween.duration) this.moveXTween.active = false;
        }
        if (this.moveYTween.active) {
            this.camParent.y = evalTween(this.moveYTween, now);
            if (now >= this.moveYTween.startTime + this.moveYTween.duration) this.moveYTween.active = false;
        }
        if (this.rotationTween.active) {
            this.camAngle = evalTween(this.rotationTween, now);
            if (now >= this.rotationTween.startTime + this.rotationTween.duration) this.rotationTween.active = false;
        }
        if (this.zoomTween.active) {
            this.zoomSize = evalTween(this.zoomTween, now);
            if (now >= this.zoomTween.startTime + this.zoomTween.duration) this.zoomTween.active = false;
        }
    }

    // ── Follow helpers ─────────────────────────────────────────────────────

    private cameraWorldPos(): { x: number; y: number } {
        return { x: this.camParent.x + this.pos.x, y: this.camParent.y + this.pos.y };
    }

    private setToFreeMode(): void {
        this.frompos = { x: 0, y: 0 };
        this.topos = { x: 0, y: 0 };
        this.pos = { x: 0, y: 0 };
        this.followMode = false;
    }

    private updateFollowCam(planetWorldPos: { x: number; y: number }): void {
        if (this.followMode) {
            // C#: frompos = camera.localPosition - shake; topos = planet.world; timer = 0
            this.frompos = { x: this.pos.x, y: this.pos.y };
            this.topos = { x: planetWorldPos.x, y: planetWorldPos.y };
            this.timer = 0;
        }
    }
}
