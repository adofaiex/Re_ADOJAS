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
    /** 诊断：已记录过"首次激活"的砖（排查 MoveTrack 生效时机/范围；上限 200 条）。 */
    private _loggedActive: Set<number> = new Set();

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
                1
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

        // Only process tiles whose animation time window covers the current time.
        // Uses pre-computed sorted ranges + binary search — avoids iterating ALL
        // animated tiles (which can be 180k+ for levels with global appear animations).
        const activeNow = this.timelineManager.getActiveTileIndicesAt(time);
        for (let ai = 0; ai < activeNow.length; ai++) {
            const tileIdx = activeNow[ai];
            const mesh = this.tiles.get(tileIdx.toString());
            if (!mesh) continue;

            newActiveIndices.add(tileIdx);

            const dirty = this.timelineManager.applyToTileMesh(tileIdx, mesh, time);
            if (!this._loggedActive.has(tileIdx) && this._loggedActive.size < 200) {
                this._loggedActive.add(tileIdx);
                debugLog('[MoveTrackApply] tile=' + tileIdx + ' t=' + time.toFixed(3)
                    + ' pos=' + mesh.position.x.toFixed(4) + ',' + mesh.position.y.toFixed(4)
                    + ' rot=' + mesh.rotation.z.toFixed(4));
            }
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

        // Apply the final (end) state once for tiles that just stopped animating.
        // Since an animation is now considered active only while time < end, the
        // last active frame may not land exactly on the final value.
        if (this.pendingFinalApply.size > 0) {
            for (const tileIdx of this.pendingFinalApply) {
                const mesh = this.tiles.get(tileIdx.toString());
                if (!mesh) continue;
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
            this.pendingFinalApply.clear();
        }
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

    /**
     * 按时间轴在 `time` 的取值刷新单块砖（缺省用当前播放时间）。
     *
     * 用途：砖块网格被 `cleanupTileCache` 裁掉后重回视野时会被重新创建，
     * `registerTileInitial` 只写基值；如果该砖的 MoveTrack/动画窗口已经过去，
     * `getActiveTileIndicesAt` 不再命中，它就会一直停在原位（"该动的砖没动"）。
     * 重建时补一次时间轴采样即可恢复正确状态。
     */
    public refreshTile(tileIndex: number, time?: number): void {
        if (!this.tiles) return;
        const mesh = this.tiles.get(tileIndex.toString());
        if (!mesh) return;

        const t = time !== undefined ? time : this.currentTime;
        const dirty = this.timelineManager.applyToTileMesh(tileIndex, mesh, t);
        if (dirty && this.tileTransformChanged) {
            this.tileTransformChanged(
                tileIndex,
                mesh.position,
                mesh.rotation as Euler,
                mesh.scale,
                mesh.userData.opacity ?? 1
            );
        }
    }

    public reset(): void {
        this.debugPlayId = ++MoveTrackManager.playCounter;
        this.activeTileIndices.clear();
        this.pendingFinalApply.clear();
        this._loggedActive.clear();
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
                    // 合成轨道颜色 alpha（#RRGGBBAA），reset 不吞透明度
                    const effectiveOpacity = op * ((mesh.userData as any).trackColorOpacity ?? 1);
                    if (mesh.material) {
                        (mesh.material as any).opacity = effectiveOpacity;
                        (mesh.material as any).transparent = effectiveOpacity < 0.999;
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
