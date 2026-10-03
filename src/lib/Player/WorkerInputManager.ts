import type { InputQueue } from './types';
import type { AsyncInputEvent } from './AsyncInputManager';

/**
 * Worker 异步输入队列。
 *
 * 主线程捕获 DOM 事件（守卫逻辑与 AsyncInputManager 一致），在事件派发瞬间用
 * `performance.now()` 打时间戳，转发给 Worker 排队；Worker 批量回传后写入本地
 * mailbox。`drain()` 与 AsyncInputManager 保持同步返回契约，游戏循环无需改动。
 */
export class WorkerInputManager implements InputQueue {
    private worker: Worker | null = null;
    private mailbox: AsyncInputEvent[] = [];
    private attached: boolean = false;

    private post(type: 'down' | 'up'): void {
        this.worker?.postMessage({ kind: 'event', type, perfTime: performance.now() });
    }

    private readonly onKeyDown = (e: KeyboardEvent) => {
        if (e.repeat) return;
        // 排除纯修饰键（Ctrl/Shift/Alt/Meta）与编辑器/UI 快捷键组合
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        this.post('down');
    };

    private readonly onKeyUp = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        this.post('up');
    };

    private readonly onPointerDown = (e: PointerEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        this.post('down');
    };

    private readonly onPointerUp = (e: PointerEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        this.post('up');
    };

    public attach(): void {
        if (this.attached) return;
        this.attached = true;
        if (!this.worker) {
            this.worker = new Worker(new URL('./inputWorker.ts', import.meta.url), { type: 'module' });
            this.worker.onmessage = (e: MessageEvent<{ kind: 'batch'; events: AsyncInputEvent[] }>) => {
                const data = e.data;
                if (data && data.kind === 'batch') {
                    const evs = data.events;
                    for (let i = 0; i < evs.length; i++) this.mailbox.push(evs[i]);
                }
            };
        }
        window.addEventListener('keydown', this.onKeyDown, { capture: true });
        window.addEventListener('keyup', this.onKeyUp, { capture: true });
        window.addEventListener('pointerdown', this.onPointerDown, { capture: true });
        window.addEventListener('pointerup', this.onPointerUp, { capture: true });
    }

    public detach(): void {
        if (!this.attached) return;
        this.attached = false;
        window.removeEventListener('keydown', this.onKeyDown, { capture: true });
        window.removeEventListener('keyup', this.onKeyUp, { capture: true });
        window.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
        window.removeEventListener('pointerup', this.onPointerUp, { capture: true });
        // 终止 Worker 线程，避免残留监听/线程；下次 attach 时按需重建。
        this.worker?.terminate();
        this.worker = null;
    }

    public drain(): AsyncInputEvent[] {
        if (this.mailbox.length === 0) return EMPTY;
        const q = this.mailbox;
        this.mailbox = [];
        return q;
    }

    public get pendingCount(): number {
        return this.mailbox.length;
    }

    public clear(): void {
        this.mailbox.length = 0;
        this.worker?.postMessage({ kind: 'clear' });
    }
}

const EMPTY: AsyncInputEvent[] = [];
