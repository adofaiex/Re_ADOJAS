import * as THREE from 'three';

export interface PositionTrackEvent {
    positionOffset?: [number, number] | { x: number; y: number };
    relativeTo?: [number, string];
    rotation?: number;
    scale?: number;
    opacity?: number;
    justThisTile?: boolean;
    editorOnly?: boolean;
    stickToFloors?: boolean | 'Enabled' | 'Disabled';
    disabled?: { [key: string]: boolean };
}

export interface TileTransform {
    position: THREE.Vector3;
    rotation: number;
    scale: THREE.Vector3;
    opacity: number;
    stickToFloors: boolean;
}

export class PositionTrackManager {
    private levelData: any;
    private positionTrackEvents: Map<number, PositionTrackEvent[]>;
    private tileTransforms: Map<number, TileTransform>;
    private tilePositions: Map<number, THREE.Vector2>;

    private static TILE_SIZE = 1.0;

    constructor(levelData: any) {
        this.levelData = levelData;
        this.positionTrackEvents = new Map();
        this.tileTransforms = new Map();
        this.tilePositions = new Map();
        this.parsePositionTrackEvents();
    }

    private normalizeVec2(v: [number, number] | { x: number; y: number } | undefined): [number, number] {
        if (!v) return [0, 0];
        if (Array.isArray(v)) return [v[0] ?? 0, v[1] ?? 0];
        return [(v as any).x ?? 0, (v as any).y ?? 0];
    }

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
                result = thisTileId + offset;
                break;
        }
        return Math.max(0, Math.min(result, totalTiles - 1));
    }

    private parseStickToFloors(value: boolean | 'Enabled' | 'Disabled' | undefined): boolean {
        if (value === undefined || value === null) {
            return this.levelData.settings?.stickToFloors !== false;
        }
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value === 'Enabled';
        return true;
    }

    private isDisabled(event: PositionTrackEvent, prop: string): boolean {
        return event.disabled?.[prop] === true;
    }

    private parsePositionTrackEvents(): void {
        if (!this.levelData.actions) return;
        for (const action of this.levelData.actions) {
            if (action.eventType !== 'PositionTrack') continue;
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
                stickToFloors: action.stickToFloors,
                disabled: action.disabled,
            });
        }
    }

    public calculateAllTileTransforms(isEditorMode: boolean = false): Map<number, TileTransform> {
        const transforms = new Map<number, TileTransform>();
        const tiles = this.levelData.tiles;
        const tileCount = tiles.length;
        const rawAngleData = this.levelData.angleData || [];

        const TILE_SIZE = PositionTrackManager.TILE_SIZE;

        this.tilePositions.clear();

        const floats = new Array(tileCount);
        for (let i = 0; i < tileCount; i++) {
            const a = rawAngleData[i];
            if (a === undefined || a === null) {
                floats[i] = (floats[i - 1] || 0) + 180;
            } else {
                floats[i] = a === 999 ? (floats[i - 1] || 0) + 180 : a;
            }
        }

        let currentPos = new THREE.Vector2(0, 0);
        this.tilePositions.set(0, currentPos.clone());
        for (let i = 0; i < tileCount; i++) {
            const rad = floats[i] * Math.PI / 180;
            currentPos.x += Math.cos(rad) * TILE_SIZE;
            currentPos.y += Math.sin(rad) * TILE_SIZE;
            this.tilePositions.set(i + 1, currentPos.clone());
        }

        const workingPos: THREE.Vector2[] = [];
        const workingRot: number[] = [];
        const workingScale: number[] = [];
        const workingOpacity: number[] = [];
        const workingStick: boolean[] = [];
        const defaultStick = this.levelData.settings?.stickToFloors !== false;

        for (let i = 0; i < tileCount; i++) {
            const basePos = this.tilePositions.get(i);
            workingPos.push(basePos ? basePos.clone() : new THREE.Vector2(0, 0));
            workingRot.push(0);
            workingScale.push(1);
            workingOpacity.push(1);
            workingStick.push(defaultStick);
        }

        // ADOFAI's `vector`: accumulated non-justThisTile offset, used for relativeTo
        // relativeTo formula: (target.startPos + target.offsetPos) - (current.startPos + vector)
        const vector = new THREE.Vector2(0, 0);

        for (let floor = 0; floor < tileCount; floor++) {
            const events = this.positionTrackEvents.get(floor);
            if (!events) continue;

            for (const event of events) {
                if (event.editorOnly && !isEditorMode) continue;

                // ============================================================
                // Position offset block
                // ADOFAI: gated by !item5.disabled["positionOffset"]
                // Contains positionOffset ADDITION + relativeTo + vector update
                // ============================================================
                const posEnabled = !this.isDisabled(event, 'positionOffset');

                if (posEnabled) {
                    let changeX = 0, changeY = 0;

                    // relativeTo target tile
                    let targetTileId = floor;
                    if (event.relativeTo) {
                        targetTileId = this.IDFromTile(event.relativeTo, floor);
                    }

                    // positionOffset * tileSize * currentScale
                    if (event.positionOffset) {
                        const pos = this.normalizeVec2(event.positionOffset);
                        const s = workingScale[floor];
                        changeX += pos[0] * TILE_SIZE * s;
                        changeY += pos[1] * TILE_SIZE * s;
                    }

                    // relativeTo difference
                    // ADOFAI: (target.startPos + target.offsetPos) - (current.startPos + vector)
                    if (targetTileId !== floor && targetTileId < tileCount) {
                        const basePos = this.tilePositions.get(floor)!;
                        changeX += workingPos[targetTileId].x - (basePos.x + vector.x);
                        changeY += workingPos[targetTileId].y - (basePos.y + vector.y);
                    }

                    // Apply change
                    if (event.justThisTile) {
                        workingPos[floor].x += changeX;
                        workingPos[floor].y += changeY;
                    } else {
                        for (let j = floor; j < tileCount; j++) {
                            workingPos[j].x += changeX;
                            workingPos[j].y += changeY;
                        }
                        // ADOFAI: vector = vector2
                        // vector2 = total accumulated offset for current floor = workingPos[floor] - basePos[floor]
                        const basePos = this.tilePositions.get(floor)!;
                        vector.x = workingPos[floor].x - basePos.x;
                        vector.y = workingPos[floor].y - basePos.y;
                    }
                }

                // ============================================================
                // Scale (not gated by positionOffset disabled, gated by its own disabled flag)
                // ADOFAI: output3 /= 100f; if (!justThisTile) num10 = output3
                // ============================================================
                if (event.scale !== undefined && event.scale !== null && !this.isDisabled(event, 'scale')) {
                    const s = event.scale / 100;
                    if (event.justThisTile) {
                        workingScale[floor] = s;
                    } else {
                        for (let j = floor; j < tileCount; j++) {
                            workingScale[j] = s;
                        }
                    }
                }

                // ============================================================
                // Rotation
                // ============================================================
                if (event.rotation !== undefined && event.rotation !== null && !this.isDisabled(event, 'rotation')) {
                    if (event.justThisTile) {
                        workingRot[floor] = event.rotation;
                    } else {
                        for (let j = floor; j < tileCount; j++) {
                            workingRot[j] = event.rotation;
                        }
                    }
                }

                // ============================================================
                // Opacity
                // ============================================================
                if (event.opacity !== undefined && event.opacity !== null && !this.isDisabled(event, 'opacity')) {
                    const o = event.opacity / 100;
                    if (event.justThisTile) {
                        workingOpacity[floor] = o;
                    } else {
                        for (let j = floor; j < tileCount; j++) {
                            workingOpacity[j] = o;
                        }
                    }
                }

                // ============================================================
                // stickToFloors
                // ============================================================
                if (event.stickToFloors !== undefined && !this.isDisabled(event, 'stickToFloors')) {
                    const st = this.parseStickToFloors(event.stickToFloors);
                    if (event.justThisTile) {
                        workingStick[floor] = st;
                    } else {
                        for (let j = floor; j < tileCount; j++) {
                            workingStick[j] = st;
                        }
                    }
                }
            }
        }

        for (let i = 0; i < tileCount; i++) {
            const zLevel = (1000 - (i % 1000)) * 0.0001;
            transforms.set(i, {
                position: new THREE.Vector3(workingPos[i].x, workingPos[i].y, zLevel),
                rotation: workingRot[i],
                scale: new THREE.Vector3(workingScale[i], workingScale[i], workingScale[i]),
                opacity: workingOpacity[i],
                stickToFloors: workingStick[i],
            });
        }

        this.tileTransforms = transforms;
        return transforms;
    }

    public getTileTransform(tileIndex: number): TileTransform | undefined {
        return this.tileTransforms.get(tileIndex);
    }

    public getAllTileTransforms(): Map<number, TileTransform> {
        return this.tileTransforms;
    }

    public dispose(): void {
        this.positionTrackEvents.clear();
        this.tileTransforms.clear();
        this.tilePositions.clear();
    }
}
