import { Vector3 } from 'three';
import { isEventActive, isEnabled } from './EventUtils';
import { Level } from 'adofai';
import type { TileBases } from './TileBases';

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
    position: Vector3;
    rotation: number;
    scale: Vector3;
    opacity: number;
    stickToFloors: boolean;
}

/**
 * PositionTrack 计算器（紧凑版）。
 *
 * 谱面砖数可达百万级（例：Singularity 99.7 万砖），原实现会一次性构造
 * `Map<number, TileTransform>` + 每砖一个 Vector2/Vector3，单次数百 MB。
 * 现在：
 *  - 基础位置/事件结果全部存 Float64Array（位置）、Float32Array（角度/缩放/透明度）、
 *    Uint8Array（stickToFloors）；
 *  - `applyPositionsToTiles()` 把结果写回 `tile.position`（存在则原地写）；
 *  - `getTileTransform(i)` 按需临时组装（只对可见砖/编辑器缓存砖调用）。
 * 语义与旧实现保持一致（含 relativeTo / vector 累积 / disabled / editorOnly）。
 */
export class PositionTrackManager {
    private levelData: any;
    private positionTrackEvents: Map<number, PositionTrackEvent[]>;

    private static TILE_SIZE = 1.0;

    // ── 紧凑数组（tileCount 长度）───────────────────────────────
    /** 应用 PositionTrack 事件后的位置 */
    private workX: Float64Array | null = null;
    private workY: Float64Array | null = null;
    private workRot: Float32Array | null = null;      // 度
    private workScale: Float32Array | null = null;
    private workOpacity: Float32Array | null = null;
    private workStick: Uint8Array | null = null;

    private computed: boolean = false;
    private computedEditorMode: boolean | null = null;
    private tileCount: number = 0;
    /** getTileTransform 的复用对象（调用方均立即读取，不持有引用）。 */
    private _tmpTransform: TileTransform | null = null;
    /** getBases 缓存的访问器（computeTransforms 重算时失效）。 */
    private _bases: TileBases | null = null;
    /** Player 叠加 Hold/ScaleRadius 偏移后的最终砖位（官方 startPos 含偏移）。 */
    private finalX: Float64Array | null = null;
    private finalY: Float64Array | null = null;

