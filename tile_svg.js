import * as PIXI from 'pixi.js';

// ========== 模块级状态 ==========
let tiletexture = null;   // 全局纹理（用于贴图模式）
let renderer = null;      // PixiJS 渲染器（用于生成纹理）
const geometryCache = new Map(); // 形状纹理缓存

/**
 * 设置全局纹理（用于轨道贴图）
 */
export function getTileTexture(texture) {
    tiletexture = texture;
}

/**
 * 设置渲染器（必须在 app.init 之后调用）
 */
export function setRenderer(r) {
    renderer = r;
}

// ========== 原有辅助函数 ==========

export function fmol(a, b) { return a - b * Math.floor(a / b); }

function l(a, b, t) { return a + t * (b - a); }

function q(x) {
    if (x >= 0 && x <= 5) return 1;
    if (x > 5 && x <= 30) return l(1, 0.83, Math.sqrt((x - 5) / 25));
    if (x > 30 && x <= 45) return l(0.83, 0.77, (x - 30) / 15);
    if (x > 45 && x <= 90) return l(0.77, 0.15, Math.pow((x - 45) / 45, 0.7));
    if (x > 90 && x <= 120) return l(0.15, 0, Math.sqrt((x - 90) / 45));
    return 0;
}

function f(x, w) {
    if (x <= 5) return 0;
    return -1 * (l(0, w, q(x)) - w) / sin(x / 2);
}

function d2r(deg) { return deg * Math.PI / 180; }
function sin(deg) { return Math.sin(d2r(deg)); }
function cos(deg) { return Math.cos(d2r(deg)); }

function Sector(Cx, Cy, rad, ang, dir, a, acc, pts) {
    let angle = a;
    let d = dir;
    const p = pts;
    const lastPt = p[p.length - 1].split(',').map(Number);
    if (rad < Math.round(Math.sqrt((Cx + rad * cos(angle) - lastPt[0]) ** 2 + (Cy + rad * sin(angle) - lastPt[1]) ** 2))) {
        angle = a + dir * ang;
        d = -1 * dir;
    }
    for (let i = 0; i < Math.floor(ang / acc) - 1; i++) {
        p.push(`${Cx + rad * cos(angle)},${Cy + rad * sin(angle)}`);
        angle += d * acc;
    }
    if (d === dir) {
        p.push(`${Cx + rad * cos(a + dir * ang)},${Cy + rad * sin(a + dir * ang)}`);
    } else {
        p.push(`${Cx + rad * cos(a)},${Cy + rad * sin(a)}`);
    }
    return p;
}

function CaculatePoints(ang1, ang2, wid, len, mr) {
    let a1 = -ang1;
    let a2 = -ang2;
    const alpha = Math.min(fmol(a1 - a2, 360), fmol(a2 - a1, 360));
    const a = [];
    if (fmol(a1 - a2, 360) > fmol(a2 - a1, 360)) {
        a.push(fmol(a1, 360));
        a.push(fmol(a2, 360));
    } else {
        a.push(fmol(a2, 360));
        a.push(fmol(a1, 360));
    }
    const m = a[0] + alpha / 2;
    const x0 = -f(alpha, wid) * cos(m);
    const y0 = -f(alpha, wid) * sin(m);
    const r0 = Math.abs(f(alpha, wid) * sin(alpha / 2) - wid);
    const pts = [];

    pts.push(`${-r0 * sin(a[1]) + x0},${r0 * cos(a[1]) + y0}`);
    pts.push(`${-wid * sin(a[1]) + len * cos(a[1])},${wid * cos(a[1]) + len * sin(a[1])}`);

    if (mr === 0) {
        if (2 * Math.atan(wid / len) < d2r(alpha)) {
            pts.push(`${wid * sin(a[1]) + len * cos(a[1])},${-wid * cos(a[1]) + len * sin(a[1])}`);
            pts.push(`${(wid / sin(alpha / 2)) * cos(m)},${(wid / sin(alpha / 2)) * sin(m)}`);
            pts.push(`${-wid * sin(a[0]) + len * cos(a[0])},${wid * cos(a[0]) + len * sin(a[0])}`);
        } else {
            pts.push(`${(len * cos(a[0]) - wid * sin(a[1])) / cos(alpha)},${(len * sin(a[0]) + wid * cos(a[1])) / cos(alpha)}`);
            pts.push(`${-wid * sin(a[0]) + len * cos(a[0])},${wid * cos(a[0]) + len * sin(a[0])}`);
            pts.push(`${(len * cos(m)) / cos(alpha / 2)},${(len * sin(m)) / cos(alpha / 2)}`);
            pts.push(`${wid * sin(a[1]) + len * cos(a[1])},${-wid * cos(a[1]) + len * sin(a[1])}`);
            pts.push(`${(len * cos(a[1]) + wid * sin(a[0])) / cos(alpha)},${(len * sin(a[1]) - wid * cos(a[0])) / cos(alpha)}`);
        }
        pts.push(`${wid * sin(a[0]) + len * cos(a[0])},${-wid * cos(a[0]) + len * sin(a[0])}`);
        pts.push(`${r0 * sin(a[0]) + x0},${-r0 * cos(a[0]) + y0}`);

        if (fmol(a1, 360) > fmol(a2, 360)) {
            return Sector(x0, y0, r0, 180 - alpha, fmol(a1, 360) - fmol(a2, 360) > 180 ? 1 : -1, fmol(a1, 360) - fmol(a2, 360) > 180 ? a2 + 90 : a2 - 90, 6, pts);
        } else {
            return Sector(x0, y0, r0, 180 - alpha, fmol(a2, 360) - fmol(a1, 360) > 180 ? 1 : -1, fmol(a2, 360) - fmol(a1, 360) > 180 ? a1 + 90 : a1 - 90, 6, pts);
        }
    } else {
        pts.push(`${wid * sin(a[1]) + len * cos(a[1])},${-wid * cos(a[1]) + len * sin(a[1])}`);
        pts.push(`${r0 * sin(a[0]) + x0},${-r0 * cos(a[0]) + y0}`);
        pts.push(`${x0 + r0 * cos(a1 + 180)},${y0 + r0 * sin(a1 + 180)}`);
        return pts;
    }
}

