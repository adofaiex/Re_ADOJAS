/**
 * 砖块"基础值"的只读访问接口（PositionTrack 事件结算后的最终值）。
 *
 * 取代过去 TimelineManager / MoveTrackManager 里按砖构造的 `Vector2[]` base
 * 数组（100 万砖 ≈ 数十万个小对象）。位置直接引用 PositionTrackManager 的
 * Float64Array；旋转/缩放/透明度用访问器按需读取（这些只在"有动画的砖"上被
 * 访问，量级很小，不需要物化整条数组）。
 */
export interface TileBases {
    /** 砖块数量 */
    count: number;
    /** 最终 X 坐标（PositionTrack 偏移已应用） */
    posX: ArrayLike<number>;
    /** 最终 Y 坐标 */
    posY: ArrayLike<number>;
    /** 基础旋转（弧度，含 PositionTrack rotation） */
    rotRad(index: number): number;
    /** X 缩放（1 = 原始） */
    scaleX(index: number): number;
    /** Y 缩放（1 = 原始） */
    scaleY(index: number): number;
    /** 透明度（1 = 原始） */
    opacity(index: number): number;
}
