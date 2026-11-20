import defaultFontUrl from '@/assets/fonts/godoMaum.otf'

/**
 * ADOFAI 的 Default 字体是 godoMaum（韩/拉丁）；中文/日文版另有字体。
 * ADOUAC 的 DecorationFonts.asset 也把 `_latin` / `_korean` 指向 godoMaum。
 *
 * Web 端在这里只加载默认字体；Arial/Comic 等系统字体直接用 CSS family。
 */
export const DEFAULT_DECORATION_FONT = 'godoMaum'

let loadPromise: Promise<boolean> | null = null
let ready = false

export function ensureDefaultDecorationFont(): Promise<boolean> {
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
        try {
            const face = new FontFace(DEFAULT_DECORATION_FONT, `url(${defaultFontUrl})`)
            const loaded = await face.load()
            document.fonts.add(loaded)
            ready = true
            return true
        } catch {
            // 字体加载失败时保留 Arial fallback，不能影响谱面播放。
            return false
        }
    })()
    return loadPromise
}

export function isDefaultDecorationFontReady(): boolean {
    return ready
}

const FONT_FAMILY_BY_NAME: Record<string, string> = {
    Default: `'${DEFAULT_DECORATION_FONT}', Arial`,
    Arial: 'Arial',
    ComicSansMS: 'Comic Sans MS',
    CourierNew: 'Courier New',
    Georgia: 'Georgia',
    Impact: 'Impact',
    TimesNewRoman: 'Times New Roman',
}

export function decorationFontFamily(name: unknown): string {
    const key = typeof name === 'string' ? name : 'Default'
    return FONT_FAMILY_BY_NAME[key] ?? FONT_FAMILY_BY_NAME.Default
}
