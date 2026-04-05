import { useState, useCallback, useEffect } from "react"

/**
 * Extended Document type for Safari/WebKit fullscreen APIs.
 * Safari uses `webkitFullscreenElement` / `webkitRequestFullscreen` / `webkitExitFullscreen`
 * and dispatches `webkitfullscreenchange` instead of `fullscreenchange`.
 */
interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

/**
 * Custom hook for fullscreen toggle with Safari/WebKit compatibility.
 *
 * Standard API:  `element.requestFullscreen()` / `document.exitFullscreen()`
 * WebKit (Safari): `element.webkitRequestFullscreen()` / `document.webkitExitFullscreen()`
 * Event:          `fullscreenchange` / `webkitfullscreenchange`
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Guard against SSR / environments without the API
  const supported = typeof document !== "undefined" && (
    document.fullscreenEnabled ||
    !!(document.documentElement as FullscreenElement).webkitRequestFullscreen
  )

  useEffect(() => {
    if (!supported) return

    const onFullscreenChange = () => {
      const doc = document as FullscreenDocument
      const full =
        !!doc.fullscreenElement ||
        !!doc.webkitFullscreenElement
      setIsFullscreen(full)
    }

    document.addEventListener("fullscreenchange", onFullscreenChange)
    document.addEventListener("webkitfullscreenchange", onFullscreenChange)

    // Sync initial state
    onFullscreenChange()

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange)
    }
  }, [supported])

  const requestFullscreen = useCallback(async (element?: HTMLElement) => {
    const target = element || document.documentElement
    const el = target as FullscreenElement
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen()
      }
    } catch {
      // User rejected or browser blocked the request
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument
    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen()
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      }
    } catch {
      // No fullscreen to exit
    }
  }, [])

  const toggleFullscreen = useCallback(async (element?: HTMLElement) => {
    const doc = document as FullscreenDocument
    const isFull =
      !!doc.fullscreenElement ||
      !!doc.webkitFullscreenElement

    if (isFull) {
      await exitFullscreen()
    } else {
      await requestFullscreen(element)
    }
  }, [requestFullscreen, exitFullscreen])

  return {
    isFullscreen,
    supported,
    toggleFullscreen,
    requestFullscreen,
    exitFullscreen,
  }
}
