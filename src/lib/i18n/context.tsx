"use client"
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Locale } from "./config"
import { defaultLocale } from "./config"
import { translations } from "./translations"

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  mounted: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // 从localStorage读取保存的语言设置
    try {
      const savedLocale = localStorage.getItem("locale") as Locale
      if (savedLocale && savedLocale in translations) {
        setLocaleState(savedLocale)
      }
    } catch (error) {
      // localStorage 可能在某些环境下不可用
      console.warn("Failed to read locale from localStorage:", error)
    }
    setMounted(true)
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem("locale", newLocale)
    } catch (error) {
      console.warn("Failed to save locale to localStorage:", error)
    }
  }

  const t = (key: string): string => {
    // 如果还没有挂载，返回 key 作为默认值
    if (!mounted) return key

    const keys = key.split(".")
    let value: any = translations[locale]

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k]
      } else {
        // 如果找不到翻译，尝试使用默认语言
        let fallbackValue: any = translations[defaultLocale]
        for (const fallbackK of keys) {
          if (fallbackValue && typeof fallbackValue === "object" && fallbackK in fallbackValue) {
            fallbackValue = fallbackValue[fallbackK]
          } else {
            return key // 如果默认语言也没有，返回key
          }
        }
        return fallbackValue
      }
    }

    return typeof value === "string" ? value : key
  }

  return <I18nContext.Provider value={{ locale, setLocale, t, mounted }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}

// 安全的 hook，在 Provider 外使用时返回默认值
export function useSafeI18n() {
  const context = useContext(I18nContext)

  if (context === undefined) {
    // 返回默认的 i18n 功能
    return {
      locale: defaultLocale,
      setLocale: () => {},
      t: (key: string) => key,
      mounted: false,
    }
  }

  return context
}
