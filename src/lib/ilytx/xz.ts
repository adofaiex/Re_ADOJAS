/**
 * xz 主线程 API：分块并行压缩（progress 可见）+ 整流解压。
 *
 * 压缩：tar 字节流切成 chunkSize 分片 → worker 池并行压成独立 xz 流 → 拼接
 * （concatenated streams，解压端一次还原）。进度按"完成分片数"回报。
 *
 * 解压：优先单 worker 整体解压（0.3s 级）；worker 不可用/失败时自动回退
 * 主线程（xzDecompressMain）。两条路都不 detach 调用方的输入。
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

/** 单次调用看门狗：worker 被杀（崩溃/OOM）时永远不会有响应，超时即失败，避免页面永久卡在进度条上。 */
const CALL_TIMEOUT_MS = 120_000

/** 向 worker 发一次请求（等待对应 id 的响应；超时/出错则 reject）。 */
function call(
  worker: Worker,
  payload: { id: number; op: string; bytes: Uint8Array; level?: number },
  timeoutMs: number = CALL_TIMEOUT_MS
): Promise<XzResponse> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
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
      if (timer !== undefined) clearTimeout(timer)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    timer = setTimeout(() => {
      cleanup()
      reject(new Error(`xz worker timeout (${timeoutMs}ms)`))
    }, timeoutMs)
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    // 压缩分片是用完即弃的副本 → transfer 避免主线程多持有；
    // 解压输入不 transfer —— worker 失败回退主线程时还要用原件。
    const transfer: Transferable[] = payload.op === 'compress' ? [payload.bytes.buffer as ArrayBuffer] : []
    worker.postMessage(payload, transfer)
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
 * worker 优先，任何 worker 问题自动回退主线程 —— 调用方无感知，导出文件永远能导回来。
 * `data` 不会被 detach。
 */
export async function xzDecompress(data: Uint8Array, onProgress?: (percent: number) => void): Promise<Uint8Array> {
  if (typeof Worker !== 'undefined') {
    let worker: Worker | undefined
    try {
      worker = createWorker()
      onProgress?.(5)
      const res = await call(worker, { id: 0, op: 'decompress', bytes: data })
      if (res.ok && res.bytes) {
        onProgress?.(100)
        return res.bytes
      }
      throw new Error(res.error || 'xz decompress failed')
    } catch (err) {
      // worker 不可用（CSP/构造失败）/ 被杀 / 超时 → 回退主线程（data 未被 transfer，原件完好）
      console.warn('[ilytx] xz worker decompress failed, falling back to main thread:', err)
    } finally {
      worker?.terminate()
    }
  }
  return xzDecompressMain(data, onProgress)
}

/** 解压内存上限：tar = ilybin + 音频 + 装饰图，极端情况给足余量。 */
const DECOMPRESS_MEM_LIMIT = 1024 * 1024 * 1024

/** 主线程回退解压（Worker 不可用时）。`data` 不会被 detach。 */
export async function xzDecompressMain(data: Uint8Array, onProgress?: (percent: number) => void): Promise<Uint8Array> {
  onProgress?.(5)
  const { initWasm, decompress } = await import('lzma-wasm')
  await initWasm()
  const out = decompress(data, { memLimit: DECOMPRESS_MEM_LIMIT })
  onProgress?.(100)
  return out
}

const yieldToUI = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * 主线程回退压缩（Worker 不可用 / worker 池出错时）。
 * 与 xzCompress 同样的分块拼接策略，但每块之间让出事件循环 ——
 * 压缩期间进度条与页面仍然响应，而不是整页冻结。
 */
export async function xzCompressMain(data: Uint8Array, opts: XzCompressOptions = {}): Promise<Uint8Array> {
  const level = opts.level ?? 6
  const chunkSize = opts.chunkSize ?? 4 * 1024 * 1024
  const total = Math.max(1, Math.ceil(data.length / chunkSize))

  const { initWasm, compress } = await import('lzma-wasm')
  await initWasm()

  const parts = new Array<Uint8Array>(total)
  for (let i = 0; i < total; i++) {
    const start = i * chunkSize
    const chunk = data.subarray(start, Math.min(start + chunkSize, data.length))
    parts[i] = compress(chunk, { format: 'xz', level })
    opts.onProgress?.(i + 1, total)
    if (i < total - 1) await yieldToUI()
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
