/**
 * 异步输入 Worker。
 *
 * 关键约束：Worker 收不到 DOM 事件，键盘/指针只能在主线程捕获。所以主线程只负责在
 * 事件派发瞬间打 `performance.now()` 时间戳并 `postMessage` 转发，Worker 维护队列、
 * 用微任务合并成一批回传，主线程游戏循环照旧同步 `drain()`。
 */

type InputType = 'down' | 'up';

interface EventMessage {
    kind: 'event';
    type: InputType;
    perfTime: number;
}

interface ClearMessage {
    kind: 'clear';
}

type InMessage = EventMessage | ClearMessage;

interface BatchMessage {
    kind: 'batch';
    events: { type: InputType; perfTime: number }[];
}

let queue: { type: InputType; perfTime: number }[] = [];
let flushScheduled = false;

function flush(): void {
    flushScheduled = false;
    if (queue.length === 0) return;
    const events = queue;
    queue = [];
    postBatch({ kind: 'batch', events });
}

function scheduleFlush(): void {
    if (flushScheduled) return;
    flushScheduled = true;
    // 微任务把同一轮投递的多个事件合并成一批（无 DOM 时 queueMicrotask 仍可用）。
    queueMicrotask(flush);
}

/** 收窄的 postMessage：Window.postMessage 的 DOM 签名带 targetOrigin，不适用于 Worker 全局。 */
const postBatch = (msg: BatchMessage): void => {
    (self as unknown as { postMessage(m: BatchMessage): void }).postMessage(msg);
};

self.onmessage = (e: MessageEvent<InMessage>) => {
    const msg = e.data;
    if (!msg) return;
    if (msg.kind === 'clear') {
        queue.length = 0;
        return;
    }
    if (msg.kind === 'event') {
        queue.push({ type: msg.type, perfTime: msg.perfTime });
        scheduleFlush();
    }
};
