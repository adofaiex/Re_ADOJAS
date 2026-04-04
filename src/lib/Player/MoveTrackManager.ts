import * as THREE from 'three';
import { EasingFunctions } from './Easing';

interface MoveTrackTween {
    type: 'position' | 'rotation' | 'scale' | 'opacity';
    tween: any; // TWEEN.Tween or similar
}

interface TileAnimationState {
    startPos: THREE.Vector3;
    startRot: THREE.Euler;
    startScale: THREE.Vector3;
    startOpacity: number;
    tweens: Map<string, MoveTrackTween>;
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
    }> = new Map();

    // Reference to tiles map (will be set by Player)
    private tiles: Map<string, THREE.Mesh> | null = null;

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
                    scale: tileMesh.scale.clone()
                });
            }
        });
    }

    /**
     * Register a tile's initial state (called when tile is first created)
     */
    public registerTileInitial(index: number, tileMesh: THREE.Mesh): void {
        if (!this.tileInitialStates.has(index)) {
            console.log(`[MoveTrackManager] Registering initial state for tile ${index}`);
            this.tileInitialStates.set(index, {
                position: tileMesh.position.clone(),
                rotation: tileMesh.rotation.clone() as THREE.Euler,
                scale: tileMesh.scale.clone()
            });
        }
    }

    /**
     * Initialize MoveTrack events from tileMoveTrackEvents Map
     * (mirrors CameraController.buildCameraTimeline logic)
     */
    public initializeMoveTrackEvents(tileMoveTrackEvents: Map<number, any[]>): void {
        this.moveTrackEventsTimeline = [];
        const entries: { time: number; event: any }[] = [];

        console.log('[MoveTrackManager] tileStartTimes at initialization:', this.tileStartTimes.slice(0, 10).map((t, i) => `[${i}]=${t.toFixed(3)}s`).join(', '));
        console.log('[MoveTrackManager] tileBPM at initialization:', this.tileBPM.slice(0, 10).map((b, i) => `[${i}]=${b}`).join(', '));

        tileMoveTrackEvents.forEach((events, floor) => {
            const bpm = this.tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            const startTime = this.tileStartTimes[floor] || 0; // seconds

            events.forEach(event => {
                // Skip disabled events
                if (!this.isEventActive(event)) return;

                // Ensure floor is attached to the event
                const eventWithFloor = { ...event, floor };

                // angleOffset is in degrees. 180 degrees = 1 beat.
                const angleOffset = event.angleOffset || 0;
                const timeOffset = (angleOffset / 180) * secPerBeat;
                const eventTime = startTime + timeOffset;

                // Duration in seconds (duration is in beats, multiply by secPerBeat)
                const duration = (event.duration || 1) * secPerBeat;

                console.log(`[MoveTrackManager] MoveTrack event at floor ${floor}: eventTime=${eventTime.toFixed(3)}s = startTime(${startTime.toFixed(3)}s from tileStartTimes[${floor}]=${this.tileStartTimes[floor]?.toFixed(3)}s) + timeOffset(${timeOffset.toFixed(3)}s from angleOffset=${angleOffset}°), duration=${duration.toFixed(3)}s, bpm=${bpm}, secPerBeat=${secPerBeat.toFixed(4)}s`);

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

        console.log('[MoveTrackManager] Found MoveTrack events:', entries.length);
        console.log('[MoveTrackManager] Sorted timeline:', entries.map(e => `floor=${e.event.floor}, time=${e.time.toFixed(3)}s`).join(', '));

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
        this.processMoveTrackEvents(timeInSeconds);

        // Clean up completed MoveTrack animations
        this.cleanupCompletedAnimations(timeInSeconds);
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
     * @returns The offset { x, y, rotation } to apply to the planet
     */
    public getPlanetFollowOffset(tileIndex: number): { x: number; y: number; rotation: number } {
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

            // Calculate current progress
            const currentTime = performance.now() / 1000;
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
        // Check if we need to reset
        if (this.lastMoveTrackEventIndex >= 0 && this.lastMoveTrackEventIndex < this.moveTrackEventsTimeline.length) {
            const lastEvent = this.moveTrackEventsTimeline[this.lastMoveTrackEventIndex];
            if (timeInSeconds < lastEvent.time) {
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
            if (entry) {
                this.processMoveTrackEvent(entry.event, timeInSeconds);
            }
            safetyCounter++;
        }
    }

    /**
     * Process a single MoveTrack event
     */
    private processMoveTrackEvent(event: any, currentTime: number): void {
        if (!this.tiles) return;

        console.log(`[MoveTrackManager] Processing MoveTrack event at currentTime=${currentTime.toFixed(3)}s, event.startTime=${event.startTime.toFixed(3)}s}`);

        // Parse tile range
        const startTile = this.parseTileReference(event.startTile, event.floor);
        const endTile = this.parseTileReference(event.endTile, event.floor);
        const gapLength = event.gapLength || 0;

        // Ensure start <= end
        const start = Math.min(startTile, endTile);
        const end = Math.max(startTile, endTile);

        // Get animation parameters
        const duration = event.duration || 1;
        const ease = event.ease || 'Linear.easeNone';
        const positionOffset = event.positionOffset || [0, 0];
        const rotationOffset = event.rotationOffset || 0;
        const scale = event.scale || [100, 100];
        const opacity = event.opacity !== undefined ? event.opacity / 100 : 1;

        // Check if planet should follow this track (default true)
        const follow = event.follow !== false; // Default to true

        console.log(`[MoveTrackManager] Animating tiles ${start}-${end}, duration=${duration.toFixed(3)}s, ease=${ease}, follow=${follow}`);

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

        // Apply animation to tiles in range
        for (let i = start; i <= end; i += 1 + gapLength) {
            const tileId = i.toString();
            const tileMesh = this.tiles.get(tileId);

            if (!tileMesh) continue;

            // Get current tile state as start state for this animation
            const startPos = tileMesh.position.clone();
            const startRot = tileMesh.rotation.clone() as THREE.Euler;
            const startScale = tileMesh.scale.clone();

            // Kill existing tweens for this tile
            if (this.tileAnimationStates.has(i)) {
                const state = this.tileAnimationStates.get(i)!;
                state.tweens.forEach(tween => {
                    if (tween.tween) {
                        tween.tween.stop();
                    }
                });
                state.tweens.clear();
            }

            // Create new animation state
            const state = {
                startPos,
                startRot,
                startScale,
                startOpacity: 1,
                tweens: new Map()
            };
            this.tileAnimationStates.set(i, state);

            // Calculate target values
            const targetX = startPos.x + positionOffset[0];
            const targetY = startPos.y + positionOffset[1];
            // Convert rotationOffset from degrees to radians
            const targetRot = startRot.z + (rotationOffset * Math.PI / 180);
            const targetScaleX = scale[0] / 100;
            const targetScaleY = scale[1] / 100;

            // Get easing function
            const easingFunc = this.getEasingFunction(ease);

            // Animate position X
            if (positionOffset[0] !== 0) {
                this.animateProperty(
                    tileMesh,
                    'positionX',
                    state.startPos.x,
                    targetX,
                    duration,
                    easingFunc,
                    state
                );
            }

            // Animate position Y
            if (positionOffset[1] !== 0) {
                this.animateProperty(
                    tileMesh,
                    'positionY',
                    state.startPos.y,
                    targetY,
                    duration,
                    easingFunc,
                    state
                );
            }

            // Animate rotation
            if (rotationOffset !== 0) {
                this.animateProperty(
                    tileMesh,
                    'rotation',
                    state.startRot.z,
                    targetRot,
                    duration,
                    easingFunc,
                    state
                );
            }

            // Animate scale
            if (scale[0] !== 100 || scale[1] !== 100) {
                this.animateProperty(
                    tileMesh,
                    'scale',
                    1,
                    targetScaleX,
                    duration,
                    easingFunc,
                    state,
                    { scaleY: targetScaleY }
                );
            }

            // Animate opacity (if material supports it)
            if (opacity !== 1) {
                this.animateProperty(
                    tileMesh,
                    'opacity',
                    1,
                    opacity,
                    duration,
                    easingFunc,
                    state
                );
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
     * Animate a property using requestAnimationFrame
     */
    private animateProperty(
        mesh: THREE.Mesh,
        property: string,
        startValue: number,
        endValue: number,
        duration: number,
        easingFunc: (t: number) => number,
        state: TileAnimationState,
        extra?: any
    ): void {
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = (currentTime - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easingFunc(progress);
            const value = startValue + (endValue - startValue) * easedProgress;

            switch (property) {
                case 'positionX':
                    mesh.position.x = value;
                    break;
                case 'positionY':
                    mesh.position.y = value;
                    break;
                case 'rotation':
                    mesh.rotation.z = value;
                    break;
                case 'scale':
                    mesh.scale.x = value;
                    if (extra?.scaleY !== undefined) {
                        mesh.scale.y = startValue + (extra.scaleY - startValue) * easedProgress;
                    } else {
                        mesh.scale.y = value;
                    }
                    break;
                case 'opacity':
                    if (mesh.material && 'opacity' in mesh.material) {
                        (mesh.material as any).opacity = value;
                    }
                    break;
            }

            if (progress < 1) {
                const frameId = requestAnimationFrame(animate);
                state.tweens.set(property, { type: property as any, tween: { frameId } });
            } else {
                // Animation complete
                state.tweens.delete(property);
            }
        };

        const frameId = requestAnimationFrame(animate);
        state.tweens.set(property, { type: property as any, tween: { frameId } });
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
     * Reset all tiles to their initial state
     */
    private resetTiles(): void {
        if (!this.tiles) {
            console.log('[MoveTrackManager] resetTiles: tiles is null');
            return;
        }

        console.log('[MoveTrackManager] resetTiles: resetting', this.tiles.size, 'tiles');
        console.log('[MoveTrackManager] resetTiles: tileInitialStates has', this.tileInitialStates.size, 'entries');

        let resetCount = 0;
        this.tiles.forEach((tileMesh, tileId) => {
            const index = parseInt(tileId);
            const initialState = this.tileInitialStates.get(index);

            if (initialState) {
                // Reset to stored initial state
                tileMesh.position.copy(initialState.position);
                tileMesh.rotation.copy(initialState.rotation);
                tileMesh.scale.copy(initialState.scale);
                resetCount++;
            } else {
                console.log(`[MoveTrackManager] resetTiles: No initial state for tile ${index}`);
                // If no stored initial state, reset to original level data position
                const tile = this.levelData.tiles[index];
                if (tile) {
                    const [x, y] = tile.position;
                    const zLevel = 12 - index;
                    tileMesh.position.set(x, y, zLevel * 0.001);
                    tileMesh.rotation.set(0, 0, 0);
                    tileMesh.scale.set(1, 1, 1);
                }
            }

            // Reset opacity (if material supports it)
            if ((tileMesh.material as any).opacity !== undefined) {
                (tileMesh.material as any).opacity = 1;
                (tileMesh.material as any).transparent = false;
            }
        });

        console.log('[MoveTrackManager] resetTiles: successfully reset', resetCount, 'tiles');
    }

    /**
     * Reset MoveTrack (restore tiles to initial positions without clearing resources)
     */
    public reset(): void {
        console.log('[MoveTrackManager] reset: resetting tiles to initial state');

        // Stop all running tweens first
        this.tileAnimationStates.forEach(state => {
            state.tweens.forEach(tween => {
                if (tween.tween?.frameId) {
                    cancelAnimationFrame(tween.tween.frameId);
                }
            });
            state.tweens.clear();
        });

        // Reset all tiles to initial state
        this.resetTiles();

        // Clear active MoveTrack animations
        this.activeMoveTracks.clear();

        // Reset timeline index
        this.lastMoveTrackEventIndex = -1;

        console.log('[MoveTrackManager] reset: complete');
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        console.log('[MoveTrackManager] dispose: starting cleanup');

        // Reset all tiles to initial state
        this.resetTiles();

        // Stop all tweens
        this.tileAnimationStates.forEach(state => {
            state.tweens.forEach(tween => {
                if (tween.tween?.frameId) {
                    cancelAnimationFrame(tween.tween.frameId);
                }
            });
        });
        this.tileAnimationStates.clear();
        this.moveTrackEventsTimeline = [];

        // Clear active MoveTrack animations
        this.activeMoveTracks.clear();

        console.log('[MoveTrackManager] dispose: cleanup complete');
    }
}
