import {
  Mesh, BufferGeometry, ShaderMaterial, BufferAttribute, Color, CustomBlending,
  OneFactor,
} from 'three';

/**
 * 行星拖尾 —— 软圆点拖尾（tailParticles）：
 * 不是连续 ribbon，而是一串"软圆点"四边形：
 *   - 每个发射点散布 Bb=3 个子粒子（1 个在原点、2 个在 Vb*scale 半径内随机）
 *   - 每个粒子寿命 yf = 0.74s，尺寸按 jb 衰减、亮度 Xl→zb 递减、alpha Nb*(1-u)
 *   - 片元用一个程序化高斯+羽毛+轻微噪声的软圆遮罩，输出预乘 alpha
 * 复刻沿用"历史采样点"驱动：把采样点当作发射点（旧→新），按窗口时长推年龄。
 */

// 拖尾常量（yf/Nb/Bb/Ub/Vb/Gb/Xl/zb/jb）
const TRAIL_LIFETIME = 0.74;        // yf = 74e4 µs
const ALPHA_BASE = 0.22;            // Nb
const SCATTER_COUNT = 3;            // Bb
// Ub：单个软点尺寸倍率。1.28 在本项目世界单位下偏窄（球直径 0.44），
// 这里放大到 2.2 让拖尾宽度接近球径。
const SIZE_MUL = 2.2;               // Ub (基准 1.28)
const SCATTER_RADIUS_FACTOR = 0.2;  // Vb
/** xf：行星每移动 $l 就补一个发射点（否则快速移动时点之间会断开）。 */
const EMIT_MIN_DIST = 0.058;        // $l
/** 单帧内最多补几个发射点（Hb=2 偏小，这里放宽一点让轨迹连续）。 */
const MAX_SUB_EMIT = 6;
const SPREAD_LIFETIME = 0.7;        // Gb
const BRIGHT_START = 0.5;           // Xl
const BRIGHT_END = 0.3;             // zb
const SIZE_DECAY = 0.503937;        // jb

const VERT = `
attribute vec4 trailColor;
attribute vec2 trailUv;
varying vec4 vTrailColor;
varying vec2 vTrailUv;
void main() {
  vTrailColor = trailColor;
  vTrailUv = trailUv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
varying vec4 vTrailColor;
varying vec2 vTrailUv;
void main() {
  vec2 centered = vTrailUv * 2.0 - 1.0;
  float dist = length(centered);
  float gaussian = exp(-dist * dist * 2.05);
  float feather = 1.0 - smoothstep(0.68, 1.16, dist);
  float cloudNoise = 0.88 + 0.07 * sin(vTrailUv.x * 17.0 + vTrailUv.y * 31.0)
                          + 0.05 * sin(vTrailUv.x * 43.0 - vTrailUv.y * 19.0);
  float softAlpha = gaussian * feather * cloudNoise;
  float alpha = vTrailColor.a * softAlpha;
  if (alpha <= 0.0005) discard;
  gl_FragColor = vec4(vTrailColor.rgb * alpha, alpha);
}
`;

