/**
 * 准度条（Hit Error Meter）—— 还原官方 scrHitErrorMeter。
 *
 * 结构（官方）：
 * - 中间 = Perfect，左右按误差偏移（误差角度归一化到 ±60）
 * - 指针（hand）：averageAngle 用 lerp 平滑（sensitivity 0.2）
 * - 判定痕迹（tick）：每次判定在偏移位置画一条带颜色的短线，tickLife=3s 淡出
 * - 越靠近边界颜色越"宽松"：Perfect 绿 → EPerfect/LPerfect 黄绿 → VeryEarly/VeryLate 红 → TooEarly/TooLate 深红
 *
 * 归一化（官方 AddHit）：angleNorm = 误差角度(deg) × (60 / Counted边界角度)
 * 颜色（官方 CalculateTickColor）：用归一化后的 ±60 与 Perfect/Pure 边界（同样×60/counted）比较。
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

export class HitErrorMeter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr: number = 1;
  private visible: boolean = false;

  private averageAngle: number = 0;
  private ticks: Tick[] = [];

  // 几何
  private cx: number = 0;
  private cy: number = 0;
  private radius: number = 45;

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
    this.cy = h - 40; // 底部偏上（官方 pos y=0.03）
    this.radius = Math.min(w * 0.09, 60);
  }

  /** 是否显示（有判定痕迹或指针非零时） */
  setVisible(v: boolean): void {
    this.visible = v;
  }

  /**
   * 记录一次判定。
   * @param errorAngleDeg 误差角度（度，正=晚，负=早）
   * @param bpmTimesSpeed bpm×speed
   * @param pitch song.pitch
   * @param marginScale 砖块判定缩放
   * @param config 判定配置（难度等）
   */
  addHit(errorAngleDeg: number, bpmTimesSpeed: number, pitch: number, marginScale: number, config: JudgeConfig = {}): void {
    const bounds = getBoundariesInDeg(bpmTimesSpeed, pitch, marginScale, config);
    if (bounds.countedDeg <= 0) return;

    // 归一化到 ±60（官方：angleDiff *= 60/counted）
    let angle = -errorAngleDeg * (60 / bounds.countedDeg);
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

  private draw(): void {
    const ctx = this.ctx;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 半圆弧刻度（-60° ~ +60°）
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, Math.PI * (1 + 60 / 180), Math.PI * (2 - 60 / 180));
    ctx.stroke();

    // 刻度线
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let a = -60; a <= 60; a += 15) {
      const rad = (a / 180) * Math.PI;
      const x1 = this.cx + Math.sin(rad) * (this.radius - 4);
      const y1 = this.cy - Math.cos(rad) * (this.radius - 4);
      const x2 = this.cx + Math.sin(rad) * (this.radius + 4);
      const y2 = this.cy - Math.cos(rad) * (this.radius + 4);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 中心 Perfect 标记
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '8px "Google Sans Code", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PERFECT', this.cx, this.cy - this.radius - 10);

    // ticks（判定痕迹，判定颜色，淡出）
    for (const t of this.ticks) {
      const alpha = Math.max(0, t.life / t.maxLife);
      const rad = (t.angle / 180) * Math.PI;
      const x1 = this.cx + Math.sin(rad) * (this.radius - 10);
      const y1 = this.cy - Math.cos(rad) * (this.radius - 10);
      const x2 = this.cx + Math.sin(rad) * (this.radius + 8);
      const y2 = this.cy - Math.cos(rad) * (this.radius + 8);
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 指针（hand，lerp 平滑）
    const rad = (this.averageAngle / 180) * Math.PI;
    const px = this.cx + Math.sin(rad) * (this.radius - 2);
    const py = this.cy - Math.cos(rad) * (this.radius - 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();

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
