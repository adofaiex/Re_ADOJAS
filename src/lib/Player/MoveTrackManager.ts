import * as THREE from 'three';
import { EasingFunctions } from './Easing';
import { debugLog } from './DebugLog';

interface MoveTrackTween {
    type: 'position' | 'rotation' | 'scale' | 'opacity';
    tween: any; // TWEEN.Tween or similar
}

interface AnimationProperty {
    property: string;
    startValue: number;
    endValue: number;
    startTime: number;
    duration: number;
    easingFunc: (t: number) => number;
    extra?: any;
}

interface DeltaAnimation {
    property: string;
    delta: number;           // total change to apply (e.g., rotationDelta in radians)
    startTime: number;
    duration: number;
    easingFunc: (t: number) => number;
}

interface TileAnimationState {
    startPos: THREE.Vector3;
    startRot: THREE.Euler;
    startScale: THREE.Vector3;
    startOpacity: number;
    tweens: Map<string, MoveTrackTween>;
    animations: Map<string, AnimationProperty>;
    deltaAnimations: DeltaAnimation[];  // additive delta animations (PIXI-style)
}

/**
 * Pending target for a tile that hasn't been created yet (lazy tile creation).
 * Stored when processMoveTrackEvent encounters a tile that doesn't exist,
 * then applied in registerTileInitial when the tile is eventually created.
 */
interface PendingMoveTrackAnimation {
    startTime: number;
    duration: number;
    easingFunc: (t: number) => number;
    targets: {
        positionX?: number;
        positionY?: number;
        rotationZ?: number;
        scaleX?: number;
        scaleY?: number;
        opacity?: number;
    };
}

/**
 * Manager for MoveTrack events
 * Handles animation of tiles (position, rotation, scale, opacity)
 */
export class MoveTrackManager {
    private levelData: any;
    private tileStartTimes: number[];
    private tileBPM: number[];

    // Timeline for MoveTrack events
    private moveTrackEventsTimeline: { time: number; event: any }[] = [];
    private lastMoveTrackEventIndex: number = -1;

    // Animation state for each tile
    private tileAnimationStates: Map<number, TileAnimationState> = new Map();

    // Initial state for each tile (for reset)
    private tileInitialStates: Map<number, {
        position: THREE.Vector3;
        rotation: THREE.Euler;
        scale: THREE.Vector3;
        opacity: number;
    }> = new Map();

    // Reference to tiles map (will be set by Player)
    private tiles: Map<string, THREE.Mesh> | null = null;

    // Base positions from angle data (unmodified by PositionTrack)
    // These match ADOFAI's startPos — the raw tile position before any
    // PositionTrack/MoveTrack modifications.
    private basePositions: THREE.Vector2[] = [];

    // Track active MoveTrack animations for planet following
    private activeMoveTracks: Map<number, {
        event: any;
        positionOffset: { x: number; y: number };
        rotationOffset: number;
        scaleOffset: { x: number; y: number };
        startTime: number;
        duration: number;
        ease: string;
    }> = new Map();

    /**
     * PIXI-style savingtrack for rotationOffset: stores the absolute rotationOffset
     * value per tile. Each new event computes change = newCr - oldCr, then replaces
     * savingtrack. Multiple delta animations can run simultaneously (additive),
     * matching PIXI's TrackTickRush behavior where events overlap/interrupt.
     */
    private savingtrackRotation: Map<number, number> = new Map();

    /**
     * Callback fired when a tile's transform is updated by an animation.
     * Used to sync changes to InstancedMeshManager when instanced rendering is active.
     */
    public tileTransformChanged?: (
        tileIndex: number,
        position: THREE.Vector3,
        rotation: THREE.Euler,
        scale: THREE.Vector3,
        opacity: number
    ) => void;

    // Pending animations for tiles that don't exist yet (lazy tile creation)
    // When processMoveTrackEvent skips a non-existent tile, the target is stored here
    // and applied when registerTileInitial is called for that tile.
    private pendingMoveTrackTargets: Map<number, PendingMoveTrackAnimation[]> = new Map();

    // Current game time in seconds (updated every frame by update())
    private currentTime: number = 0;

    // Debug: play counter for FAIL→PASS→PASS diagnosis
    private static playCounter: number = 0;
    private debugPlayId: number = 0;

    constructor(levelData: any, tileStartTimes: number[], tileBPM: number[]) {
        this.levelData = levelData;
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
    }

    /**
     * Set reference to tiles map
     */
    public setTilesReference(tiles: Map<string, THREE.Mesh>): void {
        this.tiles = tiles;

        // Store initial state for tiles that don't have it yet
        tiles.forEach((tileMesh, tileId) => {
            const index = parseInt(tileId);
            if (!this.tileInitialStates.has(index)) {
                this.tileInitialStates.set(index, {
                    position: tileMesh.position.clone(),
                    rotation: tileMesh.rotation.clone() as THREE.Euler,
                    scale: tileMesh.scale.clone(),
                    opacity: tileMesh.userData.opacity !== undefined ? tileMesh.userData.opacity : 1
                });
            }
        });
    }

    /**
     * Set base positions from angle data (unmodified by PositionTrack).
     * These are used for computing absolute MoveTrack targets,
     * matching ADOFAI's use of target.startPos.
     */
    public setBasePositions(positions: THREE.Vector2[]): void {
        this.basePositions = positions;
    }

