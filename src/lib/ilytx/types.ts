/** .ilytx 导出选项（导出弹窗 → useFileHandlers.handleExportConfirm）。 */
export interface IlytxExportOptions {
  /** 目标格式：ilytx（二进制 + tar + xz）或 adofai（文本，走库自身导出） */
  format: 'ilytx' | 'adofai'
  /** 内置音频（仅 ilytx；无音频加载时无效） */
  embedAudio: boolean
  /** 内置装饰/背景图片（仅 ilytx） */
  embedDecor: boolean
  /** xz 等级 */
  xzLevel: 1 | 3 | 6
}

/** tar 内 manifest.json 的内容 —— 版本与成员清单（解码端据此找成员）。 */
export interface IlytxManifest {
  format: 'ilytx'
  version: number
  generator: string
  created: number
  tileCount: number
  /** 关卡自身的 songFilename（仅信息，实际音频在 audio/ 成员里） */
  songFilename?: string
  /** 内置成员名（不含 audio/ decor/ bg/ 前缀） */
  audio?: string
  decor: string[]
  bg: string[]
}

export const ILYTX_VERSION = 2
export const MEMBER_LEVEL = 'level.ilybin'
export const MEMBER_MANIFEST = 'manifest.json'
