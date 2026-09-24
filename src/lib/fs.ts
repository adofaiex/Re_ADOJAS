/**
 * ADOJAS FileSystem — 用法同 Node.js fs/promises。
 *
 * 在 ADOJAS Android App 内通过 Kotlin Bridge 读写真实文件系统；
 * 在浏览器降级为无操作（或抛出「仅在 ADOJAS 中可用」）。
 */

import { join, dirname, basename, extname } from './path'

// ========================================================================
// Bridge 检测
// ========================================================================

interface AdojasBridge {
  call(json: string): string
}

function getBridge(): AdojasBridge {
  const b = (window as any).AdojasBridge
  if (!b) throw new Error('ADOJAS FS: 仅在 ADOJAS App 中可用')
  return b as AdojasBridge
}

export function isAdojas(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).AdojasBridge !== 'undefined'
}

// ========================================================================
// 文件选择器路径注入（onShowFileChooser → resolveContentUri）
// ========================================================================

/** 获取最近一次通过系统文件选择器选择的文件所在目录 */
export function getLastFileDir(): string | null {
  return (window as any).__adojas_fileDir ?? null
}

/** 获取最近一次通过系统文件选择器选择的文件名 */
export function getLastFileName(): string | null {
  return (window as any).__adojas_fileName ?? null
}

function bridgeCall<T = unknown>(plugin: string, action: string, params: Record<string, unknown> = {}): T {
  const resp = JSON.parse(
    getBridge().call(JSON.stringify({ plugin, action, params, id: crypto.randomUUID() }))
  )
  if (!resp.success) throw new Error(resp.error || 'Bridge call failed')
  return resp.data as T
}

// ========================================================================
// 文件条目
// ========================================================================

export interface Dirent {
  name: string
  isDirectory: boolean
  isFile(): boolean
  size: number
  lastModified: number
}

// ========================================================================
// 文件读写
// ========================================================================

/** 读取文本文件 */
export function readFileSync(path: string, encoding: 'utf-8' | 'utf8' = 'utf-8'): string {
  return bridgeCall<string>('file', 'read', { path })
}

/** 读取文本文件（Promise） */
export async function readFile(path: string, encoding: 'utf-8' | 'utf8' = 'utf-8'): Promise<string> {
  return readFileSync(path, encoding)
}

