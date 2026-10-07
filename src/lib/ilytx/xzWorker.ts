/**
 * xz 压缩/解压 worker。
 *
 * lzma-wasm 的 wasm 以 base64 内嵌在 JS 里（无 fetch），天然满足本项目
 * `file://` 无网络约束；单次调用是同步的，所以放在 worker 里跑，主线程不卡。
 *
 * 压缩端：每个消息独立压一个 tar 分片，产出独立 xz 流 —— 主线程拼接后仍是
 * 合法的 concatenated xz stream（xz 规范原生支持），解压端一次调用还原。
 */

import { initWasm, compress, decompress } from 'lzma-wasm'

export interface XzRequest {
  id: number
  op: 'compress' | 'decompress'
  bytes: Uint8Array
  /** 仅 compress：xz 等级 1-9 */
  level?: number
}

export interface XzResponse {
  id: number
  ok: boolean
  bytes?: Uint8Array
  error?: string
}

// 解压内存上限：tar = ilybin + 音频 + 装饰图，极端情况给足余量
const DECOMPRESS_MEM_LIMIT = 1024 * 1024 * 1024

const ready = initWasm()

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<XzRequest>) => void) | null
  postMessage(message: XzResponse, transfer?: Transferable[]): void
}

ctx.onmessage = (e: MessageEvent<XzRequest>): void => {
  const { id, op, bytes, level } = e.data
  void (async (): Promise<void> => {
    try {
      await ready
      const out =
        op === 'compress'
          ? compress(bytes, { format: 'xz', level: level ?? 6 })
          : decompress(bytes, { memLimit: DECOMPRESS_MEM_LIMIT })
      ctx.postMessage({ id, ok: true, bytes: out }, [out.buffer])
    } catch (err) {
      ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  })()
}
