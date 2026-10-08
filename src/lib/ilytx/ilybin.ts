/**
 * ilybin — .ilytx 内的谱面核心二进制格式（v1）。
 *
 * 设计原则（见 M1 方案讨论）：
 *   ilybin 存的是 adofai 库 `createTiles` 的**全部输出**（即 CompactTileStore 的
 *   内存布局 / 对象模式的 Tile 数组），而不是 .adofai 文本的二进制翻版。
 *   导入时直接重建 tiles、跳过 `Level.load()` —— 600MB JSON 扫描、相对角度
 *   状态机、Twirl 差分全部免掉，代价只有 typed array 的 memcpy。
 *
 * 布局：
 *   header:  magic "ILYB"(4) | u8 version | u8 tileMode | u16 sectionCount | u32 tileCount
 *   section: u8 id | u32 byteLength | payload
 *
 *   tileMode: 0 = 对象模式(Tile[])，1 = 紧凑模式(CompactTileStore)
 *
 *   sections:
 *     1 settings     UTF-8 JSON
 *     2 direction    FloatSection（= angleData 的值，含 999 中心块标记）
 *     3 angle        FloatSection，紧凑模式写 f32 定宽 kind=2（相对角度，
 *                    createTiles 状态机产物 —— 本格式的核心价值；见 encodeAngleSection）
 *     5 twirl        ZigZag-Varint 差分（累计 Twirl 计数，非递减）
 *     6 actions      UTF-8 JSON [{floor, ...}]（对象模式含 Twirl；紧凑模式由 twirl 段还原，
 *                    解码时按 tileMode 过滤，镜像库的紧凑剥离行为）
 *     7 decorations  UTF-8 JSON [{floor, ...}]
 *     8 extraProps   UTF-8 JSON [[floor, {...}]]（仅非空时写入）
 *
 *   FloatSection: u8 kind | payload
 *     kind 0（缩放整数差分）: u16 LE scale, 然后 ZigZag-Varint(Δ(round(v*scale)))
 *     kind 1（原始 f64）:     tileCount × f64 LE（位精确，无损兜底）
 *     kind 2（f32 定宽）:     tileCount × f32 LE（紧凑 store 原生精度，位精确）
 *
 *   注：_lastdir 不落盘 —— 库在 createTiles 里就是 `angleData[i-1] || 0` 派生的，
 *   重建时同公式导出即可（与 .adofai 文本往返的保真度一致）。
 */

// —— section id ——
const S_SETTINGS = 1
const S_DIRECTION = 2
const S_ANGLE = 3
const S_TWIRL = 5
const S_ACTIONS = 6
const S_DECORATIONS = 7
const S_EXTRAPROPS = 8

export const ILYBIN_VERSION = 1
export const TILE_MODE_OBJECT = 0
export const TILE_MODE_COMPACT = 1

const HEADER_SIZE = 12
const MAGIC = 0x42594c49 // "ILYB" as u32 LE

/** 解码后 / 编码前的谱面核心数据（与 Level 的公共字段一一对应）。 */
export interface IlybinData {
  tileMode: typeof TILE_MODE_OBJECT | typeof TILE_MODE_COMPACT
  tileCount: number
  settings: Record<string, unknown>
  /** 紧凑模式 Float32Array / 对象模式 Float64Array（物化+编辑覆盖时为 number[]），长度 = tileCount */
  direction: ArrayLike<number>
  angle: ArrayLike<number>
  /** 累计 Twirl 计数（紧凑 = Int32Array；对象 = Float64Array，tile.twirl 语义相同） */
  twirl: ArrayLike<number>
  /** 含 floor 的事件数组；紧凑模式存入前不含 Twirl，对象模式含 */
  actions: Array<Record<string, unknown>>
  decorations: Array<Record<string, unknown>>
  extraProps: Array<[number, Record<string, unknown>]> | null
}

// ————————————————————————— Varint / ZigZag —————————————————————————

class ByteWriter {
  private buf: Uint8Array
  private view: DataView
  len = 0

