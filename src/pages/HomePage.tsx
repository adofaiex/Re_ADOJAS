"use client"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Settings, Code, EditIcon as Cube, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import { version } from "@/control/VersionManager"
import { useI18n } from "@/lib/i18n/context"

export default function HomePage() {
  const { t, mounted } = useI18n()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // 在客户端挂载完成前显示加载状态
  if (!isClient || !mounted) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900">
      {/* Header */}
      <header className="flex justify-between items-center p-4 sm:p-6 w-full">
        <div className="flex items-center gap-2">
          <Cube className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 dark:text-purple-400" />
          <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Re_ADOJAS</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://github.com/flutas-web/Re_ADOJAS" target="_blank" rel="noopener noreferrer">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
            >
              <Github className="w-4 h-4 text-slate-700 dark:text-white" />
            </Button>
          </a>
          <Link to="/settings">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
            >
              <Settings className="w-4 h-4 text-slate-700 dark:text-white" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 sm:px-6 w-full">
        <div className="text-center space-y-6 sm:space-y-8 max-w-2xl w-full">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl">
                <Cube className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur opacity-30"></div>
            </div>
          </div>

          {/* Project Info */}
          <div className="space-y-3 sm:space-y-4">
            <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t("home.title")}
            </h1>
            <div className="space-y-2 text-slate-600 dark:text-slate-300">
              <p className="text-lg sm:text-xl">
                {t("home.version")} <span className="text-purple-400 font-mono">{version.tag}</span>
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <Link to="/editor">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 sm:px-8 py-2 sm:py-3 text-base sm:text-lg">
                <Code className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                {t("home.openEditor")}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      {/*<footer className="text-center py-4 sm:py-6 text-slate-600 dark:text-slate-400 px-4">
        <p className="text-sm sm:text-base">{t("home.builtWith")}</p>
      </footer>
      */}
    </div>
  )
}
