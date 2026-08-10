/**
 * 异步输入系统。
 *
 * 目的：判定精度不受浏览器帧率/装饰物/渲染负载影响。
 * 方案：在 keydown/keyup 事件派发瞬间用 performance.now() 记录高精度时间戳，
 * 入队后由游戏循环按事件时间戳统一处理。即使某帧卡顿，按键的
 * "发生时刻" 也已精确锁定，处理时通过时间戳换算成关卡时间即可。
 *
 * 注意：performance.now() 与 AudioContext.currentTime 均随真实时间推进，
 * 二者偏移恒定，可在处理时互相换算（见 Player.getElapsedTimeAt）。
 */

export type AsyncInputType = 'down' | 'up';

export interface AsyncInputEvent {
  type: AsyncInputType;
  perfTime: number; // performance.now() 时刻
}

export class AsyncInputManager {
  private queue: AsyncInputEvent[] = [];
  private attached: boolean = false;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    // 排除纯修饰键（Ctrl/Shift/Alt/Meta）与编辑器/UI 快捷键组合
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.queue.push({ type: 'down', perfTime: performance.now() });
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.queue.push({ type: 'up', perfTime: performance.now() });
  };

  public attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
  }

  public detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('keyup', this.onKeyUp, { capture: true });
  }

  /** 取出并清空队列（单遍遍历，无嵌套循环）。 */
  public drain(): AsyncInputEvent[] {
    if (this.queue.length === 0) return EMPTY;
    const q = this.queue;
    this.queue = [];
    return q;
  }

  public get pendingCount(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue.length = 0;
  }
}

const EMPTY: AsyncInputEvent[] = [];
