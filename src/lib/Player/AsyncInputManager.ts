/**
 * 异步输入系统（判定架构照抄官方 ADOFAI：SkyHook 时间戳 + Simulated_PlayerControl_Update 逐事件模拟）。
 *
 * 目的：判定精度不受浏览器帧率/装饰物/渲染负载影响——即使帧率降到 1fps 也不吞键。
 * 方案：
 * - 事件时间戳取 `event.timeStamp`（浏览器在事件创建/合成器输入时刻打点，等价官方
 *   SkyHook OS 级时间戳），主线程卡顿不影响精度；事件排队攒着，游戏循环按时间戳
 *   逐个模拟（见 Player.processAsyncInputs），"发生时刻"精确锁定后换算成关卡时间。
 *
 * 可靠性设计（否则会"吞键"/卡键，触屏场景尤其明显）：
 * - 跟踪物理按键/触点状态（heldKeys / heldPointers），只有确实按下的键才允许
 *   产生 'up'：避免组合键、被过滤键产生"裸 up"吃掉按键计数；
 * - 监听 pointercancel：触屏上手势被系统接管、快速连点、息屏时浏览器发
 *   pointercancel 而非 pointerup，必须补发 'up'，否则 Player 的 _keysDown
 *   计数永久偏大，长按松手判定永久失效；
 * - 监听 window blur / visibilitychange(hidden)：按住时切后台/息屏收不到
 *   keyup/pointerup，失焦瞬间为所有按住的键合成 'up'（官方：非焦点 ClearKeys）。
 *
 * 注意：event.timeStamp 与 performance.now() 同一时钟域；与 AudioContext.currentTime
 * 均随真实时间推进，锚点重定位时 Player 会调用 shiftPendingTime 平移在途事件，
 * 保证已入队事件的判定时刻连续不跳（官方 UpdateOffsetTime 平滑校准的等价实现）。
 */

import type { InputQueue } from './types';

export type AsyncInputType = 'down' | 'up';

export interface AsyncInputEvent {
  type: AsyncInputType;
  /** 事件创建时刻（event.timeStamp，与 performance.now() 同一时钟域）。 */
  perfTime: number;
}

export class AsyncInputManager implements InputQueue {
  private queue: AsyncInputEvent[] = [];
  private attached: boolean = false;
  /** 当前按住的物理键（KeyboardEvent.code）。 */
  private heldKeys: Set<string> = new Set();
  /** 当前按住的触点/鼠标（PointerEvent.pointerId）。 */
  private heldPointers: Set<number> = new Set();

  private push(type: AsyncInputType, stamp: number): void {
    this.queue.push({ type, perfTime: stamp });
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    // 排除纯修饰键（Ctrl/Shift/Alt/Meta）与编辑器/UI 快捷键组合
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.heldKeys.add(e.code);
    this.push('down', eventStamp(e));
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    // 只释放确实记录过的键：keydown 被过滤的组合键/修饰键不应产生 'up'
    if (!this.heldKeys.delete(e.code)) return;
    this.push('up', eventStamp(e));
  };

  /** 触控/鼠标指针按下 → 视为 'down' */
  private readonly onPointerDown = (e: PointerEvent) => {
    // 排除编辑器/UI 区域的输入控件
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.heldPointers.add(e.pointerId);
    this.push('down', eventStamp(e));
  };

  /** 触控/鼠标指针释放 → 视为 'up' */
  private readonly onPointerUp = (e: PointerEvent) => {
    if (!this.heldPointers.delete(e.pointerId)) return;
    this.push('up', eventStamp(e));
  };

  /** 浏览器吞掉 pointerup（手势接管/息屏/系统弹窗）时补发释放，防止计数卡死。 */
  private readonly onPointerCancel = (e: PointerEvent) => {
    if (!this.heldPointers.delete(e.pointerId)) return;
    this.push('up', eventStamp(e));
  };

  /** 失焦/切后台会丢 keyup/pointerup → 为所有按住的输入合成释放。 */
  private readonly releaseAllHeld = () => {
    const count = this.heldKeys.size + this.heldPointers.size;
    if (count === 0) return;
    this.heldKeys.clear();
    this.heldPointers.clear();
    const now = performance.now();
    for (let i = 0; i < count; i++) this.push('up', now);
  };

  private readonly onWindowBlur = () => {
    this.releaseAllHeld();
  };

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') this.releaseAllHeld();
  };

  public attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
    window.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    window.addEventListener('pointerup', this.onPointerUp, { capture: true });
    window.addEventListener('pointercancel', this.onPointerCancel, { capture: true });
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  public detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('keyup', this.onKeyUp, { capture: true });
    window.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    window.removeEventListener('pointerup', this.onPointerUp, { capture: true });
    window.removeEventListener('pointercancel', this.onPointerCancel, { capture: true });
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.heldKeys.clear();
    this.heldPointers.clear();
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

  /** 时钟锚点重定位时平移在途事件时间戳，保证已入队事件的换算结果不跳变
   * （等价官方 AsyncInputUtils.UpdateOffsetTime 的平滑 offsetTick 校准）。 */
  public shiftPendingTime(deltaMs: number): void {
    if (deltaMs === 0 || this.queue.length === 0) return;
    for (let i = 0; i < this.queue.length; i++) this.queue[i].perfTime += deltaMs;
  }

  public clear(): void {
    this.queue.length = 0;
    this.heldKeys.clear();
    this.heldPointers.clear();
  }
}

const EMPTY: AsyncInputEvent[] = [];

/**
 * 事件时间戳：优先用 `event.timeStamp`——浏览器在事件创建（触控为合成器输入）时刻
 * 打点，与 `performance.now()` 同一时钟域，主线程卡顿不影响精度。这是官方 ADOFAI
 * SkyHook OS 级时间戳的浏览器等价物；若在 handler 里 dispatch 时再打
 * `performance.now()`，主线程每阻塞一帧（如 7fps ≈ 143ms）所有按键时间戳就系统性
 * 滞后，正是"吞键/判定忽近忽松"的根源。异常值（0/超出当前时刻）回退 dispatch 时刻。
 */
function eventStamp(e: Event): number {
  const ts = e.timeStamp;
  if (typeof ts === 'number' && ts > 0 && ts <= performance.now() + 500) return ts;
  return performance.now();
}
