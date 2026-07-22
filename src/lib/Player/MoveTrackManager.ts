import { Vector3, Euler, Mesh, Vector2 } from 'three';
import { debugLog } from './DebugLog';
import { TimelineManager } from './TimelineManager';

export class MoveTrackManager {
    private timelineManager: TimelineManager;
    private tiles: Map<string, Mesh> | null = null;

    private basePositions: Vector2[] = [];
    private baseRotations: number[] = [];

    public tileTransformChanged?: (
        tileIndex: number,
        position: Vector3,
        rotation: Euler,
        scale: Vector3,
        opacity: number
    ) => void;

    private currentTime: number = 0;
    private activeTileIndices: Set<number> = new Set();
    private pendingFinalApply: Set<number> = new Set();

    private static playCounter: number = 0;
    private debugPlayId: number = 0;

    constructor(timelineManager: TimelineManager) {
        this.timelineManager = timelineManager;
    }

    public setTilesReference(tiles: Map<string, Mesh>): void {
        this.tiles = tiles;
    }

    public setBasePositions(positions: Vector2[]): void {
        this.basePositions = positions;
    }

    public setBaseRotations(rotations: number[]): void {
        this.baseRotations = rotations;
    }

    public registerTileInitial(index: number, tileMesh: Mesh): void {
        const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;
        const entity = `tile:${index}`;

        // Apply base state directly instead of sampling timeline at time 0.
        // Timeline at time 0 has appear animation initial state (invisible),
        // but tiles should be fully visible in preview mode at load time.
        const baseX = index < this.basePositions.length ? this.basePositions[index].x : 0;
        const baseY = index < this.basePositions.length ? this.basePositions[index].y : 0;
        const baseRot = index < this.baseRotations.length ? this.baseRotations[index] : 0;
        tileMesh.position.x = baseX;
        tileMesh.position.y = baseY;
        tileMesh.rotation.z = baseRot;
        tileMesh.scale.set(1, 1, 1);
        tileMesh.userData.opacity = 1;
        if (tileMesh.material) {
            (tileMesh.material as any).opacity = 1;
            (tileMesh.material as any).transparent = false;
        }

        if (this.tileTransformChanged) {
            this.tileTransformChanged(
                index,
                tileMesh.position,
                tileMesh.rotation as Euler,
                tileMesh.scale,
                1,
            );
        }
    }

    public update(elapsedTimeMs: number): void {
        this.currentTime = elapsedTimeMs / 1000;
        this.updateTileAnimations();
    }

    private updateTileAnimations(): void {
        if (!this.tiles) return;
        const time = this.currentTime;
        const newActiveIndices = new Set<number>();

        for (const tileIdx of this.timelineManager.getAllTileIndices()) {
            const mesh = this.tiles.get(tileIdx.toString());
            if (!mesh) continue;

            const isActive = this.timelineManager.isTileActive(tileIdx, time);

            if (isActive) {
                newActiveIndices.add(tileIdx);
            } else if (this.pendingFinalApply.has(tileIdx)) {
                this.pendingFinalApply.delete(tileIdx);
            } else {
                continue;
            }

            const dirty = this.timelineManager.applyToTileMesh(tileIdx, mesh, time);
            if (dirty && this.tileTransformChanged) {
                this.tileTransformChanged(
                    tileIdx,
                    mesh.position,
                    mesh.rotation as Euler,
                    mesh.scale,
                    mesh.userData.opacity ?? 1
                );
            }
        }

        for (const tileIdx of this.activeTileIndices) {
            if (!newActiveIndices.has(tileIdx)) {
                this.pendingFinalApply.add(tileIdx);
            }
        }
        this.activeTileIndices = newActiveIndices;
    }

    public getPlanetFollowOffset(tileIndex: number, currentTime: number): { x: number; y: number; rotation: number } {
        const mesh = this.tiles?.get(tileIndex.toString());
        if (!mesh) return { x: 0, y: 0, rotation: 0 };

        const baseX = tileIndex < this.basePositions.length ? this.basePositions[tileIndex].x : 0;
        const baseY = tileIndex < this.basePositions.length ? this.basePositions[tileIndex].y : 0;
        const baseRot = tileIndex < this.baseRotations.length ? this.baseRotations[tileIndex] : 0;

        return {
            x: mesh.position.x - baseX,
            y: mesh.position.y - baseY,
            rotation: mesh.rotation.z - baseRot,
        };
    }

    /**
     * Compute where a tile's mesh would be at an arbitrary point in time.
     * Used by trail rendering to reconstruct historical positions when stickToFloors is on.
     */
    public getTilePositionAtTime(tileIndex: number, queryTime: number): { x: number; y: number } | null {
        const entity = `tile:${tileIndex}`;
        if (!this.timelineManager.hasTimeline(entity, 'positionX')) return null;
        return this.timelineManager.samplePosition(entity, queryTime);
    }

    public fastForwardTo(targetTime: number): void {
        this.currentTime = targetTime;
        if (!this.tiles) return;

        const animatedIndices = this.timelineManager.getAnimatedTileIndices();
        for (const tileIdx of animatedIndices) {
            const mesh = this.tiles.get(tileIdx.toString());
            if (!mesh) continue;
            const dirty = this.timelineManager.applyToTileMesh(tileIdx, mesh, targetTime);
            if (dirty && this.tileTransformChanged) {
                this.tileTransformChanged(
                    tileIdx,
                    mesh.position,
                    mesh.rotation as Euler,
                    mesh.scale,
                    mesh.userData.opacity ?? 1
                );
            }
        }
    }

    public getAnimatedTileIndices(): Set<number> {
        return this.activeTileIndices;
    }

    public reset(): void {
        this.debugPlayId = ++MoveTrackManager.playCounter;
        this.activeTileIndices.clear();
        this.pendingFinalApply.clear();
        const playLabel = `[MoveTrackManager][Play#${this.debugPlayId}]`;

        if (this.tiles) {
            for (const [tileId, mesh] of this.tiles) {
                const tileIdx = parseInt(tileId, 10);
                if (isNaN(tileIdx)) continue;

                const entity = `tile:${tileIdx}`;
                const x = this.timelineManager.sample(entity, 'positionX', 0);
                const y = this.timelineManager.sample(entity, 'positionY', 0);
                const rot = this.timelineManager.sample(entity, 'rotation', 0);
                const sx = this.timelineManager.sample(entity, 'scaleX', 0);
                const sy = this.timelineManager.sample(entity, 'scaleY', 0);
                const op = this.timelineManager.sample(entity, 'opacity', 0);

                if (x !== undefined) mesh.position.x = x;
                if (y !== undefined) mesh.position.y = y;
                if (rot !== undefined) mesh.rotation.z = rot;
                if (sx !== undefined) mesh.scale.x = sx;
                if (sy !== undefined) mesh.scale.y = sy;
                if (op !== undefined) {
                    mesh.userData.opacity = op;
                    mesh.visible = op > 0.001;
                    if (mesh.material) {
                        (mesh.material as any).opacity = op;
                        (mesh.material as any).transparent = op < 0.999;
                    }
                }

                if (this.tileTransformChanged) {
                    this.tileTransformChanged(
                        tileIdx, mesh.position, mesh.rotation as Euler,
                        mesh.scale, mesh.userData.opacity ?? 1
                    );
                }
            }
        }

        debugLog(playLabel, 'Reset complete');
    }

    public dispose(): void {
        this.tiles = null;
    }
}
