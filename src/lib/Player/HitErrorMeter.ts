/**
 * 准度条（Hit Error Meter）—— 横向分段判定条 + 三角指针。
 *
 * 布局（SVG 样式）：
 * - 中间 = Perfect（绿），左右依次 Good（黄）→ Bad（橙）→ Miss（红）
 * - 三角符号是判定时间的指针，随 averageAngle 平滑移动
 * - 判定痕迹（tick）：每次判定在判定条上方画一个判定颜色的圆角小长方形，tickLife=3s 淡出
 *
 * 归一化（官方 AddHit）：angleNorm = 误差角度(deg) × (60 / Counted边界角度)
 */
import { getBoundariesInDeg, JudgeConfig, HitMargin } from './Judge';

interface Tick {
  angle: number;      // 归一化角度（±60）
  color: string;
  life: number;       // 剩余生命（秒）
  maxLife: number;
}

const TICK_LIFE = 3.0;     // 官方 tickLife
const SENSITIVITY = 0.2;   // 官方 sensitivity
const MAX_TICKS = 60;

// 判定条分段（与 SVG viewBox 0..520 同比例）：Miss | Bad | Good | Perfect | Good | Bad | Miss
const SEG_FRACS = [12, 60, 65, 240, 65, 60, 12];
const SEG_COLORS = ['#ff0000', '#fca15d', '#ffff00', '#00ff00', '#ffff00', '#fca15d', '#ff0000'];
const BAR_TOTAL = 520;

export class HitErrorMeter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr: number = 1;
  private visible: boolean = false;

  private averageAngle: number = 0;
  private ticks: Tick[] = [];

  // 几何
  private cx: number = 0;     // 屏幕水平中心
  private barW: number = 520; // 判定条总宽
  private barH: number = 20;  // 判定条高度
  private barY: number = 0;   // 判定条顶部 y

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.bottom = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9998';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.canvas.width = Math.ceil(w * this.dpr);
    this.canvas.height = Math.ceil(h * this.dpr);
    this.cx = w / 2;
    this.barW = Math.min(w * 0.44, 380);
    this.barH = 14;
    this.barY = h - 85; // 底部偏上（官方 pos y=0.03）
  }

  /** 是否显示（有判定痕迹或指针非零时） */
  setVisible(v: boolean): void {
    this.visible = v;
  }

  /**
   * 记录一次判定。
   * @param errorAngleDeg 误差角度（度，正=晚/慢，负=早/快）
   * @param bpmTimesSpeed bpm×speed
   * @param pitch song.pitch
   * @param marginScale 砖块判定缩放
   * @param config 判定配置（难度等）
   */
  addHit(errorAngleDeg: number, bpmTimesSpeed: number, pitch: number, marginScale: number, config: JudgeConfig = {}): void {
    const bounds = getBoundariesInDeg(bpmTimesSpeed, pitch, marginScale, config);
    if (bounds.countedDeg <= 0) return;

    // 归一化到 ±60（官方：angleDiff *= 60/counted）
    // 左=早（快），右=晚（慢）：errorAngleDeg 正=晚 → 右
    let angle = errorAngleDeg * (60 / bounds.countedDeg);
    if (angle < -60) angle = -60.0001 - Math.random() * 3;
    if (angle > 60) angle = 60.0001 + Math.random() * 3;

    if (angle >= -60 && angle <= 60) {
      this.averageAngle += (angle - this.averageAngle) * SENSITIVITY;
    }

    const color = this.calcTickColor(angle, bounds);

    // 缓存 tick 池，满了复用最旧的
    const tick: Tick = { angle, color, life: TICK_LIFE, maxLife: TICK_LIFE };
    if (this.ticks.length >= MAX_TICKS) {
      this.ticks.shift();
    }
    this.ticks.push(tick);
    this.visible = true;
  }

  /** 官方 CalculateTickColor：按归一化角度与 Perfect/Pure 边界比较 */
  private calcTickColor(angle: number, bounds: { countedDeg: number; perfectDeg: number; pureDeg: number }): string {
    const perfectN = 60 * (bounds.perfectDeg / bounds.countedDeg);
    const pureN = 60 * (bounds.pureDeg / bounds.countedDeg);
    if (angle < -60) return '#cf3030';
    if (angle < -perfectN) return '#ff4545';
    if (angle < -pureN) return '#d4d648';
    if (angle <= pureN) return '#5dde5d';
    if (angle <= perfectN) return '#d4d648';
    if (angle <= 60) return '#ff4545';
    return '#cf3030';
  }

  /** 归一化角度 → 判定条上的 x 坐标 */
  private angleToX(angle: number): number {
    const clamped = Math.max(-60, Math.min(60, angle));
    return this.cx + (clamped / 60) * (this.barW / 2 - 4);
  }

  /** 每帧：指针平滑 + tick 淡出 */
  update(delta: number): void {
    if (!this.visible && this.ticks.length === 0 && Math.abs(this.averageAngle) < 0.1) return;

    // tick 淡出
    for (let i = this.ticks.length - 1; i >= 0; i--) {
      const t = this.ticks[i];
      t.life -= delta;
      if (t.life <= 0) this.ticks.splice(i, 1);
    }

    this.draw();
    if (this.ticks.length === 0 && Math.abs(this.averageAngle) < 0.05) {
      this.visible = false;
    }
  }

  private roundRectPath(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  private draw(): void {
    const ctx = this.ctx;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const barX = this.cx - this.barW / 2;
    const barY = this.barY;

    // ── 判定条：分段矩形 ──
    let x = barX;
    for (let i = 0; i < SEG_FRACS.length; i++) {
      const segW = (SEG_FRACS[i] / BAR_TOTAL) * this.barW;
      ctx.fillStyle = SEG_COLORS[i];
      ctx.fillRect(x, barY, segW, this.barH);
      x += segW;
    }

    // ── ticks（判定痕迹：判定颜色的圆角小长方形，位于判定条上方，淡出）──
    for (const t of this.ticks) {
      const alpha = Math.max(0, t.life / t.maxLife);
      const tx = this.angleToX(t.angle);
      ctx.fillStyle = t.color;
      ctx.globalAlpha = alpha;
      this.roundRectPath(tx - 4.5, barY - 30, 9, 20, 4.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── 指针（三角符号 = 判定时间的指针，lerp 平滑）──
    const pointerX = this.angleToX(this.averageAngle);

    // 底部向上三角（描边）
    const apexY = barY + this.barH + 8;
    const baseY = barY + this.barH + 19;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pointerX - 11, baseY);
    ctx.lineTo(pointerX, apexY);
    ctx.lineTo(pointerX + 11, baseY);
    ctx.stroke();

    ctx.restore();
  }

  clear(): void {
    this.ticks.length = 0;
    this.averageAngle = 0;
    this.visible = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose(): void {
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