    /**
     * Register a tile's initial state (called when tile is first created)
     */
    public registerTileInitial(index: number, tileMesh: THREE.Mesh): void {
        const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;
        if (!this.tileInitialStates.has(index)) {
            debugLog(playLabel, `Registering initial state for tile ${index}: pos=(${tileMesh.position.x.toFixed(3)},${tileMesh.position.y.toFixed(3)}), rot=${tileMesh.rotation.z.toFixed(6)}, scale=(${tileMesh.scale.x.toFixed(3)},${tileMesh.scale.y.toFixed(3)}), opacity=${tileMesh.userData.opacity ?? 1}`);
            this.tileInitialStates.set(index, {
                position: tileMesh.position.clone(),
                rotation: tileMesh.rotation.clone() as THREE.Euler,
                scale: tileMesh.scale.clone(),
                opacity: tileMesh.userData.opacity !== undefined ? tileMesh.userData.opacity : 1
            });

            // Apply any pending MoveTrack animations that were stored when this tile
            // didn't exist yet (lazy tile creation). This fixes the FAIL→PASS→PASS bug
            // where MoveTrack events for far-ahead tiles were silently dropped.
            const pendingAnims = this.pendingMoveTrackTargets.get(index);
            if (pendingAnims && pendingAnims.length > 0) {
                debugLog(playLabel, `  tile[${index}] has ${pendingAnims.length} pending MoveTrack animation(s)`);
                for (const pending of pendingAnims) {
                    const elapsed = this.currentTime - pending.startTime;
                    const progress = Math.min(elapsed / pending.duration, 1);

                    // When tile is created after animation would have completed,
                    // snap to final target. Otherwise create a fresh animation
                    // with the remaining time.
                    if (progress >= 1) {
                        // Animation window has passed — apply final values immediately
                        for (const [prop, value] of Object.entries(pending.targets)) {
                            switch (prop) {
                                case 'positionX': tileMesh.position.x = value; break;
                                case 'positionY': tileMesh.position.y = value; break;
                                case 'rotationZ': tileMesh.rotation.z = value; break;
                                case 'scaleX': tileMesh.scale.x = value; break;
                                case 'scaleY': tileMesh.scale.y = value; break;
                                case 'opacity':
                                    if (tileMesh.material) {
                                        if (tileMesh.material instanceof THREE.ShaderMaterial && tileMesh.material.uniforms.opacity) {
                                            tileMesh.material.uniforms.opacity.value = value;
                                        } else {
                                            (tileMesh.material as any).opacity = value;
                                        }
                                        (tileMesh.material as any).transparent = value < 0.999;
                                        tileMesh.userData.opacity = value;
                                        tileMesh.visible = value > 0.001;
                                    }
                                    break;
                            }
                        }
                        debugLog(playLabel, `  tile[${index}] applied final pending target (progress=${progress.toFixed(4)})`);
                    } else {
                        // Still within animation window — create fresh animation
                        // from current value to target with remaining duration
                        let state = this.tileAnimationStates.get(index);
                        if (!state) {
                            state = {
                                startPos: tileMesh.position.clone(),
                                startRot: tileMesh.rotation.clone() as THREE.Euler,
                                startScale: tileMesh.scale.clone(),
                                startOpacity: 1,
                                tweens: new Map(),
                                animations: new Map(),
                                deltaAnimations: []
                            };
                            this.tileAnimationStates.set(index, state);
                        }

                        const remainingDuration = pending.duration - elapsed;
                        for (const [prop, targetValue] of Object.entries(pending.targets)) {
                            let currentValue: number;
                            switch (prop) {
                                case 'positionX': currentValue = tileMesh.position.x; break;
                                case 'positionY': currentValue = tileMesh.position.y; break;
                                case 'rotationZ': currentValue = tileMesh.rotation.z; break;
                                case 'scaleX': currentValue = tileMesh.scale.x; break;
                                case 'scaleY': currentValue = tileMesh.scale.y; break;
                                case 'opacity': currentValue = tileMesh.userData.opacity ?? 1; break;
                                default: continue;
                            }
                            this.animateProperty(
                                tileMesh, prop, currentValue, targetValue,
                                remainingDuration, pending.easingFunc, state,
                                undefined, this.currentTime
                            );
                        }
                        debugLog(playLabel, `  tile[${index}] created catch-up animation (progress=${progress.toFixed(4)}, remaining=${remainingDuration.toFixed(3)}s)`);
                    }
                }
                this.pendingMoveTrackTargets.delete(index);
            }
        } else {
            const existing = this.tileInitialStates.get(index)!;
            debugLog(playLabel, `Skipping registerTileInitial for tile ${index} (already exists): existing rot=${existing.rotation.z.toFixed(6)}, current rot=${tileMesh.rotation.z.toFixed(6)}`);
        }
    }

