import * as THREE from 'three'

interface Color { r: number; g: number; b: number; }

const TILE_WIDTH = 0.275;
const TILE_LENGTH = 0.5;
const OUTLINE = 0.025;

// ========== 辅助函数（与 tile_svg 对齐） ==========

// 正取模（与 tile_svg 的 fmol 一致）
const fmod = (a: number, b: number): number => {
    return a - b * Math.floor(a / b);
};

// 线性插值（与 tile_svg 的 l 一致）
const lerp = (a: number, b: number, t: number): number => {
    return a + t * (b - a);
};

// 角度转弧度
const d2r = (deg: number): number => deg * Math.PI / 180;
const sin = (deg: number): number => Math.sin(d2r(deg));
const cos = (deg: number): number => Math.cos(d2r(deg));

// q(x) 函数：根据角度计算内圆半径系数（与 tile_svg 完全一致）
const q = (x: number): number => {
    if (x >= 0 && x <= 5) return 1;
    if (x > 5 && x <= 30) return lerp(1, 0.83, Math.sqrt((x - 5) / 25));
    if (x > 30 && x <= 45) return lerp(0.83, 0.77, (x - 30) / 15);
    if (x > 45 && x <= 90) return lerp(0.77, 0.15, Math.pow((x - 45) / 45, 0.7));
    if (x > 90 && x <= 120) return lerp(0.15, 0, Math.sqrt((x - 90) / 45));
    return 0;
};

// f(x, w) 函数：计算圆心到原点的距离（与 tile_svg 完全一致）
const f = (x: number, w: number): number => {
    if (x <= 5) return 0;
    return -1 * (lerp(0, w, q(x)) - w) / sin(x / 2);
};

// 生成扇形弧段上的点（与 tile_svg 的 Sector 一致）
const Sector = (
    Cx: number, Cy: number,
    rad: number, ang: number, dir: number,
    a: number, acc: number,
    pts: [number, number][]
): [number, number][] => {
    let angle = a;
    let d = dir;
    const lastPt = pts[pts.length - 1];
    
    // 检查起始点与最后一个点的距离，决定扫描方向
    if (rad < Math.round(Math.sqrt(
        Math.pow(Cx + rad * cos(angle) - lastPt[0], 2) +
        Math.pow(Cy + rad * sin(angle) - lastPt[1], 2)
    ))) {
        angle = a + dir * ang;
        d = -1 * dir;
    }
    
    // 生成弧上的点
    for (let i = 0; i < Math.floor(ang / acc) - 1; i++) {
        pts.push([Cx + rad * cos(angle), Cy + rad * sin(angle)]);
        angle += d * acc;
    }
    
    // 添加终点
    if (d === dir) {
        pts.push([Cx + rad * cos(a + dir * ang), Cy + rad * sin(a + dir * ang)]);
    } else {
        pts.push([Cx + rad * cos(a), Cy + rad * sin(a)]);
    }
    
    return pts;
};