    constructor(levelData: Level) {
        this.levelData = levelData;
        this.positionTrackEvents = new Map();
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
            return isEnabled(this.levelData.settings?.stickToFloors, true);
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
            if (!isEventActive(action)) continue;
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
                justThisTile: isEnabled(action.justThisTile),
                editorOnly: isEnabled(action.editorOnly),
                stickToFloors: action.stickToFloors,
                disabled: action.disabled,
            });
        }
    }

    /** 是否有任何 PositionTrack 事件（没有的话所有 transform 都是默认值）。 */
    public hasPositionTrackEvents(): boolean {
        return this.positionTrackEvents.size > 0;
    }

    /**
     * 计算基础位置与 PositionTrack 事件结果（紧凑数组）。
     * 多次调用会重算（editorMode 影响 editorOnly 事件，语义同旧实现）。
     */
    public computeTransforms(isEditorMode: boolean = false): void {
        // 结果只取决于 angleData/actions/isEditorMode：同一模式下重复调用（例如每次
        // 退出播放的 reapplyPositionTrackTransforms）直接复用，避免百万砖重算 + 36MB
        // typed array 重新分配。setEditorMode 切换模式时才真正重算。
        if (this.computed && this.computedEditorMode === isEditorMode) return;
        this._bases = null;
        const tiles = this.levelData.tiles || [];
        const tileCount = tiles.length;
        const rawAngleData = this.levelData.angleData || [];
        const TILE_SIZE = PositionTrackManager.TILE_SIZE;

        this.tileCount = tileCount;

        const baseX = new Float64Array(tileCount);
        const baseY = new Float64Array(tileCount);
        const floats = new Float64Array(tileCount);
        for (let i = 0; i < tileCount; i++) {
            const a = rawAngleData[i];
            if (a === undefined || a === null) {
                floats[i] = (floats[i - 1] || 0) + 180;
            } else {
                floats[i] = a === 999 ? (floats[i - 1] || 0) + 180 : a;
            }
        }

        let px = 0, py = 0;
        for (let i = 0; i < tileCount; i++) {
            // tilePositions[k] = 前 k 步累积（与旧实现一致：先 set(0)，循环里 set(i+1)）
            baseX[i] = px;
            baseY[i] = py;
            const rad = floats[i] * Math.PI / 180;
            px += Math.cos(rad) * TILE_SIZE;
            py += Math.sin(rad) * TILE_SIZE;
        }

        const defaultStick = isEnabled(this.levelData.settings?.stickToFloors, true);

        // 无事件：work 直接等于 base，旋转/缩放/透明度默认。
        if (this.positionTrackEvents.size === 0) {
            this.workX = baseX;
            this.workY = baseY;
            this.workRot = null;
            this.workScale = null;
            this.workOpacity = null;
            this.workStick = null;
            this.computed = true;
            this.computedEditorMode = isEditorMode;
            return;
        }

        const workX = new Float64Array(tileCount);
        const workY = new Float64Array(tileCount);
        const workRot = new Float32Array(tileCount);
        const workScale = new Float32Array(tileCount);
        const workOpacity = new Float32Array(tileCount);
        const workStick = new Uint8Array(tileCount);

        // ── 位置（加法型）：Fenwick 树"后缀加法 + 点查询" ────────────────
        // 旧实现对每个 non-justThisTile 事件都循环 [floor, tileCount) 逐砖调整，
        // 复杂度 O(事件 × 砖数)：本谱 23,604 个 PositionTrack 事件 × 677 万砖
        // ≈ 千亿次操作 → 加载直接挂死。BIT 后每事件 O(log n)。
        const bitSize = tileCount + 1;
        const bitX = new Float64Array(bitSize);
        const bitY = new Float64Array(bitSize);
        const pointX = new Float64Array(tileCount);
        const pointY = new Float64Array(tileCount);
        const bitAdd = (idx: number, dx: number, dy: number): void => {
            for (let i = idx + 1; i < bitSize; i += i & -i) { bitX[i] += dx; bitY[i] += dy; }
        };
        const bitSumX = (idx: number): number => {
            let s = 0;
            for (let i = idx + 1; i > 0; i -= i & -i) s += bitX[i];
            return s;
        };
        const bitSumY = (idx: number): number => {
            let s = 0;
            for (let i = idx + 1; i > 0; i -= i & -i) s += bitY[i];
            return s;
        };

        // ADOFAI's `vector`: accumulated non-justThisTile offset, used for relativeTo
        let vectorX = 0, vectorY = 0;

        // 持续状态（对应旧实现里"fill 到结尾"的效果）
        let curScale = 1, curRot = 0, curOpacity = 1, curStick = defaultStick ? 1 : 0;

        for (let floor = 0; floor < tileCount; floor++) {
            const events = this.positionTrackEvents.get(floor);
            let tileScale: number | null = null;
            let tileRot: number | null = null;
            let tileOpacity: number | null = null;
            let tileStick: number | null = null;

            if (events) {
                for (const event of events) {
                    if (event.editorOnly && !isEditorMode) continue;

                    // ── positionOffset + relativeTo ─────────────────────
                    if (!this.isDisabled(event, 'positionOffset')) {
                        let changeX = 0, changeY = 0;

                        let targetTileId = floor;
                        if (event.relativeTo) {
                            targetTileId = this.IDFromTile(event.relativeTo, floor);
                        }

                        if (event.positionOffset) {
                            const pos = this.normalizeVec2(event.positionOffset);
                            changeX += pos[0] * TILE_SIZE;
                            changeY += pos[1] * TILE_SIZE;
                        }

                        if (targetTileId !== floor && targetTileId < tileCount) {
                            const targetX = baseX[targetTileId] + bitSumX(targetTileId) + pointX[targetTileId];
                            const targetY = baseY[targetTileId] + bitSumY(targetTileId) + pointY[targetTileId];
                            changeX += targetX - (baseX[floor] + vectorX);
                            changeY += targetY - (baseY[floor] + vectorY);
                        }

                        if (event.justThisTile) {
                            pointX[floor] += changeX;
                            pointY[floor] += changeY;
                        } else {
                            bitAdd(floor, changeX, changeY);
                            vectorX = bitSumX(floor) + pointX[floor];
                            vectorY = bitSumY(floor) + pointY[floor];
                        }
                    }

                    // ── scale ───────────────────────────────────────────
                    if (event.scale !== undefined && event.scale !== null && !this.isDisabled(event, 'scale')) {
                        const s = event.scale / 100;
                        tileScale = s;
                        if (!event.justThisTile) curScale = s;
                    }

                    // ── rotation ────────────────────────────────────────
                    if (event.rotation !== undefined && event.rotation !== null && !this.isDisabled(event, 'rotation')) {
                        tileRot = event.rotation;
                        if (!event.justThisTile) curRot = event.rotation;
                    }

                    // ── opacity ─────────────────────────────────────────
                    if (event.opacity !== undefined && event.opacity !== null && !this.isDisabled(event, 'opacity')) {
                        const o = event.opacity / 100;
                        tileOpacity = o;
                        if (!event.justThisTile) curOpacity = o;
                    }

                    // ── stickToFloors ───────────────────────────────────
                    if (event.stickToFloors !== undefined && !this.isDisabled(event, 'stickToFloors')) {
                        const v = this.parseStickToFloors(event.stickToFloors) ? 1 : 0;
                        tileStick = v;
                        if (!event.justThisTile) curStick = v;
                    }
                }
            }

            // 当前砖的值：事件直接赋值优先（同 floor 后写覆盖），否则用持续状态
            workScale[floor] = tileScale !== null ? tileScale : curScale;
            workRot[floor] = tileRot !== null ? tileRot : curRot;
            workOpacity[floor] = tileOpacity !== null ? tileOpacity : curOpacity;
            workStick[floor] = tileStick !== null ? tileStick : curStick;
        }

        for (let i = 0; i < tileCount; i++) {
            workX[i] = baseX[i] + bitSumX(i) + pointX[i];
            workY[i] = baseY[i] + bitSumY(i) + pointY[i];
        }

        this.workX = workX;
        this.workY = workY;
        this.workRot = workRot;
        this.workScale = workScale;
        this.workOpacity = workOpacity;
        this.workStick = workStick;
        this.computed = true;
        this.computedEditorMode = isEditorMode;
    }

    private ensureComputed(): void {
        if (!this.computed) this.computeTransforms(false);
    }

    /** 把最终坐标拷贝到外部位置存储（紧凑模式用；不建对象）。 */
    public copyTo(pos: { x: Float64Array; y: Float64Array }): void {
        this.ensureComputed();
        const wx = this.workX, wy = this.workY;
        if (!wx || !wy) return;
        // 共享引用（不拷贝）：computeTransforms 重算时会生成新的 work 数组，
        // 调用方在每次重算后都会再调 copyTo，引用保持最新 —— 省一份
        // 6.7M×2×8B 的常驻拷贝。
        pos.x = wx;
        pos.y = wy;
    }

    /**
     * copyTo 是共享引用；调用方若要在位置上原地叠加偏移（Hold/ScaleRadius），
     * 必须先据此判断并分离出私有副本，否则偏移会写进缓存 work 数组，
     * 退出播放重算时被重复叠加（砖位错乱）。
     */
    public sharesPositionArrays(x: Float64Array, y: Float64Array): boolean {
        return this.workX === x && this.workY === y;
    }

    /**
     * 记录 Player 叠加 Hold/ScaleRadius 偏移后的最终砖位。
     * MoveTrack/appear 动画都以"含偏移的最终位置"为基准，因此 getBases() 优先使用这里的引用。
     */
    public setFinalPositions(x: Float64Array, y: Float64Array): void {
        this.finalX = x;
        this.finalY = y;
        if (this._bases) {
            this._bases.posX = x;
            this._bases.posY = y;
        }
    }

    /** 把最终位置写回 tiles[i].position（存在数组则原地写，避免再造 100 万个数组）。 */
    public applyPositionsToTiles(tiles: any[]): void {
        this.ensureComputed();
        const wx = this.workX, wy = this.workY;
        if (!wx || !wy) return;
        const n = Math.min(tiles.length, wx.length);
        for (let i = 0; i < n; i++) {
            const t = tiles[i];
            if (!t) continue;
            const arr = t.position;
            if (Array.isArray(arr)) {
                arr[0] = wx[i];
                arr[1] = wy[i];
            } else {
                t.position = [wx[i], wy[i]];
            }
        }
    }

    /** 基础位置（角度递推、不含事件），供需要"原始起点"的逻辑使用。 */
    public getBasePosition(index: number): { x: number; y: number } | undefined {
        this.ensureComputed();
        if (!this.workX || !this.workY) return undefined;
        if (index < 0 || index >= this.workX.length) return undefined;
        return { x: this.workX[index], y: this.workY[index] };
    }

    public getRotationDeg(index: number): number {
        this.ensureComputed();
        return this.workRot ? this.workRot[index] : 0;
    }

    public getScale(index: number): number {
        this.ensureComputed();
        return this.workScale ? this.workScale[index] : 1;
    }

    public getOpacity(index: number): number {
        this.ensureComputed();
        return this.workOpacity ? this.workOpacity[index] : 1;
    }

    public getStickToFloors(index: number): boolean {
        this.ensureComputed();
        if (!this.workStick) {
            return isEnabled(this.levelData.settings?.stickToFloors, true);
        }
        return this.workStick[index] !== 0;
    }

    /**
     * 按需组装单个砖块的 TileTransform（只应在可见砖/编辑器缓存砖上调用）。
     * 没有 PositionTrack 事件时返回 undefined —— 调用方按基础值处理。
     */
    public getTileTransform(tileIndex: number): TileTransform | undefined {
        this.ensureComputed();
        if (this.positionTrackEvents.size === 0) return undefined;
        if (tileIndex < 0 || tileIndex >= this.tileCount) return undefined;
        const x = this.workX ? this.workX[tileIndex] : 0;
        const y = this.workY ? this.workY[tileIndex] : 0;
        const rot = this.workRot ? this.workRot[tileIndex] : 0;
        const s = this.workScale ? this.workScale[tileIndex] : 1;
        const op = this.workOpacity ? this.workOpacity[tileIndex] : 1;
        // 复用单个对象：所有调用方都是"取到后立即读取/拷贝"，没有持有引用的场景。
        // 高速段每帧创建数百个砖时，避免每砖 2 个 Vector3 的 GC 压力。
        const t = this._tmpTransform
            ?? (this._tmpTransform = {
                position: new Vector3(),
                rotation: 0,
                scale: new Vector3(),
                opacity: 1,
                stickToFloors: true,
            });
        t.position.set(x, y, 0);
        t.rotation = rot;
        t.scale.set(s, s, s);
        t.opacity = op;
        t.stickToFloors = this.getStickToFloors(tileIndex);
        return t;
    }

    /**
     * 只读"基础值"访问器：位置直接引用 work Float64Array，旋转/缩放/透明度按需读取。
     * 取代以前按砖构造的 Vector2[] base 数组（百万砖下省数百 MB）。
     */
    public getBases(): TileBases {
        this.ensureComputed();
        if (!this._bases) {
            const wx = this.finalX ?? this.workX!;
            const wy = this.finalY ?? this.workY!;
            const wr = this.workRot;
            const ws = this.workScale;
            const wo = this.workOpacity;
            this._bases = {
                count: this.tileCount,
                posX: wx,
                posY: wy,
                rotRad: (i: number) => (wr ? wr[i] : 0) * Math.PI / 180,
                scaleX: (i: number) => (ws ? ws[i] : 1),
                scaleY: (i: number) => (ws ? ws[i] : 1),
                opacity: (i: number) => (wo ? wo[i] : 1),
            };
        }
        return this._bases;
    }

    public dispose(): void {
        this.positionTrackEvents.clear();
        this.workX = this.workY = null;
        this.workRot = this.workScale = this.workOpacity = null;
        this.workStick = null;
        this.computed = false;
        this._bases = null;
    }
}
