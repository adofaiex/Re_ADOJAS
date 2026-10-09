/**
 * .ilytx 体积基准：677w 谱面 ilybin → 各压缩方案对比 + 分段解剖。
 *
 * 回答的问题：
 *   1. xz-L6 是否还有同算法更优档位（L9 / 单流 / 大分块 vs 生产的 4MB 分块）？
 *   2. brotli-q11 / zstd（Node 内置权威实现）能否打赢 lzma-wasm 的 xz-L6？
 *   3. ilybin 各 section 压缩后谁占大头 —— 下一步内容级优化该砍谁？
 *   4. 消融：丢掉 direction 段（导入时重算）能省多少？
 *   5. 生产管线（tar + 音频 + 分块 xz）最终 .ilytx 里音频占多少？
 *
 * 结论（v2 落地）：弃 direction 的路线因破坏分数谱面严格导出等价被否决，
 * 改为弃 angle 段（angle 是 direction+twirl 的纯函数，解码端重建，见
 * ilybin.reconstructAngle）——677w ilybin raw 45.47→19.64MB、
 * xz L6 单流 8.92→4.65MB（-47.9%）。第 4 问的 direction 消融保留供参考
 *（它同时显示 direction 是 v2 之后唯一的大段，进一步压缩只能从它下手）。
 *
 * 谱面生成：seeded PRNG 非周期角度 + 拷贝粘贴段（长程冗余）+ 浮点装饰参数。
 * 注意：不能用模数循环生成（周期病态重复会让所有压缩器撞帧头地板，对比失真）。
 *
 * 运行：ITX_TILES=6770000 node <esbuild-bundled>
 */

import * as ADOFAI from 'adofai'
import * as zlib from 'node:zlib'
import { levelToIlybin } from '../src/lib/ilytx/level.ts'
import { buildTar } from '../src/lib/ilytx/tar.ts'

const SECTION_NAMES: Record<number, string> = {
  1: 'settings', 2: 'direction', 3: 'angle', 5: 'twirl',
  6: 'actions', 7: 'decorations', 8: 'extraProps',
}

function mb(n: number): string {
  return `${(n / 1048576).toFixed(2)}MB`
}
function kb(n: number): string {
  return n < 1024 ? `${n}B` : n < 1048576 ? `${(n / 1024).toFixed(1)}KB` : `${(n / 1048576).toFixed(2)}MB`
}