/** `Ai()` 的 sin-hash（确定性散布）。 */
function hash(n: number): number {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

export class PlanetTrail {
  public mesh: Mesh;
  private geometry: BufferGeometry;
  private material: ShaderMaterial;
  private planetRadius: number;
  private color: Color = new Color(0xffffff);

  constructor(color: Color, planetRadius: number) {
    this.planetRadius = planetRadius;
    this.color.copy(color);
    this.geometry = new BufferGeometry();

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      // 片元输出预乘 alpha；拖尾是发光带 → 加法混合（One/One），重叠处叠加变亮
      // （否则 One/OneMinusSrcAlpha 会是一条很暗的带子，看着"不明显"）。
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneFactor,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
  }

  /**
   * 由历史采样点（旧→新，XY 对）构建拖尾：每个采样点作为发射点，
   * 按 `Wl` 散布 Bb 个子粒子、按 `Kb` 生成四边形。
   */
  setPoints(xy: Float64Array): void {
    const n = xy.length >> 1;
    if (n < 2) { this.mesh.visible = false; return; }

    // 1) 把"每帧一个采样点"加密成发射点：相邻点距离超过 EMIT_MIN_DIST 时插值补点，
    //    否则快速移动时软点之间会断开（同样按最小步长补发射点）。
    const emitX: number[] = [];
    const emitY: number[] = [];
    const emitU: number[] = [];
    for (let s = 0; s < n; s++) {
      const x = xy[s * 2];
      const y = xy[s * 2 + 1];
      // 采样点顺序为旧→新：最后一个是最新（u=0），第一个最旧（u≈1）
      const u = (n - 1 - s) / (n - 1);
      if (s > 0) {
        const px = xy[(s - 1) * 2];
        const py = xy[(s - 1) * 2 + 1];
        const uPrev = (n - 1 - (s - 1)) / (n - 1);
        const d = Math.hypot(x - px, y - py);
        const sub = Math.min(MAX_SUB_EMIT, Math.max(0, Math.ceil(d / EMIT_MIN_DIST) - 1));
        for (let k = 1; k <= sub; k++) {
          const f = k / (sub + 1);
          emitX.push(px + (x - px) * f);
          emitY.push(py + (y - py) * f);
          emitU.push(uPrev + (u - uPrev) * f);
        }
      }
      emitX.push(x);
      emitY.push(y);
      emitU.push(u);
    }

    const pos: number[] = [];
    const col: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const c = this.color;
    const r = this.planetRadius;

    // 2) 每个发射点散布 Bb 个子粒子并生成软圆点四边形
    for (let s = 0; s < emitX.length; s++) {
      const x = emitX[s];
      const y = emitY[s];
      const age = emitU[s];

      for (let a = 0; a < SCATTER_COUNT; a++) {
        // 发射点的 seed（去掉时间项 → 散布稳定）
        const seed = x * 37.719 + y * 19.173 + r * 101.113 + (s * SCATTER_COUNT + a) * 3.917;
        const ang = hash(seed + a * 2 + 0.13) * Math.PI * 2;
        const rnd = hash(seed + a * 2 + 1.79);
        // a=0 精确落在发射点；其余散布在 0.18~0.68 × (radius*Vb)
        const spread = a === 0 ? 0 : (a % 3 === 0 ? 0.52 + rnd * 0.2 : 0.18 + Math.sqrt(rnd) * 0.5);
        const off = spread * (r * SCATTER_RADIUS_FACTOR);
        // 散布越远 → 寿命越短
        const lifeMul = 1 - spread * (1 - SPREAD_LIFETIME);

        const u = Math.min(1, age / lifeMul);
        const sizeJitter = 0.75 + hash(seed) * 0.55;
        const half = (r * SIZE_MUL * sizeJitter * Math.max(0, 1 - u / SIZE_DECAY)) / 2;
        const bright = BRIGHT_START + (BRIGHT_END - BRIGHT_START) * u;
        const lifeY = 0.45 + 0.55 * lifeMul;
        const alpha = ALPHA_BASE * (1 - u) * lifeY;
        if (alpha <= 0.0005 || half <= 0) continue;

        const px = x + Math.cos(ang) * off;
        const py = y + Math.sin(ang) * off;
        const base = pos.length / 3;

        pos.push(
          px - half, py - half, 0,
          px + half, py - half, 0,
          px + half, py + half, 0,
          px - half, py + half, 0,
        );
        for (let k = 0; k < 4; k++) col.push(c.r * bright, c.g * bright, c.b * bright, alpha);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    if (idx.length === 0) { this.mesh.visible = false; return; }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('trailColor', new BufferAttribute(new Float32Array(col), 4));
    geo.setAttribute('trailUv', new BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();

    this.geometry.dispose();
    this.geometry = geo;
    this.mesh.geometry = geo;
    this.mesh.visible = true;
  }

  setPlanetRadius(radius: number): void { this.planetRadius = radius; }

  /** 更新拖尾颜色（SetPlanetTailColor 等运行时改色） */
  setColor(color: Color): void {
    this.color.copy(color);
  }

  /** SetDepth：拖尾 renderer 也继承装饰的 sorting 层级/顺序。 */
  public setDepthTier(z: number, renderOrder: number): void {
    this.mesh.position.z = z;
    this.mesh.renderOrder = renderOrder;
  }

  dispose(): void { this.geometry.dispose(); this.material.dispose(); }

  clear(): void { this.mesh.visible = false; }
}
