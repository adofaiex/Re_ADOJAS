/**
 * 探针：验证"弃存 direction / 弃存 angle"两条路线的重建保真度。
 *
 *   A. 弃 angle（留 direction）：正向复刻 parseAngle(direction, twirl) → angle
 *      预期：与 createTiles 位精确（状态机只依赖 direction+twirl）。
 *   B. 弃 direction（留 angle）：逆向 angle+twirl → direction
 *      预期：整数谱面精确；分数谱面因 angle 是 f32 存储，逆推有 ~1e-5° 误差
 *      （会破坏 export('object') 的严格等价）；555/666/777/888 特殊砖被
 *      归一化为字面方向值（几何等价、导出文本不同）。
 */
import * as ADOFAI from 'adofai'
import { Structure } from 'adofai'

const normalizeAngle = (v: number): number => (((v % 360) + 360) % 360)

function resolveAngleOffset(v: number): number | null {
  if (v === 555) return 72
  if (v === 666) return -72
  if (v === 777) return 52
  if (v === 888) return -52
  return null
}

/** 与库 levelAngle.js parseAngle 逐行等价的内联复刻 */
function parseAngle(agd: ArrayLike<number>, i: number, angleDir: { value: number }, isTwirl: number): number {
  let prev = 0
  if (i === 0) angleDir.value = 180
  const offset = resolveAngleOffset(agd[i])
  if (offset !== null) {
    const prevDir = normalizeAngle(angleDir.value - 180)
    const actualDir = normalizeAngle(prevDir + offset)
    const delta = normalizeAngle(angleDir.value - actualDir)
    prev = isTwirl === 0 ? delta : normalizeAngle(360 - delta)
    if (prev === 0) prev = 360
    angleDir.value = normalizeAngle(actualDir + 180)
  } else if (agd[i] === 999) {
    let minus = 1
    while (i - minus >= 0 && agd[i - minus] === 999) minus++
    const realAngle = i - minus >= 0 ? agd[i - minus] : 0
    angleDir.value = normalizeAngle(realAngle + (minus - 1) * 180)
    if (isNaN(angleDir.value)) angleDir.value = 0
    prev = 0
  } else {
    const delta = normalizeAngle(angleDir.value - agd[i])
    prev = isTwirl === 0 ? delta : normalizeAngle(360 - delta)
    if (prev === 0) prev = 360
    angleDir.value = normalizeAngle(agd[i] + 180)
  }
  return prev
}

