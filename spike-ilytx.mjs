// M0 spike: lzma-wasm 分块 xz → concat → 单次解压 round-trip 验证
import { initWasm, compress, decompress } from 'lzma-wasm'

await initWasm()

// 1. 模拟 ilybin 数据：677w 条 delta+zigzag+varint 风格的字节流（这里用可压缩的类二进制数据代替）
const N = 6_770_000
const raw = new Uint8Array(N * 2) // ~13.5MB 模拟
let x = 12345
for (let i = 0; i < raw.length; i++) {
  x = (x * 1103515245 + 12345) & 0x7fffffff
  raw[i] = x & 0xff
}
// 加入一段高度可压的"谱面"模式（模拟定步进角度）
for (let i = 0; i < N; i++) {
  raw[i * 2] = i % 7 === 0 ? 0x80 : 0x01
}

console.log('raw size MB:', (raw.length / 1048576).toFixed(1))

// 2. 单块压 level 6 计时
let t = Date.now()
const single = compress(raw, { format: 'xz', level: 6 })
console.log('single xz L6:', (Date.now() - t) + 'ms ->', (single.length / 1048576).toFixed(2), 'MB')

t = Date.now()
const singleL1 = compress(raw, { format: 'xz', level: 1 })
console.log('single xz L1:', (Date.now() - t) + 'ms ->', (singleL1.length / 1048576).toFixed(2), 'MB')

// 3. 分块 4MB 压缩 → concat → 单次 decompress（核心假设）
const CHUNK = 4 * 1024 * 1024
const parts = []
t = Date.now()
for (let off = 0; off < raw.length; off += CHUNK) {
  const end = Math.min(off + CHUNK, raw.length)
  parts.push(compress(raw.subarray(off, end), { format: 'xz', level: 6 }))
}
const concatMs = Date.now() - t
let total = 0
for (const p of parts) total += p.length
console.log(`chunked(${parts.length} x 4MB) L6: ${concatMs}ms -> ${(total / 1048576).toFixed(2)} MB`)

const joined = new Uint8Array(total)
let o = 0
for (const p of parts) { joined.set(p, o); o += p.length }

t = Date.now()
const back = decompress(joined, { expectedSize: raw.length })
console.log('decompress(concat):', (Date.now() - t) + 'ms, roundtrip ok:', back.length === raw.length && back.every((v, i) => v === raw[i]))

// 4. 混入不可压数据（模拟 mp3 音频成员）
const audio = new Uint8Array(5 * 1024 * 1024)
for (let i = 0; i < audio.length; i++) audio[i] = (i * 2654435761) >>> 24
t = Date.now()
const audioC = compress(audio, { format: 'xz', level: 6 })
console.log('incompressible 5MB:', (Date.now() - t) + 'ms ->', (audioC.length / 1048576).toFixed(2), 'MB (ratio', (audioC.length / audio.length).toFixed(3) + ')')
const audioBack = decompress(audioC, { expectedSize: audio.length })
console.log('audio roundtrip ok:', audioBack.length === audio.length)
