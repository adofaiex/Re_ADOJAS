/**
 * 判定文本展示。
 *
 * 官方行为：判定显示在被打到的砖块上，固定面向上（不随砖块/摄像机旋转改变）。
 * 实现：用 THREE.Sprite（恒面向相机），父级挂到目标砖块 mesh 上 → 跟随砖块位置，
 * 但文本始终垂直于屏幕（面向上）。
 *
 * 性能：文本纹理按判定等级缓存，sprite 复用池，单遍 update 处理淡出。
 */
import { Sprite, SpriteMaterial, CanvasTexture, Mesh, Scene, Vector3 } from 'three';
import { HitMargin } from './Judge';

const TEXT: Record<number, string> = {
  [HitMargin.TooEarly]: '太快！！',
  [HitMargin.VeryEarly]: '太快！',
  [HitMargin.EarlyPerfect]: '稍快！',
  [HitMargin.Perfect]: '完美！',
  [HitMargin.LatePerfect]: '稍慢！',
  [HitMargin.VeryLate]: '太慢！',
  [HitMargin.TooLate]: '太慢！！',
  [HitMargin.Multipress]: '提前',
  [HitMargin.FailMiss]: '错过',
  [HitMargin.FailOverload]: '提前',
  [HitMargin.Auto]: '完美！',
  [HitMargin.OverPress]: '提前',
};

// 官方配色：绿系判定 + 红系失误 + 紫判
const COLOR: Record<number, string> = {
  [HitMargin.TooEarly]: '#cf3030',   // 太快！！ 深红
  [HitMargin.VeryEarly]: '#ff4545',  // 太快！ 浅一点的红
  [HitMargin.EarlyPerfect]: '#d4d648', // 稍快！ 绿带黄
  [HitMargin.Perfect]: '#5dde5d',    // 完美！ 绿
  [HitMargin.LatePerfect]: '#d4d648',// 稍慢！ 绿带黄
  [HitMargin.VeryLate]: '#ff4545',   // 太慢！ 浅一点的红
  [HitMargin.TooLate]: '#cf3030',    // 太慢！！ 深红
  [HitMargin.Multipress]: '#b77ef2', // 提前 紫
  [HitMargin.FailMiss]: '#b77ef2',   // 错过 紫
  [HitMargin.FailOverload]: '#b77ef2', // 提前 紫
  [HitMargin.Auto]: '#5dde5d',       // 完美！
  [HitMargin.OverPress]: '#b77ef2',  // 提前 紫
};

interface ActiveSprite {
  sprite: Sprite;
  material: SpriteMaterial;
  life: number;
  maxLife: number;
}

const CANVAS_W = 256;
const CANVAS_H = 96;
const LIFETIME = 0.7; // 秒
// 判定文字相对砖块的偏移：上方约 0.5 个 tile 单位（官方 camy.up，取半）
const OFFSET_Y = 0.5;
// 文字大小倍率（相对基准尺寸的 1.6 倍）
const SCALE = 1.6;
const BASE_W = 0.9;
const BASE_H = 0.34;

export class JudgmentDisplay {
  private scene: Scene | null = null;
  private pool: ActiveSprite[] = [];       // 所有已创建的 entry（含空闲/活跃）
  private freeList: ActiveSprite[] = [];   // 空闲可复用的 entry
  private active: ActiveSprite[] = [];     // 正在展示中的 entry
  private textureCache: Map<number, CanvasTexture> = new Map();
  private i18n: any = null;

  /** 注入场景（sprite 作为独立节点加入场景，不绑定砖块）。 */
  public setScene(scene: Scene): void {
    this.scene = scene;
  }

  /** 注入 i18n 翻译对象（可选）。清缓存让文本纹理在下次 show 时按新语言生成。 */
  public setI18n(i18n: any): void {
    this.i18n = i18n;
    for (const tex of this.textureCache.values()) tex.dispose();
    this.textureCache.clear();
  }

  /**
   * 在目标砖块位置显示一条判定。
   * 位置取砖块的【世界坐标】（不随砖块后续位移/旋转变化，判定文字固定在世界位置）。
   * 文字位于砖块上方约 OFFSET_Y 个单位。
   */
  public show(tileMesh: Mesh | null, margin: HitMargin): void {
    if (!tileMesh || !this.scene) return;

    // 从空闲列表取，没有则新建（官方每判定预实例化 100 个 → 多个砖块可同时展示）
    let entry = this.freeList.pop();
    if (!entry) {
      const material = new SpriteMaterial({ transparent: true, depthTest: false });
      const sprite = new Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 9999;
      entry = { sprite, material, life: 0, maxLife: LIFETIME };
      this.pool.push(entry);
    }

    const texture = this.getTexture(margin);
    entry.material.map = texture;
    entry.material.color.set(COLOR[margin] ?? '#ffffff');
    entry.material.rotation = 0;
    entry.material.needsUpdate = true;
    entry.life = LIFETIME;
    entry.maxLife = LIFETIME;

    // 固定在世界坐标：砖块当前位置 + 上方偏移。之后不随砖块移动。
    const p = tileMesh.position;
    entry.sprite.position.set(p.x, p.y + OFFSET_Y, p.z + 0.5);
    entry.sprite.scale.set(BASE_W * SCALE, BASE_H * SCALE, 1);
    this.scene.add(entry.sprite);
    entry.sprite.visible = true;

    this.active.push(entry);
  }

  /** 每帧调用，处理淡出。 */
  public update(delta: number): void {
    if (this.active.length === 0) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      entry.life -= delta;
      if (entry.life <= 0) {
        entry.sprite.visible = false;
        if (entry.sprite.parent) entry.sprite.parent.remove(entry.sprite);
        this.active.splice(i, 1);
        this.freeList.push(entry);
        continue;
      }
      // 淡出：后半段透明度下降；前半段保持清晰
      const ratio = entry.life / entry.maxLife;
      entry.material.opacity = ratio < 0.5 ? ratio / 0.5 : 1;
    }
  }

  public clear(): void {
    for (const entry of this.active) {
      entry.sprite.visible = false;
      if (entry.sprite.parent) entry.sprite.parent.remove(entry.sprite);
      this.freeList.push(entry);
    }
    this.active.length = 0;
  }

  public dispose(): void {
    this.clear();
    for (const entry of this.pool) {
      entry.material.dispose();
    }
    for (const tex of this.textureCache.values()) {
      tex.dispose();
    }
    this.textureCache.clear();
    this.pool.length = 0;
  }

  private getTexture(margin: HitMargin): CanvasTexture {
    let tex = this.textureCache.get(margin);
    if (tex) return tex;

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d')!;
    // 尝试 i18n 翻译，回退到英文硬编码
    let text = TEXT[margin] ?? 'PERFECT';
    if (this.i18n) {
      try {
        const key = `HitMargin.${HitMargin[margin]}`;
        const translated = this.i18n.t?.(key);
        if (translated && translated !== key) text = translated.toUpperCase();
      } catch { /* keep fallback */ }
    }
    const color = COLOR[margin] ?? '#ffffff';

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = 'bold 40px "Google Sans Code", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 描边（黑底）；让浅色文字在深色背景上也可读
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W - 16);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W - 16);

    tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;
    this.textureCache.set(margin, tex);
    return tex;
  }
}
