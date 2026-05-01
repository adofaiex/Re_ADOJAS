"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "dark" | "light" | "system"

interface ThemeProviderContext {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme?: Theme
}

const ThemeProviderContext = createContext<ThemeProviderContext | undefined>(undefined)

export interface ThemeProviderProps {
  children: ReactNode
  attribute?: string
  defaultTheme?: Theme
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<Theme>()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // 从 localStorage 读取保存的主题
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme && ["dark", "light", "system"].includes(savedTheme)) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement

    // 移除之前的主题类
    root.classList.remove("light", "dark")

    let effectiveTheme = theme

    if (theme === "system" && enableSystem) {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }

    setResolvedTheme(effectiveTheme)

    if (attribute === "class") {
      root.classList.add(effectiveTheme)
    } else {
      root.setAttribute(attribute, effectiveTheme)
    }

    // 保存到 localStorage
    localStorage.setItem("theme", theme)
  }, [theme, mounted, attribute, enableSystem])

  // 监听系统主题变化
  useEffect(() => {
    if (!mounted || !enableSystem) return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      if (theme === "system") {
        const newResolvedTheme = mediaQuery.matches ? "dark" : "light"
        setResolvedTheme(newResolvedTheme)

        const root = window.document.documentElement
        root.classList.remove("light", "dark")

        if (attribute === "class") {
          root.classList.add(newResolvedTheme)
        } else {
          root.setAttribute(attribute, newResolvedTheme)
        }
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, mounted, enableSystem, attribute])

  const value = {
    theme,
    setTheme,
    resolvedTheme,
  }

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
