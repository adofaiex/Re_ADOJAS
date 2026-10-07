// M0 spike2: 真实风格 angleData → delta+zigzag+varint → xz 尺寸/耗时估算
// 单位统一用“百分之一度”(整数)，避免浮点破坏 varint
import { initWasm, compress, decompress } from 'lzma-wasm'

await initWasm()

let s = 0x9e3779b9
const rnd = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const N = 6_770_000
const TURNS = [1800, 1800, 1800, 900, -900, 1350, -1350, 450, -450, 0, 1800, 900] // 百分之一度
const angleData = new Int32Array(N)
let a = 0
for (let i = 0; i < N; i++) {
  if (rnd() < 0.02) a = (rnd() * 3600) | 0           // 偶发浮点角度（已×10）
  else a = (a + TURNS[(rnd() * TURNS.length) | 0] + 3600) % 3600
  angleData[i] = a
}

function varintLen(v) { let n = 1; while (v >= 128) { v >>>= 7; n++ } return n }
let size = 12
let prev = 0
for (let i = 0; i < N; i++) {
  const d = angleData[i] - prev; prev = angleData[i]
  size += varintLen(d < 0 ? -2 * d - 1 : 2 * d)
}
const ilybin = new Uint8Array(size)
let o = 12
prev = 0
for (let i = 0; i < N; i++) {
  const d = angleData[i] - prev; prev = angleData[i]
  let zz = d < 0 ? -2 * d - 1 : 2 * d
  while (zz >= 128) { ilybin[o++] = (zz & 127) | 128; zz >>>= 7 }
  ilybin[o++] = zz
}
console.log('angleData 若按 f64 数组:', (N * 8 / 1048576).toFixed(1), 'MB；若按 f32:', (N * 4 / 1048576).toFixed(1), 'MB')
console.log('delta+zigzag+varint 后:', (ilybin.length / 1048576).toFixed(2), 'MB')

for (const level of [1, 3, 6]) {
  const t = Date.now()
  const c = compress(ilybin, { format: 'xz', level })
  const ms = Date.now() - t
  const t2 = Date.now()
  const back = decompress(c, { expectedSize: ilybin.length })
  const ms2 = Date.now() - t2
  console.log(`xz L${level}: 压缩 ${ms}ms → ${(c.length / 1048576).toFixed(2)} MB | 解压 ${ms2}ms roundtrip:${back.length === ilybin.length && back.every((v, i) => v === ilybin[i])}`)
}
