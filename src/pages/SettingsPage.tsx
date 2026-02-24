"use client"

import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useTheme } from "@/hooks/use-theme"
import { useI18n } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Monitor, Sun, Moon, Globe } from "lucide-react"
import { locales, localeNames, type Locale } from "@/lib/i18n/config"
import { useAppSettings } from "@/hooks/use-app-settings"

export default function SettingsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isClient, setIsClient] = useState(false)
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, t, mounted } = useI18n()
  const { settings, updateSettings } = useAppSettings()

  useEffect(() => {
    setIsClient(true)
  }, [])

  // 在客户端挂载完成前显示加载状态
  if (!isClient || !mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    )
  }

  const settingsCategories = [
    {
      id: "general",
      title: t("settings.categories.general"),
      icon: Monitor,
      settings: [
        {
          id: "appearance",
          title: t("settings.appearance.title"),
          description: t("settings.appearance.description"),
          type: "theme",
        },
        {
          id: "language",
          title: t("settings.language.title"),
          description: t("settings.language.description"),
          type: "language",
        },
        {
          id: "renderer",
          title: "Renderer",
          description: "Select the graphics renderer backend.",
          type: "renderer",
        },
      ],
    },
  ]

  const filteredCategories = settingsCategories
    .map((category) => ({
      ...category,
      settings: category.settings.filter(
        (setting) =>
          setting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          setting.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => category.settings.length > 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <Link to="/">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t("settings.title")}</h1>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
          <Input
            placeholder={t("settings.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20"
          />
        </div>

        {/* Settings Categories */}
        {filteredCategories.map((category) => (
          <Card
            key={category.id}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/20"
          >
            <CardHeader className="pb-4">
              <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                <category.icon className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {category.settings.map((setting) => (
                <div key={setting.id} className="space-y-3">
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300 text-base font-medium">{setting.title}</Label>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{setting.description}</p>
                  </div>

                  {setting.type === "theme" && (
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white w-full sm:w-48 hover:bg-slate-50 dark:hover:bg-slate-600 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50">
                        <SelectItem
                          value="system"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            {t("settings.appearance.system")}
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="light"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Sun className="w-4 h-4" />
                            {t("settings.appearance.light")}
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="dark"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Moon className="w-4 h-4" />
                            {t("settings.appearance.dark")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {setting.type === "language" && (
                    <Select value={locale} onValueChange={(value: Locale) => setLocale(value)}>
                      <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white w-full sm:w-48 hover:bg-slate-50 dark:hover:bg-slate-600 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50">
                        {locales.map((loc) => (
                          <SelectItem
                            key={loc}
                            value={loc}
                            className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              {localeNames[loc]}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {setting.type === "renderer" && (
                    <Select value={settings.renderer} onValueChange={(value: any) => updateSettings({ renderer: value })}>
                      <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white w-full sm:w-48 hover:bg-slate-50 dark:hover:bg-slate-600 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50">
                        <SelectItem
                          value="webgl"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            WebGL (Default)
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="webgpu"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            WebGPU (Experimental)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {filteredCategories.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <div className="bg-white dark:bg-slate-800 backdrop-blur-sm rounded-lg p-8 border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/20">
              <div className="text-slate-400 dark:text-slate-500 mb-2">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">{t("settings.noResults")}</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">{t("settings.tryDifferentKeywords")}</p>
            </div>
          </div>
        )}

        {/* Theme Preview Section */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/20">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
              {t("settings.themePreview.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Theme Preview */}
              <div className="relative group cursor-pointer" onClick={() => setTheme("light")}>
                <div
                  className={`bg-white border-2 rounded-lg p-4 transition-all duration-200 hover:border-purple-400 hover:shadow-md ${
                    theme === "light" ? "border-purple-500 shadow-md" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-slate-700">{t("settings.appearance.light")}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-slate-200 rounded"></div>
                    <div className="h-2 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
                {theme === "light" && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white"></div>
                )}
              </div>

              {/* Dark Theme Preview */}
              <div className="relative group cursor-pointer" onClick={() => setTheme("dark")}>
                <div
                  className={`bg-slate-800 border-2 rounded-lg p-4 transition-all duration-200 hover:border-purple-400 hover:shadow-md ${
                    theme === "dark" ? "border-purple-500 shadow-md" : "border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Moon className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-slate-300">{t("settings.appearance.dark")}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-slate-600 rounded"></div>
                    <div className="h-2 bg-slate-700 rounded w-3/4"></div>
                    <div className="h-2 bg-slate-600 rounded w-1/2"></div>
                  </div>
                </div>
                {theme === "dark" && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-slate-800"></div>
                )}
              </div>

              {/* System Theme Preview */}
              <div className="relative group cursor-pointer" onClick={() => setTheme("system")}>
                <div
                  className={`bg-gradient-to-br from-white to-slate-800 border-2 rounded-lg p-4 transition-all duration-200 hover:border-purple-400 hover:shadow-md ${
                    theme === "system" ? "border-purple-500 shadow-md" : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Monitor className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t("settings.appearance.system")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-gradient-to-r from-slate-200 to-slate-600 rounded"></div>
                    <div className="h-2 bg-gradient-to-r from-slate-100 to-slate-700 rounded w-3/4"></div>
                    <div className="h-2 bg-gradient-to-r from-slate-200 to-slate-600 rounded w-1/2"></div>
                  </div>
                </div>
                {theme === "system" && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