    /**
     * Initialize MoveTrack events from tileMoveTrackEvents Map
     * (mirrors CameraController.buildCameraTimeline logic)
     */
    public initializeMoveTrackEvents(tileMoveTrackEvents: Map<number, any[]>): void {
        this.moveTrackEventsTimeline = [];
        const entries: { time: number; event: any }[] = [];

        debugLog('[MoveTrackManager] tileStartTimes at initialization:', this.tileStartTimes.slice(0, 10).map((t, i) => `[${i}]=${t.toFixed(3)}s`).join(', '));
        debugLog('[MoveTrackManager] tileBPM at initialization:', this.tileBPM.slice(0, 10).map((b, i) => `[${i}]=${b}`).join(', '));

        // CRITICAL: tileStartTimes from Player.ts are shifted so that tileStartTimes[1] = 0.
        // ADOFAN_PIXI uses raw times where time[0] = 0 (tile 0 at level start).
        // We must unshift to match ADOFAN_PIXI timing, otherwise ALL MoveTrack event times
        // are off by tileDurations[0] (e.g. 0.6s at 100 BPM / 180°), causing events to fire
        // before the planet reaches the corresponding tile.
        const shiftAmount = this.tileStartTimes.length > 0 ? -this.tileStartTimes[0] : 0;

        tileMoveTrackEvents.forEach((events, floor) => {
            const bpm = this.tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            const startTime = this.tileStartTimes[floor] || 0; // seconds (shifted)
            const unshiftedStartTime = startTime + shiftAmount; // seconds (matches ADOFAN_PIXI time[floor])

            events.forEach(event => {
                // Skip disabled events
                if (!this.isEventActive(event)) return;

                // Ensure floor is attached to the event
                const eventWithFloor = { ...event, floor };

                // angleOffset is in degrees. 180 degrees = 1 beat.
                const angleOffset = event.angleOffset || 0;
                const timeOffset = (angleOffset / 180) * secPerBeat;
                const eventTime = unshiftedStartTime + timeOffset;

                // Duration in seconds (duration is in beats, multiply by secPerBeat)
                const duration = (event.duration || 1) * secPerBeat;

                debugLog(`[MoveTrackManager] MoveTrack event at floor ${floor}: eventTime=${eventTime.toFixed(3)}s = unshiftedStartTime(${unshiftedStartTime.toFixed(3)}s from tileStartTimes[${floor}]=${this.tileStartTimes[floor]?.toFixed(3)}s + shiftAmount=${shiftAmount.toFixed(3)}s) + timeOffset(${timeOffset.toFixed(3)}s from angleOffset=${angleOffset}°), duration=${duration.toFixed(3)}s, bpm=${bpm}, secPerBeat=${secPerBeat.toFixed(4)}s`);

                entries.push({
                    time: eventTime,
                    event: {
                        ...eventWithFloor,
                        duration,
                        startTime: eventTime
                    }
                });
            });
        });

        debugLog('[MoveTrackManager] Found MoveTrack events:', entries.length);
        debugLog('[MoveTrackManager] Sorted timeline:', entries.map(e => `floor=${e.event.floor}, time=${e.time.toFixed(3)}s`).join(', '));

        // Sort by time
        entries.sort((a, b) => a.time - b.time);
        this.moveTrackEventsTimeline = entries;
    }

    /**
     * Check if an event is active (not disabled)
     */
    private isEventActive(event: any): boolean {
        if (event.active === false) return false;
        if (event.editorOnly === true) return false;
        return true;
    }

    /**
     * Update MoveTrack animations
     * @param elapsedTimeMs Elapsed time in milliseconds (from level start, before countdown)
     * Note: This method now receives timeInLevel (time from actual level start) from Player
     */
    public update(elapsedTimeMs: number): void {
        const timeInSeconds = elapsedTimeMs / 1000;
        this.currentTime = timeInSeconds;
        this.processMoveTrackEvents(timeInSeconds);

        // Update all active animations with current game time (synchronized)
        this.updateActiveAnimations(timeInSeconds);

        // Clean up completed MoveTrack animations
        this.cleanupCompletedAnimations(timeInSeconds);
    }

    /**
     * Update all active animations based on current game time (synchronized with game clock)
     * This is called every frame with the actual game time, allowing pause/resume functionality
     */
    private updateActiveAnimations(currentTime: number): void {
        if (!this.tiles) return;

        for (const [tileIndex, state] of this.tileAnimationStates.entries()) {
            const mesh = this.tiles.get(tileIndex.toString());
            if (!mesh) continue;

            for (const [propertyName, animation] of state.animations.entries()) {
                // Calculate progress based on game time (not wall clock time)
                const elapsed = currentTime - animation.startTime;
                const progress = Math.min(elapsed / animation.duration, 1);
                const easedProgress = animation.easingFunc(progress);
                const value = animation.startValue + (animation.endValue - animation.startValue) * easedProgress;

                // Apply the animated value to the mesh
                switch (propertyName) {
                    case 'positionX':
                        mesh.position.x = value;
                        break;
                    case 'positionY':
                        mesh.position.y = value;
                        break;
                    case 'scaleX':
                        mesh.scale.x = value;
                        break;
                    case 'scaleY':
                        mesh.scale.y = value;
                        break;
                    case 'rotationZ':
                        mesh.rotation.z = value;
                        if (tileIndex < 10) { // Only log for first 10 tiles to avoid spam
                            const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;
                            debugLog(playLabel, `  updateAnim tile[${tileIndex}] rotationZ: ${animation.startValue.toFixed(4)} → ${value.toFixed(4)} (end=${animation.endValue.toFixed(4)}, progress=${progress.toFixed(4)})`);
                        }
                        break;
                    case 'opacity':
                        if (mesh.material) {
                            if (mesh.material instanceof THREE.ShaderMaterial && mesh.material.uniforms.opacity) {
                                mesh.material.uniforms.opacity.value = value;
                            } else {
                                (mesh.material as any).opacity = value;
                            }
                            (mesh.material as any).transparent = value < 0.999;
                            mesh.userData.opacity = value;
                            mesh.visible = value > 0.001;

                            // Update children (decorations/icons) opacity
                            // Children always have transparent=true (set at creation),
                            // so we only need to set opacity — no shader recompile needed.
                            mesh.traverse((child) => {
                                if (child !== mesh && (child as any).material) {
                                    const childMat = (child as any).material;
                                    if (childMat.opacity !== undefined) {
                                        childMat.opacity = value;
                                    }
                                }
                            });
                        }
                        break;
                }

                // Remove animation when complete
                if (progress >= 1) {
                    state.animations.delete(propertyName);
                }
            }

            // PIXI-style delta animations: sum all active delta contributions
            // applied on top of the tile's initial rotation
            if (state.deltaAnimations.length > 0) {
                const initialState = this.tileInitialStates.get(tileIndex);
                const initialRotation = initialState ? initialState.rotation.z : 0;
                let totalDelta = 0;

                for (let j = state.deltaAnimations.length - 1; j >= 0; j--) {
                    const anim = state.deltaAnimations[j];
                    const elapsed = currentTime - anim.startTime;
                    const progress = Math.min(elapsed / anim.duration, 1);
                    const easedProgress = anim.easingFunc(progress);
                    totalDelta += anim.delta * easedProgress;

                    if (progress >= 1) {
                        state.deltaAnimations.splice(j, 1);
                    }
                }

                mesh.rotation.z = initialRotation + totalDelta;
            }

            // Sync to InstancedMeshManager when instanced rendering is active
            if (this.tileTransformChanged) {
                this.tileTransformChanged(
                    tileIndex,
                    mesh.position,
                    mesh.rotation as THREE.Euler,
                    mesh.scale,
                    mesh.userData.opacity !== undefined ? mesh.userData.opacity : 1
                );
            }
        }
    }