// ========== 原有 tile() 函数（保留） ==========
export function tile(ang1, ang2, wid, len, color1, color2, mr) {
    const pts = CaculatePoints(ang1, ang2, wid, len, mr);
    let points = '';
    for (let i = 0; i < pts.length; i++) points += pts[i] + ' ';

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("width", String(4 * Math.max(len, wid)));
    svg.setAttribute("height", String(4 * Math.max(len, wid)));

    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", `translate(${2 * Math.max(len, wid)},${2 * Math.max(len, wid)})`);
    svg.appendChild(g);

    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", String(-2 * Math.max(len, wid)));
    rect.setAttribute("y", String(-2 * Math.max(len, wid)));
    rect.setAttribute("width", String(4 * Math.max(len, wid)));
    rect.setAttribute("height", String(4 * Math.max(len, wid)));
    rect.setAttribute("fill-opacity", "0");
    g.appendChild(rect);

    const polygon = document.createElementNS(svgNS, "polygon");
    polygon.setAttribute("points", points);
    polygon.setAttribute("fill", color1);
    polygon.setAttribute("stroke", color2);
    polygon.setAttribute("stroke-width", String(wid * 0.1));
    g.appendChild(polygon);

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
}

// ========== 随机纹理矩阵 ==========
function randomTextureMatrix() {
    const matrix = new PIXI.Matrix();
    matrix.scale(5 + Math.random() * 2, 5 + Math.random() * 2);
    matrix.rotate(Math.random() * Math.PI * 2);
    matrix.translate(Math.random(), Math.random());
    return matrix;
}

// 颜色转整数
function colorToInt(hex) {
    if (!hex) return 0xffffff;
    if (hex.startsWith('#')) hex = hex.slice(1);
    return parseInt(hex, 16);
}

