"use client"

import { useState, useEffect } from "react"

export type RendererType = "webgl" | "webgpu"
export type RenderMethodType = "sync" | "async"
export type LoadMethodType = "sync" | "async" | "worker"
export type TargetFramerateType = "auto" | "30" | "60" | "120" | "144" | "165" | "240" | "unlimited"
export type RenderScaleType = "0.75" | "1" | "1.5" | "native"
export type InputMethodType = "sync" | "worker"
export type TrailSampleModeType = "fixed" | "bpm"

interface AppSettings {
  renderer: RendererType
  renderMethod: RenderMethodType
  showTrail: boolean
  trailSampleMode: TrailSampleModeType // 拖尾采样率：fixed=固定 100 点/秒；bpm=随当前 BPM 提高采样率（高 BPM 更平滑）
  targetFramerate: TargetFramerateType
  renderScale: RenderScaleType // 渲染倍率上限（pixelRatio = min(DPR, 该值)）
  loadMethod: LoadMethodType
  inputMethod: InputMethodType // 输入方式：sync 主线程 / worker 队列
  hitsoundEnabled: boolean
  showStats: boolean // 是否使用 stats.js 面板
  useOGGCompression: boolean // 是否使用 OGG 压缩减少内存占用
  disableTrackTexture: boolean // 对 Standard 轨道禁用轨道纹理（高砖块数谱面性能优化）
  musicDelayMs: number // 音乐播放延迟补偿（ms，独立于谱面 offset）
}

const DEFAULT_SETTINGS: AppSettings = {
  renderer: "webgl", // Default to WebGL for compatibility
  renderMethod: "sync", // Default to synchronous rendering
  showTrail: false, // Default to disabled
  trailSampleMode: "bpm", // 高 BPM 下自动加密拖尾采样（低 BPM 与固定模式相同）
  targetFramerate: "auto", // Default to auto (monitor refresh rate)
  renderScale: "1.5", // Cap pixel ratio at min(DPR, 1.5) for fill-rate performance
  loadMethod: "async", // Default to async loading
  inputMethod: "sync", // Default to main-thread synchronous input
  hitsoundEnabled: true, // Default to enabled
  showStats: false, // Default to using default FPS panel
  useOGGCompression: false, // Default to disabled (may affect quality)
  disableTrackTexture: false, // Default to enabled (texture on)
  musicDelayMs: 0, // Default to no compensation
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedSettings = localStorage.getItem("app-settings")
    if (storedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) })
      } catch (e) {
        console.error("Failed to parse app settings", e)
      }
    }
  }, [])

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem("app-settings", JSON.stringify(updated))
      return updated
    })
  }

  return {
    settings,
    updateSettings,
    mounted,
  }
}
