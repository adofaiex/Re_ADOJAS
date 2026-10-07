/**
 * 最小 ustar tar 实现（.ilytx 的多成员容器层）。
 *
 * 只需要两个能力：把若干命名成员打成字节流、以及反向拆出成员。
 * 不引第三方依赖 —— tar 头就 512 字节，自己写比引库可控。
 *
 * 限制（对本用途足够）：
 *   - 成员名经 prefix 拆分后 ≤ 255 字节（ustar 上限）
 *   - 单成员 < 8GB（11 位八进制 size 上限）
 */

const BLOCK = 512
const NAME_MAX = 100 // 头部 name 字段长度；超出走 prefix 拆分
const PREFIX_MAX = 155

export interface TarEntry {
  /** 归一化路径，如 "level.ilybin" / "audio/song.mp3" */
  name: string
  data: Uint8Array
}

function writeOctal(buf: Uint8Array, off: number, fieldLen: number, value: number): void {
  // fieldLen 含结尾 NUL：前 fieldLen-1 位补零八进制数字 + '\0'
  const digits = value.toString(8)
  if (digits.length > fieldLen - 1) {
    throw new Error(`[tar] 数值溢出八进制字段: ${value}`)
  }
  const pad = fieldLen - 1 - digits.length
  for (let i = 0; i < pad; i++) buf[off + i] = 0x30 // '0'
  for (let i = 0; i < digits.length; i++) buf[off + pad + i] = digits.charCodeAt(i)
  buf[off + fieldLen - 1] = 0
}

function readOctal(buf: Uint8Array, off: number, len: number): number {
  let v = 0
  for (let i = 0; i < len; i++) {
    const c = buf[off + i]
    if (c === 0 || c === 0x20) break // NUL / 空格终止
    if (c < 0x30 || c > 0x37) throw new Error(`[tar] 非法八进制字节 0x${c.toString(16)}`)
    v = v * 8 + (c - 0x30)
  }
  return v
}

function writeString(buf: Uint8Array, off: number, fieldLen: number, s: string): void {
  const bytes = new TextEncoder().encode(s)
  if (bytes.length > fieldLen) throw new Error(`[tar] 字段超长: "${s}" (${bytes.length} > ${fieldLen})`)
  buf.set(bytes, off)
  // 余量保持 0（tar 头以 NUL 填充）
}

/** 拆 name/prefix：优先在 '/' 处断开，保证 name≤100 且 prefix≤155。 */
function splitName(name: string): { name: string; prefix: string } {
  const bytes = new TextEncoder().encode(name)
  if (bytes.length <= NAME_MAX) return { name, prefix: '' }
  if (bytes.length > NAME_MAX + 1 + PREFIX_MAX) {
    throw new Error(`[tar] 路径过长 (${bytes.length}B): ${name}`)
  }
  // 从后往前找一个切点：后段 ≤100 且前段 ≤155
  const slashPositions: number[] = []
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x2f) slashPositions.push(i)
  for (let i = slashPositions.length - 1; i >= 0; i--) {
    const cut = slashPositions[i] // '/' 的下标
    const tailLen = bytes.length - cut - 1
    const headLen = cut
    if (tailLen >= 1 && tailLen <= NAME_MAX && headLen <= PREFIX_MAX) {
      return {
        name: new TextDecoder().decode(bytes.subarray(cut + 1)),
        prefix: new TextDecoder().decode(bytes.subarray(0, cut)),
      }
    }
  }
  throw new Error(`[tar] 无法拆分路径: ${name}`)
}