// ========== 核心函数：tileToGraphics ==========
export function tileToGraphics(ang1, ang2, wid, len, fillColor, strokeColor, mr) {
    const shapeKey = `${ang1}_${ang2}_${wid}_${len}_${mr}`;
    const pointsArray = (() => {
        const pts = CaculatePoints(ang1, ang2, wid, len, mr);
        return pts.map(p => {
            const [x, y] = p.split(',').map(Number);
            return { x, y };
        });
    })();
    // 计算 pointsArray 的包围盒中心
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { x, y } of pointsArray) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // --- 填充纹理（纯色模式用） ---
    let fillTexture = geometryCache.get(shapeKey);
    if (!fillTexture && renderer) {
        const temp = new PIXI.Graphics();
        temp.fill({ color: 0xffffff });
        temp.moveTo(pointsArray[0].x, pointsArray[0].y);
        for (let i = 1; i < pointsArray.length; i++) temp.lineTo(pointsArray[i].x, pointsArray[i].y);
        temp.closePath();
        temp.fill();
        fillTexture = renderer.generateTexture(temp);
        temp.destroy();
        geometryCache.set(shapeKey, fillTexture);
    }

    // --- 容器 ---
    const container = new PIXI.Container();

    // 当前模式标记
    container._useTexture = false;    // 默认纯色模式
    container._fillObj = null;       // 填充显示对象（Sprite 或 Graphics）
    container._strokeObj = null;     // 描边 Graphics（始终保持为 Graphics）

    // --- 初始绘制 ---
    function createFillPure(fc) {
        if (!fillTexture) return null;
        const spr = new PIXI.Sprite(fillTexture);
        spr.anchor.set(0.5, 0.5);               // 中心锚点
        spr.position.set(centerX, centerY);      // 定位到图形中心
        spr.tint = colorToInt(fc);
        return spr;
    }

    function createStroke(sc) {
        const g = new PIXI.Graphics();
        g.setStrokeStyle({ width: wid * 0.12, color: sc });
        g.moveTo(pointsArray[0].x, pointsArray[0].y);
        for (let i = 1; i < pointsArray.length; i++) g.lineTo(pointsArray[i].x, pointsArray[i].y);
        g.closePath();
        g.stroke();
        return g;
    }

    // 初次使用纯色模式
    if (fillTexture) {
        container._fillObj = createFillPure(fillColor);
        container.addChild(container._fillObj);
    } else {
        // 降级：创建 Graphics 填充
        const g = new PIXI.Graphics();
        g.fill({ color: fillColor });
        g.moveTo(pointsArray[0].x, pointsArray[0].y);
        for (let i = 1; i < pointsArray.length; i++) g.lineTo(pointsArray[i].x, pointsArray[i].y);
        g.closePath();
        g.fill();
        container._fillObj = g;
        container.addChild(g);
    }
    container._strokeObj = createStroke(strokeColor);
    container.addChild(container._strokeObj);
    container.tilematrix = randomTextureMatrix();
    // --- updateColors 方法 ---
    container.updateColors = (newFillColor, newStrokeColor, useTexture = false) => {
        // 1. 处理填充
        if (newFillColor !== undefined) {
            if (useTexture !== container._useTexture) {
                // 模式切换：移除旧填充，创建新填充
                if (container._fillObj) {
                    container.removeChild(container._fillObj);
                    container._fillObj.destroy();
                    container._fillObj = null;
                }
                container._useTexture = useTexture;

                if (!useTexture) {
                    // 纯色模式
                    if (fillTexture) {
                        container._fillObj = createFillPure(newFillColor);
                    } else {
                        const g = new PIXI.Graphics();
                        g.fill({ color: newFillColor });
                        g.moveTo(pointsArray[0].x, pointsArray[0].y);
                        for (let i = 1; i < pointsArray.length; i++) g.lineTo(pointsArray[i].x, pointsArray[i].y);
                        g.closePath();
                        g.fill();
                        container._fillObj = g;
                    }
                } else {
                    // 纹理模式（使用全局 tiletexture）
                    const g = new PIXI.Graphics();
                    const style = tiletexture ? { texture: tiletexture, color: newFillColor ?? 0xffffff, matrix: container.tilematrix } : { color: newFillColor };
                    g.fill(style);
                    g.moveTo(pointsArray[0].x, pointsArray[0].y);
                    for (let i = 1; i < pointsArray.length; i++) g.lineTo(pointsArray[i].x, pointsArray[i].y);
                    g.closePath();
                    g.fill();
                    container._fillObj = g;
                }
                if (container._fillObj) container.addChildAt(container._fillObj, 0);
            } else {
                // 相同模式，只需更新颜色
                if (!useTexture && container._fillObj && container._fillObj.tint !== undefined) {
                    // Sprite 模式，直接改 tint
                    container._fillObj.tint = colorToInt(newFillColor);
                } else if (container._fillObj instanceof PIXI.Graphics) {
                    // Graphics 模式，需要重绘（纹理或纯色）
                    container._fillObj.clear();
                    if (useTexture && tiletexture) {
                        container._fillObj.fill({ texture: tiletexture, color: newFillColor ?? 0xffffff, matrix: container.tilematrix });
                    } else {
                        container._fillObj.fill({ color: newFillColor });
                    }
                    container._fillObj.moveTo(pointsArray[0].x, pointsArray[0].y);
                    for (let i = 1; i < pointsArray.length; i++) container._fillObj.lineTo(pointsArray[i].x, pointsArray[i].y);
                    container._fillObj.closePath();
                    container._fillObj.fill();
                }
            }
        }

        // 2. 处理描边
        if (newStrokeColor !== undefined) {
            container._strokeObj.clear();
            container._strokeObj.setStrokeStyle({ width: wid * 0.12, color: newStrokeColor });
            container._strokeObj.moveTo(pointsArray[0].x, pointsArray[0].y);
            for (let i = 1; i < pointsArray.length; i++) container._strokeObj.lineTo(pointsArray[i].x, pointsArray[i].y);
            container._strokeObj.closePath();
            container._strokeObj.stroke();
        }
    };

    return container;
}