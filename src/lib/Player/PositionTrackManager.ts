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
        const [offset, relativeToType] = relativeTo;
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
                    positionOffset: action.positionOffset,
                    relativeTo: action.relativeTo,
                    rotation: action.rotation,
                    scale: action.scale,
                    opacity: action.opacity,
                    justThisTile: action.justThisTile || false,
                    editorOnly: action.editorOnly || false,
                    stickToFloors: this.parseStickToFloors(action.stickToFloors)
                });
            }
        }
    }

    /**
     * Calculate all tile positions and transforms using a two-pass approach
     * matching ADOFAN_PIXI's architecture:
     *   Pass 1: Calculate ALL base tile positions from angle data (loadtilepos)
     *   Pass 2: Apply PositionTrack events in order, modifying positions
     *           in-place (loadpositiontrack) — all positions are available
     *           for relativeTo lookups
     *
     * This fixes the critical bug where relativeTo forward references
     * (tile i referencing tile j where j > i) silently failed because
     * the target tile's transform hadn't been computed yet.
     */
    public calculateAllTileTransforms(isEditorMode: boolean = false): Map<number, TileTransform> {
        const transforms = new Map<number, TileTransform>();
        const tiles = this.levelData.tiles;
        const angleData = this.levelData.angleData || [];
        const TILE_SIZE = 1.0;

        // ============================================================
        // PASS 1: Calculate ALL base tile positions from angle data
        // Like ADOFAN_PIXI's loadtilepos()
        // ============================================================
        this.tilePositions.clear();

        const floats = new Array(tiles.length);
        for (let i = 0; i < tiles.length; i++) {
            floats[i] = angleData[i] === 999 ? (floats[i - 1] || 0) + 180 : angleData[i];
        }

        // tilePositions stores base positions for tiles 0..tiles.length
        // (the extra entry at tiles.length is the "position after last tile" for camera/planet)
        let currentPos = new THREE.Vector2(0, 0);
        this.tilePositions.set(0, currentPos.clone());
        for (let i = 0; i < tiles.length; i++) {
            const rad = floats[i] * Math.PI / 180;
            currentPos.x += Math.cos(rad) * TILE_SIZE;
            currentPos.y += Math.sin(rad) * TILE_SIZE;
            this.tilePositions.set(i + 1, currentPos.clone());
        }

        // ============================================================
        // PASS 2: Apply PositionTrack events in order
        // Like ADOFAN_PIXI's loadpositiontrack()
        //
        // Working mutable arrays (equivalent to ADOFAN_PIXI's trackpos,
        // tracksro, trackscale arrays modified in-place)
        // ============================================================
        const workingPos: THREE.Vector2[] = [];
        const workingRot: number[] = [];
        const workingScale: number[] = [];
        const workingOpacity: number[] = [];
        const workingStick: boolean[] = [];
        const defaultStick = this.levelData.settings?.stickToFloors !== false;

        for (let i = 0; i < tiles.length; i++) {
            const basePos = this.tilePositions.get(i);
            workingPos.push(basePos ? basePos.clone() : new THREE.Vector2(0, 0));
            workingRot.push(0);
            workingScale.push(1);
            workingOpacity.push(1);
            workingStick.push(defaultStick);
        }

        // Process PositionTrack events in tile order
        for (let floor = 0; floor < tiles.length; floor++) {
            const events = this.positionTrackEvents.get(floor);
            if (!events || events.length === 0) continue;

            for (const event of events) {
                if (event.editorOnly && !isEditorMode) continue;

                // Calculate position change (relativeTo + positionOffset combine into one delta,
                // just like ADOFAN_PIXI where changeX/Y accumulate both contributions)
                let changeX = 0, changeY = 0;
                let hasPosChange = false;

                // Handle relativeTo: difference between target tile's current position and this tile's position
                // ADOFAN_PIXI: changeX = this.trackpos[rela][0] - this.trackpos[event['floor']][0];
                if (event.relativeTo) {
                    const targetTileId = this.IDFromTile(event.relativeTo, floor);
                    if (targetTileId !== floor && targetTileId < workingPos.length) {
                        changeX += workingPos[targetTileId].x - workingPos[floor].x;
                        changeY += workingPos[targetTileId].y - workingPos[floor].y;
                        hasPosChange = true;
                    }
                }

                // Handle positionOffset (in track-width units)
                // ADOFAN_PIXI: changeX += this.trackradius[event['floor']] * event['positionOffset'][0];
                if (event.positionOffset) {
                    changeX += event.positionOffset[0] * TILE_SIZE;
                    changeY += event.positionOffset[1] * TILE_SIZE;
                    hasPosChange = true;
                }

                // Determine affected tiles (ADOFAN_PIXI's ct array)
                if (hasPosChange) {
                    if (event.justThisTile) {
                        // Only affect this floor
                        workingPos[floor].x += changeX;
                        workingPos[floor].y += changeY;
                    } else {
                        // Affect this floor and ALL following tiles (ADOFAN_PIXI default behavior)
                        for (let j = floor; j < tiles.length; j++) {
                            workingPos[j].x += changeX;
                            workingPos[j].y += changeY;
                        }
                    }
                }

                // Apply rotation to affected tiles
                if (event.rotation !== undefined && event.rotation !== null) {
                    if (event.justThisTile) {
                        workingRot[floor] = event.rotation;
                    } else {
                        for (let j = floor; j < tiles.length; j++) {
                            workingRot[j] = event.rotation;
                        }
                    }
                }

                // Apply scale to affected tiles
                if (event.scale !== undefined && event.scale !== null) {
                    const s = event.scale / 100;
                    if (event.justThisTile) {
                        workingScale[floor] = s;
                    } else {
                        for (let j = floor; j < tiles.length; j++) {
                            workingScale[j] = s;
                        }
                    }
                }

                // Apply opacity to affected tiles
                if (event.opacity !== undefined && event.opacity !== null) {
                    const o = event.opacity / 100;
                    if (event.justThisTile) {
                        workingOpacity[floor] = o;
                    } else {
                        for (let j = floor; j < tiles.length; j++) {
                            workingOpacity[j] = o;
                        }
                    }
                }

                // Apply stickToFloors to affected tiles
                if (event.stickToFloors !== undefined) {
                    const st = this.parseStickToFloors(event.stickToFloors);
                    if (event.justThisTile) {
                        workingStick[floor] = st;
                    } else {
                        for (let j = floor; j < tiles.length; j++) {
                            workingStick[j] = st;
                        }
                    }
                }
            }
        }

        // ============================================================
        // PASS 3: Build TileTransform results from working arrays
        // ============================================================
        for (let i = 0; i < tiles.length; i++) {
            const zLevel = (1000 - (i % 1000)) * 0.0001;
            transforms.set(i, {
                position: new THREE.Vector3(workingPos[i].x, workingPos[i].y, zLevel),
                rotation: workingRot[i],
                scale: new THREE.Vector3(workingScale[i], workingScale[i], workingScale[i]),
                opacity: workingOpacity[i],
                stickToFloors: workingStick[i]
            });
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