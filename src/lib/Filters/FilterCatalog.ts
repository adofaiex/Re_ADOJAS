import {
    GENERATED_FILTERS,
    GENERATED_FILTER_BY_NAME,
    SET_FILTER_COMPONENTS,
    SET_FILTER_ORDER,
    SCENE_FILTER_VALUES,
} from './catalog.generated'
import type { GeneratedFilterDefinition, GeneratedFilterField } from './catalog.generated'
import { FILTER_ENUM_NAMES } from './FilterTypes'

export type { GeneratedFilterDefinition, GeneratedFilterField }

export interface FilterFieldValue {
    field: GeneratedFilterField
    /** Color=rgba, Vector2=xy, scalar=x. */
    value: [number, number, number, number]
}

/**
 * ADOUAC ForegroundOrder places VideoBloom immediately after EightiesTV:
 * ... Grayscale -> EightiesTV -> Bloom -> EdgeBlackLine -> NightVision ...
 * It is a fixed slot in the filter chain, NOT always last.
 */
export const BLOOM_FILTER_ORDER = Math.max(
    0,
    SET_FILTER_ORDER.indexOf('EightiesTV') >= 0
        ? SET_FILTER_ORDER.indexOf('EightiesTV') + 1
        : 27,
)

const SUFFIX_TO_COMPONENT = new Map<string, string>()
for (const component of Object.values(SET_FILTER_COMPONENTS)) {
    const suffix = component.replace(/^CameraFilterPackLegacy_/, '').replace(/^CameraFilterPack_/, '')
    if (!SUFFIX_TO_COMPONENT.has(suffix)) SUFFIX_TO_COMPONENT.set(suffix, component)
}

/**
 * Resolve any ADOFAI filter spelling to the original CameraFilterPack component.
 *
 * Handles:
 * - numeric Filter enum
 * - SetFilter enum name (`Grayscale`, `VHS`, ...)
 * - SetFilterAdvanced component name (`CameraFilterPack_Color_Noise`)
 * - shortened shader/class suffix (`Color_Noise`)
 */
export function resolveFilterName(raw: unknown): string | null {
    if (typeof raw === 'number' && Number.isInteger(raw)) {
        const name = FILTER_ENUM_NAMES[raw]
        return name ? SET_FILTER_COMPONENTS[name] ?? null : null
    }
    if (typeof raw !== 'string') return null
    const name = raw.trim()
    if (!name) return null

    const direct = SET_FILTER_COMPONENTS[name]
    if (direct) return direct
    if (GENERATED_FILTER_BY_NAME[name]) return name

    const withoutLegacy = name.replace(/^CameraFilterPackLegacy_/, '')
    const withoutPack = name.replace(/^CameraFilterPack_/, '')
    for (const candidate of [withoutLegacy, withoutPack]) {
        if (GENERATED_FILTER_BY_NAME[candidate]) return candidate
        if (GENERATED_FILTER_BY_NAME[`CameraFilterPackLegacy_${candidate}`]) {
            return `CameraFilterPackLegacy_${candidate}`
        }
        if (GENERATED_FILTER_BY_NAME[`CameraFilterPack_${candidate}`]) {
            return `CameraFilterPack_${candidate}`
        }
    }

    const suffix = SUFFIX_TO_COMPONENT.get(withoutLegacy) ?? SUFFIX_TO_COMPONENT.get(withoutPack)
    return suffix ?? null
}

export function getFilterDefinition(raw: unknown): GeneratedFilterDefinition | null {
    const name = resolveFilterName(raw)
    return name ? (GENERATED_FILTER_BY_NAME[name] ?? null) : null
}