    /**
     * Clean up completed MoveTrack animations
     */
    private cleanupCompletedAnimations(currentTime: number): void {
        for (const [id, moveTrack] of this.activeMoveTracks.entries()) {
            if (currentTime >= moveTrack.startTime + moveTrack.duration) {
                this.activeMoveTracks.delete(id);
            }
        }
    }

    /**
     * Get the offset that the planet should follow based on active MoveTrack animations
     * @param tileIndex The current tile index where the planet is
     * @param currentTime Current game time in seconds (to enable pause/resume)
     * @returns The offset { x, y, rotation } to apply to the planet
     */
    public getPlanetFollowOffset(tileIndex: number, currentTime: number): { x: number; y: number; rotation: number } {
        const result = { x: 0, y: 0, rotation: 0 };

        for (const moveTrack of this.activeMoveTracks.values()) {
            const event = moveTrack.event;

            // Check if this tile is in the affected range
            const startTile = this.parseTileReference(event.startTile, event.floor);
            const endTile = this.parseTileReference(event.endTile, event.floor);
            const gapLength = event.gapLength || 0;

            const start = Math.min(startTile, endTile);
            const end = Math.max(startTile, endTile);

            // Check if current tile is in the affected range (considering gap)
            let inRange = false;
            for (let i = start; i <= end; i += 1 + gapLength) {
                if (i === tileIndex) {
                    inRange = true;
                    break;
                }
            }

            if (!inRange) continue;

            // Check if follow is enabled for this MoveTrack
            if (event.follow === false) continue;

            // Calculate current progress using synchronized game time
            const elapsed = currentTime - moveTrack.startTime;
            const progress = Math.min(elapsed / moveTrack.duration, 1);

            // Get easing function
            const easingFunc = this.getEasingFunction(moveTrack.ease);
            const easedProgress = easingFunc(progress);

            // Apply offset
            result.x += moveTrack.positionOffset.x * easedProgress;
            result.y += moveTrack.positionOffset.y * easedProgress;
            result.rotation += moveTrack.rotationOffset * easedProgress;
        }

        return result;
    }

    /**
     * Process MoveTrack events
     */
    private processMoveTrackEvents(timeInSeconds: number): void {
        const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;
        // Check if we need to reset
        if (this.lastMoveTrackEventIndex >= 0 && this.lastMoveTrackEventIndex < this.moveTrackEventsTimeline.length) {
            const lastEvent = this.moveTrackEventsTimeline[this.lastMoveTrackEventIndex];
            if (timeInSeconds < lastEvent.time) {
                debugLog(playLabel, `REWIND: time=${timeInSeconds.toFixed(3)}s < lastEvent.time=${lastEvent.time.toFixed(3)}s (floor=${lastEvent.event.floor}), resetting lastMoveTrackEventIndex from ${this.lastMoveTrackEventIndex} to -1`);
                this.lastMoveTrackEventIndex = -1;
            }
        }

        // Process new events that have reached their start time
        let safetyCounter = 0;
        while (
            safetyCounter < 100 &&
            this.lastMoveTrackEventIndex + 1 < this.moveTrackEventsTimeline.length &&
            this.moveTrackEventsTimeline[this.lastMoveTrackEventIndex + 1].time <= timeInSeconds
        ) {
            this.lastMoveTrackEventIndex++;
            const entry = this.moveTrackEventsTimeline[this.lastMoveTrackEventIndex];
            debugLog(playLabel, `Processing event idx=${this.lastMoveTrackEventIndex}: floor=${entry.event.floor}, time=${entry.time.toFixed(3)}s, currentTime=${timeInSeconds.toFixed(3)}s, remaining=${(this.moveTrackEventsTimeline.length - this.lastMoveTrackEventIndex - 1)} events left`);
            if (entry) {
                this.processMoveTrackEvent(entry.event, timeInSeconds);
            }
            safetyCounter++;
        }
    }

