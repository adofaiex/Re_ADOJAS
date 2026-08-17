import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "@/hooks/use-theme"
import { useI18n } from "@/lib/i18n/context"
import { useAppSettings } from "@/hooks/use-app-settings"
import * as ADOFAI from "adofai"
import { Parsers, Structure } from "adofai"
import { Player } from "@/lib/Player/Player"
import { ILevelData } from "@/lib/Player/types"
import type { Difficulty } from "@/lib/Player/Judge"
import example from "@/lib/example/line.json"
import { useFileHandlers } from "./useFileHandlers"


// 类型导入
type ParseProgressEvent = Structure.ParseProgressEvent;

// 手打/判定设置持久化（localStorage）
const PLAYBACK_SETTINGS_KEY = "editor-playback-settings"
interface PlaybackSettings {
  manualMode: boolean
  noFail: boolean
  judgeDifficulty: Difficulty
}
const DEFAULT_PLAYBACK: PlaybackSettings = {
  manualMode: false,
  noFail: false,
  judgeDifficulty: "Normal",
}
function loadPlaybackSettings(): PlaybackSettings {
  try {
    const raw = localStorage.getItem(PLAYBACK_SETTINGS_KEY)
    if (!raw) return DEFAULT_PLAYBACK
    const parsed = JSON.parse(raw)
    return {
      manualMode: typeof parsed.manualMode === "boolean" ? parsed.manualMode : DEFAULT_PLAYBACK.manualMode,
      noFail: typeof parsed.noFail === "boolean" ? parsed.noFail : DEFAULT_PLAYBACK.noFail,
      judgeDifficulty: parsed.judgeDifficulty === "Lenient" || parsed.judgeDifficulty === "Strict"
        ? parsed.judgeDifficulty
        : DEFAULT_PLAYBACK.judgeDifficulty,
    }
  } catch {
    return DEFAULT_PLAYBACK
  }
}
function savePlaybackSettings(settings: PlaybackSettings): void {
  try {
    localStorage.setItem(PLAYBACK_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // localStorage 不可用时忽略（如隐私模式）
  }
}

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 手动游玩状态（localStorage 持久化，导入谱面/刷新后继承）
  const [manualMode, setManualMode] = useState(() => loadPlaybackSettings().manualMode)
  const [noFail, setNoFail] = useState(() => loadPlaybackSettings().noFail)
  // 判定难度：宽（Lenient）/ 标（Normal）/ 严（Strict）
  const [judgeDifficulty, setJudgeDifficultyState] = useState<Difficulty>(() => loadPlaybackSettings().judgeDifficulty)

  // otto 表情状态
  const [autoFailed, setAutoFailed] = useState(false)
  const [ottoBlinkIdx, setOttoBlinkIdx] = useState(0) // 0=无眨眼，1/2=左右看
  const ottoBlinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ottoBlinkFlip = useRef(false)
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

  // otto：每次成功判定/矫正 → 左右看一拍时长（官方 OttoBlink）
  const handleManualHit = useCallback((): void => {
    setAutoFailed(false)
    ottoBlinkFlip.current = !ottoBlinkFlip.current
    setOttoBlinkIdx(ottoBlinkFlip.current ? 1 : 2)
    const p = previewerRef.current
    const bpm = p?.getCurrentBPM?.() ?? 100
    const durMs = Math.max(200, (60 / bpm) * 1000)
    if (ottoBlinkTimer.current) clearTimeout(ottoBlinkTimer.current)
    ottoBlinkTimer.current = setTimeout(() => setOttoBlinkIdx(0), durMs)
  }, [])

  // 绑定 otto 事件到 Player
  const bindOttoEvents = useCallback((player: Player | null): void => {
    if (!player) return
    player.setManualEventCallbacks({
      onHit: handleManualHit,
      onCorrect: handleManualHit,
      onFail: () => setAutoFailed(true),
    })
  }, [handleManualHit])

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
    if (containerRef.current) {
      const player = new Player(loadedLevel)
      player.createPlayer(containerRef.current)
      player.setRenderer(settings.renderer)
      player.setRenderMethod(settings.renderMethod)
      player.setShowTrail(settings.showTrail)
      player.setHitsoundEnabled(settings.hitsoundEnabled)
      player.setTargetFramerate(settings.targetFramerate)
      player.setOGGCompression(settings.useOGGCompression)
      player.setStatsPanel(settings.showStats)
      player.setDisableTrackTexture(settings.disableTrackTexture)
      
      previewerRef.current = player
      bindOttoEvents(player)
      // 重新应用手动模式状态到新 Player
      if (manualMode) {
        player.enableManualPlay({ noFail })
      }
      player.setJudgmentI18n?.({ t })
    }
  }, [settings, manualMode, noFail, t, bindOttoEvents])

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
  const handlePlay = useCallback((startAtMs?: number): void => {
    if (!adofaiFile && !previewerRef.current) {
      window.showNotification?.("error", t("editor.notifications.noFileToPlay"))
      return
    }

    // 死亡后重新播放 → otto 恢复常态
    setAutoFailed(false)

    if (playMode === "preview") {
      let startTime = startAtMs
      if (startTime === undefined) {
        const p = previewerRef.current
        const selIdx = p?.selectedTileIndex
        if (selIdx !== null && selIdx !== undefined) {
          startTime = p!.getTileTimeMs(selIdx)
        } else {
          startTime = p?.currentTimeMs ?? 0
        }
      }
      setPlayMode("play")
      setPlayModeActive(true)
      console.log('[EditorState] calling startPlay with:', startTime)
      previewerRef.current?.startPlay(startTime)
    } else if (playMode === "play") {
      const p = previewerRef.current
      // 死亡后按播放键 → 完整重开
      if (p?.isManualDead?.()) {
        p.retryManual()
        return
      }
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

  // 切换手动游玩模式（关闭自动播放，用键盘判定）
  const handleToggleManualPlay = useCallback((): void => {
    setManualMode(prev => {
      const next = !prev
      // 官方 ToggleAuto：切换即清除 autoFailed（otto 恢复常态）
      setAutoFailed(false)
      setOttoBlinkIdx(0)
      if (ottoBlinkTimer.current) clearTimeout(ottoBlinkTimer.current)
      const p = previewerRef.current
      if (p) {
        if (next) {
          p.enableManualPlay({ noFail })
        } else {
          p.disableManualPlay()
        }
      }
      savePlaybackSettings({ manualMode: next, noFail, judgeDifficulty })
      return next
    })
  }, [noFail, judgeDifficulty])

  // 切换不死模式
  const handleToggleNoFail = useCallback((): void => {
    setNoFail(prev => {
      const next = !prev
      previewerRef.current?.setManualNoFail(next)
      savePlaybackSettings({ manualMode, noFail: next, judgeDifficulty })
      return next
    })
  }, [manualMode, judgeDifficulty])

  // 设置判定难度
  const handleSetJudgeDifficulty = useCallback((d: Difficulty): void => {
    setJudgeDifficultyState(d)
    previewerRef.current?.setJudgeDifficulty(d)
    savePlaybackSettings({ manualMode, noFail, judgeDifficulty: d })
  }, [manualMode, noFail])

  // 循环切换判定难度（官方：单个按钮点击循环 Lenient→Normal→Strict）
  const handleCycleJudgeDifficulty = useCallback((): void => {
    const order: Difficulty[] = ["Lenient", "Normal", "Strict"]
    const idx = order.indexOf(judgeDifficulty)
    handleSetJudgeDifficulty(order[(idx + 1) % order.length])
  }, [judgeDifficulty, handleSetJudgeDifficulty])

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

  // Apply settings changes to existing player in real-time
  useEffect(() => {
    const player = previewerRef.current
    if (player) {
      player.setRenderer(settings.renderer)
      player.setRenderMethod(settings.renderMethod)
      player.setShowTrail(settings.showTrail)
      player.setHitsoundEnabled(settings.hitsoundEnabled)
      player.setTargetFramerate(settings.targetFramerate)
      player.setOGGCompression(settings.useOGGCompression)
      player.setStatsPanel(settings.showStats)
      player.setDisableTrackTexture(settings.disableTrackTexture)
    }
  }, [
    settings.renderer,
    settings.renderMethod,
    settings.showTrail,
    settings.hitsoundEnabled,
    settings.targetFramerate,
    settings.showStats,
    settings.disableTrackTexture,
  ])

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

          if (containerRef.current) {
            const player = new Player(loadedLevel)
            player.createPlayer(containerRef.current)
            player.setRenderer(settings.renderer)
            player.setRenderMethod(settings.renderMethod)
            player.setShowTrail(settings.showTrail)
            player.setHitsoundEnabled(settings.hitsoundEnabled)
            player.setTargetFramerate(settings.targetFramerate)
            player.setStatsPanel(settings.showStats)
            
            player.setDisableTrackTexture(settings.disableTrackTexture)
            
            // Synthesize hitsounds
            await player.preSynthesizeHitsoundsWithProgress()
            
            previewerRef.current = player
            bindOttoEvents(player)
            // 重新应用手动模式状态到新 Player
            if (manualMode) {
              player.enableManualPlay({ noFail })
            }
            player.setJudgmentI18n?.({ t })
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
      if (ottoBlinkTimer.current) clearTimeout(ottoBlinkTimer.current)
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
    manualMode,
    noFail,
    judgeDifficulty,
    autoFailed,
    ottoBlinkIdx,
    setAutoFailed,
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
    handleToggleManualPlay,
    handleToggleNoFail,
    handleSetJudgeDifficulty,
    handleCycleJudgeDifficulty,
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
