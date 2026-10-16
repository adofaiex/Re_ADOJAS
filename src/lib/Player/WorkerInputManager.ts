import { AsyncInputManager } from './AsyncInputManager';

/**
 * "Worker 输入方式" 的兼容实现。
 *
 * 历史：早期实现把主线程捕获的 DOM 事件 postMessage 转发到 Worker 排队，
 * Worker 用微任务合并成批再回传主线程 mailbox。
 *
 * 已移除 Worker 数据通路，原因：
 * - Worker 线程是单点故障：移动端浏览器在内存压力下会直接杀死 Worker 线程
 *   （本应用同时运行 WebGL 渲染、WebAudio、音效合成 Worker，压力尤其大），
 *   此后 postMessage 静默失败，无 onerror/重建/兜底，输入整体死亡；
 * - 队列本身没有可并行的计算量，转发只是纯增两次 postMessage 往返延迟
 *   （主线程卡顿时会进一步放大），并无精度收益——事件时间戳在主线程
 *   派发瞬间就已打定，本地队列同样精确；
 * - Worker 往返引入 clear() 与在途 batch 的竞态，重开一局可能收到幻影按键。
 *
 * 现与 AsyncInputManager 同契约（含 pointercancel / 失焦释放等可靠性修复），
 * 保留类名与设置项以兼容既有配置。
 */
export class WorkerInputManager extends AsyncInputManager { }