// 计算多边形顶点（与 tile_svg 的 CaculatePoints 完全一致）
const CaculatePoints = (
    ang1: number, ang2: number,
    wid: number, len: number,
    mr: number
): [number, number][] => {
    // 角度取负（tile_svg 的方向体系）
    const a1 = -ang1;
    const a2 = -ang2;
    
    // 计算夹角
    const alpha = Math.min(fmod(a1 - a2, 360), fmod(a2 - a1, 360));
    
    // 确定角度顺序
    const a: number[] = [];
    if (fmod(a1 - a2, 360) > fmod(a2 - a1, 360)) {
        a.push(fmod(a1, 360));
        a.push(fmod(a2, 360));
    } else {
        a.push(fmod(a2, 360));
        a.push(fmod(a1, 360));
    }
    
    // 计算中间角度和圆心位置
    const m = a[0] + alpha / 2;
    const x0 = -f(alpha, wid) * cos(m);
    const y0 = -f(alpha, wid) * sin(m);
    const r0 = Math.abs(f(alpha, wid) * sin(alpha / 2) - wid);
    
    const pts: [number, number][] = [];
    
    // 起始点
    pts.push([-r0 * sin(a[1]) + x0, r0 * cos(a[1]) + y0]);
    pts.push([-wid * sin(a[1]) + len * cos(a[1]), wid * cos(a[1]) + len * sin(a[1])]);
    
    if (mr === 0) {
        // 正常模式
        if (2 * Math.atan(wid / len) < d2r(alpha)) {
            // 宽角度情况
            pts.push([wid * sin(a[1]) + len * cos(a[1]), -wid * cos(a[1]) + len * sin(a[1])]);
            pts.push([(wid / sin(alpha / 2)) * cos(m), (wid / sin(alpha / 2)) * sin(m)]);
            pts.push([-wid * sin(a[0]) + len * cos(a[0]), wid * cos(a[0]) + len * sin(a[0])]);
        } else {
            // 窄角度情况
            pts.push([
                (len * cos(a[0]) - wid * sin(a[1])) / Math.cos(d2r(alpha)),
                (len * sin(a[0]) + wid * cos(a[1])) / Math.cos(d2r(alpha))
            ]);
            pts.push([-wid * sin(a[0]) + len * cos(a[0]), wid * cos(a[0]) + len * sin(a[0])]);
            pts.push([
                (len * cos(m)) / Math.cos(d2r(alpha / 2)),
                (len * sin(m)) / Math.cos(d2r(alpha / 2))
            ]);
            pts.push([wid * sin(a[1]) + len * cos(a[1]), -wid * cos(a[1]) + len * sin(a[1])]);
            pts.push([
                (len * cos(a[1]) + wid * sin(a[0])) / Math.cos(d2r(alpha)),
                (len * sin(a[1]) - wid * cos(a[0])) / Math.cos(d2r(alpha))
            ]);
        }
        pts.push([wid * sin(a[0]) + len * cos(a[0]), -wid * cos(a[0]) + len * sin(a[0])]);
        pts.push([r0 * sin(a[0]) + x0, -r0 * cos(a[0]) + y0]);
        
        // 添加扇形弧段
        if (fmod(a1, 360) > fmod(a2, 360)) {
            return Sector(
                x0, y0, r0, 180 - alpha,
                fmod(a1, 360) - fmod(a2, 360) > 180 ? 1 : -1,
                fmod(a1, 360) - fmod(a2, 360) > 180 ? a2 + 90 : a2 - 90,
                6, pts
            );
        } else {
            return Sector(
                x0, y0, r0, 180 - alpha,
                fmod(a2, 360) - fmod(a1, 360) > 180 ? 1 : -1,
                fmod(a2, 360) - fmod(a1, 360) > 180 ? a1 + 90 : a1 - 90,
                6, pts
            );
        }
    } else {
        // midspin 模式（mr !== 0）
        pts.push([wid * sin(a[1]) + len * cos(a[1]), -wid * cos(a[1]) + len * sin(a[1])]);
        pts.push([r0 * sin(a[0]) + x0, -r0 * cos(a[0]) + y0]);
        pts.push([x0 + r0 * cos(a1 + 180), y0 + r0 * sin(a1 + 180)]);
        return pts;
    }
};

// ========== 创建圆形 ==========
const createCircle = (
    center: THREE.Vector3,
    radius: number,
    color: Color,
    vertices: number[],
    faces: number[],
    colors: number[]
) => {
    const resolution = 32;
    const centerIndex = vertices.length / 3;

    // 添加中心点
    vertices.push(center.x, center.y, center.z);
    colors.push(color.r, color.g, color.b);

    // 添加圆周顶点
    for (let i = 0; i < resolution; i++) {
        const angle = (2 * Math.PI * i) / resolution;
        const x = Math.cos(angle) * radius + center.x;
        const y = Math.sin(angle) * radius + center.y;
        vertices.push(x, y, center.z);
        colors.push(color.r, color.g, color.b);
    }

    // 添加三角形面
    for (let i = 1; i < resolution; i++) {
        faces.push(centerIndex, centerIndex + i, centerIndex + i + 1);
    }
    faces.push(centerIndex, centerIndex + resolution, centerIndex + 1);
};

// ========== MeshData 接口 ==========
interface MeshData { vertices: number[]; faces: number[]; colors: number[]; }

// ========== 多边形转网格 ==========
const polygonToMesh = (
    points: [number, number][],
    color: Color,
    vertices: number[],
    faces: number[],
    colors: number[]
) => {
    if (points.length < 3) return;
    
    const startIndex = vertices.length / 3;
    
    // 添加所有顶点（y取反：SVG y-down → Three.js y-up）
    for (const [x, y] of points) {
        vertices.push(x, -y, 0);
        colors.push(color.r, color.g, color.b);
    }
    
    // 使用扇形三角剖分（fan triangulation）
    for (let i = 1; i < points.length - 1; i++) {
        faces.push(startIndex, startIndex + i, startIndex + i + 1);
    }
};

