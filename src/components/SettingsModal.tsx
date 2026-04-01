"use client"

import { useState } from "react"
import { useTheme } from "@/hooks/use-theme"
import { useI18n } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Search, Monitor, Sun, Moon, Globe } from "lucide-react"
import { locales, localeNames, type Locale } from "@/lib/i18n/config"
import { useAppSettings } from "@/hooks/use-app-settings"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, t, mounted } = useI18n()
  const { settings, updateSettings } = useAppSettings()

  if (!isOpen || !mounted) return null

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
          title: t("settings.renderer.title"),
          description: t("settings.renderer.description"),
          type: "renderer",
        },
        {
          id: "renderMethod",
          title: t("settings.renderMethod.title"),
          description: t("settings.renderMethod.description"),
          type: "renderMethod",
        },
        {
          id: "showTrail",
          title: t("settings.showTrail.title"),
          description: t("settings.showTrail.description"),
          type: "showTrail",
        },
        {
          id: "hitsoundEnabled",
          title: t("settings.hitsoundEnabled.title"),
          description: t("settings.hitsoundEnabled.description"),
          type: "hitsoundEnabled",
        },
        {
          id: "showStats",
          title: t("settings.showStats.title"),
          description: t("settings.showStats.description"),
          type: "showStats",
        },
        {
          id: "useWorker",
          title: t("settings.useWorker.title"),
          description: t("settings.useWorker.description"),
          type: "useWorker",
        },
        {
          id: "targetFramerate",
          title: t("settings.targetFramerate.title"),
          description: t("settings.targetFramerate.description"),
          type: "targetFramerate",
        },
        {
          id: "loadMethod",
          title: t("settings.loadMethod.title"),
          description: t("settings.loadMethod.description"),
          type: "loadMethod",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("settings.title")}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
            <Input
              placeholder={t("settings.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20"
            />
          </div>

          {/* Settings Categories */}
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
                <category.icon className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                {category.title}
              </div>
              
              {category.settings.map((setting) => (
                <div key={setting.id} className="pl-7 space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 text-sm font-medium">{setting.title}</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{setting.description}</p>

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
                            {t("settings.renderer.webgl")}
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="webgpu"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            {t("settings.renderer.webgpu")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {setting.type === "renderMethod" && (
                    <Select value={settings.renderMethod} onValueChange={(value: any) => updateSettings({ renderMethod: value })}>
                      <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white w-full sm:w-48 hover:bg-slate-50 dark:hover:bg-slate-600 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50">
                        <SelectItem
                          value="sync"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            {t("settings.renderMethod.sync")}
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="async"
                          className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            {t("settings.renderMethod.async")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {setting.type === "showTrail" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateSettings({ showTrail: !settings.showTrail })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.showTrail ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.showTrail ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {settings.showTrail ? t("settings.showTrail.enabled") : t("settings.showTrail.disabled")}
                      </span>
                    </div>
                  )}

                  {setting.type === "hitsoundEnabled" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateSettings({ hitsoundEnabled: !settings.hitsoundEnabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.hitsoundEnabled ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.hitsoundEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {settings.hitsoundEnabled ? t("settings.hitsoundEnabled.enabled") : t("settings.hitsoundEnabled.disabled")}
                      </span>
                    </div>
                  )}

                  {setting.type === "showStats" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateSettings({ showStats: !settings.showStats })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.showStats ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.showStats ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {settings.showStats ? t("settings.showStats.statsjs") : t("settings.showStats.default")}
                      </span>
                    </div>
                  )}

                  {setting.type === "useWorker" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateSettings({ useWorker: !settings.useWorker })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.useWorker ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.useWorker ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {settings.useWorker ? t("settings.useWorker.enabled") : t("settings.useWorker.disabled")}
                      </span>
                    </div>
                  )}

                  {setting.type === "targetFramerate" && (
                    <Select value={settings.targetFramerate} onValueChange={(value: any) => updateSettings({ targetFramerate: value })}>
                      <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white w-full sm:w-48 hover:bg-slate-50 dark:hover:bg-slate-600 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50">
                        <SelectItem value="auto" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          {t("settings.targetFramerate.auto")}
                        </SelectItem>
                        <SelectItem value="30" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          30 FPS
                        </SelectItem>
                        <SelectItem value="60" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          60 FPS
                        </SelectItem>
                        <SelectItem value="120" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          120 FPS
                        </SelectItem>
                        <SelectItem value="144" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          144 FPS
                        </SelectItem>
                        <SelectItem value="165" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          165 FPS
                        </SelectItem>
                        <SelectItem value="240" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          240 FPS
                        </SelectItem>
                        <SelectItem value="unlimited" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          {t("settings.targetFramerate.unlimited")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {setting.type === "loadMethod" && (
                    <Select value={settings.loadMethod} onValueChange={(value: any) => updateSettings({ loadMethod: value })}>
                      <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white w-full sm:w-48 hover:bg-slate-50 dark:hover:bg-slate-600 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 dark:focus:ring-purple-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50">
                        <SelectItem value="sync" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          {t("settings.loadMethod.sync")}
                        </SelectItem>
                        <SelectItem value="async" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          {t("settings.loadMethod.async")}
                        </SelectItem>
                        <SelectItem value="worker" className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                          {t("settings.loadMethod.worker")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          ))}

          {filteredCategories.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <div className="text-slate-400 dark:text-slate-500 mb-2">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">{t("settings.noResults")}</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">{t("settings.tryDifferentKeywords")}</p>
            </div>
          )}

          {/* Theme Preview Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium">
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
              {t("settings.themePreview.title")}
            </div>
            
            <div className="grid grid-cols-3 gap-3 pl-7">
              {/* Light Theme Preview */}
              <div 
                className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${theme === "light" ? "ring-2 ring-purple-500" : ""}`}
                onClick={() => setTheme("light")}
              >
                <div className="bg-white border border-slate-200 p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Sun className="w-3 h-3 text-amber-500" />
                    <span className="text-xs font-medium text-slate-700">{t("settings.appearance.light")}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-200 rounded"></div>
                    <div className="h-1.5 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-1.5 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>

              {/* Dark Theme Preview */}
              <div 
                className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${theme === "dark" ? "ring-2 ring-purple-500" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <div className="bg-slate-800 border border-slate-700 p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Moon className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-medium text-slate-300">{t("settings.appearance.dark")}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-600 rounded"></div>
                    <div className="h-1.5 bg-slate-700 rounded w-3/4"></div>
                    <div className="h-1.5 bg-slate-600 rounded w-1/2"></div>
                  </div>
                </div>
              </div>

              {/* System Theme Preview */}
              <div 
                className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${theme === "system" ? "ring-2 ring-purple-500" : ""}`}
                onClick={() => setTheme("system")}
              >
                <div className="bg-gradient-to-br from-white to-slate-800 border border-slate-300 dark:border-slate-600 p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Monitor className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t("settings.appearance.system")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-gradient-to-r from-slate-200 to-slate-600 rounded"></div>
                    <div className="h-1.5 bg-gradient-to-r from-slate-100 to-slate-700 rounded w-3/4"></div>
                    <div className="h-1.5 bg-gradient-to-r from-slate-200 to-slate-600 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
