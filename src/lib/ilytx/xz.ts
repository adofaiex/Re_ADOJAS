/**
 * xz 主线程 API：分块并行压缩（progress 可见）+ 整流解压。
 *
 * 压缩：tar 字节流切成 chunkSize 分片 → worker 池并行压成独立 xz 流 → 拼接
 * （concatenated streams，解压端一次还原）。进度按"完成分片数"回报。
 *
 * 解压：单 worker 整体解压（0.3s 级），调用方的输入 buffer 会被转移（detach），
 * 调用后不要继续持有。
 */

export interface XzCompressOptions {
  /** xz 等级：1 快 / 3 均衡 / 6 最小体积（默认 6） */
  level?: 1 | 3 | 6 | 9
  /** 分片大小（默认 4MB —— 决定进度粒度与并行度） */
  chunkSize?: number
  workerCount?: number
  onProgress?: (doneChunks: number, totalChunks: number) => void
}

interface XzResponse {
  id: number
  ok: boolean
  bytes?: Uint8Array
  error?: string
}

function createWorker(): Worker {
  return new Worker(new URL('./xzWorker.ts', import.meta.url), { type: 'module' })
}

/** 向 worker 发一次请求（等待对应 id 的响应）。 */
function call(worker: Worker, payload: { id: number; op: string; bytes: Uint8Array; level?: number }): Promise<XzResponse> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<XzResponse>): void => {
      if (e.data && e.data.id === payload.id) {
        cleanup()
        resolve(e.data)
      }
    }
    const onError = (e: ErrorEvent): void => {
      cleanup()
      reject(e.error ?? new Error(e.message || 'xz worker error'))
    }
    const cleanup = (): void => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(payload, [payload.bytes.buffer as ArrayBuffer])
  })
}

function defaultWorkerCount(chunkCount: number): number {
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
  return Math.max(1, Math.min(4, chunkCount, cores - 1))
}

/** 分块并行 xz 压缩。`data` 会被分片复制，原 buffer 不受影响。 */
export async function xzCompress(data: Uint8Array, opts: XzCompressOptions = {}): Promise<Uint8Array> {
  const level = opts.level ?? 6
  const chunkSize = opts.chunkSize ?? 4 * 1024 * 1024
  const total = Math.max(1, Math.ceil(data.length / chunkSize))
  const workerCount = opts.workerCount ?? defaultWorkerCount(total)

  if (total === 1) {
    // 单分片：无需池化
    const worker = createWorker()
    try {
      const copy = data.slice()
      const res = await call(worker, { id: 0, op: 'compress', bytes: copy, level })
      if (!res.ok || !res.bytes) throw new Error(res.error || 'xz compress failed')
      opts.onProgress?.(1, 1)
      return res.bytes
    } finally {
      worker.terminate()
    }
  }

  const workers = Array.from({ length: Math.min(workerCount, total) }, createWorker)
  const parts = new Array<Uint8Array>(total)
  let next = 0
  let done = 0
  let failure: unknown = null

  const runWorker = async (worker: Worker): Promise<void> => {
    try {
      for (;;) {
        if (failure) return
        const idx = next++
        if (idx >= total) return
        const start = idx * chunkSize
        const chunk = data.subarray(start, Math.min(start + chunkSize, data.length)).slice()
        const res = await call(worker, { id: idx, op: 'compress', bytes: chunk, level })
        if (!res.ok || !res.bytes) throw new Error(res.error || `xz compress failed at chunk ${idx}`)
        parts[idx] = res.bytes
        done++
        opts.onProgress?.(done, total)
      }
    } catch (err) {
      failure = err
      throw err
    } finally {
      worker.terminate()
    }
  }

  try {
    await Promise.all(workers.map(runWorker))
  } catch (err) {
    throw failure ?? err
  }

  let outLen = 0
  for (const p of parts) outLen += p.length
  const out = new Uint8Array(outLen)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/**
 * 整流 xz 解压（支持 concatenated 分块流）。
 * `data` 会被转移给 worker（detach），调用后不要继续持有。
 */
export async function xzDecompress(data: Uint8Array, onProgress?: (percent: number) => void): Promise<Uint8Array> {
  const worker = createWorker()
  try {
    onProgress?.(5)
    const res = await call(worker, { id: 0, op: 'decompress', bytes: data })
    if (!res.ok || !res.bytes) throw new Error(res.error || 'xz decompress failed')
    onProgress?.(100)
    return res.bytes
  } finally {
    worker.terminate()
  }
}
