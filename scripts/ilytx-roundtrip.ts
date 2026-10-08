/**
 * ilytx M1 round-trip 测试：.adofai → Level → ilybin → Level' ，
 * 断言 export('object') 与原 Level 完全等价（= 与库自身 .adofai 导出同保真）。
 *
 * 运行：node scripts/ilytx-roundtrip.ts
 * 规模：ITX_TILES=6770000 node scripts/ilytx-roundtrip.ts  （默认 1,000,000）
 */

import * as ADOFAI from 'adofai'
import { buildTar, parseTar, getTarEntry } from '../src/lib/ilytx/tar.ts'
import { encodeIlybin, decodeIlybin } from '../src/lib/ilytx/ilybin.ts'
import { levelFromIlybin, levelToIlybin } from '../src/lib/ilytx/level.ts'

const StringParser = ADOFAI.Parsers.StringParser
const parser = new StringParser()

let failures = 0
function check(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    console.log(`  OK  ${label}`)
  } else {
    failures++
    console.error(`  FAIL ${label}${detail ? ` -- ${detail}` : ''}`)
  }
}

/** 深比较：对象按键序逐一比；数值允许 eps（对象模式分数角度的量化余量）。 */
function deepEqual(a: unknown, b: unknown, eps = 1e-9, path = '$'): string | null {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return null
    const diff = Math.abs(a - b)
    const tol = eps * Math.max(1, Math.abs(a), Math.abs(b))
    return diff <= tol ? null : `${path}: ${a} != ${b}`
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} != ${b.length}`
    for (let i = 0; i < a.length; i++) {
      const err = deepEqual(a[i], b[i], eps, `${path}[${i}]`)
      if (err) return err
    }
    return null
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) {
      return `${path}: keys [${ka.join(',')}] != [${kb.join(',')}]`
    }
    for (const k of ka) {
      const err = deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], eps, `${path}.${k}`)
      if (err) return err
    }
    return null
  }
  const sa = JSON.stringify(a)
  const sb = JSON.stringify(b)
  return sa === sb ? null : `${path}: ${sa} != ${sb}`
}

// ————————————————————————— 1. 合成谱面 —————————————————————————

function makeChart(opts: { fractional: boolean }): string {
  const angleData: number[] = []
  const actions: Array<Record<string, unknown>> = []
  const decorations: Array<Record<string, unknown>> = []
  const base = opts.fractional ? 0.1 : 1
  let a = 0
  for (let i = 0; i < 5000; i++) {
    if (i % 37 === 5) {
      angleData.push(999) // midspin
      a = (a + 180) % 360
    } else if (opts.fractional) {
      a = (a + [180, 90, 0.3, 0.1, 45][i % 5]) % 360
      angleData.push(Math.round(a / base) * base)
    } else {
      a = (a + [180, 90, 180, 45, 135][i % 5]) % 360
      angleData.push(a)
    }
    if (i > 0 && i % 50 === 0) actions.push({ floor: i, eventType: 'Twirl' })
    if (i % 211 === 0) actions.push({ floor: i, eventType: 'SetSpeed', speedType: 'Multiplier', bpmMultiplier: 1.5 })
    if (i % 500 === 0) actions.push({ floor: i, eventType: 'MoveCamera', target: 'Tiles', x: i % 7, y: 3 })
    if (i % 700 === 3) decorations.push({ floor: i, eventType: 'AddDecoration', decorationImage: 'x.png', opacity: 0.5 })
    if (i % 900 === 4) actions.push({ floor: i, eventType: 'Twirl' }) // 同一 floor 多事件
  }
  return JSON.stringify({
    settings: {
      artist: 'ilythra', song: 'ilytx-roundtrip', bpm: 128, offset: 0,
      songFilename: 'song.mp3', bgImage: '', pitch: 100,
    },
    angleData,
    actions,
    decorations,
  })
}

/** 解析 ilybin section 布局（header 12B + {id u8, len u32, payload}），返回 id → payload */
function parseIlybinSections(buf: Uint8Array): Map<number, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = dv.getUint16(6, true)
  const out = new Map<number, Uint8Array>()
  let off = 12
  for (let i = 0; i < count; i++) {
    const id = buf[off]
    const len = dv.getUint32(off + 1, true)
    out.set(id, buf.subarray(off + 5, off + 5 + len))
    off += 5 + len
  }
  return out
}

async function roundTrip(label: string, chartText: string, compact: boolean, eps: number, strict: boolean): Promise<void> {
  const original = new ADOFAI.Level(chartText, parser, { compactTiles: compact })
  await original.load()

  const t0 = performance.now()
  const bytes = levelToIlybin(original)
  const tEnc = performance.now() - t0

  const t1 = performance.now()
  const decoded = decodeIlybin(bytes)
  const rebuilt = levelFromIlybin(decoded)
  const tDec = performance.now() - t1

  const origExport = original.export('object') as Record<string, unknown>
  const roundExport = rebuilt.export('object') as Record<string, unknown>

  const cmp = strict ? deepEqual(origExport, roundExport, 0) : deepEqual(origExport, roundExport, eps)
  check(cmp === null, `${label}: export('object') 等价`, cmp ?? undefined)
  check(rebuilt.isCompactTiles() === original.isCompactTiles(), `${label}: tileMode 保持`)
  check(rebuilt.tiles.length === original.tiles.length, `${label}: tileCount ${rebuilt.tiles.length}`)

  // 回归：紧凑模式 angle 段必须走 f32 定宽（kind=2，比 varint 小 18-24%、比
  // 曾造成 54MB 膨胀的 f64 回退小 4 倍）；对象模式保持 FloatSection 原路径
  //（f64 兜底，不量化）。
  const angleSec = parseIlybinSections(bytes).get(3)
  const angleKindOk = angleSec !== undefined && (compact ? angleSec[0] === 2 : angleSec[0] !== 2)
  check(angleKindOk, `${label}: angle 段编码 ${compact ? 'f32 定宽 (kind=2)' : 'FloatSection (非 f32)'}`,
    angleSec !== undefined ? `kind=${angleSec[0]}` : 'missing section')

  const textLen = new TextEncoder().encode(chartText).length
  console.log(
    `    sizes: ilybin ${(bytes.length / 1024).toFixed(1)}KB vs adofai ${(textLen / 1024).toFixed(1)}KB` +
    ` (encode ${tEnc.toFixed(0)}ms, decode+rebuild ${tDec.toFixed(0)}ms)`
  )
}

// ————————————————————————— 2. tar —————————————————————————

function testTar(): void {
  console.log('\n[tar]')
  const enc = new TextEncoder()
  // 模拟音频：5MB 不可压伪随机
  const audio = new Uint8Array(5 * 1024 * 1024)
  let s = 1
  for (let i = 0; i < audio.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    audio[i] = (s >>> 16) & 0xff
  }
  const longName = `decor/${'x'.repeat(90)}/very-long-image-name-for-prefix-splitting-check.png`
  const entries = [
    { name: 'manifest.json', data: enc.encode('{"version":1}') },
    { name: 'level.ilybin', data: enc.encode('chunk-data-'.repeat(1000)) },
    { name: 'audio/song.mp3', data: audio },
    { name: longName, data: enc.encode('png-ish') },
  ]
  const packed = buildTar(entries)
  const unpacked = parseTar(packed)
  check(unpacked.length === entries.length, `tar member count ${unpacked.length}`)
  for (const e of entries) {
    const got = getTarEntry(unpacked, e.name)
    check(!!got && got.length === e.data.length && got.every((v, i) => v === e.data[i]), `tar member ok: ${e.name.slice(0, 40)}`)
  }
  check(getTarEntry(unpacked, 'nope') === undefined, 'tar missing member -> undefined')
  try {
    const bad = packed.slice()
    bad[100] ^= 0xff
    parseTar(bad)
    check(false, 'corrupted tar header should throw')
  } catch {
    check(true, 'corrupted tar header throws')
  }
}

// ————————————————————————— 2b. 端到端容器 —————————————————————————

/**
 * 镜像 useFileHandlers.handleExportConfirm → loadFromIlytx 的完整链路：
 * level → ilybin + manifest + 音频/装饰成员 → tar → 分块 xz → 拼接 →
 * 单次解压 → tar 拆包 → manifest/ilybin/资产还原 → Level 重建等价。
 */
async function testE2E(): Promise<void> {
  console.log('\n[e2e container: export -> chunked xz -> import]')
  const level = await loadTiny()
  const origExport = level.export('object')
  const enc = new TextEncoder()

  // 伪随机音频（不可压，验证成员不被二次处理）
  const audio = new Uint8Array(64 * 1024)
  let s = 7
  for (let i = 0; i < audio.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    audio[i] = (s >>> 16) & 0xff
  }
  const decorPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

  const ilybin = levelToIlybin(level)
  const manifest = {
    format: 'ilytx', version: 1, generator: 'adojas', created: Date.now(),
    tileCount: level.tiles.length,
    songFilename: level.settings?.songFilename,
    audio: 'song.mp3', decor: ['deco.png'], bg: [],
  }
  const tar = buildTar([
    { name: 'manifest.json', data: enc.encode(JSON.stringify(manifest)) },
    { name: 'level.ilybin', data: ilybin },
    { name: 'audio/song.mp3', data: audio },
    { name: 'decor/deco.png', data: decorPng },
  ])

  // 分块 xz + 拼接（xz.ts 设计：每分片独立 xz 流，解压端单次还原）
  const { initWasm, compress, decompress } = await import('lzma-wasm')
  await initWasm()
  const chunkSize = 8192 // 强制多分片
  const parts: Uint8Array[] = []
  for (let o = 0; o < tar.length; o += chunkSize) {
    parts.push(tar.subarray(o, Math.min(o + chunkSize, tar.length)))
  }
  check(parts.length > 1, `tar split into ${parts.length} xz chunks`)
  const xzParts = parts.map(p => compress(p, { format: 'xz', level: 6 }))
  let xzLen = 0
  for (const p of xzParts) xzLen += p.length
  const xz = new Uint8Array(xzLen)
  let off = 0
  for (const p of xzParts) { xz.set(p, off); off += p.length }

  // 解压（与 xzWorker 相同的调用方式）
  const back = decompress(xz, { memLimit: 1024 * 1024 * 1024 })
  check(back.length === tar.length && back.every((v, i) => v === tar[i]), `concat xz decompress -> ${back.length} bytes`)

  // 拆包 + 成员还原
  const members = parseTar(back)
  check(members.length === 4, `member count ${members.length}`)
  const mBytes = getTarEntry(members, 'manifest.json')
  check(!!mBytes, 'manifest member present')
  const m = JSON.parse(new TextDecoder().decode(mBytes!)) as typeof manifest
  check(m.format === 'ilytx' && m.version === 1 && m.audio === 'song.mp3' && m.decor[0] === 'deco.png', 'manifest fields intact')
  const lvlBack = getTarEntry(members, 'level.ilybin')
  check(!!lvlBack && lvlBack.length === ilybin.length && lvlBack.every((v, i) => v === ilybin[i]), 'level.ilybin intact')
  const audioBack = getTarEntry(members, 'audio/song.mp3')
  check(!!audioBack && audioBack.length === audio.length && audioBack.every((v, i) => v === audio[i]), 'audio member intact')
  const decorBack = getTarEntry(members, 'decor/deco.png')
  check(!!decorBack && decorBack.length === decorPng.length && decorBack.every((v, i) => v === decorPng[i]), 'decor member intact')

  // Level 重建等价
  const rebuilt = levelFromIlybin(decodeIlybin(lvlBack!))
  const cmp = deepEqual(origExport, rebuilt.export('object'), 0)
  check(cmp === null, 'e2e rebuilt level export equal (strict)', cmp ?? undefined)
  check(rebuilt.export('object').settings.tileMode === origExport.settings.tileMode, 'tileMode preserved')
}

// ————————————————————————— 3. 主流程 —————————————————————————

async function loadTiny(): Promise<ADOFAI.Level> {
  const level = new ADOFAI.Level(makeChart({ fractional: false }), parser, { compactTiles: true })
  await level.load()
  return level
}

async function main(): Promise<void> {
  console.log('[ilybin round-trip]')

  await roundTrip('int+999+twirl [compact]', makeChart({ fractional: false }), true, 1e-9, true)
  await roundTrip('int+999+twirl [object]  ', makeChart({ fractional: false }), false, 1e-9, true)
  await roundTrip('frac-0.1      [compact]', makeChart({ fractional: true }), true, 1e-9, true)
  await roundTrip('frac-0.1      [object]  ', makeChart({ fractional: true }), false, 1e-6, false)

  console.log('\n[robustness]')
  try {
    decodeIlybin(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))
    check(false, 'bad magic should throw')
  } catch {
    check(true, 'bad magic throws')
  }
  try {
    const good = levelToIlybin(await loadTiny())
    decodeIlybin(good.subarray(0, good.length - 3))
    check(false, 'truncated payload should throw')
  } catch {
    check(true, 'truncated payload throws')
  }

  testTar()
  await testE2E()

  // —— 规模压测 ——
  const N = Number(process.env.ITX_TILES ?? 1_000_000)
  console.log(`\n[perf] ${N.toLocaleString()} tiles`)
  const angleData = new Array<number>(N)
  const actions: Array<Record<string, unknown>> = []
  let a = 0
  for (let i = 0; i < N; i++) {
    a = (a + [180, 90, 180, 45, 135, -90][i % 6] + 360) % 360
    angleData[i] = a
    if (i % 5000 === 7) actions.push({ floor: i, eventType: 'Twirl' })
    if (i % 100000 === 11) actions.push({ floor: i, eventType: 'SetSpeed', speedType: 'Multiplier', bpmMultiplier: 1.25 })
  }
  const settings = { bpm: 140, song: 'perf', offset: 0, songFilename: 'perf.mp3' }

  let t = performance.now()
  const big = new ADOFAI.Level({ settings, angleData, actions, decorations: [] } as never, undefined, { compactTiles: true })
  await big.load()
  const tCreate = performance.now() - t

  t = performance.now()
  const bytes = levelToIlybin(big)
  const tEnc = performance.now() - t

  t = performance.now()
  const rebuilt = levelFromIlybin(decodeIlybin(bytes))
  const tDec = performance.now() - t

  const cmp = deepEqual(big.export('object'), rebuilt.export('object'), 0)
  check(cmp === null, 'perf chart export equal (strict)', cmp ?? undefined)
  console.log(`    createTiles(lib): ${tCreate.toFixed(0)}ms | extract+encode: ${tEnc.toFixed(0)}ms | decode+rebuild: ${tDec.toFixed(0)}ms`)
  console.log(`    ilybin size: ${(bytes.length / 1048576).toFixed(2)}MB`)

  // xz 后处理（= 最终 .ilytx 的主体体积）
  const { initWasm, compress, decompress } = await import('lzma-wasm')
  await initWasm()
  for (const level of [1, 6]) {
    const tXz = performance.now()
    const xz = compress(bytes, { format: 'xz', level: level as 1 | 6 })
    const tXzMs = performance.now() - tXz
    const back = decompress(xz, { expectedSize: bytes.length })
    check(back.length === bytes.length && back.every((v, i) => v === bytes[i]), `xz L${level} roundtrip`)
    console.log(`    xz L${level}: ${(bytes.length / 1048576).toFixed(2)}MB -> ${(xz.length / 1048576).toFixed(2)}MB, compress ${tXzMs.toFixed(0)}ms`)
  }

  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})