/** 读取二进制文件为 ArrayBuffer */
export function readFileBufferSync(path: string): ArrayBuffer {
  const base64 = bridgeCall<string>('file', 'readBinary', { path })
  const bin = atob(base64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

/** 读取二进制文件为 Blob */
export function readFileBlob(path: string, mime = ''): Blob {
  const base64 = bridgeCall<string>('file', 'readBinary', { path })
  const bin = atob(base64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

/** 写入文本文件 */
export function writeFileSync(path: string, data: string): void {
  bridgeCall<boolean>('file', 'write', { path, data })
}

/** 写入文本文件（Promise） */
export async function writeFile(path: string, data: string): Promise<void> {
  writeFileSync(path, data)
}

// ========================================================================
// 目录操作
// ========================================================================

/** 列出目录 */
export function readdirSync(path: string): Dirent[] {
  return bridgeCall<any[]>('file', 'list', { dir: path }).map(e => ({
    name: e.name,
    isDirectory: e.isDir,
    isFile: () => !e.isDir,
    size: e.size,
    lastModified: e.lastModified
  }))
}

/** 列出目录（Promise） */
export async function readdir(path: string): Promise<Dirent[]> {
  return readdirSync(path)
}

/** 列出目录下的 .adofai 文件（含子目录） */
export function findLevelFilesSync(dir: string): string[] {
  const results: string[] = []
  function walk(d: string) {
    try {
      const entries = readdirSync(d)
      for (const e of entries) {
        const full = join(d, e.name)
        if (e.isDirectory) walk(full)
        else if (e.name.endsWith('.adofai')) results.push(full)
      }
    } catch { /* skip unreadable */ }
  }
  walk(dir)
  return results
}

// ========================================================================
// 文件状态
// ========================================================================

export interface Stats {
  size: number
  lastModified: number
  isDirectory: boolean
  isFile(): boolean
}

/** 判断文件/目录是否存在 */
export function existsSync(path: string): boolean {
  return bridgeCall<boolean>('file', 'exists', { path })
}

export async function exists(path: string): Promise<boolean> {
  return existsSync(path)
}

/** 删除文件 */
export function unlinkSync(path: string): void {
  bridgeCall<boolean>('file', 'delete', { path })
}

export async function unlink(path: string): Promise<void> {
  unlinkSync(path)
}

// ========================================================================
// 资源自动加载（ADOFAI 关卡引用文件）
// ========================================================================

const baseDirForLevel: { current: string | null } = { current: null }

/** 记录当前关卡所在目录（在 loadLevel 时设置） */
export function setLevelBaseDir(dir: string): void {
  baseDirForLevel.current = dir
  // 同步写入 window 变量，方便其他模块读取
  ;(window as any).__adojas_fileDir = dir
}

export function getLevelBaseDir(): string | null {
  return baseDirForLevel.current ?? getLastFileDir()
}

export interface LevelAssetLoaders {
  loadMusic: (url: string) => void
  loadVideo: (url: string) => void
  registerDecorationImage: (name: string, url: string) => void
  registerCustomBGImage: (name: string, url: string) => void
}

/**
 * 根据 ADOFAI Level 的 settings，自动加载引用的音频/视频/图片。
 *
 * @param levelData    — 解析后的 ADOFAI Level 对象
 * @param levelDir     — 关卡文件所在目录
 * @param loaders      — 回调集合
 */
export async function autoLoadAssets(
  levelData: any,
  levelDir: string,
  loaders: LevelAssetLoaders
): Promise<void> {
  const settings = levelData?.settings
  if (!settings) return

  setLevelBaseDir(levelDir)

  // 1. 音频
  const songFilename = settings.songFilename as string | undefined
  if (songFilename) {
    const exts = ['', '.mp3', '.ogg', '.wav', '.m4a', '.flac']
    for (const ext of exts) {
      try {
        const full = join(levelDir, songFilename + (ext || ''))
        if (ext === '' && existsSync(full)) {
          loaders.loadMusic(URL.createObjectURL(readFileBlob(full)))
          break
        } else if (ext) {
          const p = join(levelDir, songFilename + ext)
          if (existsSync(p)) {
            loaders.loadMusic(URL.createObjectURL(readFileBlob(p)))
            break
          }
        }
      } catch { /* try next */ }
    }
  }

  // 2. 视频背景
  const bgVideo = settings.bgVideo as string | undefined
  if (bgVideo) {
    try {
      const p = join(levelDir, bgVideo)
      if (existsSync(p)) loaders.loadVideo(URL.createObjectURL(readFileBlob(p)))
    } catch { /* ignore */ }
  }

  // 3. 装饰图片
  const decImages = collectDecImages(levelData)
  for (const name of decImages) {
    try {
      const p = join(levelDir, name)
      if (existsSync(p)) loaders.registerDecorationImage(name, URL.createObjectURL(readFileBlob(p)))
    } catch { /* ignore */ }
  }

  // 4. 背景图片：settings.bgImage + 所有 CustomBackground（/旧 SetCustomBG）事件引用的 bgImage
  const bgImages = new Set<string>()
  if (settings.bgImage) bgImages.add(settings.bgImage as string)
  for (const a of (levelData.actions || [])) {
    if (a.eventType === 'CustomBackground' || a.eventType === 'SetCustomBG') {
      const img = a.bgImage || a.image
      if (img) bgImages.add(img)
    }
  }
  for (const bgImage of bgImages) {
    try {
      const p = join(levelDir, bgImage)
      if (existsSync(p)) loaders.registerCustomBGImage(bgImage, URL.createObjectURL(readFileBlob(p)))
    } catch { /* ignore */ }
  }
}

function collectDecImages(level: any): Set<string> {
  const s = new Set<string>()

  const rootDec = level.decorations || level.__decorations || []
  for (const d of rootDec) { if (d.decorationImage) s.add(d.decorationImage) }

  const tiles = level.tiles || []
  for (const tile of tiles) {
    if (tile.addDecorations) {
      for (const d of tile.addDecorations) { if (d.decorationImage) s.add(d.decorationImage) }
    }
  }
  return s
}

export {
  join,
  dirname,
  basename,
  extname,
}