  constructor(cap = 1 << 20) {
    this.buf = new Uint8Array(cap)
    this.view = new DataView(this.buf.buffer)
  }

  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return
    let cap = this.buf.length * 2
    while (cap < this.len + n) cap *= 2
    const next = new Uint8Array(cap)
    next.set(this.buf.subarray(0, this.len))
    this.buf = next
    this.view = new DataView(next.buffer)
  }

  u8(v: number): void {
    this.ensure(1)
    this.buf[this.len++] = v & 0xff
  }

  u16(v: number): void {
    this.ensure(2)
    this.view.setUint16(this.len, v, true)
    this.len += 2
  }

  u32(v: number): void {
    this.ensure(4)
    this.view.setUint32(this.len, v, true)
    this.len += 4
  }

  bytes(src: Uint8Array): void {
    this.ensure(src.length)
    this.buf.set(src, this.len)
    this.len += src.length
  }

  f32(v: number): void {
    this.ensure(4)
    this.view.setFloat32(this.len, v, true)
    this.len += 4
  }

  f64(v: number): void {
    this.ensure(8)
    this.view.setFloat64(this.len, v, true)
    this.len += 8
  }

  /** 无符号 LEB128（接受 >2^31 的 number，按 7bit 组编码）。 */
  varint(v: number): void {
    this.ensure(10)
    let val = v
    while (val >= 128) {
      this.buf[this.len++] = (val % 128) | 128
      val = Math.floor(val / 128)
    }
    this.buf[this.len++] = val
  }

  /** 有符号 ZigZag-Varint。 */
  svarint(v: number): void {
    this.varint(v < 0 ? -2 * v - 1 : 2 * v)
  }

  take(): Uint8Array {
    return this.buf.slice(0, this.len)
  }
}

class ByteReader {
  private buf: Uint8Array
  private view: DataView
  pos = 0

  constructor(buf: Uint8Array) {
    this.buf = buf
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }

  u8(): number {
    return this.buf[this.pos++]
  }

  u16(): number {
    const v = this.view.getUint16(this.pos, true)
    this.pos += 2
    return v
  }

  u32(): number {
    const v = this.view.getUint32(this.pos, true)
    this.pos += 4
    return v
  }

  bytes(n: number): Uint8Array {
    const v = this.buf.subarray(this.pos, this.pos + n)
    this.pos += n
    return v
  }

  f32(): number {
    const v = this.view.getFloat32(this.pos, true)
    this.pos += 4
    return v
  }

  f64(): number {
    const v = this.view.getFloat64(this.pos, true)
    this.pos += 8
    return v
  }

  varint(): number {
    let v = 0
    let mult = 1
    for (;;) {
      const b = this.buf[this.pos++]
      v += (b & 0x7f) * mult
      if ((b & 0x80) === 0) break
      mult *= 128
    }
    return v
  }

  svarint(): number {
    const zz = this.varint()
    return zz % 2 === 1 ? -(zz + 1) / 2 : zz / 2
  }
}

// ————————————————————————— 浮点数组编码 —————————————————————————

/**
 * 尝试的缩放因子：让 v*scale 尽量落在整数上。
 *
 * 双重容差：
 *   - 相对：f32 半 ulp（2^-24 相对）。紧凑模式源数据本来就是 Float32Array，
 *     命中相对容差意味着解码回 f32 后**位精确**；
 *   - 绝对：1e-6 度（SNAP_ABS_EPS_DEG）。createTiles 状态机的 f64 运算会留下
 *     趋零余数（如 (360-ε)%360 → 5.7e-14）。这些值 round 到 0 后相对误差恒为
 *     100%，纯相对容差任何 scale 都过不去 —— 整段会回退 f64（8B/tile，比
 *     varint 大 5 倍，677w 谱面实测 angle 段 54MB vs 13MB）。绝对容差兜住
 *     这类噪声：1e-6° 物理不可见、低于真实输入精度（最细 0.001°），
 *     且相对角段不参与 export('object') 等价比较（导出只含 angleData）。
 *   全落空 → 原始 f64 兜底（真超精度值如 6 位小数角度仍无损保真）。
 */
const SCALE_CANDIDATES = [1, 10, 100, 1000]
const SNAP_REL_EPS = Math.pow(2, -24)
const SNAP_ABS_EPS_DEG = 1e-6

function fitsSnap(v: number, scale: number): boolean {
  const x = v * scale
  if (!Number.isFinite(x)) return false
  const r = Math.round(x)
  return Math.abs(x - r) <= Math.max(Math.abs(x) * SNAP_REL_EPS, SNAP_ABS_EPS_DEG * scale)
}

/** 单遍扫描出可用缩放；全落空返回 -1（= 原始 f64）。 */
function pickScale(values: ArrayLike<number>): number {
  const active = SCALE_CANDIDATES.map(() => true)
  let anyActive = true
  const n = values.length
  for (let i = 0; i < n && anyActive; i++) {
    const v = values[i]
    anyActive = false
    for (let s = 0; s < SCALE_CANDIDATES.length; s++) {
      if (!active[s]) continue
      if (fitsSnap(v, SCALE_CANDIDATES[s])) {
        active[s] = true
        anyActive = true
      } else {
        active[s] = false
      }
    }
  }
  for (let s = 0; s < SCALE_CANDIDATES.length; s++) if (active[s]) return SCALE_CANDIDATES[s]
  return -1
}

