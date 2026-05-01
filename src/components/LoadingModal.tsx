import { useI18n } from "@/lib/i18n/context"
import type { LoadMethodType } from "@/hooks/use-app-settings"

interface LoadingModalProps {
  isOpen: boolean
  progress: number // 0-100
  status?: string // Optional status text
  loadMethod?: LoadMethodType // Loading method (sync/async/worker)
}

export function LoadingModal({ isOpen, progress, status, loadMethod }: LoadingModalProps) {
  const { t } = useI18n()

  if (!isOpen) return null

  // Get display text for load method
  const getLoadMethodText = (): string => {
    switch (loadMethod) {
      case 'sync':
        return t("settings.loadMethodSync")
      case 'async':
        return t("settings.loadMethodAsync")
      case 'worker':
        return t("settings.loadMethodWorker")
      default:
        return ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg 
              className="animate-spin h-5 w-5 text-purple-500" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t("loading.title")}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Load method indicator */}
          {loadMethod && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t("loading.method")}:</span>
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                {getLoadMethodText()}
              </span>
            </div>
          )}

          {/* Status text */}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {status || t("loading.parsingLevel")}
          </p>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{t("loading.progress")}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Tips */}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t("loading.tip")}
          </p>
        </div>
      </div>
    </div>
  )
}
