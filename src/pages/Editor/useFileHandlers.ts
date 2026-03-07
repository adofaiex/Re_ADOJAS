import { useCallback } from "react"
import * as ADOFAI from "adofai"
import { Parsers, Structure } from "adofai"
import type { ILevelData } from "@/lib/Player/types"
import { Player } from "@/lib/Player/Player"

// 类型导入
type ParseProgressEvent = Structure.ParseProgressEvent;

// 使用 StringParser 作为解析器
const StringParser = Parsers.StringParser
const parser = new StringParser()

// 获取加载阶段的显示文本
const getStageText = (stage: ParseProgressEvent['stage'], t: (key: string) => string): string => {
  switch (stage) {
    case 'start':
      return t("loading.stage.start")
    case 'pathData':
      return t("loading.stage.pathData")
    case 'angleData':
      return t("loading.stage.angleData")
    case 'relativeAngle':
      return t("loading.stage.relativeAngle")
    case 'tilePosition':
      return t("loading.stage.tilePosition")
    case 'complete':
      return t("loading.stage.complete")
    default:
      return t("loading.parsingLevel")
  }
}

interface UseFileHandlersProps {
  setIsLoading: (loading: boolean) => void
  setLoadingProgress: (progress: number) => void
  setLoadingStatus: (status: string) => void
  setAdofaiFile: (file: any) => void
  initializePlayer: (loadedLevel: any) => void
  settings: any
  t: (key: string) => string
  containerRef: React.RefObject<HTMLDivElement>
  fpsCounterRef: React.RefObject<HTMLDivElement>
  infoRef: React.RefObject<HTMLDivElement>
  previewerRef: React.MutableRefObject<Player | null>
}

