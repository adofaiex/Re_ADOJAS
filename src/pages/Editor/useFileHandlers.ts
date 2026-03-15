import { useCallback } from "react"
import * as ADOFAI from "adofai"
import { Parsers, Structure } from "adofai"
import type { ILevelData } from "@/lib/Player/types"
import { Player } from "@/lib/Player/Player"
import { LargeFileParser } from "@/lib/LargeFileParser"

// 类型导入
type ParseProgressEvent = Structure.ParseProgressEvent;

// 使用 StringParser 作为解析器
const StringParser = Parsers.StringParser
const parser = new StringParser()

// 大文件阈值 - V8 字符串限制约为 512MB，我们设置安全阈值
const LARGE_FILE_THRESHOLD = 400 * 1024 * 1024 // 400MB

// 超大文件阈值 - 需要提前预合成 hitsound
const VERY_LARGE_FILE_THRESHOLD = 90 * 1024 * 1024 // 90MB

// 获取加载阶段的显示文本
const getStageText = (stage: string, t: (key: string) => string): string => {
  switch (stage) {
    case 'start':
      return t("loading.stage.start")
    case 'pathData':
      return t("loading.stage.pathData")
    case 'angleData':
    case 'parsing_angleData':
      return t("loading.stage.angleData")
    case 'relativeAngle':
      return t("loading.stage.relativeAngle")
    case 'tilePosition':
      return t("loading.stage.tilePosition")
    case 'complete':
      return t("loading.stage.complete")
    case 'scanning':
      return t("loading.preparingLargeFile")
    case 'parsing_settings':
    case 'parsing_actions':
    case 'parsing_decorations':
      return t("loading.parsingLevel")
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
  
  // 辅助函数：初始化玩家并合成打拍音
  const initializePlayerWithHitsounds = async (loadedLevel: any, isVeryLargeFile: boolean = false): Promise<void> => {
    initializePlayer(loadedLevel)
    
    // Synthesize hitsounds with progress display
    if (previewerRef.current) {
      if (isVeryLargeFile) {
        // 对于超大文件，显示详细的合成进度
        setLoadingProgress(85)
        setLoadingStatus(t("loading.synthesizingHitsounds"))
        
        await previewerRef.current.preSynthesizeHitsoundsWithProgress((percent) => {
          // Map 0-100 to 85-99
          const mappedPercent = 85 + (percent / 100) * 14
          setLoadingProgress(mappedPercent)
        })
      } else {
        setLoadingProgress(96)
        setLoadingStatus(t("loading.synthesizingHitsounds"))
        
        await previewerRef.current.preSynthesizeHitsoundsWithProgress((percent) => {
          // Map 0-100 to 96-100
          const mappedPercent = 96 + (percent / 100) * 4
          setLoadingProgress(mappedPercent)
        })
      }
    }
  }

  // 大文件加载 - 使用 LargeFileParser 直接从 ArrayBuffer 解析
  const loadLargeFile = async (arrayBuffer: ArrayBuffer, isVeryLargeFile: boolean = false): Promise<void> => {
    console.log('[DEBUG] Using LargeFileParser for large file')
    setLoadingStatus("正在预处理大文件...")
    setLoadingProgress(0)

    try {
      // 创建大文件解析器
      const largeFileParser = new LargeFileParser((stage, percent) => {
        setLoadingStatus(getStageText(stage, t))
        // 对于超大文件，解析进度 0-80%，对于普通大文件也是 0-80%
        setLoadingProgress(Math.round(percent * 0.8))
      })

      // 解析文件
      const parsedData = largeFileParser.parse(arrayBuffer)
      console.log('[DEBUG] LargeFileParser result:', {
        hasAngleData: !!parsedData.angleData,
        angleDataLength: parsedData.angleData?.length,
        hasSettings: !!parsedData.settings,
        hasActions: !!parsedData.actions,
        actionsLength: parsedData.actions?.length
      })

      // 使用解析后的数据创建 Level
      const level = new ADOFAI.Level(parsedData, undefined)

      // 监听进度事件
      level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(80 + Math.round(progressEvent.percent * 0.05))
        setLoadingStatus(getStageText(progressEvent.stage, t))
      })

      level.on("load", async (loadedLevel: any): Promise<void> => {
        // 计算瓦片位置
        loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
          setLoadingProgress(80 + Math.round(progressEvent.percent * 0.05))
          setLoadingStatus(getStageText(progressEvent.stage, t))
        })
        loadedLevel.calculateTilePosition()

        setLoadingProgress(85)
        setLoadingStatus(t("loading.buildingScene"))

        // Initialize player and synthesize hitsounds
        await initializePlayerWithHitsounds(loadedLevel, isVeryLargeFile)

        setLoadingProgress(100)
        window.showNotification?.("success", t("editor.notifications.loadSuccess"))
        setIsLoading(false)
        setLoadingProgress(0)
        setLoadingStatus("")
      })

      await level.load()

    } catch (error) {
      console.error('[DEBUG] LargeFileParser error:', error)
      throw error
    }
  }

  // Synchronous loading (blocks UI) - for small files
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
          console.log('[DEBUG] File loaded, starting parse...')
          
          // Get ArrayBuffer directly
          const arrayBuffer = e.target?.result as ArrayBuffer
          const fileSize = arrayBuffer?.byteLength || 0
          console.log('[DEBUG] ArrayBuffer size:', fileSize)
          
          // 判断是否为超大文件 (>90MB) 或大文件 (>400MB)
          const isVeryLargeFile = fileSize > VERY_LARGE_FILE_THRESHOLD
          const isLargeFile = fileSize > LARGE_FILE_THRESHOLD
          console.log('[DEBUG] Is very large file:', isVeryLargeFile, '(threshold:', VERY_LARGE_FILE_THRESHOLD, ')')
          console.log('[DEBUG] Is large file:', isLargeFile, '(threshold:', LARGE_FILE_THRESHOLD, ')')

          if (isLargeFile) {
            // 大文件：直接使用 ArrayBuffer 解析，不转换为字符串
            console.log('[DEBUG] Using large file parser')
            await loadLargeFile(arrayBuffer, isVeryLargeFile)
          } else if (isVeryLargeFile) {
            // 超大文件但不是极大文件：也使用 LargeFileParser
            console.log('[DEBUG] Using large file parser for very large file')
            await loadLargeFile(arrayBuffer, true)
          } else {
            // 小文件：转换为字符串后解析
            const decoder = new TextDecoder('utf-8')
            const content = decoder.decode(arrayBuffer)
            console.log('[DEBUG] Content length:', content?.length)
            
            // Choose loading method based on settings
            if (settings.loadMethod === 'worker') {
              console.log('[DEBUG] Using worker loading')
              await loadWithWorker(content)
            } else if (settings.loadMethod === 'async') {
              console.log('[DEBUG] Using async loading')
              await loadAsync(content)
            } else {
              console.log('[DEBUG] Using sync loading')
              loadSync(content)
            }
          }
        } catch (error) {
          console.error('[DEBUG] Loading error:', error)
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

      // Always use readAsArrayBuffer
      reader.readAsArrayBuffer(file)
    },
    [t, settings, setIsLoading, setLoadingProgress, setLoadingStatus]
  )

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
