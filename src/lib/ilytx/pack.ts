/**
 * 主线程侧的打包入口：优先把 ilybin 编码 + tar 打包交给 exportWorker，
 * 任何环节不可用时回退主线程 —— 导出必须在所有环境可用，worker 只是
 * "不卡 UI"的优化，不是前置依赖。
 *
 * 可用性判定 = Worker 构造成功 + ping 在 5s 内应答（file:// 下 module
 * worker 常被 CORS 拦截、CSP 也可能禁用）。
 */

import { encodeIlybin } from './ilybin'
import type { IlybinData } from './ilybin'
import { buildTar } from './tar'
import type { TarEntry } from './tar'
import { MEMBER_LEVEL } from './types'
import type { PackRequest, PackResponse } from './exportWorker'

const PING_TIMEOUT_MS = 5_000
const PACK_TIMEOUT_MS = 180_000

const yieldToUI = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** 向 worker 发一次请求（等待对应 id 的响应；超时/出错 reject）。 */
function callWorker(worker: Worker, req: PackRequest, timeoutMs: number): Promise<PackResponse> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    const onMessage = (e: MessageEvent<PackResponse>): void => {
      if (e.data && e.data.id === req.id) {
        cleanup()
        resolve(e.data)
      }
    }
    const onError = (e: ErrorEvent): void => {
      cleanup()
      reject(e.error ?? new Error(e.message || 'export worker error'))
    }
    timer = setTimeout(() => {
      cleanup()
      reject(new Error(`export worker timeout (${timeoutMs}ms)`))
    }, timeoutMs)
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(req)
  })
}

export interface PackResult {
  tar: Uint8Array
  /** true = 在 worker 完成（主线程无感）；false = 主线程回退 */
  viaWorker: boolean
}

export async function packIlybin(data: IlybinData, entries: TarEntry[]): Promise<PackResult> {
  if (typeof Worker !== 'undefined') {
    let worker: Worker | undefined
    try {
      worker = new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' })
      const pong = await callWorker(worker, { id: 0, op: 'ping' }, PING_TIMEOUT_MS)
      if (!pong.ok) throw new Error(pong.error || 'ping failed')

      const res = await callWorker(worker, { id: 1, op: 'pack', data, entries }, PACK_TIMEOUT_MS)
      if (!res.ok || !res.bytes) throw new Error(res.error || 'pack failed')
      return { tar: res.bytes, viaWorker: true }
    } catch (err) {
      console.warn('[ilytx] worker pack unavailable, falling back to main thread:', err)
    } finally {
      worker?.terminate()
    }
  }

  // 主线程回退：编码 + 打包前后各让出一次事件循环，避免与进度渲染抢帧
  await yieldToUI()
  const ilybin = encodeIlybin(data)
  const tar = buildTar([...entries, { name: MEMBER_LEVEL, data: ilybin }])
  await yieldToUI()
  return { tar, viaWorker: false }
}
