/**
 * 砖块数据访问层：同时兼容两种后端
 *   - 对象模式：`tiles` 是 `Tile[]`（`tiles[i].angle` 等）；
 *   - 紧凑模式：`tiles` 是 adofai@>=3.4 的 `CompactTileStore`
 *     （提供 getAngle/getDirection/getTwirl/getActions 等访问器）。
 *
 * Player 内部所有逐砖读取都走这里，避免 50+ 处 `tiles[i].xxx` 在紧凑模式下取到
 * undefined / 抛错。对象模式的具体实现里这些函数就是原来那行读取，没有额外语义。
 */

/** 是否为紧凑存储（鸭子类型判断，兼容不同版本的类实例）。 */
export function isCompactTiles(tiles: any): boolean {
    return !!tiles && typeof tiles.getAngle === 'function' && !Array.isArray(tiles);
}

export function tileCount(tiles: any): number {
    return tiles?.length ?? 0;
}

export function tileAngle(tiles: any, i: number): number {
    if (!tiles) return 0;
    if (typeof tiles.getAngle === 'function') return tiles.getAngle(i) ?? 0;
    return tiles[i]?.angle ?? 0;
}

/** angle 读取（缺省值语义与 `tiles[i]?.angle ?? def` 一致）。 */
export function tileAngleOr(tiles: any, i: number, def: number): number {
    if (!tiles) return def;
    if (typeof tiles.getAngle === 'function') {
        const v = tiles.getAngle(i);
        return v === undefined || v === null ? def : v;
    }
    const t = tiles[i];
    return t?.angle === undefined || t?.angle === null ? def : t.angle;
}

export function tileDirection(tiles: any, i: number): number {
    if (!tiles) return 0;
    if (typeof tiles.getDirection === 'function') return tiles.getDirection(i) ?? 0;
    return tiles[i]?.direction ?? 0;
}

export function tileTwirl(tiles: any, i: number): number {
    if (!tiles) return 0;
    if (typeof tiles.getTwirl === 'function') return tiles.getTwirl(i) ?? 0;
    return tiles[i]?.twirl ?? 0;
}

export function tileActions(tiles: any, i: number): any[] {
    if (!tiles) return [];
    if (typeof tiles.getActions === 'function') return tiles.getActions(i) ?? [];
    const a = tiles[i]?.actions;
    return Array.isArray(a) ? a : [];
}

/**
 * 逐砖位置存储（Float64 精度）：取代每砖一个 `[x, y]` 小数组。
 * PositionTrackManager 计算完成后把最终坐标写进来；此前由
 * calculateBasicTilePositions 填基础坐标。
 */
export class TilePositions {
    x: Float64Array;
    y: Float64Array;

    constructor(n: number = 0) {
        this.x = new Float64Array(n);
        this.y = new Float64Array(n);
    }

    ensure(n: number): void {
        if (this.x.length >= n) return;
        const x = new Float64Array(n);
        x.set(this.x);
        const y = new Float64Array(n);
        y.set(this.y);
        this.x = x;
        this.y = y;
    }

    getX(i: number): number {
        return i >= 0 && i < this.x.length ? this.x[i] : 0;
    }

    getY(i: number): number {
        return i >= 0 && i < this.y.length ? this.y[i] : 0;
    }

    set(i: number, x: number, y: number): void {
        this.ensure(i + 1);
        this.x[i] = x;
        this.y[i] = y;
    }
}
