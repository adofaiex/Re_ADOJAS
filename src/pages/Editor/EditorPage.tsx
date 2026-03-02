"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, Save, Upload, Download, Music, Video } from "lucide-react"
import { SettingsModal } from "@/components/SettingsModal"
import { LoadingModal } from "@/components/LoadingModal"
import { NotificationSystem } from "./NotificationSystem"
import { useEditorState } from "./useEditorState"

// 主编辑器页面
export default function EditorPage() {
  const {
    // Refs
    containerRef,
    fpsCounterRef,
    infoRef,
    fileInputRef,
    audioInputRef,
    videoInputRef,
    
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
    isDark,
    i18nMounted,
    settings,
    
    // Setters
    setSettingsOpen,
    
    // Handlers
    handleFileLoad,
    handleAudioLoad,
    handleVideoLoad,
    handleExport,
    handlePlay,
    handleExitPlayMode,
    handleBackClick,
    handleConfirmExit,
    handleCancelExit,
    
    // Translation
    t
  } = useEditorState()

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
      <input ref={fileInputRef} type="file" accept=".adofai,.json" onChange={handleFileLoad} className="hidden" />
      <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioLoad} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoLoad} className="hidden" />

      {/* Floating Header Buttons */}
      <div className="absolute top-0 left-0 right-0 px-4 py-3 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className={`${
              isDark
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
            className={`${
              isDark
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
            className={`${
              isDark
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
            className={`${
              isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            } bg-black/20 backdrop-blur-sm ${adofaiFile?.settings?.bgVideo ? "border border-purple-500/50" : ""}`}
            onClick={() => videoInputRef.current?.click()}
            disabled={!adofaiFile}
            title="Load Video"
          >
            <Video className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`${
              isDark
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
            className={`${
              isDark
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
            className={`${
              isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-700"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            } bg-black/20 backdrop-blur-sm`}
            title={t("common.settings")}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancelExit} />
          <div className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl overflow-hidden ${
            isDark ? "bg-slate-800" : "bg-white"
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
                className={`${
                  isDark 
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
        <div
          ref={fpsCounterRef}
          className="absolute top-16 left-4 text-sm font-medium text-white bg-black bg-opacity-50 px-2 py-1 rounded"
        >
          FPS 0.00
        </div>
        <div
          ref={infoRef}
          className="absolute top-16 right-4 text-sm font-medium text-white bg-black bg-opacity-50 px-2 py-1 rounded"
        >
          {/* Info will be updated dynamically */}
        </div>
        {playModeActive && (
          <Button
            variant="outline"
            size="icon"
            className={`absolute top-16 right-32 ${
              isDark
                ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            } bg-transparent`}
            title={t("editor.exitPlayMode")}
            onClick={handleExitPlayMode}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
          </Button>
        )}
        <button
          className={`absolute bottom-4 left-4 w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isDark
              ? "bg-slate-700/80 text-slate-200 hover:bg-slate-600"
              : "bg-white/80 text-slate-700 hover:bg-slate-100"
          } shadow-lg backdrop-blur-sm`}
          title={playMode === "play" ? t("editor.pause"): t("editor.play")}
          id="play-button"
          onClick={handlePlay}
        >
          {playMode === "play" ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
      </div>
    </div>
  )
}
