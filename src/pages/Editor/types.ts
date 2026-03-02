import type { RefObject } from "react"

// 编辑器状态接口
export interface EditorState {
  isLoading: boolean
  loadingProgress: number
  loadingStatus: string
  adofaiFile: any
  mounted: boolean
  themeReady: boolean
  playMode: "preview" | "play" | "pause"
  playModeActive: boolean
  settingsOpen: boolean
  showExitDialog: boolean
}

// 编辑器 refs 接口
export interface EditorRefs {
  containerRef: RefObject<HTMLDivElement>
  fpsCounterRef: RefObject<HTMLDivElement>
  infoRef: RefObject<HTMLDivElement>
  fileInputRef: RefObject<HTMLInputElement>
  audioInputRef: RefObject<HTMLInputElement>
  videoInputRef: RefObject<HTMLInputElement>
  previewerRef: RefObject<any>
}

// 加载函数类型
export type LoadFunction = (content: string) => void | Promise<void>