function mulberry32(seed: number): () => number {
  let t = seed | 0
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** 解析 ilybin 布局（header 12B + section{id u8, len u32, payload}） */
function parseSections(buf: Uint8Array): Array<{ id: number; payload: Uint8Array }> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const magic = String.fromCharCode(buf[0], buf[1], buf[2], buf[3])
  if (magic !== 'ILYB') throw new Error(`bad magic: ${magic}`)
  const count = dv.getUint16(6, true)
  const sections: Array<{ id: number; payload: Uint8Array }> = []
  let off = 12
  for (let i = 0; i < count; i++) {
    const id = buf[off]
    const len = dv.getUint32(off + 1, true)
    sections.push({ id, payload: buf.subarray(off + 5, off + 5 + len) })
    off += 5 + len
  }
  if (off !== buf.length) throw new Error(`section parse ended at ${off}, len ${buf.length}`)
  return sections
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

async function main(): Promise<void> {
  const N = Number(process.env.ITX_TILES ?? 6_770_000)
  console.log(`[size-bench] ${N.toLocaleString()} tiles`)

  // —— 合成谱面：PRNG 非周期 + 拷贝粘贴段 + 浮点装饰 ——
  const rand = mulberry32(0x1a2b3c4d)
  const angleData = new Array<number>(N)
  const actions: Array<Record<string, unknown>> = []
  const decorations: Array<Record<string, unknown>> = []
  let a = 0
  let i = 0
  let copiedTiles = 0
  while (i < N) {
    // 拷贝粘贴段：真实谱面常见（整段复制）。80% 近程(<100k tile)，20% 远程(可达 5M tile)
    if (i > 20000 && rand() < 0.00006) {
      const len = Math.min(1000 + Math.floor(rand() * 9000), N - i)
      const dist = rand() < 0.8
        ? 50_000 + Math.floor(rand() * 50_000)
        : 100_000 + Math.floor(rand() * 4_900_000)
      const src = i - dist
      if (src >= 0 && src + len <= i) {
        for (let k = 0; k < len; k++) angleData[i + k] = angleData[src + k]
        i += len
        copiedTiles += len
        continue
      }
    }
    const r = rand()
    let delta: number
    if (r < 0.15) delta = 0
    else if (r < 0.28) delta = 180
    else if (r < 0.38) delta = 90
    else if (r < 0.46) delta = -90
    else if (r < 0.54) delta = 45
    else if (r < 0.60) delta = -45
    else if (r < 0.72) delta = Math.floor(rand() * 360) - 180
    else delta = (Math.floor(rand() * 21) - 10) / 10 // 分数角 0.1 步进
    if (i % 37 === 5) {
      angleData[i] = 999 // midspin，不改变累计角
    } else {
      a = (a + delta + 360) % 360
      angleData[i] = Math.round(a * 10) / 10
    }
    if (i % 500 === 7) actions.push({ floor: i, eventType: 'Twirl' })
    if (i % 100000 === 11) actions.push({ floor: i, eventType: 'SetSpeed', speedType: 'Multiplier', bpmMultiplier: 1.25 })
    if (i % 500 === 3) decorations.push({
      floor: i, eventType: 'AddDecoration', decorationImage: `deco${i % 7}.png`,
      tag: `d${i % 23}`,
      positionOffset: [Math.round(rand() * 100000) / 100, Math.round(rand() * 100000) / 100],
      opacity: Math.round(rand() * 100) / 100,
      scale: [Math.round((0.5 + rand()) * 100) / 100, Math.round((0.5 + rand()) * 100) / 100],
      rotation: Math.round(rand() * 3600) / 10,
      animation: { definedDuration: Math.round(rand() * 500) / 1000, easing: 'InOutCubic' },
    })
    i++
  }
  const settings = { bpm: 140, song: 'bench', offset: 0, songFilename: 'bench.mp3', artist: 'x', diff: 12 }
  console.log(`  generator: ${((copiedTiles / N) * 100).toFixed(1)}% tiles from copy-paste segments`)

  const level = new ADOFAI.Level({ settings, angleData, actions, decorations } as never, undefined, { compactTiles: true })
  await level.load()

  const t0 = performance.now()
  const ilybin = levelToIlybin(level)
  console.log(`  ilybin raw: ${mb(ilybin.length)} (extract+encode ${(performance.now() - t0).toFixed(0)}ms)\n`)

  // —— 分段解剖 ——
  const sections = parseSections(ilybin)
  console.log('[sections raw]')
  for (const s of sections) {
    console.log(`  ${(SECTION_NAMES[s.id] ?? s.id).padEnd(12)} ${kb(s.payload.length)}`)
  }

  // —— 压缩工具 ——
  const { initWasm, compress: xzRaw, decompress: xzInflate } = await import('lzma-wasm')
  await initWasm()

  const time = <T>(fn: () => T): [T, number] => {
    const t = performance.now()
    const v = fn()
    return [v, performance.now() - t]
  }

  const brotli11 = (buf: Uint8Array): Uint8Array => {
    const view = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
    const params: Record<number, number> = {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    }
    return new Uint8Array(zlib.brotliCompressSync(view, { params }))
  }
  const zstdOf = (buf: Uint8Array, extraParams?: Record<number, number>): Uint8Array => {
    const view = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
    const params: Record<number, number> = { [zlib.constants.ZSTD_c_compressionLevel]: 3 }
    if (extraParams) Object.assign(params, extraParams)
    return new Uint8Array(zlib.zstdCompressSync(view, { params } as never))
  }
  const xzChunked = (buf: Uint8Array, level: 1 | 6, chunkSize: number): Uint8Array => {
    const parts: Uint8Array[] = []
    for (let o = 0; o < buf.length; o += chunkSize) {
      parts.push(xzRaw(buf.subarray(o, Math.min(o + chunkSize, buf.length)), { format: 'xz', level }))
    }
    return concat(parts)
  }

  // —— 整体对比 ——
  console.log('\n[whole ilybin]')
  type Row = { label: string; bytes: Uint8Array; ms: number; kind: 'xz' | 'brotli' | 'zstd' }
  const rows: Row[] = []
  const push = (label: string, kind: Row['kind'], fn: () => Uint8Array): void => {
    const [bytes, ms] = time(fn)
    rows.push({ label, bytes, ms, kind })
    console.log(`  ${label.padEnd(20)} ${mb(bytes.length).padStart(9)}  (${(ms / 1000).toFixed(1)}s)`)
  }
  push('xz L1', 'xz', () => xzRaw(ilybin, { format: 'xz', level: 1 }))
  push('xz L6 single', 'xz', () => xzRaw(ilybin, { format: 'xz', level: 6 }))
  push('xz L6 @4MB(prod)', 'xz', () => xzChunked(ilybin, 6, 4 * 1024 * 1024))
  push('xz L6 @16MB', 'xz', () => xzChunked(ilybin, 6, 16 * 1024 * 1024))
  push('xz L9 single', 'xz', () => xzRaw(ilybin, { format: 'xz', level: 9 }))
  push('brotli q11', 'brotli', () => brotli11(ilybin))
  push('zstd L3 (fast)', 'zstd', () => zstdOf(ilybin))
  push('zstd L19', 'zstd', () => zstdOf(ilybin, { [zlib.constants.ZSTD_c_compressionLevel]: 19 }))
  push('zstd L22+long', 'zstd', () => zstdOf(ilybin, {
    [zlib.constants.ZSTD_c_compressionLevel]: 22,
    [zlib.constants.ZSTD_c_windowLog]: 26,
    [zlib.constants.ZSTD_c_enableLongDistanceMatching]: 1,
  }))

  const best = rows.reduce((x, y) => (y.bytes.length < x.bytes.length ? y : x))
  const worst = rows.reduce((x, y) => (y.bytes.length > x.bytes.length ? y : x))
  console.log(`  best: ${best.label} ${mb(best.bytes.length)} | worst: ${worst.label} ${mb(worst.bytes.length)}`)

  // 往返校验（新候选必须能完整解回）
  {
    const [got, ms] = time(() => {
      if (best.kind === 'brotli') return zlib.brotliDecompressSync(Buffer.from(best.bytes)).length
      if (best.kind === 'zstd') return zlib.zstdDecompressSync(Buffer.from(best.bytes)).length
      return xzInflate(best.bytes, { expectedSize: ilybin.length }).length
    })
    console.log(`  roundtrip(${best.label}): ${got === ilybin.length ? 'OK' : `MISMATCH ${got}`} decompress ${(ms / 1000).toFixed(2)}s`)
  }

  // —— 分段：xz L6（brotli/zstd 与 xz 差距 <2%，不再重复耗时）——
  console.log('\n[per-section: xz L6]')
  let secXz = 0
  for (const s of sections) {
    const xz = xzRaw(s.payload, { format: 'xz', level: 6 }).length
    secXz += xz
    console.log(`  ${(SECTION_NAMES[s.id] ?? String(s.id)).padEnd(12)} raw ${kb(s.payload.length).padStart(10)} -> xz ${kb(xz).padStart(10)}`)
  }
  console.log(`  ${'Σ (独立压，无跨段字典)'.padEnd(34)} xz ${kb(secXz).padStart(10)}`)

  // —— 消融：丢掉 direction 段（导入时 typed-array 重算）——
  const dirSec = sections.find(s => s.id === 2)
  if (dirSec) {
    const withoutDir = concat(sections.filter(s => s.id !== 2).map(s => s.payload))
    const [xzNoDir] = time(() => xzRaw(withoutDir, { format: 'xz', level: 6 }))
    const wholeXz = rows.find(r => r.label === 'xz L6 single')!.bytes.length
    console.log('\n[ablation: drop direction]')
    console.log(`  xz L6   all ${mb(wholeXz)} -> no-direction ${mb(xzNoDir.length)}  (省 ${mb(wholeXz - xzNoDir.length)}, ${(((wholeXz - xzNoDir.length) / wholeXz) * 100).toFixed(1)}%)`)
  }

  // —— 生产管线模拟：tar(ilybin + 5MB 音频) → 分块 xz ——
  console.log('\n[production pipeline: tar(ilybin + 5MB audio) -> xz L6 @4MB]')
  const audio = new Uint8Array(5 * 1024 * 1024)
  let s = 1
  for (let k = 0; k < audio.length; k++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    audio[k] = (s >>> 16) & 0xff
  }
  const tar = buildTar([
    { name: 'manifest.json', data: new TextEncoder().encode('{"format":"ilytx","version":1}') },
    { name: 'level.ilybin', data: ilybin },
    { name: 'audio/song.mp3', data: audio },
  ])
  const [xzTar] = time(() => xzChunked(tar, 6, 4 * 1024 * 1024))
  const audioRawStreamOverhead = xzTar.length - Math.min(
    xzTar.length,
    // 估算：只压 ilybin 部分的产出（音频原样存）≈ 分块压 ilybin 的结果
    xzChunked(ilybin, 6, 4 * 1024 * 1024).length + audio.length + 512 * 2
  )
  console.log(`  tar raw: ${mb(tar.length)} (ilybin ${mb(ilybin.length)} + audio 5.00MB)`)
  console.log(`  xz L6 @4MB -> .ilytx: ${mb(xzTar.length)}   (音频 5MB 经 xz 的净开销 ≈ ${kb(Math.max(0, audioRawStreamOverhead))})`)

  console.log('\ndone')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
