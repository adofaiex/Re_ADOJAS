import * as THREE from 'three';

/**
 * PositionTrack event interface
 */
export interface PositionTrackEvent {
    positionOffset?: [number, number];
    relativeTo?: [number, string];
    rotation?: number;
    scale?: number;
    opacity?: number;
    justThisTile?: boolean;
    editorOnly?: boolean;
    stickToFloors?: boolean | 'Enabled' | 'Disabled';
}

/**
 * Tile transform result
 */
export interface TileTransform {
    position: THREE.Vector3;
    rotation: number;
    scale: THREE.Vector3;
    opacity: number;
    stickToFloors: boolean;
}

/**
 * Manages PositionTrack events - using ADOFAI-Src's cumulative logic
 * Implements our own tile position calculation based on ADOFAI-JS structure
 */
export class PositionTrackManager {
    private levelData: any;
    private positionTrackEvents: Map<number, PositionTrackEvent[]>;
    private tileTransforms: Map<number, TileTransform>;
    private tilePositions: Map<number, THREE.Vector2>; // Store base tile positions for relative calculations

    constructor(levelData: any) {
        this.levelData = levelData;
        this.positionTrackEvents = new Map();
        this.tileTransforms = new Map();
        this.tilePositions = new Map();

        this.parsePositionTrackEvents();
    }

    /**
     * Convert relativeTo to absolute tile ID (matches ADOFAI IDFromTile logic)
     * @param relativeTo The relativeTo value: [offset, relativeToType]
     * @param thisTileId The current tile ID (floor where event occurs)
     * @returns Absolute tile ID
     */
    private IDFromTile(relativeTo: [number, string], thisTileId: number): number {
        const offset = relativeTo[0];
        const relativeToType = relativeTo[1];
        const totalTiles = this.levelData.tiles.length;

        let result: number;

        switch (relativeToType) {
            case 'ThisTile':
            case '0':
                result = thisTileId + offset;
                break;
            case 'Start':
            case '1':
                result = offset;
                break;
            case 'End':
            case '2':
                result = totalTiles - 1 + offset;
                break;
            default:
                // Default to ThisTile
                result = thisTileId + offset;
                break;
        }

        // Clamp to valid range
        return Math.max(0, Math.min(result, totalTiles - 1));
    }

    /**
     * Parse stickToFloors value
     */
    private parseStickToFloors(value: boolean | 'Enabled' | 'Disabled' | undefined): boolean {
        if (value === undefined || value === null) {
            return this.levelData.settings?.stickToFloors !== false;
        }
        
        if (typeof value === 'boolean') {
            return value;
        }
        
        if (typeof value === 'string') {
            return value === 'Enabled';
        }
        
        return true;
    }

    /**
     * Parse position track events from level data
     */
    private parsePositionTrackEvents(): void {
        if (!this.levelData.actions) return;

        for (const action of this.levelData.actions) {
            if (action.eventType === 'PositionTrack') {
                const floor = action.floor;
                if (!this.positionTrackEvents.has(floor)) {
                    this.positionTrackEvents.set(floor, []);
                }
                this.positionTrackEvents.get(floor)!.push({
                    positionOffset: action.positionOffset || [0, 0],
                    relativeTo: action.relativeTo || [0, 'ThisTile'],
                    rotation: action.rotation || 0,
                    scale: action.scale || 100,
                    opacity: action.opacity || 100,
                    justThisTile: action.justThisTile || false,
                    editorOnly: action.editorOnly || false,
                    stickToFloors: this.parseStickToFloors(action.stickToFloors)
                });
            }
        }
    }

