"use client"

import { useState, useEffect } from "react"

export type RendererType = "webgl" | "webgpu"
export type RenderMethodType = "sync" | "async"
export type LoadMethodType = "sync" | "async" | "worker"
export type TargetFramerateType = "auto" | "30" | "60" | "120" | "144" | "165" | "240" | "unlimited"

interface AppSettings {
  renderer: RendererType
  renderMethod: RenderMethodType
  showTrail: boolean
  targetFramerate: TargetFramerateType
  loadMethod: LoadMethodType
  hitsoundEnabled: boolean
  showStats: boolean // 是否使用 stats.js 面板
  useOGGCompression: boolean // 是否使用 OGG 压缩减少内存占用
  disableTrackTexture: boolean // 对 Standard 轨道禁用轨道纹理（高砖块数谱面性能优化）
}

const DEFAULT_SETTINGS: AppSettings = {
  renderer: "webgl", // Default to WebGL for compatibility
  renderMethod: "sync", // Default to synchronous rendering
  showTrail: false, // Default to disabled
  targetFramerate: "auto", // Default to auto (monitor refresh rate)
  loadMethod: "async", // Default to async loading
  hitsoundEnabled: true, // Default to enabled
  showStats: false, // Default to using default FPS panel
  useOGGCompression: false, // Default to disabled (may affect quality)
  disableTrackTexture: false, // Default to enabled (texture on)
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