    /**
     * Process a single MoveTrack event
     * Based on official ffxMoveFloorPlus.StartEffect() logic
     * Key improvements:
     * - Kill individual property tweens instead of all tweens
     * - Use tileInitialStates as base for calculations (like startPos in official)
     * - Check approximate values to avoid unnecessary tweens
     * - Handle NaN values properly for optional properties
     */
    private processMoveTrackEvent(event: any, currentTime: number): void {
        if (!this.tiles) return;

        const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;
        const startTile = this.parseTileReference(event.startTile, event.floor);
        const endTile = this.parseTileReference(event.endTile, event.floor);
        const start = Math.min(startTile, endTile);
        const end = Math.max(startTile, endTile);
        const gapLength = event.gapLength || 0;

        // Count how many tiles in range exist
        let existCount = 0, totalCount = 0;
        for (let i = start; i <= end; i += 1 + gapLength) {
            totalCount++;
            if (this.tiles.has(i.toString())) existCount++;
        }
        debugLog(playLabel, `Processing MoveTrack event: floor=${event.floor}, range=[${start},${end}] gap=${gapLength}, tilesExist=${existCount}/${totalCount}, rotationOffset=${event.rotationOffset}, positionOffset=${JSON.stringify(event.positionOffset)}`);

        // Get animation parameters
        const duration = event.duration || 1;
        const ease = event.ease || 'Linear.easeNone';
        const positionOffset = event.positionOffset || [0, 0];
        const rotationOffset = event.rotationOffset || 0;
        const scale = event.scale || [100, 100];
        const opacity = event.opacity !== undefined ? event.opacity / 100 : 1;

        // Check which properties are actually used (not disabled)
        // In ADOFAI, properties are used if they are present in the event
        const positionUsed = event.positionOffset !== undefined;
        const rotationUsed = event.rotationOffset !== undefined;
        const scaleUsed = event.scale !== undefined;
        const opacityUsed = event.opacity !== undefined;

        // Store active MoveTrack for planet following
        const moveTrackId = this.activeMoveTracks.size;
        this.activeMoveTracks.set(moveTrackId, {
            event,
            positionOffset: { x: positionOffset[0], y: positionOffset[1] },
            rotationOffset,
            scaleOffset: { x: scale[0] / 100, y: scale[1] / 100 },
            startTime: currentTime,
            duration,
            ease
        });

        // Get easing function once
        const easingFunc = this.getEasingFunction(ease);

        // Apply animation to tiles in range
        for (let i = start; i <= end; i += 1 + gapLength) {
            const tileId = i.toString();
            const tileMesh = this.tiles.get(tileId);

            if (!tileMesh) {
                if (i < 20) {
                    debugLog(playLabel, `  tile[${i}] SKIPPED - mesh does not exist in tiles map`);
                }
                // Store pending animation target so it applies when tile is created later
                const targets: PendingMoveTrackAnimation['targets'] = {};
                if (positionUsed) {
                    const tileBasePosForPending = (i < this.basePositions.length)
                        ? this.basePositions[i]
                        : null;
                    if (tileBasePosForPending) {
                        targets.positionX = tileBasePosForPending.x + positionOffset[0];
                        targets.positionY = tileBasePosForPending.y + positionOffset[1];
                    }
                }
                if (rotationUsed) {
                    targets.rotationZ = rotationOffset * Math.PI / 180;
                }
                if (scaleUsed) {
                    targets.scaleX = scale[0] / 100;
                    targets.scaleY = scale[1] / 100;
                }
                if (opacityUsed) {
                    targets.opacity = opacity;
                }
                if (Object.keys(targets).length > 0) {
                    const pendingEntry: PendingMoveTrackAnimation = {
                        startTime: currentTime,
                        duration,
                        easingFunc,
                        targets
                    };
                    if (!this.pendingMoveTrackTargets.has(i)) {
                        this.pendingMoveTrackTargets.set(i, []);
                    }
                    this.pendingMoveTrackTargets.get(i)!.push(pendingEntry);
                    if (i < 20) {
                        debugLog(playLabel, `  tile[${i}] stored pending animation: rotTarget=${targets.rotationZ?.toFixed(6)}, posTarget=(${targets.positionX?.toFixed(3)},${targets.positionY?.toFixed(3)})`);
                    }
                }
                continue;
            }

            // Get or create animation state
            let state = this.tileAnimationStates.get(i);
            if (!state) {
                state = {
                    startPos: tileMesh.position.clone(),
                    startRot: tileMesh.rotation.clone() as THREE.Euler,
                    startScale: tileMesh.scale.clone(),
                    startOpacity: 1,
                    tweens: new Map(),
                    animations: new Map(),
                    deltaAnimations: []
                };
                this.tileAnimationStates.set(i, state);
            }

            // Get initial state for this tile (used as base like in official code)
            const initialState = this.tileInitialStates.get(i);
            const tileBaseRot = initialState ? initialState.rotation.z : state.startRot.z;
            const tileBaseScale = initialState ? initialState.scale : state.startScale;

            // ADOFAI ffxMoveFloorPlus: position target = target.startPos + positionOffset * tileSize
            // where startPos is the UNMODIFIED base position from angle data
            // (NOT the PositionTrack-modified mesh position).
            const tileBasePos = (i < this.basePositions.length)
                ? this.basePositions[i]
                : (initialState ? new THREE.Vector2(initialState.position.x, initialState.position.y) : new THREE.Vector2(state.startPos.x, state.startPos.y));

            // Position animation - following official logic
            if (positionUsed) {
                const targetX = tileBasePos.x + positionOffset[0];
                const targetY = tileBasePos.y + positionOffset[1];

                // Only create new tween if target differs from current (approximate check)
                if (!this.approximatelyEqual(tileMesh.position.x, targetX)) {
                    this.animateProperty(
                        tileMesh,
                        'positionX',
                        tileMesh.position.x,
                        targetX,
                        duration,
                        easingFunc,
                        state,
                        undefined,
                        currentTime
                    );
                }

                // Only create new tween if target differs from current
                if (!this.approximatelyEqual(tileMesh.position.y, targetY)) {
                    this.animateProperty(
                        tileMesh,
                        'positionY',
                        tileMesh.position.y,
                        targetY,
                        duration,
                        easingFunc,
                        state,
                        undefined,
                        currentTime
                    );
                }
            }

            // ADOFAI ffxMoveFloorPlus rotation: absolute target
            // In ADOFAI: target = startRot.z + rotationOffset[1]
            // where startRot is typically 0 for all tiles (base rotation from angle data).
            // The tween interpolates from current rotation (which may include
            // PositionTrack modifications) to this absolute target.
            // NOTE: This OVERRIDES any PositionTrack rotation on the tile.
            if (rotationUsed) {
                const targetRot = rotationOffset * Math.PI / 180;

                const currentRot = tileMesh.rotation.z;
                const approxEqual = this.approximatelyEqual(currentRot, targetRot, 0.001);
                debugLog(playLabel, `  tile[${i}] rotation: currentRot=${currentRot.toFixed(6)} targetRot=${targetRot.toFixed(6)} (offset=${rotationOffset}°) approxEqual=${approxEqual}`);
                if (!approxEqual) {
                    this.animateProperty(
                        tileMesh,
                        'rotationZ',
                        currentRot,
                        targetRot,
                        duration,
                        easingFunc,
                        state,
                        undefined,
                        currentTime
                    );
                }
            }

            // Scale animation
            if (scaleUsed) {
                const targetScaleX = scale[0] / 100;
                const targetScaleY = scale[1] / 100;

                // Handle scaleX
                if (scale[0] !== 100) {
                    if (!this.approximatelyEqual(tileMesh.scale.x, targetScaleX)) {
                        this.animateProperty(
                            tileMesh,
                            'scaleX',
                            tileMesh.scale.x,
                            targetScaleX,
                            duration,
                            easingFunc,
                            state,
                            undefined,
                            currentTime
                        );
                    }
                }

                // Handle scaleY
                if (scale[1] !== 100) {
                    if (!this.approximatelyEqual(tileMesh.scale.y, targetScaleY)) {
                        this.animateProperty(
                            tileMesh,
                            'scaleY',
                            tileMesh.scale.y,
                            targetScaleY,
                            duration,
                            easingFunc,
                            state,
                            undefined,
                            currentTime
                        );
                    }
                }
            }

            // Opacity animation
            if (event.opacity !== undefined) {
                const currentOpacity = tileMesh.userData.opacity !== undefined ? tileMesh.userData.opacity : 1;
                if (!this.approximatelyEqual(currentOpacity, opacity)) {
                    this.animateProperty(
                        tileMesh,
                        'opacity',
                        currentOpacity,
                        opacity,
                        duration,
                        easingFunc,
                        state,
                        undefined,
                        currentTime
                    );
                }
            }
        }
    }

