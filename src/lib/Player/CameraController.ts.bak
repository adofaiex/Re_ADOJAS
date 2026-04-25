import * as THREE from 'three';
import { EasingFunctions } from './Easing';
import { isEventActive } from './TileColorManager';

// Camera mode configuration
export interface CameraMode {
    relativeTo: string;
    anchorTileIndex: number;
    position: { x: number; y: number };
    zoom: number;
    rotation: number;
    angleOffset: number;
    lastEventRelativePosition: { x: number; y: number }; // ADOFAI: lastEventRelativePosition
}

/**
 * Camera transition state
 */
export interface CameraTransition {
    active: boolean;
    startTime: number;
    duration: number;
    startSnapshot: {
        position: { x: number; y: number };
        zoom: number;
        rotation: number;
        logicalPosition: { x: number; y: number };
        logicalZoom: number;
        logicalRotation: number;
    };
    targetSnapshot: {
        position: { x: number; y: number };
        zoom: number;
        rotation: number;
    };
    ease: string;
}

/**
 * Timeline entry for camera events
 */
export interface CameraTimelineEntry {
    time: number;
    event: any;
}

/**
 * Controller for camera movements and transitions
 */
export class CameraController {
    private cameraMode: CameraMode;
    private cameraTransition: CameraTransition;
    private cameraTimeline: CameraTimelineEntry[] = [];
    private lastCameraTimelineIndex: number = -1;
    
    private levelData: any;
    private tileStartTimes: number[];
    private tileBPM: number[];
    
    constructor(levelData: any, tileStartTimes: number[], tileBPM: number[]) {
        this.levelData = levelData;
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
        
        this.cameraMode = {
            relativeTo: 'Player',
            anchorTileIndex: 0,
            position: { x: 0, y: 0 },
            zoom: 100,
            rotation: 0,
            angleOffset: 0,
            lastEventRelativePosition: { x: 0, y: 0 }
        };
        
        this.cameraTransition = {
            active: false,
            startTime: 0,
            duration: 0,
            startSnapshot: {
                position: { x: 0, y: 0 },
                zoom: 100,
                rotation: 0,
                logicalPosition: { x: 0, y: 0 },
                logicalZoom: 100,
                logicalRotation: 0
            },
            targetSnapshot: {
                position: { x: 0, y: 0 },
                zoom: 100,
                rotation: 0
            },
            ease: 'Linear'
        };
    }
    
    public getCameraMode(): CameraMode {
        return this.cameraMode;
    }
    
    public getCameraTransition(): CameraTransition {
        return this.cameraTransition;
    }
    
    public getCameraTimeline(): CameraTimelineEntry[] {
        return this.cameraTimeline;
    }
    
    public getLastCameraTimelineIndex(): number {
        return this.lastCameraTimelineIndex;
    }
    
    public setLastCameraTimelineIndex(index: number): void {
        this.lastCameraTimelineIndex = index;
    }
    
    /**
     * Reset camera state from level settings
     */
    public resetCameraState(): void {
        const settings = this.levelData.settings;
        if (settings) {
            this.cameraMode.relativeTo = settings.relativeTo || 'Player';
            this.cameraMode.anchorTileIndex = 0;
            this.cameraMode.position = settings.position ? { x: settings.position[0], y: settings.position[1] } : { x: 0, y: 0 };
            this.cameraMode.rotation = settings.rotation !== undefined ? settings.rotation : 0;
            this.cameraMode.zoom = settings.zoom !== undefined ? settings.zoom : 100;
            this.cameraMode.angleOffset = settings.angleOffset !== undefined ? settings.angleOffset : 0;
            
            // Initialize lastEventRelativePosition based on relativeTo
            if (this.cameraMode.relativeTo === 'Tile') {
                const tile = this.levelData.tiles[0];
                this.cameraMode.lastEventRelativePosition = tile ? { x: tile.position[0], y: tile.position[1] } : { x: 0, y: 0 };
            } else if (this.cameraMode.relativeTo === 'Global') {
                this.cameraMode.lastEventRelativePosition = { x: 0, y: 0 };
            } else {
                this.cameraMode.lastEventRelativePosition = { x: 0, y: 0 };
            }
        } else {
            this.cameraMode = {
                relativeTo: 'Player',
                anchorTileIndex: 0,
                position: { x: 0, y: 0 },
                zoom: 100,
                rotation: 0,
                angleOffset: 0,
                lastEventRelativePosition: { x: 0, y: 0 }
            };
        }
    }
    
