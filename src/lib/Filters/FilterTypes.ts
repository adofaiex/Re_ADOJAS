/**
 * ADOFAI SetFilter → 本地滤镜种类。
 *
 * 滤镜实现集中在 src/lib/Filters，不放进 Player：
 * - FilterManager：事件状态、补间、render target 链
 * - glsl/：每个滤镜的 GLSL
 *
 * 先接入官方 Filter 枚举里最常用的核心滤镜；其余名称先映射到相近的
 * 通用实现（例如 EightiesTV / FiftiesTV / Arcade → VHS），后续在
 * FilterManager 里逐个替换成 WebADOFAI 的原版 shader 即可。
 */
export type FilterKind =
    | 'grayscale'
    | 'sepia'
    | 'invert'
    | 'pixelate'
    | 'blur'
    | 'glitch'
    | 'vhs'
    | 'warp'
    | 'radialBlur'
    | 'contrast'
    | 'aberration'
    | 'sharpen'
    | 'posterize'
    | 'static'
    | 'grain'
    | 'fisheye';

/** Filter.cs 枚举顺序（数字 filter 值 → 名称）。 */
export const FILTER_ENUM_NAMES = [
    'Grayscale', 'Sepia', 'Invert', 'VHS', 'EightiesTV', 'FiftiesTV',
    'Arcade', 'LED', 'Rain', 'Blizzard', 'PixelSnow', 'Compression',
    'Glitch', 'Pixelate', 'Waves', 'Static', 'Grain', 'MotionBlur',
    'Fisheye', 'Aberration', 'Drawing', 'Neon', 'Handheld', 'NightVision',
    'Funk', 'Tunnel', 'Weird3D', 'Blur', 'BlurFocus', 'GaussianBlur',
    'HexagonBlack', 'Posterize', 'Sharpen', 'Contrast', 'EdgeBlackLine',
    'OilPaint', 'SuperDot', 'WaterDrop', 'LightWater', 'Petals', 'PetalsInstant',
] as const;

const KIND_BY_NAME: Record<string, FilterKind> = {
    Grayscale: 'grayscale',
    GrayScale: 'grayscale',
    Color_GrayScale: 'grayscale',
    Sepia: 'sepia',
    Color_Sepia: 'sepia',
    Invert: 'invert',
    Color_Invert: 'invert',

    Pixelate: 'pixelate',
    Pixellate: 'pixelate',
    Pixelisation: 'pixelate',
    Pixel_Pixelisation: 'pixelate',

    Blur: 'blur',
    BlurFocus: 'blur',
    GaussianBlur: 'blur',
    MotionBlur: 'blur',
    Blur_Blurry: 'blur',
    Blur_Focus: 'blur',
    Blur_GaussianBlur: 'blur',

    Glitch: 'glitch',
    FX_Glitch1: 'glitch',
    FX_Glitch2: 'glitch',
    FX_Glitch3: 'glitch',
    Compression: 'glitch',
    TV_CompressionFX: 'glitch',

    VHS: 'vhs',
    Real_VHS: 'vhs',
    EightiesTV: 'vhs',
    FiftiesTV: 'vhs',
    Arcade: 'vhs',
    TV_80: 'vhs',
    TV_50: 'vhs',
    TV_ARCADE: 'vhs',
    LED: 'vhs',
    TV_LED: 'vhs',
    TV_VHS: 'vhs',
    TV_VHS_Rewind: 'vhs',
    VHS_Tracking: 'vhs',
    TV_Vcr: 'vhs',

    Static: 'static',
    Noise_TV: 'static',
    TV_Noise: 'static',
    TV_Old_Movie: 'static',
    TV_Old_Movie_2: 'static',
    Grain: 'grain',
    Film_Grain: 'grain',

    Contrast: 'contrast',
    Color_Contrast: 'contrast',
    Aberration: 'aberration',
    Color_Chromatic_Aberration: 'aberration',
    Sharpen: 'sharpen',
    Sharpen_Sharpen: 'sharpen',
    Posterize: 'posterize',
    TV_Posterize: 'posterize',

    Warp: 'warp',
    Waves: 'warp',
    Distortion_Wave_Horizontal: 'warp',
    Fisheye: 'fisheye',
    Distortion_FishEye: 'fisheye',
    Tunnel: 'warp',
    PolarScreen: 'warp',

    RadialBlur: 'radialBlur',
    Blur_Radial: 'radialBlur',
    Blur_Radial_Fast: 'radialBlur',
    Blur_Movie: 'radialBlur',
};

/**
 * 事件里的 filter 可能是：
 * - "Grayscale" / "Pixellate" 等枚举名
 * - 数字（Filter.cs 的枚举值）
 * - "CameraFilterPackLegacy_Color_GrayScale"
 * - SetFilterAdvanced 的 "CameraFilterPack_FX_Glitch1"
 */
export function normalizeFilterKind(value: unknown): FilterKind | null {
    let name: string | null = null;
    if (typeof value === 'number' && Number.isInteger(value)) {
        name = FILTER_ENUM_NAMES[value] ?? null;
    } else if (typeof value === 'string') {
        name = value.trim();
    }
    if (!name) return null;

    // SetFilterAdvanced / WebADOFAI 的组件名：取最后一段。
    const short = name
        .replace(/^CameraFilterPackLegacy[_/]/, '')
        .replace(/^CameraFilterPack[_/]/, '')
        .replace(/^CameraFilterPackLegacy/, '')
        .replace(/^CameraFilterPack/, '');

    return KIND_BY_NAME[name]
        ?? KIND_BY_NAME[short]
        ?? KIND_BY_NAME[short.replace(/_filter$/, '')]
        ?? null;
}

/** 官方 SetFilter 的数值强度 0..100 → 0..1。 */
export function normalizeIntensity(value: unknown, fallback = 1): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return n / 100;
}

export function parseEnabled(value: unknown, fallback = true): boolean {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const s = String(value).toLowerCase();
    return s !== 'false' && s !== 'disabled' && s !== '0' && s !== 'off';
}