    /**
     * Parse tile reference (handle relative positioning)
     */
    private parseTileReference(ref: any, currentFloor: number): number {
        if (Array.isArray(ref) && ref.length >= 2) {
            const offset = Number(ref[0]) || 0;
            const relativeTo = ref[1];

            if (relativeTo === 'ThisTile' || relativeTo === 0) {
                return currentFloor + offset;
            } else if (relativeTo === 'Start' || relativeTo === 1) {
                return offset;
            } else if (relativeTo === 'End' || relativeTo === 2) {
                return (this.levelData.tiles.length - 1) + offset;
            }
        }

        return Number(ref) || currentFloor;
    }

    /**
     * Normalize angle to -π to π range
     * Prevents issues with angle wraparound (e.g., -π and π are the same rotation)
     */
    private normalizeAngle(angle: number): number {
        let normalized = angle % (2 * Math.PI);
        if (normalized > Math.PI) {
            normalized -= 2 * Math.PI;
        } else if (normalized < -Math.PI) {
            normalized += 2 * Math.PI;
        }
        return normalized;
    }

    /**
     * Check if two values are approximately equal (with epsilon tolerance)
     * Matches Unity's Mathf.Approximately logic
     */
    private approximatelyEqual(a: number, b: number, epsilon: number = 1e-5): boolean {
        return Math.abs(a - b) < epsilon;
    }

    /**
     * Register a property animation to be updated via game clock in update()
     * Instead of using requestAnimationFrame, we store the animation params
     * and update them synchronously via update() with game time
     * 
     * @param mesh The mesh to animate (currently unused since we track by tileIndex)
     * @param property Property name to animate
     * @param startValue Starting value
     * @param endValue Target value
     * @param duration Duration in seconds
     * @param easingFunc Easing function
     * @param state Animation state to store parameters in
     * @param extra Extra parameters
     * @param startTime Current game time when animation starts
     */
    private animateProperty(
        mesh: THREE.Mesh,
        property: string,
        startValue: number,
        endValue: number,
        duration: number,
        easingFunc: (t: number) => number,
        state: TileAnimationState,
        extra?: any,
        startTime: number = 0
    ): void {
        // Guard against zero duration - apply target value immediately
        if (duration <= 0) {
            switch (property) {
                case 'positionX': mesh.position.x = endValue; break;
                case 'positionY': mesh.position.y = endValue; break;
                case 'scaleX': mesh.scale.x = endValue; break;
                case 'scaleY': mesh.scale.y = endValue; break;
                case 'opacity':
                    if (mesh.material) {
                        if (mesh.material instanceof THREE.ShaderMaterial && mesh.material.uniforms.opacity) {
                            mesh.material.uniforms.opacity.value = endValue;
                        } else {
                            (mesh.material as any).opacity = endValue;
                        }
                        (mesh.material as any).transparent = endValue < 0.999;
                        mesh.userData.opacity = endValue;
                        mesh.visible = endValue > 0.001;

                        // Update children (decorations/icons) opacity
                        mesh.traverse((child) => {
                            if (child !== mesh && (child as any).material) {
                                const childMat = (child as any).material;
                                if (childMat.opacity !== undefined) {
                                    childMat.opacity = endValue;
                                }
                            }
                        });
                    }
                    break;
            }
            state.animations.delete(property);
            return;
        }

        // Store animation data for updateActiveAnimations() to process
        state.animations.set(property, {
            property,
            startValue,
            endValue,
            startTime, // Current game time when animation starts
            duration,
            easingFunc,
            extra
        });
    }