    /**
     * Calculate all tile positions and transforms
     * Uses ADOFAI-JS structure for position calculation
     * Uses ADOFAI-Src cumulative logic for PositionTrack
     */
    public calculateAllTileTransforms(isEditorMode: boolean = false): Map<number, TileTransform> {
        const transforms = new Map<number, TileTransform>();
        const tiles = this.levelData.tiles;
        const angleData = this.levelData.angleData || [];
        const TILE_SIZE = 1.0; // Tile size in world units (matches Re_ADOJAS system)

        // Start from (0, 0)
        let currentPos = new THREE.Vector2(0, 0);

        // Cumulative values (vector in ADOFAI-Src)
        let cumulativeOffset = new THREE.Vector2(0, 0);
        let cumulativeRotation = 0;
        let cumulativeScale = 1;
        let cumulativeOpacity = 1;
        let cumulativeStickToFloors = this.levelData.settings?.stickToFloors !== false;

        // Pre-calculate all angles
        const floats = new Array(tiles.length);
        for (let i = 0; i < tiles.length; i++) {
            floats[i] = angleData[i] === 999 ? (angleData[i - 1] || 0) + 180 : angleData[i];
        }

        for (let i = 0; i <= tiles.length; i++) {
            const isLastTile = i === tiles.length;
            const angle1 = isLastTile ? (floats[i - 1] || 0) : floats[i];
            const angle2 = i === 0 ? 0 : (floats[i - 1] || 0);

            if (!isLastTile) {
                // Store base tile position (startPos in ADOFAI)
                const tileBasePos = currentPos.clone();

                // Current tile transform (vector2 in ADOFAI-Src)
                let tileOffset = cumulativeOffset.clone();
                let tileRotation = cumulativeRotation;
                let tileScale = cumulativeScale;
                let tileOpacity = cumulativeOpacity;
                let tileStickToFloors = cumulativeStickToFloors;

                // Process PositionTrack events for this tile
                const events = this.positionTrackEvents.get(i);
                if (events && events.length > 0) {
                    for (const event of events) {
                        if (event.editorOnly && !isEditorMode) {
                            continue;
                        }

                        // Apply position offset
                        if (event.positionOffset) {
                            let offsetX = event.positionOffset[0] || 0;
                            let offsetY = event.positionOffset[1] || 0;

                            // Handle relativeTo
                            if (event.relativeTo) {
                                const targetTileId = this.IDFromTile(event.relativeTo, i);

                                if (targetTileId !== i) {
                                    // Get the target tile's base position
                                    const targetBasePos = this.tilePositions.get(targetTileId);
                                    if (targetBasePos) {
                                        // Calculate position difference: targetBasePos + targetOffset - currentBasePos - currentOffset
                                        // Matches ADOFAI: scrFloor3.startPos + scrFloor3.offsetPos - (scrFloor2.startPos + vector)
                                        const targetTransform = transforms.get(targetTileId);
                                        const targetOffsetPos = targetTransform ? 
                                            new THREE.Vector2(
                                                targetTransform.position.x - targetBasePos.x,
                                                targetTransform.position.y - targetBasePos.y
                                            ) : new THREE.Vector2(0, 0);

                                        const relativeOffset = new THREE.Vector2(
                                            targetBasePos.x + targetOffsetPos.x - tileBasePos.x - tileOffset.x,
                                            targetBasePos.y + targetOffsetPos.y - tileBasePos.y - tileOffset.y
                                        );

                                        tileOffset.add(relativeOffset);
                                    }
                                }
                            }

                            // Multiply by TILE_SIZE (matches ADOFAI)
                            tileOffset.x += offsetX * TILE_SIZE;
                            tileOffset.y += offsetY * TILE_SIZE;
                        }

                        // Apply rotation
                        if (event.rotation !== undefined) {
                            tileRotation = event.rotation;
                        }

                        // Apply scale
                        if (event.scale !== undefined) {
                            tileScale = event.scale / 100;
                        }

                        // Apply opacity
                        if (event.opacity !== undefined) {
                            tileOpacity = event.opacity / 100;
                        }

                        // Apply stickToFloors
                        if (event.stickToFloors !== undefined) {
                            tileStickToFloors = this.parseStickToFloors(event.stickToFloors);
                        }

                        // Update cumulative values for next tiles (if not justThisTile)
                        if (!event.justThisTile) {
                            cumulativeOffset = tileOffset.clone();
                            cumulativeRotation = tileRotation;
                            cumulativeScale = tileScale;
                            cumulativeOpacity = tileOpacity;
                            cumulativeStickToFloors = tileStickToFloors;
                        }
                    }
                }

                // Calculate final position
                const finalX = currentPos.x + tileOffset.x;
                const finalY = currentPos.y + tileOffset.y;
                const zLevel = 12 - i;

                transforms.set(i, {
                    position: new THREE.Vector3(finalX, finalY, zLevel * 0.00001),
                    rotation: tileRotation,
                    scale: new THREE.Vector3(tileScale, tileScale, tileScale),
                    opacity: tileOpacity,
                    stickToFloors: tileStickToFloors
                });

                // Store base tile position for relative calculations
                this.tilePositions.set(i, tileBasePos);
            }

            // Update position for next tile (based on angle)
            const rad = angle1 * Math.PI / 180;
            currentPos.x += Math.cos(rad);
            currentPos.y += Math.sin(rad);
        }

        this.tileTransforms = transforms;
        return transforms;
    }

    /**
     * Get transform for a specific tile
     */
    public getTileTransform(tileIndex: number): TileTransform | undefined {
        return this.tileTransforms.get(tileIndex);
    }

    /**
     * Get all tile transforms
     */
    public getAllTileTransforms(): Map<number, TileTransform> {
        return this.tileTransforms;
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this.positionTrackEvents.clear();
        this.tileTransforms.clear();
        this.tilePositions.clear();
    }
}