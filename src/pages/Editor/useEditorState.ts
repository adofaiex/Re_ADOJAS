import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "@/hooks/use-theme"
import { useI18n } from "@/lib/i18n/context"
import { useAppSettings } from "@/hooks/use-app-settings"
import * as ADOFAI from "adofai"
import { Parsers, Structure } from "adofai"
import { Player } from "@/lib/Player/Player"
import { ILevelData } from "@/lib/Player/types"
import example from "@/lib/example/line.json"
import { useFileHandlers } from "./useFileHandlers"

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

export function useEditorState() {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const fpsCounterRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const decorationInputRef = useRef<HTMLInputElement>(null)
  const bgImageInputRef = useRef<HTMLInputElement>(null)
  const previewerRef = useRef<Player | null>(null)
  
  // State
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadingProgress, setLoadingProgress] = useState<number>(0)
  const [loadingStatus, setLoadingStatus] = useState<string>("")
  const [adofaiFile, setAdofaiFile] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [themeReady, setThemeReady] = useState(false)
  const [playMode, setPlayMode] = useState<"preview" | "play" | "pause">("preview")
  const [playModeActive, setPlayModeActive] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [showVideoImportDialog, setShowVideoImportDialog] = useState(false)
  
  // Hooks
  const navigate = useNavigate()
  const { theme, resolvedTheme } = useTheme()
  const { t, mounted: i18nMounted } = useI18n()
  const { settings } = useAppSettings()

  // Initialize player with level data
  const initializePlayer = useCallback((loadedLevel: any): void => {
    setAdofaiFile(loadedLevel)

    // Clean up old Player
    if (previewerRef.current) {
      console.log("Disposing old Player...")
      previewerRef.current.destroyPlayer()
      previewerRef.current = null
    }

    // Create new Player
    if (containerRef.current && fpsCounterRef.current && infoRef.current) {
      const player = new Player(loadedLevel as ILevelData)
      player.createPlayer(containerRef.current)
      player.setRenderer(settings.renderer)
      player.setRenderMethod(settings.renderMethod)
      player.setShowTrail(settings.showTrail)
      player.setHitsoundEnabled(settings.hitsoundEnabled)
      player.setUseWorker(settings.useWorker)
      player.setTargetFramerate(settings.targetFramerate)
      player.setStatsPanel(settings.showStats)
      
      // Only set stats callback if not using stats.js
      if (!settings.showStats) {
        player.setStatsCallback((stats) => {
          if (fpsCounterRef.current) {
            fpsCounterRef.current.textContent = `FPS  ${stats.fps.toFixed(2)}`
          }
          if (infoRef.current) {
            const bpm = loadedLevel.settings?.bpm || 0
            infoRef.current.innerHTML = `
              <div class="space-y-1">
                <div>Time: ${(stats.time / 1000).toFixed(2)}s</div>
                <div>Tile: ${stats.tileIndex} / ${loadedLevel.tiles?.length || 0}</div>
                <div>BPM: ${bpm}</div>
              </div>
            `
          }
        })
      }
      
      previewerRef.current = player
    }
  }, [settings])

  // File handlers
  const { handleFileLoad, handleAudioLoad, handleVideoLoad, handleDecorationLoad, handleBGImageLoad, handleExport } = useFileHandlers({
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
  })

  // 视频按钮点击处理 - 显示选择对话框
  const handleVideoButtonClick = useCallback((): void => {
    setShowVideoImportDialog(true)
  }, [])

  // 选择导入视频背景
  const handleImportVideoBackground = useCallback((): void => {
    setShowVideoImportDialog(false)
    videoInputRef.current?.click()
  }, [])

  // 选择导入装饰图片
  const handleImportDecoration = useCallback((): void => {
    setShowVideoImportDialog(false)
    decorationInputRef.current?.click()
  }, [])

  // 取消视频导入对话框
  const handleCancelVideoImport = useCallback((): void => {
    setShowVideoImportDialog(false)
  }, [])

  // 播放功能
  const handlePlay = useCallback((): void => {
    if (!adofaiFile && !previewerRef.current) {
      window.showNotification?.("error", t("editor.notifications.noFileToPlay"))
      return
    }

    if (playMode === "preview") {
      setPlayMode("play")
      setPlayModeActive(true)
      previewerRef.current?.startPlay()
    } else if (playMode === "play") {
      setPlayMode("pause")
      previewerRef.current?.pausePlay()
    } else if (playMode === "pause") {
      setPlayMode("play")
      previewerRef.current?.resumePlay()
    }
  }, [adofaiFile, playMode, t])

  // 退出播放模式
  const handleExitPlayMode = useCallback((): void => {
    setPlayMode("preview")
    setPlayModeActive(false)
    previewerRef.current?.stopPlay()
  }, [])

  // 返回主页处理
  const handleBackClick = useCallback((): void => {
    setShowExitDialog(true)
  }, [])

  const handleConfirmExit = useCallback((): void => {
    // 清理 Player 资源
    if (previewerRef.current) {
      previewerRef.current.destroyPlayer()
      previewerRef.current = null
    }
    navigate("/")
  }, [navigate])

  const handleCancelExit = useCallback((): void => {
    setShowExitDialog(false)
  }, [])

  // 确保组件和主题都已挂载
  useEffect(() => {
    setMounted(true)
    // 延迟一点时间确保主题完全加载
    const timer = setTimeout(() => {
      setThemeReady(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // 监听主题变化，确保主题正确应用
  useEffect(() => {
    if (mounted && resolvedTheme) {
      // 强制重新渲染以确保主题正确应用
      setThemeReady(false)
      const timer = setTimeout(() => {
        setThemeReady(true)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [mounted, resolvedTheme])

  // 监听渲染器设置变化
  useEffect(() => {
    if (previewerRef.current && settings.renderer) {
      previewerRef.current.setRenderer(settings.renderer)
    }
  }, [settings.renderer])

  // 监听渲染方法设置变化
  useEffect(() => {
    if (previewerRef.current && settings.renderMethod) {
      previewerRef.current.setRenderMethod(settings.renderMethod)
    }
  }, [settings.renderMethod])

  // 监听拖尾设置变化
  useEffect(() => {
    if (previewerRef.current) {
      previewerRef.current.setShowTrail(settings.showTrail)
    }
  }, [settings.showTrail])

  // 监听打击音效设置变化
  useEffect(() => {
    if (previewerRef.current) {
      previewerRef.current.setHitsoundEnabled(settings.hitsoundEnabled)
    }
  }, [settings.hitsoundEnabled])

  // 监听多线程渲染设置变化
  useEffect(() => {
    if (previewerRef.current) {
      previewerRef.current.setUseWorker(settings.useWorker)
    }
  }, [settings.useWorker])

  // 监听帧率设置变化
  useEffect(() => {
    if (previewerRef.current) {
      previewerRef.current.setTargetFramerate(settings.targetFramerate)
    }
  }, [settings.targetFramerate])

  // 监听性能面板设置变化
  useEffect(() => {
    if (previewerRef.current) {
      previewerRef.current.setStatsPanel(settings.showStats)
    }
  }, [settings.showStats])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault()
        fileInputRef.current?.click()
      } else if (e.code === "Space") {
        // 空格键只能开始播放，不能暂停
        if (playMode === "preview" || playMode === "pause") {
          e.preventDefault()
          handlePlay()
        }
      } else if (e.code === "Escape" && playModeActive) {
        e.preventDefault()
        handleExitPlayMode()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [playMode, playModeActive, handlePlay, handleExitPlayMode])

  // 初始化示例数据
  useEffect(() => {
    if (!mounted || !i18nMounted || !themeReady) return

    const initializeExample = async (): Promise<void> => {
      try {
        const level = new ADOFAI.Level(example, parser)
        level.on("load", async (loadedLevel: any): Promise<void> => {
          loadedLevel.calculateTilePosition()
          setAdofaiFile(loadedLevel)

          if (previewerRef.current) {
            console.log("Disposing old Player...")
            previewerRef.current.destroyPlayer()
            previewerRef.current = null
          }

          if (containerRef.current && fpsCounterRef.current && infoRef.current) {
            const player = new Player(loadedLevel as ILevelData)
            player.createPlayer(containerRef.current)
            player.setRenderer(settings.renderer)
            player.setRenderMethod(settings.renderMethod)
            player.setShowTrail(settings.showTrail)
            player.setHitsoundEnabled(settings.hitsoundEnabled)
            player.setUseWorker(settings.useWorker)
            player.setTargetFramerate(settings.targetFramerate)
            player.setStatsPanel(settings.showStats)
            
            // Synthesize hitsounds
            await player.preSynthesizeHitsoundsWithProgress()
            
            // Only set stats callback if not using stats.js
            if (!settings.showStats) {
              player.setStatsCallback((stats) => {
                if (fpsCounterRef.current) {
                  fpsCounterRef.current.textContent = `FPS  ${stats.fps.toFixed(2)}`
                }
                if (infoRef.current) {
                  const bpm = loadedLevel.settings?.bpm || 0
                  infoRef.current.innerHTML = `
                    <div class="space-y-1">
                      <div>Time: ${(stats.time / 1000).toFixed(2)}s</div>
                      <div>Tile: ${stats.tileIndex} / ${loadedLevel.tiles?.length || 0}</div>
                      <div>BPM: ${bpm}</div>
                    </div>
                  `
                }
              })
            }
            
            previewerRef.current = player
          }
          window.showNotification?.("success", t("editor.notifications.loadSuccess"))
        })

        await level.load()
      } catch (error) {
        window.showNotification?.("error", t("editor.notifications.loadError"))
        console.error(error)
      }
    }

    initializeExample()
  }, [mounted, i18nMounted, themeReady, t, settings])

  // 监听窗口大小变化，触发Previewer的resize
  useEffect(() => {
    const handleResize = (): void => {
      if (previewerRef.current) {
        // 延迟执行以确保容器尺寸已更新
        setTimeout(() => {
          previewerRef.current?.onWindowResize()
        }, 100)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // 页面卸载时清理资源
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      if (previewerRef.current) {
        previewerRef.current.destroyPlayer()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (previewerRef.current) {
        previewerRef.current.destroyPlayer()
      }
    }
  }, [])

  // 使用 resolvedTheme 来确保获取到正确的主题值
  const currentTheme = resolvedTheme || theme
  const isDark = currentTheme === "dark"

  return {
    // Refs
    containerRef,
    fpsCounterRef,
    infoRef,
    fileInputRef,
    audioInputRef,
    videoInputRef,
    decorationInputRef,
    bgImageInputRef,
    previewerRef,
    
    // State
    isLoading,
    loadingProgress,
    loadingStatus,
    adofaiFile,
    mounted,
    themeReady,
    playMode,
    playModeActive,
    settingsOpen,
    showExitDialog,
    showVideoImportDialog,
    isDark,
    i18nMounted,
    settings,
    
    // Setters
    setSettingsOpen,
    
    // Handlers
    handleFileLoad,
    handleAudioLoad,
    handleVideoLoad,
    handleDecorationLoad,
    handleBGImageLoad,
    handleExport,
    handlePlay,
    handleExitPlayMode,
    handleBackClick,
    handleConfirmExit,
    handleCancelExit,
    handleVideoButtonClick,
    handleImportVideoBackground,
    handleImportDecoration,
    handleCancelVideoImport,
    
    // Translation
    t
  }
}