/** B 路线：angle + twirl → direction（逆推） */
function inverseDirection(angle: ArrayLike<number>, twirl: ArrayLike<number>, n: number): Float64Array {
  const out = new Float64Array(n)
  let A = 180
  let run = 0 // 连续999 计数（含当前）
  let lastReal = 0 //999 段前最后一个非 999 的 direction
  for (let i = 0; i < n; i++) {
    const prev = angle[i]
    if (prev === 0) {
      //999：正向 angleDir = normalize(realAngle + (minus-1)*180)
      run++
      A = normalizeAngle(lastReal + (run - 1) * 180)
      if (isNaN(A)) A = 0
      out[i] = 999
    } else {
      run = 0
      const isTwirl = twirl[i] % 2
      const delta = isTwirl === 0 ? (prev === 360 ? 0 : prev) : normalizeAngle(360 - prev)
      const cand = normalizeAngle(A - delta)
      out[i] = cand
      lastReal = cand
      A = normalizeAngle(cand + 180)
    }
  }
  return out
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

async function run(label: string, angleData: number[], actions: Array<Record<string, unknown>>): Promise<void> {
  const settings = { bpm: 140, song: 'probe', offset: 0, songFilename: 'p.mp3' }
  const level = new ADOFAI.Level({ settings, angleData, actions } as never, undefined, { compactTiles: true })
  await level.load()
  const store = level.tiles as unknown as Structure.CompactTileStore
  const n = angleData.length
  const dir = store.direction
  const ang = store.angle
  const tw = store.twirl

  // —— A：正向重建 angle ——
  const A_angleDir = { value: 180 }
  let aExact = 0
  let aFirstBad = -1
  for (let i = 0; i < n; i++) {
    const expected = Math.fround(parseAngle(dir, i, A_angleDir, tw[i] % 2))
    if (expected === ang[i]) aExact++
    else if (aFirstBad < 0) aFirstBad = i
  }

  // —— B：逆向重建 direction ——
  const B = inverseDirection(ang, tw, n)
  let bExact = 0
  let bMaxErr = 0
  let bFirstBad = -1
  let b999ok = true
  for (let i = 0; i < n; i++) {
    const expect = dir[i]
    const got = Math.fround(B[i])
    if (got === expect) bExact++
    else {
      if (bFirstBad < 0) bFirstBad = i
      bMaxErr = Math.max(bMaxErr, Math.abs(B[i] - expect))
      if (expect === 999 || B[i] === 999) b999ok = false
    }
  }

  console.log(`\n[${label}] n=${n}`)
  console.log(`  A 正向(留direction): angle 位精确 ${aExact}/${n}${aFirstBad >= 0 ? ` 首个差异 i=${aFirstBad} expect=${ang[aFirstBad]} got=${Math.fround(parseAngleFromScratch(dir, tw, aFirstBad))}` : ' ✓'}`)
  console.log(`  B 逆向(留angle):    direction 位精确 ${bExact}/${n}${bFirstBad >= 0 ? ` 首个差异 i=${bFirstBad} expect=${dir[bFirstBad]} got=${B[bFirstBad]} maxErr=${bMaxErr.toExponential(2)}` : ' ✓'}`)
  console.log(`  B 999 标记: ${b999ok ? '全部还原 ✓' : '有丢失 ✗'}`)
}

function parseAngleFromScratch(dir: ArrayLike<number>, tw: ArrayLike<number>, upto: number): number {
  const s = { value: 180 }
  let v = 0
  for (let i = 0; i <= upto; i++) v = parseAngle(dir, i, s, tw[i] % 2)
  return Math.fround(v)
}

async function main(): Promise<void> {
  const N = Number(process.env.ITX_TILES ?? 50_000)
  const rand = mulberry32(0xC0FFEE)

  // 1. 整数谱面（45° 网格 + 999 + Twirl + 开头999）
  {
    const ad: number[] = [999, 999]
    for (let i = 2; i < N; i++) {
      if (i % 37 === 5) ad.push(999)
      else ad.push([0, 45, 90, 180, 270, 135][Math.floor(rand() * 6)])
    }
    const actions: Array<Record<string, unknown>> = []
    for (let i = 7; i < N; i += 500) actions.push({ floor: i, eventType: 'Twirl' })
    await run(`int 网格`, ad, actions)
  }

  // 2. 分数谱面（0.1 步进 + 999 + Twirl）
  {
    const ad: number[] = []
    for (let i = 0; i < N; i++) {
      if (i % 37 === 5) ad.push(999)
      else ad.push(Math.round((rand() * 3600)) / 10)
    }
    const actions: Array<Record<string, unknown>> = []
    for (let i = 7; i < N; i += 500) actions.push({ floor: i, eventType: 'Twirl' })
    await run(`frac 0.1`, ad, actions)
  }

  // 3. 特殊砖 555/666/777/888 + delta=108 的普通砖（歧义对）
  {
    const ad: number[] = [0, 180, 72, 555, 108, 180, 666, 777, 888, 45]
    for (let i = ad.length; i < N; i++) {
      ad.push(i % 97 === 0 ? 555 : i % 89 === 0 ? 666 : [0, 45, 90][Math.floor(rand() * 3)])
    }
    const actions: Array<Record<string, unknown>> = []
    for (let i = 7; i < N; i += 300) actions.push({ floor: i, eventType: 'Twirl' })
    await run(`special 555/666/777/888`, ad, actions)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
