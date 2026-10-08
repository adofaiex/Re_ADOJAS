/**
 * 导出 worker：ilybin 编码 + tar 打包。
 *
 * 677 万砖的 varint 编码 + tar 的百 MB 级 memcpy 如果在主线程做，会把 UI 卡死，
 * 并在大谱面本就内存紧张的场景把页面推过崩溃线。这两步与 Level 无关（数据
 * 已在主线程提取好），所以整体搬进 worker：
 *
 *   - data（IlybinData）走结构化克隆，**不 transfer** —— 紧凑无编辑时
 *     direction/angle/twirl 是 Level 内部 typed array 的视图，transfer 会把
 *     谱面本体 detach 掉；
 *   - entries（manifest/音频/图片）同样克隆，主线程保留原件，
 *     这样 worker 挂掉时还能安全回退主线程重跑。
 *
 * 协议：ping（探测可用性，必须在 5s 内应答）/ pack（编码 + 打包，返回 tar 流）。
 */

import { encodeIlybin } from './ilybin'
import type { IlybinData } from './ilybin'
import { buildTar } from './tar'
import type { TarEntry } from './tar'
import { MEMBER_LEVEL } from './types'

export interface PackRequest {
  id: number
  op: 'ping' | 'pack'
  /** 仅 pack：主线程提取后的谱面数据 */
  data?: IlybinData
  /** 仅 pack：manifest + 音频/图片成员（level.ilybin 由本 worker 追加） */
  entries?: TarEntry[]
}

export interface PackResponse {
  id: number
  ok: boolean
  op: 'ping' | 'pack'
  /** 仅 pack 成功：完整 tar 字节流（buffer transfer 回主线程） */
  bytes?: Uint8Array
  error?: string
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<PackRequest>) => void) | null
  postMessage(message: PackResponse, transfer?: Transferable[]): void
}

ctx.onmessage = (e: MessageEvent<PackRequest>): void => {
  const { id, op, data, entries } = e.data
  if (op === 'ping') {
    ctx.postMessage({ id, ok: true, op })
    return
  }
  try {
    if (!data || !entries) throw new Error('pack: missing data/entries')
    const ilybin = encodeIlybin(data)
    const tar = buildTar([...entries, { name: MEMBER_LEVEL, data: ilybin }])
    ctx.postMessage({ id, ok: true, op, bytes: tar }, [tar.buffer as ArrayBuffer])
  } catch (err) {
    ctx.postMessage({ id, ok: false, op, error: err instanceof Error ? err.message : String(err) })
  }
}