    /**
     * Build camera event timeline
     */
    public buildCameraTimeline(tileCameraEvents: Map<number, any[]>): void {
        this.cameraTimeline = [];
        const entries: CameraTimelineEntry[] = [];
        
        tileCameraEvents.forEach((events, floor) => {
            const startTime = this.tileStartTimes[floor] || 0; // seconds
            const bpm = this.tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            
            events.forEach(event => {
                // Skip disabled events
                if (!isEventActive(event)) return;
                
                // Ensure floor is attached to the event for relativeTo: Tile
                const eventWithFloor = { ...event, floor };
                
                // angleOffset is in degrees. 180 degrees = 1 beat.
                const angleOffset = event.angleOffset || 0;
                const timeOffset = (angleOffset / 180) * secPerBeat;
                const eventTime = startTime + timeOffset;
                
                entries.push({ time: eventTime, event: eventWithFloor });
            });
        });
        
        // Sort by time
        entries.sort((a, b) => a.time - b.time);
        this.cameraTimeline = entries;
    }
    
    /**
     * Process a camera event
     * @param event The camera event
     * @param floorIndex The floor index where the event occurs
     * @param elapsedTime Current elapsed time in ms
     * @param cameraSnapshot Current camera state snapshot { position, zoom, rotation }
     */
    public processCameraEvent(
        event: any, 
        floorIndex: number, 
        elapsedTime: number,
        cameraSnapshot?: { position: { x: number; y: number }; zoom: number; rotation: number }
    ): void {
        // Skip disabled events
        if (!isEventActive(event)) return;
        
        // Capture ACTUAL current camera position (from camera snapshot) as transition start point
        // This ensures parallel events start from the same actual camera position
        // NOT from cameraMode.position which may have been modified by previous events
        let currentLogicalPos = { ...this.cameraMode.position };
        let currentLogicalZoom = this.cameraMode.zoom;
        let currentLogicalRotation = this.cameraMode.rotation;

        if (this.cameraTransition.active) {
            // ADOFAI behavior: if there's an active transition, instantly complete it
            // Old transition jumps to target value, new transition starts from that value
            const start = this.cameraTransition.startSnapshot;
            
            // Use target values from cameraMode (not interpolated)
            currentLogicalPos = { ...this.cameraMode.position };
            currentLogicalZoom = this.cameraMode.zoom;
            currentLogicalRotation = this.cameraMode.rotation;
            
            // Old transition is instantly completed
            this.cameraTransition.active = false;
        }

        const duration = (event.duration !== undefined) ? event.duration : 0;
        const relativeTo = event.relativeTo; // Can be undefined - treat as offset from current position
        
        const startLogicalPos = currentLogicalPos;
        const startLogicalZoom = currentLogicalZoom;
        const startLogicalRotation = currentLogicalRotation;

        // Determine next relativeTo
        // If relativeTo is undefined, keep current relativeTo (position will be treated as offset)
        let nextRelativeTo = this.cameraMode.relativeTo;
        let relativeToSpecified = false;
        
        if (relativeTo !== undefined && relativeTo !== null) {
            relativeToSpecified = true;
            if (typeof relativeTo === 'string') {
                nextRelativeTo = relativeTo;
            } else if (typeof relativeTo === 'number') {
                nextRelativeTo = ['Player', 'Tile', 'Global', 'LastPosition', 'LastPositionNoRotation'][relativeTo] || 'Player';
            }
        }

        // Calculate rotation offset for LastPosition mode (matches ADOFAI logic)
        let rotationOffset = 0;
        if (relativeToSpecified && nextRelativeTo === 'LastPosition') {
            // LastPosition inherits current camera angle
            rotationOffset = this.cameraMode.rotation;
        }

        // 1. Update RelativeTo & Anchor (only if specified)
        if (relativeToSpecified) {
            if (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation') {
                // Keep current relativeTo and anchorTileIndex
            } else {
                this.cameraMode.relativeTo = nextRelativeTo;
                if (nextRelativeTo === 'Tile') {
                    this.cameraMode.anchorTileIndex = floorIndex;
                    // ADOFAI: this.cam.lastEventRelativePosition = this.floorPos;
                    const tile = this.levelData.tiles[floorIndex];
                    if (tile) {
                        this.cameraMode.lastEventRelativePosition = { x: tile.position[0], y: tile.position[1] };
                    }
                } else if (nextRelativeTo === 'Global') {
                    this.cameraMode.anchorTileIndex = 0; // Default or ignored
                    // ADOFAI: this.cam.lastEventRelativePosition = Vector2.zero;
                    this.cameraMode.lastEventRelativePosition = { x: 0, y: 0 };
                } else if (nextRelativeTo === 'Player') {
                    // ADOFAI doesn't explicitly set lastEventRelativePosition in Player mode
                    // It keeps the previous value from other modes
                }
            }
        }

        // 2. Update Position
        // Position values are multiplied by tileSize
        const TILE_SIZE = 1.0; // Tile size in world units (matches Re_ADOJAS system)
        
        // Determine if position is explicitly specified in the event
        const positionSpecified = event.position !== undefined && event.position !== null;
        
        if (positionSpecified) {
            const px = (event.position[0] !== null && event.position[0] !== undefined) ? event.position[0] * TILE_SIZE : null;
            const py = (event.position[1] !== null && event.position[1] !== undefined) ? event.position[1] * TILE_SIZE : null;
            
            // In ADOFAI, position is always absolute except for LastPosition/LastPositionNoRotation
            // LastPosition/LastPositionNoRotation: position is added to current camParent.position
            if (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation') {
                if (px !== null) this.cameraMode.position.x += px;
                if (py !== null) this.cameraMode.position.y += py;
            } else {
                if (px !== null) this.cameraMode.position.x = px;
                if (py !== null) this.cameraMode.position.y = py;
            }
        } else {
            // If position is not specified, calculate based on ADOFAI logic
            // ADOFAI: vector2 = lastEventRelativePosition - camParent.position
            // In our implementation, we need to calculate the position that would result in this behavior
            
            if (nextRelativeTo === 'Player') {
                // Player mode: keep current relative position (camParent.position in ADOFAI)
                // No change needed, cameraMode.position is already the relative position
            } else if (nextRelativeTo === 'Tile') {
                // Tile mode: if no position, use lastEventRelativePosition calculation
                // ADOFAI: vector2 = lastEventRelativePosition - camParent.position
                // In our implementation, we need to calculate cameraMode.position to achieve the same finalPos
                // Since finalPos = floorPos + cameraMode.position, we need:
                // floorPos + cameraMode.position = (lastEventRelativePosition - camParentPosition) + floorPos
                // cameraMode.position = lastEventRelativePosition - camParentPosition
                // But camParentPosition is the offset from the reference point, which is cameraMode.position!
                // So: cameraMode.position = lastEventRelativePosition - cameraMode.position
                // This doesn't make sense directly. Let's think differently.
                // In ADOFAI, camParent.position represents the current camera position relative to its reference point
                // In Tile mode, the reference point is the floor position
                // So camParent.position should be currentCameraPosition - floorPosition
                // And finalPos = (lastEventRelativePosition - (currentCameraPosition - floorPosition)) + floorPosition
                // This is complex. For simplicity, let's assume lastEventRelativePosition is the last floor position
                // and we want to maintain the same relative position
                const tile = this.levelData.tiles[floorIndex];
                if (tile) {
                    const floorPos = { x: tile.position[0], y: tile.position[1] };
                    // Use lastEventRelativePosition to maintain position continuity
                    // This is a simplification of ADOFAI's complex logic
                    this.cameraMode.position = this.cameraMode.lastEventRelativePosition;
                }
            } else if (nextRelativeTo === 'Global') {
                // Global mode: if no position, use lastEventRelativePosition
                // ADOFAI: this.cam.lastEventRelativePosition = Vector2.zero
                // So if no position, cameraMode.position should be 0
                this.cameraMode.position = { x: 0, y: 0 };
            } else if (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation') {
                // LastPosition mode: keep cumulative position
                // No change needed, cameraMode.position is already cumulative
            }
        }

        // 3. Update Rotation (always absolute, not affected by relativeTo undefined)
        // LastPosition mode adds rotation offset (matches ADOFAI: targetRot + num)
        if (event.rotation !== undefined && event.rotation !== null) {
            this.cameraMode.rotation = event.rotation + rotationOffset;
        }

        // 4. Update Zoom (Always absolute, matches ADOFAI: zoom is percentage)
        if (event.zoom !== undefined && event.zoom !== null) {
            this.cameraMode.zoom = event.zoom;
        }

        // 5. Angle Offset
        if (event.angleOffset !== undefined && event.angleOffset !== null) {
            this.cameraMode.angleOffset = event.angleOffset;
        }

        // Setup Transition
        // Use the event floor's BPM for duration calculation
        const eventBPM = (this.tileBPM && this.tileBPM[floorIndex]) || 100;

        // 高速BPM检测：如果BPM>20000且relativeTo为Player，强制duration=0实现瞬间移动
        let effectiveDuration = duration;
        if (eventBPM > 20000) {
            // 检查relativeTo是否为Player
            const isPlayerMode = relativeTo === undefined ||
                                relativeTo === 'Player' ||
                                (typeof relativeTo === 'number' && relativeTo === 0) ||
                                nextRelativeTo === 'Player';
            if (isPlayerMode) {
                effectiveDuration = 0;
                console.log(`[CameraController] High BPM detected (${eventBPM}), forcing instant camera move for Player mode`);
            }
        }

        const durationSeconds = effectiveDuration * (60 / eventBPM);

        if (durationSeconds <= 0) {
            this.cameraTransition.active = false;
        } else {
            this.cameraTransition.active = true;
            this.cameraTransition.startTime = elapsedTime / 1000;
            this.cameraTransition.duration = durationSeconds;
            this.cameraTransition.ease = event.ease || 'Linear';
            
            // Use provided camera snapshot or defaults
            const snapshot = cameraSnapshot || { position: { x: 0, y: 0 }, zoom: 1, rotation: 0 };
            
            this.cameraTransition.startSnapshot = {
                position: { x: snapshot.position.x, y: snapshot.position.y },
                zoom: snapshot.zoom,
                rotation: snapshot.rotation,
                logicalPosition: startLogicalPos,
                logicalZoom: startLogicalZoom,
                logicalRotation: startLogicalRotation
            };
        }
    }
    