// ========== 创建 Gems 样式网格 ==========
const createGemsMesh = (
    startAngle: number,
    endAngle: number,
    length: number,
    width: number,
    outline: number
): MeshData => {
    const vertices: number[] = [];
    const faces: number[] = [];
    const colors: number[] = [];

    const m11 = Math.cos((startAngle / 180) * Math.PI);
    const m12 = Math.sin((startAngle / 180) * Math.PI);
    const m21 = Math.cos((endAngle / 180) * Math.PI);
    const m22 = Math.sin((endAngle / 180) * Math.PI);

    const blackColor: Color = { r: 0, g: 0, b: 0 };
    const whiteColor: Color = { r: 1, g: 1, b: 1 };

    const hexRadius = width;
    const hexOutlineRadius = hexRadius + outline;

    // 外六边形（黑色描边）
    {
        const count = vertices.length / 3;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = Math.cos(angle) * hexOutlineRadius;
            const y = Math.sin(angle) * hexOutlineRadius;
            vertices.push(x, y, 0);
            colors.push(blackColor.r, blackColor.g, blackColor.b);
        }
        for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            faces.push(count, count + i, count + next);
        }
    }

    // 内六边形（白色填充）
    {
        const count = vertices.length / 3;
        const hexInnerRadius = hexRadius - outline;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = Math.cos(angle) * hexInnerRadius;
            const y = Math.sin(angle) * hexInnerRadius;
            vertices.push(x, y, 0);
            colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
        }
        for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            faces.push(count, count + i, count + next);
        }
    }

    // 端盖（描边）
    {
        const count = vertices.length / 3;
        vertices.push(
            length * m11 + width * m12, length * m12 - width * m11, 0,
            length * m11 - width * m12, length * m12 + width * m11, 0,
            -width * m12, width * m11, 0,
            width * m12, -width * m11, 0,
            length * m21 + width * m22, length * m22 - width * m21, 0,
            length * m21 - width * m22, length * m22 + width * m21, 0,
            -width * m22, width * m21, 0,
            width * m22, -width * m21, 0
        );
        for (let i = 0; i < 8; i++) {
            colors.push(blackColor.r, blackColor.g, blackColor.b);
        }
        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
        faces.push(count + 6, count + 7, count + 4);
    }

    // 端盖（内部）
    {
        const count = vertices.length / 3;
        const innerLength = length - outline;
        const innerWidth = width - outline;
        vertices.push(
            innerLength * m11 + innerWidth * m12, innerLength * m12 - innerWidth * m11, 0,
            innerLength * m11 - innerWidth * m12, innerLength * m12 + innerWidth * m11, 0,
            -innerWidth * m12, innerWidth * m11, 0,
            innerWidth * m12, -innerWidth * m11, 0,
            innerLength * m21 + innerWidth * m22, innerLength * m22 - innerWidth * m21, 0,
            innerLength * m21 - innerWidth * m22, innerLength * m22 + innerWidth * m21, 0,
            -innerWidth * m22, innerWidth * m21, 0,
            innerWidth * m22, -innerWidth * m21, 0
        );
        for (let i = 0; i < 8; i++) {
            colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
        }
        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
        faces.push(count + 6, count + 7, count + 4);
    }

    return { vertices, faces, colors };
};

// ========== 创建 MidSpin 网格 ==========
const createMidSpinMesh = (
    angle: number,
    width: number = TILE_WIDTH,
    length: number = TILE_WIDTH,
    outline: number = OUTLINE
): MeshData => {
    let widthi = width;
    let lengthi = length;

    const m1 = Math.cos((angle / 180) * Math.PI);
    const m2 = Math.sin((angle / 180) * Math.PI);

    const vertices: number[] = [];
    const faces: number[] = [];
    const colors: number[] = [];

    const midpoint = new THREE.Vector3(-m1 * 0.04, -m2 * 0.04, 0);

    const blackColor: Color = { r: 0, g: 0, b: 0 };
    const whiteColor: Color = { r: 1, g: 1, b: 1 };

    // Main body with outline
    widthi += outline;
    lengthi += outline;

    {
        const count = vertices.length / 3;
        vertices.push(
            midpoint.x + lengthi * m1 + widthi * m2, midpoint.y + lengthi * m2 - widthi * m1, 0,
            midpoint.x + lengthi * m1 - widthi * m2, midpoint.y + lengthi * m2 + widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m1, midpoint.y - widthi * m2, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0
        );

        for (let i = 0; i < 7; i++) {
            colors.push(blackColor.r, blackColor.g, blackColor.b);
        }

        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
    }

    // Inner part (white)
    widthi -= outline * 2;
    lengthi -= outline * 2;

    {
        const count = vertices.length / 3;
        vertices.push(
            midpoint.x + lengthi * m1 + widthi * m2, midpoint.y + lengthi * m2 - widthi * m1, 0,
            midpoint.x + lengthi * m1 - widthi * m2, midpoint.y + lengthi * m2 + widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m1, midpoint.y - widthi * m2, 0,
            midpoint.x + widthi * m2, midpoint.y - widthi * m1, 0,
            midpoint.x - widthi * m2, midpoint.y + widthi * m1, 0
        );

        for (let i = 0; i < 7; i++) {
            colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
        }

        faces.push(count, count + 1, count + 2);
        faces.push(count + 2, count + 3, count);
        faces.push(count + 4, count + 5, count + 6);
    }

    return { vertices, faces, colors };
};

