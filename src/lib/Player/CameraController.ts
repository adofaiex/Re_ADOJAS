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
    
    // Track active transitions by property to handle parallel non-conflicting transitions
    private activeTransitions: Map<string, CameraTransition> = new Map();
    
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
     * 处理特殊情况：如果多个运镜事件在同一floor上，angleOffset都为0，
     * 按照它们在砖块中的排序（id顺序）来决定时间线先后顺序
     */
    public buildCameraTimeline(tileCameraEvents: Map<number, any[]>): void {
        this.cameraTimeline = [];
        const entries: CameraTimelineEntry[] = [];
        
        tileCameraEvents.forEach((events, floor) => {
            const startTime = this.tileStartTimes[floor] || 0; // seconds
            const bpm = this.tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            
            // 按id排序，处理同一floor且angleOffset都为0的情况
            const sortedEvents = [...events].sort((a, b) => {
                const aId = a.id !== undefined ? a.id : Infinity;
                const bId = b.id !== undefined ? b.id : Infinity;
                return aId - bId;
            });
            
            sortedEvents.forEach((event, index) => {
                // Skip disabled events
                if (!isEventActive(event)) return;
                
                // Ensure floor is attached to the event for relativeTo: Tile
                const eventWithFloor = { ...event, floor };
                
                // angleOffset is in degrees. 180 degrees = 1 beat.
                const angleOffset = event.angleOffset || 0;
                let timeOffset = (angleOffset / 180) * secPerBeat;
                
                // 特殊处理：同一floor上的多个事件，如果angleOffset都为0
                // 则按id顺序微调时间，确保不同的事件按顺序执行
                if (angleOffset === 0) {
                    // 检查是否有其他同floor的angleOffset为0的事件
                    const sameFloorZeroOffsetEvents = sortedEvents.filter(e => 
                        isEventActive(e) && (e.angleOffset || 0) === 0
                    );
                    if (sameFloorZeroOffsetEvents.length > 1) {
                        // 添加微小的时间偏移，确保按id顺序执行
                        const eventIndex = sameFloorZeroOffsetEvents.findIndex(e => e.id === event.id);
                        timeOffset += eventIndex * 0.0001; // 100微秒的差异
                    }
                }
                
                const eventTime = startTime + timeOffset;
                
                entries.push({ time: eventTime, event: eventWithFloor });
            });
        });
        
        // Sort by time, then by id for same-time events
        entries.sort((a, b) => {
            if (Math.abs(a.time - b.time) < 0.0001) {
                // 时间相同，按id排序
                const aId = a.event.id !== undefined ? a.event.id : Infinity;
                const bId = b.event.id !== undefined ? b.event.id : Infinity;
                return aId - bId;
            }
            return a.time - b.time;
        });
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
        
        const duration = (event.duration !== undefined) ? event.duration : 0;
        const relativeTo = event.relativeTo; // Can be undefined - treat as offset from current position
        
        // Determine which properties this event will modify
        const modifiesPosition = event.position !== undefined && event.position !== null;
        const modifiesRotation = event.rotation !== undefined && event.rotation !== null;
        const modifiesZoom = event.zoom !== undefined && event.zoom !== null;
        const modifiesRelativeTo = relativeTo !== undefined && relativeTo !== null;
        
        // Check for conflicting active transitions
        const conflictingKeys: string[] = [];
        if (modifiesPosition) conflictingKeys.push('position');
        if (modifiesRotation) conflictingKeys.push('rotation');
        if (modifiesZoom) conflictingKeys.push('zoom');
        if (modifiesRelativeTo) conflictingKeys.push('relativeTo');
        
        // If there are conflicting transitions, complete them instantly
        for (const key of conflictingKeys) {
            if (this.activeTransitions.has(key)) {
                const oldTransition = this.activeTransitions.get(key);
                if (oldTransition && oldTransition.active) {
                    // 旧运镜立即瞬移到终点
                    oldTransition.active = false;
                }
                this.activeTransitions.delete(key);
            }
        }
        
        // Capture ACTUAL current camera position (from camera snapshot) as transition start point
        // This ensures parallel events start from the same actual camera position
        // NOT from cameraMode.position which may have been modified by previous events
        let currentLogicalPos = { ...this.cameraMode.position };
        let currentLogicalZoom = this.cameraMode.zoom;
        let currentLogicalRotation = this.cameraMode.rotation;
        
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
        
        // 处理LastPosition系列的参考系查找
        // 如果当前event的relativeTo是LastPosition系列，需要回溯找到真实的参考系
        let realRelativeTo = nextRelativeTo;
        let accumulatedPosition = { x: 0, y: 0 };
        let accumulatedRotation = 0;
        
        if (relativeToSpecified && (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation')) {
            // 向前查找，直到找到非LastPosition的参考系
            realRelativeTo = this.findRealRelativeTo(floorIndex, accumulatedPosition, nextRelativeTo === 'LastPositionNoRotation');
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
                    // 当切换到Player模式时，需要重置或保持position
                    // ADOFAI会重新计算相对位置，确保摄像机相对于玩家正确对齐
                    // 如果当前不是Player模式，需要计算新的相对位置
                    if (this.cameraMode.relativeTo !== 'Player') {
                        // 从其他模式切换到Player：保持当前摄像机的绝对位置不变
                        // position应该相对于Player，这里不需要改变，后面的position处理会根据actualPosition调整
                    }
                }
            }
        }

        // 2. Update Position
        // Position values are multiplied by tileSize
        const TILE_SIZE = 1.0; // Tile size in world units (matches Re_ADOJAS system)
        
        // Determine if position is explicitly specified in the event
        // 关键修复：[null, null]应该被视为position未指定（即保持当前位置）
        let positionSpecified = event.position !== undefined && event.position !== null;
        if (positionSpecified && Array.isArray(event.position)) {
            // 检查position的两个分量是否都为null
            if (event.position[0] === null && event.position[1] === null) {
                positionSpecified = false; // 视为position未指定
            }
        }
        
        if (positionSpecified) {
            const px = (event.position[0] !== null && event.position[0] !== undefined) ? event.position[0] * TILE_SIZE : null;
            const py = (event.position[1] !== null && event.position[1] !== undefined) ? event.position[1] * TILE_SIZE : null;
            
            // 关键修复：当relativeTo未指定时，position应该作为偏移应用到当前位置
            if (!relativeToSpecified) {
                // relativeTo未指定：position作为相对偏移
                if (px !== null) this.cameraMode.position.x += px;
                if (py !== null) this.cameraMode.position.y += py;
            } else if (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation') {
                // LastPosition/LastPositionNoRotation: position叠加
                if (px !== null) this.cameraMode.position.x += px;
                if (py !== null) this.cameraMode.position.y += py;
            } else {
                // 其他relativeTo：position绝对设置
                if (px !== null) this.cameraMode.position.x = px;
                if (py !== null) this.cameraMode.position.y = py;
            }
        } else {
            // Position未指定时的处理逻辑
            // 关键：position未指定时应该重置为[0, 0]（除了LastPosition系列）
            
            if (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation') {
                // LastPosition模式：保持累积位置，position未指定不改变
                // No change needed, cameraMode.position is already cumulative
            } else {
                // 其他所有模式（Player、Tile、Global、或relativeTo未指定）：
                // position未指定时重置为[0, 0]
                this.cameraMode.position = { x: 0, y: 0 };
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
     * Find the real relativeTo by backtracking through LastPosition events
     * 处理LastPosition系列的参考系查找
     * 如果当前是LastPosition系列，向前查找直到找到非LastPosition的参考系
     * 中途遇到的所有LastPosition的position和rotation都应该叠加
     */
    private findRealRelativeTo(
        currentFloorIndex: number, 
        accumulatedPosition: { x: number; y: number },
        isNoRotation: boolean
    ): string {
        // 向后回溯timeline，找到第一个非LastPosition的relativeTo
        for (let i = this.lastCameraTimelineIndex; i >= 0; i--) {
            const entry = this.cameraTimeline[i];
            if (!entry) continue;
            
            const event = entry.event;
            if (!isEventActive(event)) continue;
            
            const eventRelativeTo = event.relativeTo;
            let eventMode = this.cameraMode.relativeTo;
            
            if (eventRelativeTo !== undefined && eventRelativeTo !== null) {
                if (typeof eventRelativeTo === 'string') {
                    eventMode = eventRelativeTo;
                } else if (typeof eventRelativeTo === 'number') {
                    eventMode = ['Player', 'Tile', 'Global', 'LastPosition', 'LastPositionNoRotation'][eventRelativeTo] || 'Player';
                }
            }
            
            // 如果找到��LastPosition的参考系，就是我们要找的
            if (eventMode !== 'LastPosition' && eventMode !== 'LastPositionNoRotation') {
                return eventMode;
            }
            
            // 累加position和rotation
            if (event.position !== undefined && event.position !== null) {
                const TILE_SIZE = 1.0;
                if (event.position[0] !== null && event.position[0] !== undefined) {
                    accumulatedPosition.x += event.position[0] * TILE_SIZE;
                }
                if (event.position[1] !== null && event.position[1] !== undefined) {
                    accumulatedPosition.y += event.position[1] * TILE_SIZE;
                }
            }
            
            // 如果不是NoRotation模式，累加rotation
            if (!isNoRotation && event.rotation !== undefined && event.rotation !== null) {
                // 累加逻辑已在processCameraEvent中处理
            }
        }
        
        // 默认回退到Player模式
        return 'Player';
    }
    
    /**
     * Update camera events based on current elapsed time
     * 应该在游戏更新循环中每帧调用
     * @param elapsedTime Current elapsed time in seconds
     */
    public update(elapsedTime: number): void {
        // 处理当前应该发生的摄像机事件
        for (let i = this.lastCameraTimelineIndex + 1; i < this.cameraTimeline.length; i++) {
            const entry = this.cameraTimeline[i];
            if (entry.time <= elapsedTime) {
                // 处理这个事件
                this.processCameraEvent(entry.event, entry.event.floor || 0, elapsedTime * 1000);
                this.lastCameraTimelineIndex = i;
            } else {
                break; // 时间线已前进到未来，停止处理
            }
        }
    }
    
    /**
     * Get interpolated logical values during transition
     * 用于平滑过渡动画
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
