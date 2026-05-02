/**
 * WasmParser - WebAssembly 加速的 ADOFAI 文件解析器
 *
 * 基于 Rust wasm32 模块，用于 > 100MB 的大文件解析。
 * 作为 LargeFileParser 的替代方案，提供相同接口。
 *
 * 工作流程:
 * 1. 加载 .wasm 模块（延迟初始化）
 * 2. 将输入 ArrayBuffer 拷贝到 Wasm 线性内存
 * 3. 调用 parse_adofai() 扫描 root 级属性位置 + 解析 angleData
 * 4. 读取属性偏移量和 angleData
 * 5. JS 侧对每个属性段做 JSON.parse()
 */

const WASM_URL = '/wasm/adofai_parser_wasm.wasm'

/** 解析结果结构（匹配 ADOFAI LevelOptions 接口） */
export interface WasmParseResult {
  settings: Record<string, any>
  actions: any[]
  angleData?: number[]
  pathData?: string
  decorations: any[]
}

export class WasmParser {
  private instance: WebAssembly.Instance | null = null
  private _initialized = false
  private _initPromise: Promise<void> | null = null
  private onProgress?: (stage: string, percent: number) => void

  constructor(onProgress?: (stage: string, percent: number) => void) {
    this.onProgress = onProgress
  }

  /** 初始化 Wasm 模块（延迟加载） */
  async init(): Promise<void> {
    if (this._initialized) return
    if (this._initPromise) return this._initPromise

    this._initPromise = this._doInit()
    return this._initPromise
  }

  private async _doInit(): Promise<void> {
    const response = await fetch(WASM_URL)
    if (!response.ok) {
      throw new Error(`[WasmParser] Failed to fetch wasm: ${response.status} ${response.statusText}`)
    }
    const bytes = await response.arrayBuffer()
    const { instance } = await WebAssembly.instantiate(bytes, {})
    this.instance = instance
    this._initialized = true
  }