    /**
     * Get easing function by name
     */
    private getEasingFunction(easeName: string): (t: number) => number {
        const easeMap: { [key: string]: (t: number) => number } = {
            'Linear.easeNone': (t) => t,
            'Quad.easeIn': (t) => t * t,
            'Quad.easeOut': (t) => t * (2 - t),
            'Quad.easeInOut': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            'Cubic.easeIn': (t) => t * t * t,
            'Cubic.easeOut': (t) => 1 + (t - 1) * (t - 1) * (t - 1),
            'Cubic.easeInOut': (t) => t < 0.5 ? 4 * t * t * t : 1 + (t - 1) * (2 * (t - 2)) * (2 * (t - 2)),
            'Quart.easeIn': (t) => t * t * t * t,
            'Quart.easeOut': (t) => 1 - (t - 1) * (t - 1) * (t - 1) * (t - 1),
            'Quart.easeInOut': (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (t - 1) * (t - 1) * (t - 1) * (t - 1),
            'Quint.easeIn': (t) => t * t * t * t * t,
            'Quint.easeOut': (t) => 1 + (t - 1) * (t - 1) * (t - 1) * (t - 1) * (t - 1),
            'Quint.easeInOut': (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (t - 1) * (t - 1) * (t - 1) * (t - 1) * (t - 1),
            'Sine.easeIn': (t) => 1 - Math.cos((t * Math.PI) / 2),
            'Sine.easeOut': (t) => Math.sin((t * Math.PI) / 2),
            'Sine.easeInOut': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
            'Expo.easeIn': (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
            'Expo.easeOut': (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
            'Expo.easeInOut': (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
            'Circ.easeIn': (t) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
            'Circ.easeOut': (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
            'Circ.easeInOut': (t) => t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
            'Elastic.easeIn': (t) => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)),
            'Elastic.easeOut': (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
            'Elastic.easeInOut': (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2 : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2 + 1,
            'Back.easeIn': (t) => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return c3 * t * t * t - c1 * t * t;
            },
            'Back.easeOut': (t) => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            },
            'Back.easeInOut': (t) => {
                const c1 = 1.70158;
                const c2 = c1 * 1.525;
                return t < 0.5
                    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
                    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
            },
            'Bounce.easeOut': (t) => {
                const n1 = 7.5625;
                const d1 = 2.75;
                if (t < 1 / d1) {
                    return n1 * t * t;
                } else if (t < 2 / d1) {
                    return n1 * (t -= 1.5 / d1) * t + 0.75;
                } else if (t < 2.5 / d1) {
                    return n1 * (t -= 2.25 / d1) * t + 0.9375;
                } else {
                    return n1 * (t -= 2.625 / d1) * t + 0.984375;
                }
            },
            'Bounce.easeIn': (t) => 1 - this.getEasingFunction('Bounce.easeOut')(1 - t),
            'Bounce.easeInOut': (t) => t < 0.5
                ? (1 - this.getEasingFunction('Bounce.easeOut')(1 - 2 * t)) / 2
                : (1 + this.getEasingFunction('Bounce.easeOut')(2 * t - 1)) / 2,
        };

        return easeMap[easeName] || ((t) => t);
    }

    /**
     * Fast-forward all MoveTrack events up to the given target time.
     * Applies final animation values directly to existing tiles (no animation),
     * and stores final targets for non-existing tiles as pending with duration=0
     * (so they snap on creation).
     */
    public fastForwardTo(targetTime: number): void {
        this.currentTime = targetTime;
        const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;
        debugLog(playLabel, `Fast-forwarding MoveTrack events to targetTime=${targetTime.toFixed(3)}s`);

        // Process all events up to target time, applying final values directly
        while (
            this.lastMoveTrackEventIndex + 1 < this.moveTrackEventsTimeline.length &&
            this.moveTrackEventsTimeline[this.lastMoveTrackEventIndex + 1].time <= targetTime
        ) {
            this.lastMoveTrackEventIndex++;
            const entry = this.moveTrackEventsTimeline[this.lastMoveTrackEventIndex];
            if (entry) {
                this.applyMoveTrackEventInstant(entry.event, targetTime);
            }
        }

        // Clear any active animations (they're all completed by the fast-forward)
        this.tileAnimationStates.clear();
        this.activeMoveTracks.clear();
        debugLog(playLabel, `Fast-forward complete: lastMoveTrackEventIndex=${this.lastMoveTrackEventIndex}`);
    }

    /**
     * Apply a single MoveTrack event's final values instantly to all tiles in range.
     * For non-existent tiles, stores a pending target with duration=0 (snap on creation).
     */
    private applyMoveTrackEventInstant(event: any, currentTime: number): void {
        if (!this.tiles) return;

        const startTile = this.parseTileReference(event.startTile, event.floor);
        const endTile = this.parseTileReference(event.endTile, event.floor);
        const start = Math.min(startTile, endTile);
        const end = Math.max(startTile, endTile);
        const gapLength = event.gapLength || 0;

        const positionOffset = event.positionOffset || [0, 0];
        const rotationOffset = event.rotationOffset || 0;
        const scale = event.scale || [100, 100];
        const opacity = event.opacity !== undefined ? event.opacity / 100 : 1;

        const positionUsed = event.positionOffset !== undefined;
        const rotationUsed = event.rotationOffset !== undefined;
        const scaleUsed = event.scale !== undefined;
        const opacityUsed = event.opacity !== undefined;

        for (let i = start; i <= end; i += 1 + gapLength) {
            const tileId = i.toString();
            const tileMesh = this.tiles.get(tileId);

            if (!tileMesh) {
                // Store final targets as pending with duration=0 (snap on creation)
                const targets: PendingMoveTrackAnimation['targets'] = {};
                if (positionUsed) {
                    const tileBasePos = (i < this.basePositions.length)
                        ? this.basePositions[i] : null;
                    if (tileBasePos) {
                        targets.positionX = tileBasePos.x + positionOffset[0];
                        targets.positionY = tileBasePos.y + positionOffset[1];
                    }
                }
                if (rotationUsed) {
                    targets.rotationZ = rotationOffset * Math.PI / 180;
                }
                if (scaleUsed) {
                    targets.scaleX = scale[0] / 100;
                    targets.scaleY = scale[1] / 100;
                }
                if (opacityUsed) {
                    targets.opacity = opacity;
                }
                if (Object.keys(targets).length > 0) {
                    const pendingEntry: PendingMoveTrackAnimation = {
                        startTime: currentTime,
                        duration: 0,
                        easingFunc: (t: number) => t,
                        targets
                    };
                    if (!this.pendingMoveTrackTargets.has(i)) {
                        this.pendingMoveTrackTargets.set(i, []);
                    }
                    this.pendingMoveTrackTargets.get(i)!.push(pendingEntry);
                }
                continue;
            }

            // Apply final values directly to existing tiles
            const tileBasePos = (i < this.basePositions.length)
                ? this.basePositions[i]
                : new THREE.Vector2(tileMesh.position.x, tileMesh.position.y);

            if (positionUsed) {
                tileMesh.position.x = tileBasePos.x + positionOffset[0];
                tileMesh.position.y = tileBasePos.y + positionOffset[1];
            }
            if (rotationUsed) {
                tileMesh.rotation.z = rotationOffset * Math.PI / 180;
            }
            if (scaleUsed) {
                tileMesh.scale.x = scale[0] / 100;
                tileMesh.scale.y = scale[1] / 100;
            }
            if (opacityUsed) {
                tileMesh.userData.opacity = opacity;
                if (tileMesh.material) {
                    (tileMesh.material as any).opacity = opacity;
                    (tileMesh.material as any).transparent = opacity < 0.999;
                }
                tileMesh.visible = opacity > 0.001;
                tileMesh.traverse((child) => {
                    if (child !== tileMesh && (child as any).material) {
                        (child as any).material.opacity = opacity;
                    }
                });
            }

            // Sync to instanced mesh
            if (this.tileTransformChanged) {
                this.tileTransformChanged(
                    i,
                    tileMesh.position,
                    tileMesh.rotation as THREE.Euler,
                    tileMesh.scale,
                    tileMesh.userData.opacity !== undefined ? tileMesh.userData.opacity : 1
                );
            }
        }
    }

    /**
     * Reset all animations and tiles to initial state
     */
    public reset(): void {
        this.debugPlayId = ++MoveTrackManager.playCounter;
        const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;
        debugLog(playLabel, 'Resetting animations and tiles. tileAnimationStates size:', this.tileAnimationStates.size, 'activeMoveTracks size:', this.activeMoveTracks.size, 'lastMoveTrackEventIndex:', this.lastMoveTrackEventIndex);

        // Log tile initial states
        debugLog(playLabel, `tileInitialStates has ${this.tileInitialStates.size} entries, tiles map has ${this.tiles?.size || 0} entries`);
        if (this.tiles) {
            this.tileInitialStates.forEach((initial, idx) => {
                const exists = this.tiles!.has(idx.toString());
                debugLog(playLabel, `  tile[${idx}] initial rot=${initial.rotation.z.toFixed(6)} pos=(${initial.position.x.toFixed(3)},${initial.position.y.toFixed(3)}) exists=${exists}`);
            });
        }
        
        // Clear active animations, savingtrack, and pending targets
        this.tileAnimationStates.clear();
        this.activeMoveTracks.clear();
        this.savingtrackRotation.clear();
        this.pendingMoveTrackTargets.clear();
        this.lastMoveTrackEventIndex = -1;

        // Reset tiles to their captured initial states
        if (this.tiles) {
            this.tileInitialStates.forEach((initial, index) => {
                const mesh = this.tiles!.get(index.toString());
                if (mesh) {
                    mesh.position.copy(initial.position);
                    mesh.rotation.copy(initial.rotation);
                    mesh.scale.copy(initial.scale);
                    mesh.userData.opacity = initial.opacity;
                    mesh.visible = initial.opacity > 0.001;

                    if (mesh.material) {
                        (mesh.material as any).opacity = initial.opacity;
                        (mesh.material as any).transparent = initial.opacity < 0.999;
                    }

                    // Update children (decorations/icons) opacity to match
                    mesh.traverse((child) => {
                        if (child !== mesh && (child as any).material) {
                            const childMat = (child as any).material;
                            if (childMat.opacity !== undefined) {
                                childMat.opacity = initial.opacity;
                            }
                        }
                    });

                    // Sync to InstancedMeshManager when instanced rendering is active
                    if (this.tileTransformChanged) {
                        this.tileTransformChanged(
                            index,
                            mesh.position,
                            mesh.rotation as THREE.Euler,
                            mesh.scale,
                            mesh.userData.opacity !== undefined ? mesh.userData.opacity : 1
                        );
                    }
                }
            });
        }

        // Post-reset verification for early tiles
        if (this.tiles) {
            for (let i = 0; i < Math.min(5, this.tiles.size); i++) {
                const mesh = this.tiles.get(i.toString());
                if (mesh) {
                    debugLog(playLabel, `  POST-RESET tile[${i}]: pos=(${mesh.position.x.toFixed(3)},${mesh.position.y.toFixed(3)}) rot=${mesh.rotation.z.toFixed(6)}`);
                }
            }
        }
        debugLog(playLabel, 'Reset complete');
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this.reset();
        this.tileInitialStates.clear();
        this.moveTrackEventsTimeline = [];
    }
}
