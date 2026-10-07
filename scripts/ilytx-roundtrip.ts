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