// ========== 创建 Tile 网格（核心函数） ==========
const createTileMesh = (
    startAngle: number,
    endAngle: number,
    length: number,
    width: number,
    outline: number
): MeshData => {
    const vertices: number[] = [];
    const faces: number[] = [];
    const colors: number[] = [];

    const blackColor: Color = { r: 0, g: 0, b: 0 };
    const whiteColor: Color = { r: 1, g: 1, b: 1 };

    // 外部轮廓（黑色描边）
    const outerWidth = width + outline;
    const outerLength = length + outline;
    const outerPoints = CaculatePoints(startAngle, endAngle, outerWidth, outerLength, 0);
    polygonToMesh(outerPoints, blackColor, vertices, faces, colors);

    // 内部填充（白色）
    const innerWidth = width - outline;
    const innerLength = length - outline;
    const innerPoints = CaculatePoints(startAngle, endAngle, innerWidth, innerLength, 0);
    polygonToMesh(innerPoints, whiteColor, vertices, faces, colors);

    return { vertices, faces, colors };
};

// ========== 创建 Track 网格（主入口） ==========
const createTrackMesh = (
    startAngle: number,
    endAngle: number,
    isMidspin: boolean = false,
    length: number = TILE_LENGTH,
    width: number = TILE_WIDTH,
    outline: number = OUTLINE,
    trackStyle: string = "Standard"
): MeshData => {
    if (isMidspin) {
        return createMidSpinMesh(startAngle);
    }

    // 如果角度差为整圆（360°的整数倍），使用特殊长宽比 3.2:2.75
    let adjustedLength = length;
    if (Math.abs((endAngle - startAngle) % 360) < 0.001) {
        adjustedLength = width * 3.2 / 2.75;
    }

    if (trackStyle === "Gems") {
        return createGemsMesh(startAngle, endAngle, adjustedLength, width, outline);
    }

    if (trackStyle === "Minimal") {
        adjustedLength -= 0.03;
    }

    return createTileMesh(startAngle, endAngle, adjustedLength, width, outline);
};

// ========== 展开为每面独立顶点 ==========
const expandToPerFace = (mesh: MeshData): MeshData => {
    const newVertices: number[] = [];
    const newColors: number[] = [];
    const newFaces: number[] = [];

    for (let i = 0; i < mesh.faces.length; i += 3) {
        const a = mesh.faces[i];
        const b = mesh.faces[i + 1];
        const c = mesh.faces[i + 2];

        // Vertex A
        newVertices.push(
            mesh.vertices[a * 3],
            mesh.vertices[a * 3 + 1],
            mesh.vertices[a * 3 + 2]
        );
        newColors.push(
            mesh.colors[a * 3],
            mesh.colors[a * 3 + 1],
            mesh.colors[a * 3 + 2]
        );

        // Vertex B
        newVertices.push(
            mesh.vertices[b * 3],
            mesh.vertices[b * 3 + 1],
            mesh.vertices[b * 3 + 2]
        );
        newColors.push(
            mesh.colors[b * 3],
            mesh.colors[b * 3 + 1],
            mesh.colors[b * 3 + 2]
        );

        // Vertex C
        newVertices.push(
            mesh.vertices[c * 3],
            mesh.vertices[c * 3 + 1],
            mesh.vertices[c * 3 + 2]
        );
        newColors.push(
            mesh.colors[c * 3],
            mesh.colors[c * 3 + 1],
            mesh.colors[c * 3 + 2]
        );

        const baseIndex = newVertices.length / 3 - 3;
        newFaces.push(baseIndex, baseIndex + 1, baseIndex + 2);
    }

    return {
        vertices: newVertices,
        faces: newFaces,
        colors: newColors
    };
};

// ========== 导出 ==========
export { fmod, lerp, createCircle, createMidSpinMesh, createTileMesh, createGemsMesh, expandToPerFace, CaculatePoints };
export type { MeshData };
export default createTrackMesh;
