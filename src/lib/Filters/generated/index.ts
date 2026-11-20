import { GENERATED_FILTER_MANIFEST } from './manifest.generated'

const MODULES = import.meta.glob('./*.glsl', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>

// Two special shaders are not CameraFilterPack filters (PolarScreen / motion
// blur) and use different vertex IO; keep them out of the generic filter path.
const EXCLUDED = new Set(['ADOFAI_PolarScreen', 'Hidden_CameraMotionBlur'])

/** Original CameraFilterPack component name -> converted GLSL ES 3.00 fragment source. */
export const GENERATED_FILTER_SOURCES: Record<string, string> = Object.fromEntries(
    Object.entries(GENERATED_FILTER_MANIFEST)
        .map(([name, info]) => {
            if (EXCLUDED.has(name)) return null
            const source = MODULES[`./${info.file}`]
            return source ? [name, source] : null
        })
        .filter((entry): entry is [string, string] => entry !== null),
)

export { GENERATED_FILTER_MANIFEST }
export type { GeneratedFilterShader } from './manifest.generated'
export { GENERATED_FILTER_BINDINGS } from './bindings.generated'
export type { FilterBinding } from './bindings.generated'