function encodeFloatSection(values: ArrayLike<number>): Uint8Array {
  const w = new ByteWriter(Math.max(1024, Math.ceil(values.length * 1.5)))
  const scale = pickScale(values)
  if (scale === -1) {
    // 无损兜底：原始 f64
    w.u8(1)
    const n = values.length
    for (let i = 0; i < n; i++) w.f64(values[i])
    return w.take()
  }
  w.u8(0)
  w.u16(scale)
  let prev = 0
  const n = values.length
  for (let i = 0; i < n; i++) {
    const cur = Math.round(values[i] * scale)
    w.svarint(cur - prev)
    prev = cur
  }
  return w.take()
}

/**
 * 相对角段（紧凑模式）：f32 定宽编码（kind=2）。
 *
 * 677w 基准（scripts/ilytx-size-bench）实测，相对角是"值集集中、增量分散"型数据，
 * f32 定宽在两种数据形态下都显著胜过缩放 varint 差分与 f64 兜底：
 *   分数谱面: varint 5.08MB / f64 4.01MB / **f32 3.88MB**（-24% vs varint）
 *   整数谱面: varint 5.03MB / f64 4.24MB / **f32 4.14MB**（-18% vs varint）
 * 原理：f32 字节对齐 —— 相同值产出完全相同的 4 字节序列，LZMA 直接长距离匹配；
 * varint 把值打散成变长 token，错位削弱匹配。direction 段相反（增量集中的
 * 随机游走型），保持 varint 最优。
 *
 * 保真：紧凑 store 的 angle 本身就是 f32（f32-exact 采样 100%），定宽写入
 * **位精确无损**；对象模式不走此路径（仍用 FloatSection 的 f64 兜底）。
 * 解码 wantF32=false 时放宽到 f64，量化误差 ≤1e-5°，且相对角不参与
 * export('object')（导出只含 angleData/settings/actions/decorations），物理不可见。
 */
function encodeAngleSection(values: ArrayLike<number>): Uint8Array {
  const w = new ByteWriter(Math.max(1024, 1 + values.length * 4))
  w.u8(2)
  const n = values.length
  for (let i = 0; i < n; i++) w.f32(values[i])
  return w.take()
}

function decodeFloatSection(payload: Uint8Array, tileCount: number, wantF32: boolean): Float32Array | Float64Array {
  const r = new ByteReader(payload)
  const kind = r.u8()
  if (kind === 1) {
    const f64 = new Float64Array(tileCount)
    for (let i = 0; i < tileCount; i++) f64[i] = r.f64()
    return wantF32 ? Float32Array.from(f64) : f64
  }
  if (kind === 2) {
    // f32 定宽：紧凑模式直读进 Float32Array（位精确）；对象模式放宽到 f64
    const out = wantF32 ? new Float32Array(tileCount) : new Float64Array(tileCount)
    for (let i = 0; i < tileCount; i++) out[i] = r.f32()
    return out as Float32Array | Float64Array
  }
  if (kind !== 0) throw new Error(`[ilybin] 未知浮点编码 kind=${kind}`)
  const scale = r.u16()
  const out = wantF32 ? new Float32Array(tileCount) : new Float64Array(tileCount)
  let acc = 0
  for (let i = 0; i < tileCount; i++) {
    acc += r.svarint()
    out[i] = acc / scale
  }
  return out
}

// ————————————————————————— 编码 —————————————————————————

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