/** Official component order used by SetFilter; advanced filters append after this. */
export function setFilterOrderOf(raw: unknown): number {
    const name = resolveFilterName(raw)
    if (!name) return Number.MAX_SAFE_INTEGER
    const component = Object.keys(SET_FILTER_COMPONENTS).find(k => SET_FILTER_COMPONENTS[k] === name)
    const index = component ? SET_FILTER_ORDER.indexOf(component) : -1
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

/** Start from the component defaults and apply the scene's serialized values. */
export function getFilterFieldDefaults(
    definition: GeneratedFilterDefinition,
): FilterFieldValue[] {
    const scene = SCENE_FILTER_VALUES[definition.name] ?? {}
    return definition.fields.map(field => ({
        field,
        value: (scene[field.name] ?? field.values).slice() as [number, number, number, number],
    }))
}

/** ADOFAI writes scalar float fields as percentages unless the field is a rotation. */
export function filterFieldUnitMultiplier(field: GeneratedFilterField): number {
    return field.kind === 'Float' && !/rotation/i.test(field.name) ? 100 : 1
}

/** Reverse lookup for the legacy SetFilter enum name. */
export function setFilterNameOfComponent(component: string): string | null {
    for (const [name, value] of Object.entries(SET_FILTER_COMPONENTS)) {
        if (value === component) return name
    }
    return null
}

/**
 * ADOUAC ffxSetFilterPlus.IntensityMapOf. The returned field is the one
 * scalar field that SetFilter.intensity writes; other fields keep their
 * component defaults.
 */
export function applySetFilterIntensity(
    definition: GeneratedFilterDefinition,
    filterName: string | null,
    intensity: number,
): FilterFieldValue[] {
    const fields = getFilterFieldDefaults(definition)
    if (!filterName) return fields

    let fieldName: string | null = null
    let transform: (v: number) => number = v => v
    switch (filterName) {
        case 'VHS': fieldName = 'TRACKING'; transform = v => 0.212 * v; break
        case 'LED': fieldName = 'Size'; transform = v => Math.round(5 * v); break
        case 'Drawing': fieldName = 'Fade_With_Original'; transform = v => Math.max(0, Math.min(1, v)); break
        case 'Compression': fieldName = 'Parasite'; transform = v => 3 * v; break
        case 'Waves': fieldName = 'WaveIntensity'; transform = v => 10 * v; break
        case 'Pixelate': fieldName = '_Pixelisation'; transform = v => 4 * v; break
        case 'Rain': fieldName = 'Intensity'; transform = v => 0.5 * v; break
        case 'Blizzard': fieldName = '_Speed'; break
        case 'PixelSnow': fieldName = 'Threshold'; transform = v => 0.9 + 0.1 * v; break
        case 'Static': fieldName = 'Fade'; break
        case 'Grain': fieldName = 'Value'; transform = v => 32 * v; break
        case 'Fisheye': fieldName = 'Distortion'; break
        case 'Aberration': fieldName = 'Offset'; transform = v => v * 0.04 - 0.02; break
        case 'Sepia': case 'Grayscale': fieldName = 'Intensity'; break
        case 'HexagonBlack': fieldName = 'Value'; transform = v => Math.max(0.2, v); break
        case 'Posterize': fieldName = 'Posterize'; transform = v => v * 20; break
        case 'Sharpen': fieldName = 'Value2'; break
        case 'Contrast': fieldName = 'Contrast'; transform = v => v + 1; break
        case 'OilPaint': fieldName = 'Value'; break
        case 'Blur': fieldName = 'Amount'; transform = v => 2 * v; break
        case 'BlurFocus': fieldName = '_Size'; transform = v => Math.max(0.10001, v); break
        case 'GaussianBlur': fieldName = 'Size'; break
        case 'WaterDrop': fieldName = 'Distortion'; transform = v => 64 + (8 - 64) * Math.max(0, Math.min(1, v)); break
        case 'LightWater': fieldName = 'Intensity'; transform = v => 2.4 * v; break
        default: break
    }
    if (!fieldName) return fields
    const target = fields.find(f => f.field.name === fieldName)
    if (target) target.value[0] = transform(intensity)
    return fields
}

/** ffxSetFilterPlus filterDefaultValues, used when a disabled filter starts a tween. */
export function defaultSetFilterIntensity(filterName: string | null): number {
    switch (filterName) {
        case 'Aberration': return 0.5
        case 'Blizzard': return 1
        case 'Fisheye': return 0.5
        case 'LED': return 1
        case 'Pixelate': return 0.01
        default: return 0
    }
}

/**
 * `filterProperties` can arrive as an object, a JSON string, or the bare
 * `"field": value, ...` fragment produced by the editor.
 */
export function parseFilterProperties(raw: unknown): Record<string, unknown> | null {
    if (raw == null) return null
    if (typeof raw === 'object') return raw as Record<string, unknown>
    if (typeof raw !== 'string') return null
    const text = raw.trim()
    if (!text) return null
    const attempts = [
        text,
        `{${text}}`,
        `{${text.replace(/,\s*$/, '')}}`,
    ]
    for (const candidate of attempts) {
        try {
            const parsed = JSON.parse(candidate)
            if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
        } catch {
            // try next
        }
    }
    return null
}

/** Map `filter_Noise` etc. to the catalog field name. */
export function filterPropertyOf(
    props: Record<string, unknown> | null,
    field: GeneratedFilterField,
): unknown {
    if (!props) return undefined
    return props[`filter_${field.name}`] ?? props[field.name]
}

/** Convert one event-supplied property to the four-float field layout. */
export function parseFilterFieldValue(
    field: GeneratedFilterField,
    raw: unknown,
): [number, number, number, number] | null {
    if (raw == null) return null
    const unit = filterFieldUnitMultiplier(field)
    switch (field.kind) {
        case 'Float': {
            const n = Number(raw)
            return Number.isFinite(n) ? [n / unit, 0, 0, 0] : null
        }
        case 'Int': {
            const n = Number(raw)
            return Number.isFinite(n) ? [Math.trunc(n / unit), 0, 0, 0] : null
        }
        case 'Vector2': {
            if (!Array.isArray(raw) || raw.length < 2) return null
            const x = Number(raw[0]), y = Number(raw[1])
            return Number.isFinite(x) && Number.isFinite(y) ? [x, y, 0, 0] : null
        }
        case 'Color': {
            // Unity colors arrive as RRGGBB / RRGGBBAA.
            if (typeof raw !== 'string') return null
            const hex = raw.replace(/^#/, '')
            if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return null
            const r = parseInt(hex.slice(0, 2), 16) / 255
            const g = parseInt(hex.slice(2, 4), 16) / 255
            const b = parseInt(hex.slice(4, 6), 16) / 255
            const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
            return [r, g, b, a]
        }
    }
    return null
}

export { GENERATED_FILTERS, GENERATED_FILTER_BY_NAME, SET_FILTER_COMPONENTS, SET_FILTER_ORDER, SCENE_FILTER_VALUES }