function buildHeader(entry: TarEntry, size: number, mtime: number): Uint8Array {
  const header = new Uint8Array(BLOCK)
  const { name, prefix } = splitName(entry.name)

  writeString(header, 0, 100, name)
  writeOctal(header, 100, 8, 0o644) // mode
  writeOctal(header, 108, 8, 0) // uid
  writeOctal(header, 116, 8, 0) // gid
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, mtime)
  // chksum(148,8) 先按空格填，求和后再回写
  for (let i = 0; i < 8; i++) header[148 + i] = 0x20
  header[156] = 0x30 // typeflag '0' = 普通文件
  // linkname(157,100) 保持 0
  writeString(header, 257, 6, 'ustar') // magic: "ustar\0"
  header[262] = 0 // 已被 writeString 写 'ustar' 后的位置留 0 → "ustar\0"
  writeString(header, 263, 2, '00') // version
  // uname/gname 留空
  writeOctal(header, 329, 8, 0) // devmajor
  writeOctal(header, 337, 8, 0) // devminor
  if (prefix) writeString(header, 345, 155, prefix)

  // 校验和：全头求和（chksum 字段按 8 个空格计）
  let sum = 0
  for (let i = 0; i < BLOCK; i++) sum += header[i]
  // 6 位八进制 + NUL + 空格
  const chk = sum.toString(8)
  const pad = 6 - chk.length
  for (let i = 0; i < pad; i++) header[148 + i] = 0x30
  for (let i = 0; i < chk.length; i++) header[148 + pad + i] = chk.charCodeAt(i)
  header[154] = 0
  header[155] = 0x20

  return header
}

function padTo512(len: number): number {
  const r = len % BLOCK
  return r === 0 ? 0 : BLOCK - r
}

/** 把成员序列打包成 tar 字节流。 */
export function buildTar(entries: TarEntry[], mtimeMs: number = Math.floor(Date.now() / 1000)): Uint8Array {
  let total = 0
  const headers: Uint8Array[] = []
  for (const entry of entries) {
    const header = buildHeader(entry, entry.data.length, mtimeMs)
    headers.push(header)
    total += BLOCK + entry.data.length + padTo512(entry.data.length)
  }
  total += BLOCK * 2 // 结尾两个全零块

  const out = new Uint8Array(total)
  let off = 0
  for (let i = 0; i < entries.length; i++) {
    out.set(headers[i], off)
    off += BLOCK
    const data = entries[i].data
    out.set(data, off)
    off += data.length
    const pad = padTo512(data.length)
    if (pad > 0) off += pad // out 已是全零初始化，padding 天然为 0
  }
  // 两个全零结束块（上面已零初始化）
  return out
}

function isZeroBlock(buf: Uint8Array, off: number): boolean {
  for (let i = 0; i < BLOCK; i++) if (buf[off + i] !== 0) return false
  return true
}

/** 拆包 tar 字节流 → 成员列表（保持出现顺序）。 */
export function parseTar(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = []
  let off = 0
  while (off + BLOCK <= bytes.length) {
    if (isZeroBlock(bytes, off)) break // 第一个零块 = 归档结束
    const header = bytes.subarray(off, off + BLOCK)

    // 校验和验证：先按 8 空格还原再求和
    let sum = 0
    for (let i = 0; i < BLOCK; i++) sum += (i >= 148 && i < 156) ? 0x20 : header[i]
    const stored = readOctal(header, 148, 8)
    if (sum !== stored) throw new Error(`[tar] 头部校验和不匹配 @${off}: ${sum} != ${stored}`)

    const size = readOctal(header, 124, 12)
    const typeflag = String.fromCharCode(header[156])

    let name = readStringZ(header, 0, 100)
    const prefix = readStringZ(header, 345, 155)
    if (prefix) name = `${prefix}/${name}`

    off += BLOCK
    if (off + size > bytes.length) throw new Error(`[tar] 成员数据越界: ${name}`)
    if (typeflag === '0' || typeflag === '\0') {
      entries.push({ name, data: bytes.slice(off, off + size) })
    }
    off += size + padTo512(size)
  }
  return entries
}

function readStringZ(buf: Uint8Array, off: number, len: number): string {
  let end = off
  const max = off + len
  while (end < max && buf[end] !== 0) end++
  return new TextDecoder().decode(buf.subarray(off, end))
}

/** 按名字取成员（找不到返回 undefined）。 */
export function getTarEntry(entries: TarEntry[], name: string): Uint8Array | undefined {
  return entries.find((e) => e.name === name)?.data
}
