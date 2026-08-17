"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, Save, Upload, Download, Music, Video, Image, Maximize, Minimize } from "lucide-react"
import { SettingsModal } from "@/components/SettingsModal"
import { LoadingModal } from "@/components/LoadingModal"
import { NotificationSystem } from "./NotificationSystem"
import { useEditorState } from "./useEditorState"
import { useFullscreen } from "./useFullscreen"
import bullseyeLenient from "@/assets/ui/lenient-bullseye.json"
import bullseyeNormal from "@/assets/ui/normal-bullseye.json"
import bullseyeStrict from "@/assets/ui/strict-bullseye.json"
import noFailImg from "@/assets/ui/no_fail.json"
import ottoOff from "@/assets/ui/otto_off.json"
import ottoOn from "@/assets/ui/otto_on.json"
import ottoLeft from "@/assets/ui/otto_left.json"
import ottoRight from "@/assets/ui/otto_right.json"
import ottoOffLeft from "@/assets/ui/otto_off_left.json"
import ottoOffRight from "@/assets/ui/otto_off_right.json"
import ottoMiss from "@/assets/ui/otto_miss.json"
import ottoHappy from "@/assets/ui/otto_happy.json"
import ottoNervousOn from "@/assets/ui/otto_nervous_on.json"
import ottoNervousOff from "@/assets/ui/otto_nervous_off.json"