  /** 解析 ADOFAI 文件，返回结构化数据 */
  parse(input: ArrayBuffer): WasmParseResult | null {
    if (!this._initialized) {
      throw new Error('[WasmParser] Not initialized. Call await parser.init() first.')
    }

    const bytes = new Uint8Array(input)
    const exports = this.instance!.exports as Record<string, unknown>
    const wasmAlloc = exports.wasm_alloc as (size: number) => number
    const wasmDealloc = exports.wasm_dealloc as (ptr: number, size: number) => void
    const parseFn = exports.parse_adofai as (
      inputPtr: number, inputLen: number,
      outputPtr: number, anglePtr: number, angleCap: number
    ) => number
    const memory = exports.memory as WebAssembly.Memory

    // 估算 angleData 最大元素数（保守）
    const maxAngles = Math.min(200000, Math.floor(bytes.length / 4))

    // 在 Wasm 线性内存中分配缓冲区
    const inputPtr = wasmAlloc(bytes.length)
    const outputPtr = wasmAlloc(44)       // 11 × i32
    const anglePtr = wasmAlloc(maxAngles * 8) // f64 × maxAngles

    try {
      // 拷贝输入数据到 Wasm 内存
      const wasmMem = new Uint8Array(memory.buffer)
      wasmMem.set(bytes, inputPtr)

      // 调用 Rust 解析函数
      const result = parseFn(inputPtr, bytes.length, outputPtr, anglePtr, maxAngles)
      if (result !== 0) {
        console.warn('[WasmParser] parse_adofai returned error:', result)
        return null
      }

      // 读取输出结构（拷贝到 JS 数组，避免 buffer detach 问题）
      const outBuf = new Int32Array(memory.buffer, outputPtr, 11)
      const out = Array.from(outBuf)

      const [
        settingsOff, settingsEnd,
        actionsOff, actionsEnd,
        angleDataOff, angleDataEnd,
        pathDataOff, pathDataEnd,
        decorationsOff, decorationsEnd,
        angleCount
      ] = out

      // 拷贝 angleData（在释放内存前完成）
      let parsedAngles: number[] | undefined
      if (angleCount > 0 && anglePtr !== 0) {
        const angleView = new Float64Array(memory.buffer, anglePtr, angleCount)
        parsedAngles = Array.from(angleView)
      }

      // 释放 Wasm 内存（后续只用 input bytes 做切片）
      wasmDealloc(inputPtr, bytes.length)
      wasmDealloc(outputPtr, 44)
      wasmDealloc(anglePtr, maxAngles * 8)

      // ── 构建结果 ──
      const decoder = new TextDecoder('utf-8')
      const parsed: WasmParseResult = {
        settings: {},
        actions: [],
        decorations: [],
      }

      // 1. settings
      if (settingsOff > 0 && settingsEnd > settingsOff) {
        this.onProgress?.('parsing_settings', 10)
        parsed.settings = safeJsonParse(decoder.decode(bytes.slice(settingsOff, settingsEnd)), {})
      }

      // 2. angleData
      if (parsedAngles) {
        parsed.angleData = parsedAngles
        this.onProgress?.('parsing_angleData', 15)
      }

      // 3. pathData
      if (pathDataOff > 0 && pathDataEnd > pathDataOff) {
        const raw = decoder.decode(bytes.slice(pathDataOff, pathDataEnd))
        parsed.pathData = raw.replace(/^"|"$/g, '')
      }

      // 4. actions
      if (actionsOff > 0 && actionsEnd > actionsOff) {
        this.onProgress?.('parsing_actions', 50)
        const slice = bytes.slice(actionsOff, actionsEnd)
        const size = slice.length

        if (size > 80 * 1024 * 1024) {
          // 超大 actions 数组 → 增量解析
          parsed.actions = this.parseObjectArrayIncremental(slice)
        } else {
          const str = decoder.decode(slice)
          parsed.actions = safeJsonParse(str, [])
        }
      }

      // 5. decorations
      if (decorationsOff > 0 && decorationsEnd > decorationsOff) {
        this.onProgress?.('parsing_decorations', 95)
        parsed.decorations = safeJsonParse(
          decoder.decode(bytes.slice(decorationsOff, decorationsEnd)),
          []
        )
      }

      this.onProgress?.('complete', 100)
      return parsed
    } catch (err) {
      console.error('[WasmParser] Error:', err)
      return null
    }
  }

  /** 增量解析大型对象数组（避免超大 JSON.parse 内存爆炸） */
  private parseObjectArrayIncremental(bytes: Uint8Array): any[] {
    const decoder = new TextDecoder('utf-8')
    const values: any[] = []
    let i = 1 // skip '['
    let depth = 1
    let inString = false
    let escapeNext = false
    let objectStart = -1

    // skip leading whitespace
    while (i < bytes.length && isSpace(bytes[i])) i++
    if (i >= bytes.length || bytes[i] === 93) return [] // empty array

    while (i < bytes.length) {
      const byte = bytes[i]

      if (escapeNext) { escapeNext = false; i++; continue }
      if (byte === 92) { escapeNext = true; i++; continue }
      if (byte === 34) { inString = !inString; i++; continue }

      if (!inString) {
        if (byte === 123) { // {
          if (depth === 1 && objectStart === -1) objectStart = i
          depth++
          i++
        } else if (byte === 125) { // }
          depth--
          if (depth === 1 && objectStart !== -1) {
            const objStr = decoder.decode(bytes.slice(objectStart, i + 1))
            try {
              values.push(JSON.parse(objStr))
            } catch { /* skip malformed */ }
            objectStart = -1
            if (this.onProgress && values.length % 50000 === 0) {
              this.onProgress('parsing_actions', 50 + ((i / bytes.length) * 45))
            }
          }
          i++
        } else if (byte === 91) { depth++; i++
        } else if (byte === 93) {
          depth--
          if (depth === 0) break
          i++
        } else { i++ }
      } else { i++ }
    }

    return values
  }
}

// ── Helpers ─────────────────────────────────────

function isSpace(byte: number): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0A || byte === 0x0D
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

export default WasmParser