export function useFileHandlers({
  setIsLoading,
  setLoadingProgress,
  setLoadingStatus,
  setAdofaiFile,
  initializePlayer,
  settings,
  t,
  containerRef,
  fpsCounterRef,
  infoRef,
  previewerRef
}: UseFileHandlersProps) {
  
  // 文件加载处理
  const handleFileLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsLoading(true)
      setLoadingProgress(0)
      setLoadingStatus(t("loading.parsingLevel"))

      const reader = new FileReader()

      reader.onload = async (e): Promise<void> => {
        try {
          const content = e.target?.result as string
          
          // Choose loading method based on settings
          if (settings.loadMethod === 'worker') {
            await loadWithWorker(content)
          } else if (settings.loadMethod === 'async') {
            await loadAsync(content)
          } else {
            loadSync(content)
          }
        } catch (error) {
          window.showNotification?.("error", t("editor.notifications.loadError"))
          console.error(error)
          setIsLoading(false)
          setLoadingProgress(0)
          setLoadingStatus("")
        }
      }

      reader.onerror = (): void => {
        window.showNotification?.("error", t("editor.notifications.fileReadError"))
        setIsLoading(false)
        setLoadingProgress(0)
        setLoadingStatus("")
      }

      reader.readAsText(file)
    },
    [t, settings, setIsLoading, setLoadingProgress, setLoadingStatus]
  )

  // 辅助函数：初始化玩家并合成打拍音
  const initializePlayerWithHitsounds = async (loadedLevel: any): Promise<void> => {
    initializePlayer(loadedLevel)
    
    // Synthesize hitsounds with progress display
    if (previewerRef.current) {
      setLoadingProgress(96)
      setLoadingStatus(t("loading.synthesizingHitsounds"))
      
      await previewerRef.current.preSynthesizeHitsoundsWithProgress((percent) => {
        // Map 0-100 to 96-100
        const mappedPercent = 96 + (percent / 100) * 4
        setLoadingProgress(mappedPercent)
      })
    }
  }

  // Synchronous loading (blocks UI)
  const loadSync = (content: string): void => {
    const level = new ADOFAI.Level(content, parser)
    
    // 监听进度事件
    level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
      setLoadingProgress(progressEvent.percent)
      setLoadingStatus(getStageText(progressEvent.stage, t))
    })
    
    level.on("load", async (loadedLevel: any): Promise<void> => {
      // 计算瓦片位置时也会触发进度事件
      loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(progressEvent.percent)
        setLoadingStatus(getStageText(progressEvent.stage, t))
      })
      loadedLevel.calculateTilePosition()
      
      setLoadingProgress(95)
      setLoadingStatus(t("loading.buildingScene"))
      
      // Initialize player and synthesize hitsounds
      await initializePlayerWithHitsounds(loadedLevel)
      
      setLoadingProgress(100)
      window.showNotification?.("success", t("editor.notifications.loadSuccess"))
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingStatus("")
    })
    
    level.load()
  }

  // Asynchronous loading (non-blocking)
  const loadAsync = async (content: string): Promise<void> => {
    const level = new ADOFAI.Level(content, parser)
    
    // 监听进度事件
    level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
      setLoadingProgress(progressEvent.percent)
      setLoadingStatus(getStageText(progressEvent.stage, t))
    })
    
    level.on("load", async (loadedLevel: any): Promise<void> => {
      // 计算瓦片位置时也会触发进度事件
      loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(progressEvent.percent)
        setLoadingStatus(getStageText(progressEvent.stage, t))
      })
      loadedLevel.calculateTilePosition()
      
      setLoadingProgress(95)
      setLoadingStatus(t("loading.buildingScene"))
      
      // Initialize player and synthesize hitsounds
      await initializePlayerWithHitsounds(loadedLevel)
      
      setLoadingProgress(100)
      window.showNotification?.("success", t("editor.notifications.loadSuccess"))
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingStatus("")
    })
    
    await level.load()
  }

  // Worker loading (background thread)
  const loadWithWorker = async (content: string): Promise<void> => {
    // Check if running on file:// protocol - workers don't work there
    if (window.location.protocol === 'file:') {
      console.log('file:// protocol detected, falling back to async loading')
      window.showNotification?.("warning", "Worker mode not supported on file:// protocol, using async mode")
      await loadAsync(content)
      return
    }

    setLoadingProgress(0)
    setLoadingStatus(t("loading.stage.start"))
    
    try {
      // Create worker - correct path to src/lib/Player/levelLoaderWorker.ts
      const worker = new Worker(
        new URL('../../lib/Player/levelLoaderWorker', import.meta.url),
        { type: 'module' }
      )
      
      worker.onmessage = async (e) => {
        const { type, progress, status, stage, current, total, data, error } = e.data
        
        if (type === 'progress') {
          setLoadingProgress(progress)
          // Use translated stage text
          setLoadingStatus(getStageText(stage, t))
        } else if (type === 'result') {
          const { levelData } = data
          
          setLoadingProgress(95)
          setLoadingStatus(t("loading.buildingScene"))
          
          // Create player and synthesize hitsounds
          await initializePlayerWithHitsounds(levelData)
          
          setLoadingProgress(100)
          window.showNotification?.("success", t("editor.notifications.loadSuccess"))
          setIsLoading(false)
          setLoadingProgress(0)
          setLoadingStatus("")
          
          worker.terminate()
        } else if (type === 'error') {
          console.error('Worker error:', error)
          window.showNotification?.("error", `${t("editor.notifications.loadError")}: ${error}`)
          setIsLoading(false)
          setLoadingProgress(0)
          setLoadingStatus("")
          worker.terminate()
        }
      }
      
      worker.onerror = (error) => {
        console.error('Worker onerror:', error.message, error.filename, error.lineno)
        window.showNotification?.("error", `Worker failed: ${error.message}`)
        setIsLoading(false)
        setLoadingProgress(0)
        setLoadingStatus("")
        worker.terminate()
      }
      
      // Start loading
      worker.postMessage({ type: 'load', content })
      
    } catch (error) {
      console.error('Failed to create worker:', error)
      // Fallback to async loading
      await loadAsync(content)
    }
  }

  // 音频加载处理
  const handleAudioLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return

      const url = URL.createObjectURL(file)
      
      if (previewerRef.current) {
          previewerRef.current.loadMusic(url)
          window.showNotification?.("success", "Audio loaded successfully")
      } else {
          window.showNotification?.("warning", "Please load a level first")
      }
    },
    [previewerRef]
  )

  // 视频加载处理
  const handleVideoLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return

      const url = URL.createObjectURL(file)
      
      if (previewerRef.current) {
          previewerRef.current.loadVideo(url)
          window.showNotification?.("success", "Video loaded successfully")
      } else {
          window.showNotification?.("warning", "Please load a level first")
      }
    },
    [previewerRef]
  )

  // 导出文件功能
  const handleExport = useCallback((): void => {
    if (!previewerRef.current) {
      window.showNotification?.("error", t("editor.notifications.noFileToExport"))
      return
    }

    try {
      const adofaiFile = (previewerRef.current as any).levelData
      const exportData = JSON.stringify(adofaiFile, null, 2)
      const blob = new Blob([exportData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "level.adofai"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      window.showNotification?.("success", t("editor.notifications.exportSuccess"))
    } catch (error) {
      console.error("Export error:", error)
      window.showNotification?.("error", t("editor.notifications.exportError"))
    }
  }, [t, previewerRef])

  return {
    handleFileLoad,
    handleAudioLoad,
    handleVideoLoad,
    handleExport
  }
}