    /**
     * Calculate target camera position based on camera mode and interpolated logical position
     * Matches ADOFAI ffxCameraPlus.cs logic
     * @param currentPivotPosition Current planet position
     * @param interpolatedLogicalPos Optional interpolated logical position (for animation). If not provided, uses cameraMode.position
     */
    public calculateTargetPosition(currentPivotPosition: { x: number; y: number }, interpolatedLogicalPos?: { x: number; y: number }): { x: number; y: number } {
        let targetX = 0;
        let targetY = 0;
        
        // Use interpolated logical position if provided (for animation), otherwise use target logical position
        const logicalPos = interpolatedLogicalPos || { ...this.cameraMode.position };
        
        // Handle transition interpolation
        if (this.cameraTransition.active && !interpolatedLogicalPos) {
            // This will be handled separately in the main update loop
        }
        
        if (this.cameraMode.relativeTo === 'Player') {
            // Player mode: position is offset from planet position
            // ADOFAI: finalPos = vector2 (where vector2 is the offset from planet)
            targetX = currentPivotPosition.x + logicalPos.x;
            targetY = currentPivotPosition.y + logicalPos.y;
        } else if (this.cameraMode.relativeTo === 'Global') {
            // Global mode: position is from world origin
            // ADOFAI uses the first tile's position as origin reference
            const tile0 = this.levelData.tiles[0];
            const originX = tile0 ? tile0.position[0] : 0;
            const originY = tile0 ? tile0.position[1] : 0;
            targetX = originX + logicalPos.x;
            targetY = originY + logicalPos.y;
        } else if (this.cameraMode.relativeTo === 'Tile') {
            // Tile mode: position is offset from anchor tile
            // ADOFAI: finalPos = vector2 + floorPos
            const tile = this.levelData.tiles[this.cameraMode.anchorTileIndex];
            if (tile) {
                targetX = tile.position[0] + logicalPos.x;
                targetY = tile.position[1] + logicalPos.y;
            } else {
                // Fallback to Player mode if tile doesn't exist
                targetX = currentPivotPosition.x + logicalPos.x;
                targetY = currentPivotPosition.y + logicalPos.y;
            }
        } else if (this.cameraMode.relativeTo === 'LastPosition' || this.cameraMode.relativeTo === 'LastPositionNoRotation') {
            // LastPosition mode: position is offset from camera's relative position
            // ADOFAI: camParent.position represents the camera's position relative to its reference point
            // logicalPos is cumulative, so we add it to the current planet position
            targetX = currentPivotPosition.x + logicalPos.x;
            targetY = currentPivotPosition.y + logicalPos.y;
        } else {
            // Default fallback to Player mode
            targetX = currentPivotPosition.x + logicalPos.x;
            targetY = currentPivotPosition.y + logicalPos.y;
        }
        
        return { x: targetX, y: targetY };
    }
    