// 主编辑器页面
export default function EditorPage() {
  const {
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
  } = useEditorState()

  const [timelineOpen, setTimelineOpen] = useState(false)
  const [sliderValue, setSliderValue] = useState(0)

  const player = previewerRef.current
  const totalMs = player?.totalDurationMs ?? 600000

  // Poll slider position during playback
  useEffect(() => {
    if (!playModeActive) return
    const id = setInterval(() => {
      if (previewerRef.current) {
        setSliderValue(previewerRef.current.currentTimeMs)
      }
    }, 100)
    return () => clearInterval(id)
  }, [playModeActive])

  // Reset timeline when a new level is loaded
  useEffect(() => {
    setSliderValue(0)
  }, [adofaiFile])

  // Sync slider when tile is selected via click/keyboard
  useEffect(() => {
    if (!timelineOpen || !previewerRef.current) return
    const idx = previewerRef.current.selectedTileIndex
    if (idx !== null) {
      const t = previewerRef.current.getTileTimeMs(idx)
      setSliderValue(t)
    }
  }, [timelineOpen, previewerRef.current?.selectedTileIndex])

  // Keyboard nav for tile selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!previewerRef.current) return
      if (previewerRef.current.isPlayerPlaying) return
      const cur = previewerRef.current.selectedTileIndex
      const len = previewerRef.current.tileCount
      if (len === 0) return

      if (e.code === 'Home') {
        e.preventDefault()
        previewerRef.current.selectTile(0)
      } else if (e.code === 'End') {
        e.preventDefault()
        previewerRef.current.selectTile(len - 1)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        const next = cur !== null ? Math.min(cur + 1, len - 1) : 0
        previewerRef.current.selectTile(next)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        const prev = cur !== null ? Math.max(cur - 1, 0) : 0
        previewerRef.current.selectTile(prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handlePlayWithSeek = useCallback(() => {
    const p = previewerRef.current
    const selectedIdx = p?.selectedTileIndex ?? null
    console.log('[Play] selectedTileIndex:', selectedIdx, 'playMode:', playMode)
    if (p) p.deselectTile()
    if (playMode === 'preview' && selectedIdx !== null && p) {
      const t = p.getTileTimeMs(selectedIdx)
      console.log('[Play] seek to tile', selectedIdx, 'timeMs:', t)
      handlePlay(t)
      return
    }
    console.log('[Play] no tile selected, start from beginning')
    handlePlay()
  }, [playMode, handlePlay])

  const handleExitWithReset = useCallback(() => {
    const p = previewerRef.current
    if (p) {
      p.deselectTile()
      p.resetCameraZoomRotation()
    }
    handleExitPlayMode()
  }, [handleExitPlayMode])

  const { isFullscreen, toggleFullscreen } = useFullscreen()

  // ── otto 自动播放按钮（官方彩蛋逻辑）──
  const auto = !manualMode
  const highBPM = (previewerRef.current?.getHighestBPM?.() ?? 0) >= 300

  // 宠物抚摸：鼠标停留在 otto 上并移动 ≥1.5s（且自动播放中）→ happy
  const [petting, setPetting] = useState(false)
  const [petHappy, setPetHappy] = useState(false)
  const petStartRef = useRef(0)

  const handleOttoPetEnter = useCallback((): void => {
    petStartRef.current = Date.now()
    setPetting(true)
    setPetHappy(false)
  }, [])

  const handleOttoPetMove = useCallback((): void => {
    if (!auto) return
    petStartRef.current = Date.now()
    setPetHappy(false)
  }, [auto])

  const handleOttoPetLeave = useCallback((): void => {
    setPetting(false)
    setPetHappy(false)
  }, [])

  useEffect(() => {
    if (!auto || !petting) {
      setPetHappy(false)
      return
    }
    const id = setInterval(() => {
      if (Date.now() - petStartRef.current >= 1500) setPetHappy(true)
    }, 100)
    return () => clearInterval(id)
  }, [auto, petting])

  // otto 表情选择（优先级：miss > 眨眼 > happy > 常态）
  let ottoSrc = ottoOff
  if (auto) {
    if (autoFailed) {
      ottoSrc = ottoMiss
    } else if (ottoBlinkIdx > 0) {
      ottoSrc = ottoBlinkIdx === 1 ? ottoLeft : ottoRight
    } else if (petHappy) {
      ottoSrc = ottoHappy
    } else {
      ottoSrc = highBPM ? ottoNervousOn : ottoOn
    }
  } else {
    if (autoFailed) {
      ottoSrc = ottoMiss
    } else if (ottoBlinkIdx > 0) {
      ottoSrc = ottoBlinkIdx === 1 ? ottoOffLeft : ottoOffRight
    } else {
      ottoSrc = highBPM ? ottoNervousOff : ottoOff
    }
  }

  // 如果还没有完全挂载，显示加载状态
  if (!mounted || !i18nMounted || !themeReady) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className={`h-screen ${isDark ? "bg-slate-900" : "bg-slate-50"} overflow-hidden relative`}>
      <NotificationSystem />

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".adofai,.json,.zip" onChange={handleFileLoad} className="hidden" />
      <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioLoad} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoLoad} className="hidden" />
      <input ref={decorationInputRef} type="file" accept="image/*" multiple onChange={handleDecorationLoad} className="hidden" />
      <input ref={bgImageInputRef} type="file" accept="image/*" multiple onChange={handleBGImageLoad} className="hidden" />

      {/* Floating Header Buttons */}
      <div className="absolute top-0 left-0 right-0 px-4 py-3 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm`}
            title={t("common.back")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            id="butload"
            title={isLoading ? t("common.loading") : t("editor.loadFile")}
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm`}
            onClick={() => audioInputRef.current?.click()}
            disabled={!adofaiFile}
            title="Load Music"
          >
            <Music className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm ${adofaiFile?.settings?.bgVideo ? "border border-purple-500/50" : ""}`}
            onClick={handleVideoButtonClick}
            disabled={!adofaiFile}
            title="Load Video/Decoration"
          >
            <Video className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm`}
            onClick={handleExport}
            disabled={!adofaiFile}
            title={t("editor.export")}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm`}
            title={t("editor.save")}
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm`}
            title={t("common.settings")}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFullscreen()}
            className={`${isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              } bg-black/20 backdrop-blur-sm`}
            title={isFullscreen ? "退出全屏" : "全屏"}
          >
            {isFullscreen
              ? <Minimize className="w-4 h-4" />
              : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancelExit} />
          <div className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl overflow-hidden ${isDark ? "bg-slate-800" : "bg-white"
            }`}>
            <div className={`px-6 py-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                {t("editor.exitDialog.title")}
              </h3>
            </div>
            <div className={`px-6 py-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {t("editor.exitDialog.message")}
            </div>
            <div className={`px-6 py-4 flex justify-end gap-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <Button
                onClick={handleConfirmExit}
                className={`${isDark
                    ? "bg-slate-700 hover:bg-slate-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                  }`}
              >
                {t("editor.exitDialog.discard")}
              </Button>
              <Button
                onClick={handleCancelExit}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {t("editor.exitDialog.no")}
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancelExit}
                className={isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"}
              >
                {t("editor.exitDialog.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video Import Dialog */}
      {showVideoImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancelVideoImport} />
          <div className={`relative w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden ${isDark ? "bg-slate-800" : "bg-white"
            }`}>
            <div className={`px-6 py-4 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                {t("editor.videoImport.title") || "导入媒体"}
              </h3>
            </div>
            <div className={`px-6 py-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleImportVideoBackground}
                  className={`w-full justify-start gap-3 ${isDark
                      ? "bg-purple-600 hover:bg-purple-500 text-white"
                      : "bg-purple-500 hover:bg-purple-600 text-white"
                    }`}
                >
                  <Video className="w-5 h-5" />
                  <span>{t("editor.videoImport.videoBackground") || "导入视频背景"}</span>
                </Button>
                <Button
                  onClick={handleImportDecoration}
                  className={`w-full justify-start gap-3 ${isDark
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-blue-500 hover:bg-blue-600 text-white"
                    }`}
                >
                  <Image className="w-5 h-5" />
                  <span>{t("editor.videoImport.decoration") || "导入装饰图片"}</span>
                </Button>
                <Button
                  onClick={() => bgImageInputRef.current?.click()}
                  className={`w-full justify-start gap-3 ${isDark
                      ? "bg-green-600 hover:bg-green-500 text-white"
                      : "bg-green-500 hover:bg-green-600 text-white"
                    }`}
                >
                  <Image className="w-5 h-5" />
                  <span>{t("editor.videoImport.bgImage") || "导入背景图片"}</span>
                </Button>
              </div>
            </div>
            <div className={`px-6 py-4 flex justify-end border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <Button
                variant="ghost"
                onClick={handleCancelVideoImport}
                className={isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"}
              >
                {t("common.cancel") || "取消"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Loading Modal */}
      <LoadingModal
        isOpen={isLoading}
        progress={loadingProgress}
        status={loadingStatus}
        loadMethod={settings.loadMethod}
      />

      {/* Full-screen Canvas Area */}
      <div ref={containerRef} className="absolute inset-0">
{/* 右下角：判定选择 / 不死模式 / 自动播放（otto）——官方编辑器布局 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-3 select-none">
        {/* 判定选择：单按钮循环切换（宽→标→严） */}
        <button
          className="shrink-0 flex items-center justify-center"
          style={{ width: 37, height: 37 }}
          title={`判定难度：${judgeDifficulty === "Lenient" ? "宽" : judgeDifficulty === "Strict" ? "严" : "标"}（点击切换）`}
          onClick={handleCycleJudgeDifficulty}
        >
          <img
            src={judgeDifficulty === "Lenient" ? bullseyeLenient : judgeDifficulty === "Strict" ? bullseyeStrict : bullseyeNormal}
            alt="判定难度"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            className="drop-shadow-lg"
            draggable={false}
          />
        </button>

        {/* 不死模式：关闭时降低透明度 */}
        <button
          className="shrink-0 flex items-center justify-center"
          style={{ width: 40, height: 40 }}
          title={noFail ? "不死模式：开启（miss 自动矫正）" : "不死模式：关闭"}
          onClick={handleToggleNoFail}
        >
          <img
            src={noFailImg}
            alt="不死模式"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            className={`drop-shadow-lg transition-opacity ${noFail ? "opacity-100" : "opacity-45 grayscale"}`}
            draggable={false}
          />
        </button>

        {/* 自动播放（otto）：开 = 关闭手打 */}
        <button
          className="shrink-0 flex items-center justify-center"
          style={{ width: 56, height: 56 }}
          title={auto ? "自动播放：开启（点击关闭，进入手动判定）" : "自动播放：关闭（点击开启自动播放）"}
          onClick={handleToggleManualPlay}
          onMouseEnter={handleOttoPetEnter}
          onMouseMove={handleOttoPetMove}
          onMouseLeave={handleOttoPetLeave}
        >
          <img
            src={ottoSrc}
            alt="自动播放"
            style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'translate(-12px, -7px)' }}
            className={`drop-shadow-lg transition-all duration-150 ${manualMode ? "opacity-45 grayscale" : highBPM ? "otto-red" : ""}`}
            draggable={false}
          />
        </button>
      </div>
        <div className="absolute bottom-4 left-4 flex items-end gap-4">
          <div className="relative inline-block">
            <button
              className={`z-10 w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isDark
                  ? "bg-slate-700/80 text-slate-200 hover:bg-slate-600"
                  : "bg-white/80 text-slate-700 hover:bg-slate-100"
                } shadow-lg backdrop-blur-sm`}
              title={playMode === "play" ? t("editor.pause") : t("editor.play")}
              id="play-button"
              onClick={handlePlayWithSeek}
            >
              {playMode === "play" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </button>
            {playModeActive && (
              <button
                className={`absolute -bottom-1 -right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors z-0 ${isDark
                    ? "bg-slate-700/80 text-slate-200 hover:bg-slate-600"
                    : "bg-white/80 text-slate-700 hover:bg-slate-100"
                  } shadow-lg backdrop-blur-sm`}
                title={t("editor.exitPlayMode")}
                onClick={handleExitWithReset}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${isDark
                  ? "bg-slate-700/80 text-slate-300 hover:bg-slate-600"
                  : "bg-white/80 text-slate-600 hover:bg-slate-100"
                } shadow-lg backdrop-blur-sm`}
              title="Timeline"
              onClick={() => setTimelineOpen(!timelineOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="10" width="18" height="4" rx="1" /><circle cx="7" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="17" cy="12" r="2" /></svg>
            </button>
            {timelineOpen && (
              <div className={`flex items-center gap-2 h-8 px-3 rounded-full ${isDark ? "bg-slate-700/80" : "bg-white/80"} shadow-lg backdrop-blur-sm`}>
                <input
                  type="range"
                  min={0}
                  max={totalMs}
                  value={sliderValue}
                  onChange={e => {
                    const v = Number(e.target.value)
                    setSliderValue(v)
                    const p = previewerRef.current
                    if (p) {
                      p.seekTo(v, !playModeActive)
                      const idx = p.getTileIndexAtTime(v)
                      p.selectTile(idx, false)
                    }
                  }}
                  className="flex-1 min-w-[10rem] h-1.5 cursor-pointer accent-blue-500"
                />
                <span className={`text-xs tabular-nums min-w-[5rem] text-right ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {formatTime(sliderValue)} / {formatTime(totalMs)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, "0")}`
}
