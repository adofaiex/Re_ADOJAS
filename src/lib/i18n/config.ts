export const defaultLocale = "zh-CN"
export const locales = ["zh-CN", "en-US", "ja-JP"] as const
export type Locale = (typeof locales)[number]

export const localeNames: Record<Locale, string> = {
  "zh-CN": "简体中文",
  "en-US": "English",
  "ja-JP": "日本語",
}
