export class OverlayHUD {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr: number = 1;

  private fps: number = 0;
  private time: number = 0;
  private tileIndex: number = 0;
  private totalTiles: number = 0;
  private tileBPM: number[] = [];
  private tileStartTimes: number[] = [];
  private countdownText: string = '';
  private marginCounts: number[] = [];
  private xAcc: number = 1;

  private readonly p = 8;
  private readonly lh = 18;
  private readonly fs = 13;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
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
  }

  update(stats: {
    fps: number;
    time: number;
    tileIndex: number;
    tileBPM: number[];
    tileStartTimes: number[];
    totalTiles: number;
    countdownText?: string;
    marginCounts?: number[];
    xAcc?: number;
  }): void {
    this.fps = stats.fps;
    this.time = stats.time;
    this.tileIndex = stats.tileIndex;
    this.totalTiles = stats.totalTiles;
    this.tileBPM = stats.tileBPM;
    this.tileStartTimes = stats.tileStartTimes;
    this.countdownText = stats.countdownText ?? '';
    this.marginCounts = stats.marginCounts ?? [];
    this.xAcc = stats.xAcc ?? 1;
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.drawFPS(ctx, w, h);
    this.drawPanel(ctx, w, h, this.computeText());
    this.drawCountdown(ctx, w, h);
    this.drawMargins(ctx, w, h);

    ctx.restore();
  }

  /** 判定统计：各判定等级计数 + XAcc（官方配色）。 */
  private drawMargins(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const c = this.marginCounts;
    if (!c || c.length === 0) return;
    const labels: Array<[string, number, string]> = [
      ['Perfect', 3, '#5dde5d'],
      ['EPerfect', 2, '#d4d648'],
      ['LPerfect', 4, '#d4d648'],
      ['Early', 1, '#ff4545'],
      ['Late', 5, '#ff4545'],
      ['TooEarly', 0, '#cf3030'],
      ['TooLate', 6, '#cf3030'],
      ['Miss', 8, '#b77ef2'],
    ];
    const px = 16;
    let py = 64 + 18 + 10;
    const lh = 16;
    ctx.font = `${12}px "Google Sans Code"`;
    ctx.textBaseline = 'top';
    for (const [label, idx, color] of labels) {
      const count = c[idx] ?? 0;
      if (count === 0) continue;
      ctx.fillStyle = color;
      ctx.fillText(`${label}  ${count}`, px, py);
      py += lh;
    }
    // XAcc
    py += 4;
    const xacc = (this.xAcc * 100).toFixed(2);
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${14}px "Google Sans Code"`;
    ctx.fillText(`XAcc  ${xacc}%`, px, py);
  }

  /** 倒计时居中大字（3 / 2 / 1 / GO）。 */
  private drawCountdown(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.countdownText) return;
    const isGo = this.countdownText === 'GO';
    const fontPx = Math.min(w, h) * (isGo ? 0.15 : 0.22);
    ctx.font = `bold ${fontPx}px "Google Sans Code", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = fontPx * 0.12;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(this.countdownText, w / 2, h / 2);
    ctx.fillStyle = isGo ? '#5dde5d' : '#ffffff';
    ctx.fillText(this.countdownText, w / 2, h / 2);
    ctx.textAlign = 'start';
  }

  private drawFPS(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const text = `FPS  ${this.fps.toFixed(2)}`;
    ctx.font = `${this.fs}px "Google Sans Code"`;
    const tw = ctx.measureText(text).width;
    const x = 16;
    const y = 64;
    const bw = tw + this.p * 2;
    const bh = this.lh + this.p;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, bw, bh);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + this.p, y + bh / 2);
  }

  private drawPanel(ctx: CanvasRenderingContext2D, w: number, h: number, text: string): void {
    const lines = text.split('\n');
    ctx.font = `${this.fs}px "Google Sans Code"`;
    let maxW = 0;
    for (const l of lines) {
      const m = ctx.measureText(l).width;
      if (m > maxW) maxW = m;
    }
    const px = w - maxW - this.p * 2 - 16;
    const py = 64;
    const pw = maxW + this.p * 2;
    const ph = lines.length * this.lh + this.p * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px, py, pw, ph);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], px + this.p, py + this.p + i * this.lh);
    }
  }

  private computeText(): string {
    const { tileIndex, time, totalTiles, tileBPM, tileStartTimes } = this;

    const tbpm = tileBPM[tileIndex] ?? 0;
    let cbpm = tbpm;
    if (tileIndex < totalTiles - 1 && tileIndex >= 0 && tileStartTimes.length > tileIndex + 1) {
      const tCurrent = tileStartTimes[tileIndex] ?? 0;
      const tNext = tileStartTimes[tileIndex + 1] ?? 0;
      const dt = tNext - tCurrent;
      if (dt > 0) cbpm = 60 / dt;
    }

    const timeInLevelSec = Math.max(0, time / 1000);
    const totalMapTime =
      tileStartTimes.length > 0 ? (tileStartTimes[tileStartTimes.length - 1] ?? 0) : 0;
    const currentMapTime = Math.min(timeInLevelSec, totalMapTime);
    const mapTime = `${formatTimePrecise(currentMapTime)}~${formatTimePrecise(totalMapTime)}`;

    const safeTile = Math.min(tileIndex + 1, totalTiles);
    const pct = totalTiles > 0 ? (safeTile / totalTiles) * 100 : 0;
    const tiles = `${safeTile} / ${totalTiles} (${pct.toFixed(1)}%)`;

    return `TBPM | ${tbpm.toFixed(2)}\nCBPM | ${cbpm.toFixed(2)}\nMap Time | ${mapTime}\nTiles | ${tiles}`;
  }

  dispose(): void {
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

function formatTimePrecise(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const sFloat = seconds % 60;
  const s = Math.floor(sFloat);
  const d = Math.floor((sFloat - s) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${d}`;
}