export function encodeIlybin(data: IlybinData): Uint8Array {
  const settingsBytes = utf8(JSON.stringify(data.settings))
  const directionSec = encodeFloatSection(data.direction)
  const angleSec = data.tileMode === TILE_MODE_COMPACT
    ? encodeAngleSection(data.angle) // f32 定宽：实测比 varint/f64 小 18-24%（见函数注释）
    : encodeFloatSection(data.angle)

  const twirlW = new ByteWriter(Math.max(1024, Math.ceil(data.tileCount * 1.2)))
  {
    let prev = 0
    for (let i = 0; i < data.tileCount; i++) {
      const cur = data.twirl[i]
      twirlW.svarint(cur - prev)
      prev = cur
    }
  }
  const twirlSec = twirlW.take()

  const actionsArr = data.actions ?? []
  const decosArr = data.decorations ?? []
  const actionsBytes = actionsArr.length > 0 ? utf8(JSON.stringify(actionsArr)) : null
  const decosBytes = decosArr.length > 0 ? utf8(JSON.stringify(decosArr)) : null
  const extraBytes = data.extraProps && data.extraProps.length > 0 ? utf8(JSON.stringify(data.extraProps)) : null

  let sectionCount = 4 // settings + direction + angle + twirl
  if (actionsBytes) sectionCount++
  if (decosBytes) sectionCount++
  if (extraBytes) sectionCount++

  const sections: Array<{ id: number; payload: Uint8Array }> = [
    { id: S_SETTINGS, payload: settingsBytes },
    { id: S_DIRECTION, payload: directionSec },
    { id: S_ANGLE, payload: angleSec },
    { id: S_TWIRL, payload: twirlSec },
  ]
  if (actionsBytes) sections.push({ id: S_ACTIONS, payload: actionsBytes })
  if (decosBytes) sections.push({ id: S_DECORATIONS, payload: decosBytes })
  if (extraBytes) sections.push({ id: S_EXTRAPROPS, payload: extraBytes })

  let total = HEADER_SIZE
  for (const s of sections) total += 5 + s.payload.length

  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint32(0, MAGIC, true)
  out[4] = ILYBIN_VERSION
  out[5] = data.tileMode
  view.setUint16(6, sectionCount, true)
  view.setUint32(8, data.tileCount, true)

  let off = HEADER_SIZE
  for (const s of sections) {
    out[off] = s.id
    view.setUint32(off + 1, s.payload.length, true)
    off += 5
    out.set(s.payload, off)
    off += s.payload.length
  }
  return out
}

// ————————————————————————— 解码 —————————————————————————

export function decodeIlybin(bytes: Uint8Array): IlybinData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== MAGIC) throw new Error('[ilybin] magic 不匹配，不是 ilybin 数据')
  const version = bytes[4]
  if (version !== ILYBIN_VERSION) throw new Error(`[ilybin] 不支持的版本 ${version}`)
  const tileMode = bytes[5] as IlybinData['tileMode']
  if (tileMode !== TILE_MODE_OBJECT && tileMode !== TILE_MODE_COMPACT) {
    throw new Error(`[ilybin] 非法 tileMode=${tileMode}`)
  }
  const sectionCount = view.getUint16(6, true)
  const tileCount = view.getUint32(8, true)

  let off = HEADER_SIZE
  const byId = new Map<number, Uint8Array>()
  for (let i = 0; i < sectionCount; i++) {
    if (off + 5 > bytes.length) throw new Error('[ilybin] section 头越界')
    const id = bytes[off]
    const len = view.getUint32(off + 1, true)
    off += 5
    if (off + len > bytes.length) throw new Error('[ilybin] section 数据越界')
    byId.set(id, bytes.subarray(off, off + len))
    off += len
  }

  const wantF32 = tileMode === TILE_MODE_COMPACT
  const settingsRaw = byId.get(S_SETTINGS)
  if (!settingsRaw) throw new Error('[ilybin] 缺少 settings section')
  const directionRaw = byId.get(S_DIRECTION)
  const angleRaw = byId.get(S_ANGLE)
  if (!directionRaw || !angleRaw) throw new Error('[ilybin] 缺少 direction/angle section')
  const twirlRaw = byId.get(S_TWIRL)
  if (!twirlRaw) throw new Error('[ilybin] 缺少 twirl section')

  const settings = JSON.parse(new TextDecoder().decode(settingsRaw)) as Record<string, unknown>
  const direction = decodeFloatSection(directionRaw, tileCount, wantF32)
  const angle = decodeFloatSection(angleRaw, tileCount, wantF32)

  let twirl: Int32Array | Float64Array
  if (wantF32) {
    const arr = new Int32Array(tileCount)
    const r = new ByteReader(twirlRaw)
    let acc = 0
    for (let i = 0; i < tileCount; i++) {
      acc += r.svarint()
      arr[i] = acc
    }
    twirl = arr
  } else {
    const arr = new Float64Array(tileCount)
    const r = new ByteReader(twirlRaw)
    let acc = 0
    for (let i = 0; i < tileCount; i++) {
      acc += r.svarint()
      arr[i] = acc
    }
    twirl = arr
  }

  const decoder = new TextDecoder()
  const actionsRaw = byId.get(S_ACTIONS)
  const decosRaw = byId.get(S_DECORATIONS)
  const extraRaw = byId.get(S_EXTRAPROPS)
  const actions = actionsRaw ? (JSON.parse(decoder.decode(actionsRaw)) as Array<Record<string, unknown>>) : []
  const decorations = decosRaw ? (JSON.parse(decoder.decode(decosRaw)) as Array<Record<string, unknown>>) : []
  const extraProps = extraRaw ? (JSON.parse(decoder.decode(extraRaw)) as Array<[number, Record<string, unknown>]>) : null

  return { tileMode, tileCount, settings, direction, angle, twirl, actions, decorations, extraProps }
}
