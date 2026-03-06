import * as THREE from 'three';
import { EasingFunctions } from './Easing';
import { isEventActive } from './TileColorManager';

/**
 * Camera mode configuration
 */
export interface CameraMode {
    relativeTo: string;
    anchorTileIndex: number;
    position: { x: number; y: number };
    zoom: number;
    rotation: number;
    angleOffset: number;
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
            angleOffset: 0
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
        } else {
            this.cameraMode = {
                relativeTo: 'Player',
                anchorTileIndex: 0,
                position: { x: 0, y: 0 },
                zoom: 100,
                rotation: 0,
                angleOffset: 0
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
        
        // Capture current camera state as the new transition start point
        // If there's an active transition, we need to capture the interpolated position
        let currentLogicalPos = { ...this.cameraMode.position };
        let currentLogicalZoom = this.cameraMode.zoom;
        let currentLogicalRotation = this.cameraMode.rotation;

        if (this.cameraTransition.active) {
            // Calculate current interpolated position from the ongoing transition
            const transitionTime = (elapsedTime / 1000) - this.cameraTransition.startTime;
            let t = transitionTime / this.cameraTransition.duration;
            t = Math.max(0, Math.min(1, t));
            
            const easeFunc = EasingFunctions[this.cameraTransition.ease] || EasingFunctions.Linear;
            const progress = easeFunc(t);
            
            const start = this.cameraTransition.startSnapshot;
            
            // Interpolate logical values
            currentLogicalPos = {
                x: start.logicalPosition.x + (this.cameraMode.position.x - start.logicalPosition.x) * progress,
                y: start.logicalPosition.y + (this.cameraMode.position.y - start.logicalPosition.y) * progress
            };
            currentLogicalZoom = start.logicalZoom + (this.cameraMode.zoom - start.logicalZoom) * progress;
            currentLogicalRotation = start.logicalRotation + (this.cameraMode.rotation - start.logicalRotation) * progress;
            
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

        // 1. Update RelativeTo & Anchor (only if specified)
        if (relativeToSpecified) {
            if (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation') {
                // Keep current relativeTo and anchorTileIndex
            } else {
                this.cameraMode.relativeTo = nextRelativeTo;
                if (nextRelativeTo === 'Tile') {
                    this.cameraMode.anchorTileIndex = floorIndex;
                } else if (nextRelativeTo === 'Global' || nextRelativeTo === 'Player') {
                    this.cameraMode.anchorTileIndex = 0; // Default or ignored
                }
            }
        }

        // 2. Update Position
        if (event.position !== undefined && event.position !== null) {
            const px = event.position[0];
            const py = event.position[1];
            
            // If relativeTo is undefined, position is an offset from current position
            // If relativeTo is LastPosition/LastPositionNoRotation, position is also an offset
            // Otherwise, position is absolute
            const isOffset = (relativeTo === undefined) || 
                            (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation');
            
            if (isOffset) {
                if (px !== null && px !== undefined) this.cameraMode.position.x += px;
                if (py !== null && py !== undefined) this.cameraMode.position.y += py;
            } else {
                if (px !== null && px !== undefined) this.cameraMode.position.x = px;
                if (py !== null && py !== undefined) this.cameraMode.position.y = py;
            }
        }

        // 3. Update Rotation (always absolute, not affected by relativeTo undefined)
        if (event.rotation !== undefined && event.rotation !== null) {
            this.cameraMode.rotation = event.rotation;
        }

        // 4. Update Zoom (Always absolute)
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
        const durationSeconds = duration * (60 / eventBPM);

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
     * Calculate target camera position based on camera mode
     */
    public calculateTargetPosition(currentPivotPosition: { x: number; y: number }): { x: number; y: number } {
        let targetX = 0;
        let targetY = 0;
        
        let logicalPos = { ...this.cameraMode.position };
        
        // Handle transition interpolation
        if (this.cameraTransition.active) {
            // This will be handled separately in the main update loop
        }
        
        if (this.cameraMode.relativeTo === 'Player') {
            targetX = currentPivotPosition.x + logicalPos.x;
            targetY = currentPivotPosition.y + logicalPos.y;
        } else if (this.cameraMode.relativeTo === 'Global') {
            const tile0 = this.levelData.tiles[0];
            const originX = tile0 ? tile0.position[0] : 0;
            const originY = tile0 ? tile0.position[1] : 0;
            targetX = originX + logicalPos.x;
            targetY = originY + logicalPos.y;
        } else if (this.cameraMode.relativeTo === 'Tile') {
            const tile = this.levelData.tiles[this.cameraMode.anchorTileIndex];
            if (tile) {
                targetX = tile.position[0] + logicalPos.x;
                targetY = tile.position[1] + logicalPos.y;
            } else {
                targetX = currentPivotPosition.x + logicalPos.x;
                targetY = currentPivotPosition.y + logicalPos.y;
            }
        } else {
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
