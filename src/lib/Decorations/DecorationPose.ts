/**
 * 装饰物摆放公式（纯数据版）。
 *
 * 对应 ADOUAC 的 Core/Decorations/DecorationPose.cs 和
 * View/Shaders/DecorationState.compute 里的同一套公式：
 *   P0 = position + follow + (stickToFloor ? floorPos - startPos : 0)
 *   P  = camera-anchored ? screenPosition : (camera - P0) * parallax + P0
 *   P += parallaxOffset * scaleFactor
 *   angle = startRotation + rotation + (stick ? floorRot : lockRotation ? camRot : 0)
 *   图片中心 = P + R(angle) * (scale * (pivotOffset + cropPivotOffset))
 *
 * 这里刻意不依赖 three，方便后续把时间线求值也做成纯数据模块。
 */

export type DecorationPlacementType =
    | 'Tile'
    | 'Global'
    | 'RedPlanet'
    | 'BluePlanet'
    | 'GreenPlanet'
    | 'Player'
    | 'Camera'
    | 'CameraAspect'
    | 'LastPosition'
    | 'LastPositionNoRotation';

export interface Vec2Like {
    x: number;
    y: number;
}

export interface DecorationCameraPose {
    x: number;
    y: number;
    /** 相机角度，弧度。 */
    rotation: number;
    /** 当前视口宽（世界单位）。 */
    viewWidth: number;
    /** 当前视口高（世界单位）。 */
    viewHeight: number;
    aspect: number;
}

export interface DecorationFloorPose {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    /** 角度，弧度。 */
    rotation: number;
}

export interface DecorationPoseInput {
    placement: DecorationPlacementType;
    /** 当前通道值（position / rotation / scale 已经过时间线求值）。 */
    position: Vec2Like;
    pivotOffset: Vec2Like;
    /** 偏移点的额外偏移（官方 cropPivotOffset / 100）。 */
    cropPivotOffset?: Vec2Like;
    /** 当前旋转（rotation + rotationOffset），度。 */
    rotation: number;
    /** 初始旋转，默认 0。 */
    startRotation?: number;
    /** 当前 scale，1 = 100%。 */
    scale: Vec2Like;
    parallax: Vec2Like;
    parallaxOffset: Vec2Like;
    /** 已经包含 scaleMultiplier 的相机缩放系数。 */
    scaleFactor: number;
    lockRotation: boolean;
    lockScale: boolean;
    stickToFloor: boolean;
    /** 父砖当前状态；stickToFloor 时使用。 */
    floor?: DecorationFloorPose | null;
    /** 初始摆放位置（stickToFloor 的偏移基准）。 */
    startPos: Vec2Like;
    /** Player / 星球跟随偏移。 */
    follow?: Vec2Like | null;
    camera: DecorationCameraPose;
}

export interface DecorationPoseResult {
    /** 容器位置（pivot 仍由子视觉组处理）。 */
    x: number;
    y: number;
    /** 容器旋转，弧度。 */
    rotation: number;
    scaleX: number;
    scaleY: number;
    factorX: number;
    factorY: number;
}

function rotate(x: number, y: number, degrees: number): Vec2Like {
    const r = degrees * Math.PI / 180;
    const s = Math.sin(r);
    const c = Math.cos(r);
    return { x: x * c - y * s, y: x * s + y * c };
}

export function evaluateDecorationPose(input: DecorationPoseInput): DecorationPoseResult {
    const cam = input.camera;
    const followX = input.follow?.x ?? 0;
    const followY = input.follow?.y ?? 0;
    const stick = input.stickToFloor && !!input.floor;
    const floorX = stick ? input.floor!.x : 0;
    const floorY = stick ? input.floor!.y : 0;
    const floorScaleX = stick ? input.floor!.scaleX : 1;
    const floorScaleY = stick ? input.floor!.scaleY : 1;
    const floorRotation = stick ? input.floor!.rotation : 0;

    let px = 0;
    let py = 0;

    if (input.placement === 'Camera' || input.placement === 'CameraAspect') {
        const screenX = input.position.x + input.pivotOffset.x;
        const screenY = input.position.y + input.pivotOffset.y;
        const aspect = cam.aspect > 0 ? cam.aspect : 1;
        // CameraAspect 先除以 aspect，再乘完整视口宽；净效果是 screenX/20*viewHeight。
        const extentX = cam.viewWidth;
        const sx = input.placement === 'CameraAspect' ? screenX / aspect : screenX;
        const lx = sx / 20 * extentX;
        const ly = screenY / 20 * cam.viewHeight;
        const r = rotate(lx, ly, cam.rotation * 180 / Math.PI);
        px = cam.x + r.x;
        py = cam.y + r.y;
    } else {
        const p0x = input.position.x + followX + (stick ? floorX - input.startPos.x : 0);
        const p0y = input.position.y + followY + (stick ? floorY - input.startPos.y : 0);
        px = (cam.x - p0x) * input.parallax.x + p0x;
        py = (cam.y - p0y) * input.parallax.y + p0y;
    }

    px += input.parallaxOffset.x * input.scaleFactor;
    py += input.parallaxOffset.y * input.scaleFactor;

    let angleDeg = (input.startRotation ?? 0) + input.rotation;
    if (stick) angleDeg += floorRotation * 180 / Math.PI;
    else if (input.lockRotation) angleDeg += cam.rotation * 180 / Math.PI;

    // 当前 container 的旋转和 scale；pivotOffset 仍由 visualGroup 子节点承担。
    // 这与 ADOUAC 的 center + axisX/axisY 公式等价，只是 Three 的 Group 层级
    // 已经替我们做了 R(angle) * (scale * pivotOffset)。
    void input.pivotOffset;
    void input.cropPivotOffset;

    return {
        x: px,
        y: py,
        rotation: angleDeg * Math.PI / 180,
        scaleX: input.scale.x,
        scaleY: input.scale.y,
        factorX: input.scaleFactor * floorScaleX,
        factorY: input.scaleFactor * floorScaleY,
    };
}
