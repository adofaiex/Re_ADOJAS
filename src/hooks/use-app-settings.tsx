"use client"

import { useState, useEffect } from "react"

export type RendererType = "webgl" | "webgpu"
export type RenderMethodType = "sync" | "async"

interface AppSettings {
  renderer: RendererType
  renderMethod: RenderMethodType
  showTrail: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  renderer: "webgl", // Default to WebGL for compatibility
  renderMethod: "sync", // Default to synchronous rendering
  showTrail: false, // Default to disabled
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