    /**
     * Get interpolated logical values during transition
     */
    public getInterpolatedValues(elapsedTime: number): {
        position: { x: number; y: number };
        zoom: number;
        rotation: number;
    } {
        let logicalPos = { ...this.cameraMode.position };
        let logicalZoom = this.cameraMode.zoom;
        let logicalRotation = this.cameraMode.rotation;

        if (this.cameraTransition.active) {
            let t = (elapsedTime / 1000) - this.cameraTransition.startTime;
            t = t / this.cameraTransition.duration;
            
            if (t >= 1) {
                this.cameraTransition.active = false;
            } else {
                const easeFunc = EasingFunctions[this.cameraTransition.ease] || EasingFunctions.Linear;
                const progress = easeFunc(t);
                
                const start = this.cameraTransition.startSnapshot;
                
                logicalPos.x = start.logicalPosition.x + (this.cameraMode.position.x - start.logicalPosition.x) * progress;
                logicalPos.y = start.logicalPosition.y + (this.cameraMode.position.y - start.logicalPosition.y) * progress;
                logicalZoom = start.logicalZoom + (this.cameraMode.zoom - start.logicalZoom) * progress;
                logicalRotation = start.logicalRotation + (this.cameraMode.rotation - start.logicalRotation) * progress;
            }
        }
        
        return { position: logicalPos, zoom: logicalZoom, rotation: logicalRotation };
    }
}
