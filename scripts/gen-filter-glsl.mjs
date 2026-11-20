#!/usr/bin/env node
/**
 * Convert ADOUAC's generated HLSL filter shaders into WebGL2 GLSL ES 3.00.
 *
 * Scope: only View/Shaders/Filters/*.shader. No decoration/backdrop shaders.
 *
 * Usage:
 *   node scripts/gen-filter-glsl.mjs
 *
 * Output:
 *   src/lib/Filters/generated/<Component>.glsl
 *   src/lib/Filters/generated/manifest.generated.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shaderDir = path.join(root, '.adofai/ADOUAC/Assets/Adouac/View/Shaders/Filters');
const outDir = path.join(root, 'src/lib/Filters/generated');

if (!fs.existsSync(shaderDir)) throw new Error(`missing shader dir: ${shaderDir}`);
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.glsl')) fs.unlinkSync(path.join(outDir, f));
}

const shaderByKey = new Map();
for (const file of fs.readdirSync(shaderDir)) {
    if (!file.endsWith('.shader')) continue;
    const text = fs.readFileSync(path.join(shaderDir, file), 'utf8');
    const key = text.match(/Shader\s+"([^"]+)"/)?.[1];
    if (key) shaderByKey.set(key, { file, text });
}

function findMatching(text, openIndex, open = '{', close = '}') {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
        if (text[i] === open) depth++;
        else if (text[i] === close) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function removeFunction(text, signatureRe) {
    const m = signatureRe.exec(text);
    if (!m) return text;
    const brace = text.indexOf('{', m.index);
    if (brace < 0) return text;
    const end = findMatching(text, brace);
    if (end < 0) return text;
    return text.slice(0, m.index) + text.slice(end + 1);
}

function extractTopLevelDeclarations(program) {
    const declarations = [];
    let depth = 0;
    let i = 0;
    let lineStart = 0;
    while (i <= program.length) {
        const ch = program[i];
        if (ch === '\n' || i === program.length) {
            const line = program.slice(lineStart, i);
            if (depth === 0) {
                const trimmed = line.trim();
                // Texture/Sampler declarations.
                let m = trimmed.match(/^(Texture2D(?:<[^>]+>)?|sampler2D)\s+([A-Za-z_]\w*)\s*;\s*$/);
                if (m) declarations.push({ line, rawType: m[1], name: m[2], texture: true });
                m = trimmed.match(/^(SamplerState)\s+([A-Za-z_]\w*)\s*;\s*$/);
                if (m) declarations.push({ line, rawType: m[1], name: m[2], sampler: true });
                // Scalars/vectors used as material uniforms.
                m = trimmed.match(/^(static\s+const\s+|const\s+|static\s+)?(float|float2|float3|float4|half|half2|half3|half4|int|int2|int3|int4|uint|uint2|uint3|uint4|bool)\s+([A-Za-z_]\w*)\s*;\s*$/);
                if (m) declarations.push({
                    line,
                    rawType: m[2],
                    name: m[3],
                    isConst: !!m[1],
                });
            }
            if (ch === '\n') lineStart = i + 1;
        }
        if (ch === '{') depth++;
        else if (ch === '}') depth = Math.max(0, depth - 1);
        i++;
    }
    return declarations;
}

function glslType(t) {
    switch (t) {
        case 'float2': return 'vec2';
        case 'float3': return 'vec3';
        case 'float4': return 'vec4';
        case 'half': return 'float';
        case 'half2': return 'vec2';
        case 'half3': return 'vec3';
        case 'half4': return 'vec4';
        case 'int2': return 'ivec2';
        case 'int3': return 'ivec3';
        case 'int4': return 'ivec4';
        case 'uint2': return 'uvec2';
        case 'uint3': return 'uvec3';
        case 'uint4': return 'uvec4';
        default: return t;
    }
}

function convertTypes(src) {
    return src
        .replace(/\bhalf([234])?\b/g, (_, n) => `float${n ?? ''}`)
        .replace(/\bfloat([234])\b/g, (_, n) => `vec${n}`)
        .replace(/\bint([234])\b/g, (_, n) => `ivec${n}`)
        .replace(/\buint([234])\b/g, (_, n) => `uvec${n}`)
        .replace(/\bstatic\s+const\b/g, 'const');
}

function stripHlslSemantics(src) {
    return src
        .replace(/:\s*SV_Target\b/g, '')
        .replace(/:\s*SV_POSITION\b/g, '')
        .replace(/:\s*TEXCOORD\d+\b/g, '')
        .replace(/:\s*COLOR\d*\b/g, '')
        .replace(/\[\s*(?:unroll|loop)\s*\]/g, '');
}

function convertProgram(program, component) {
    let src = program;

    // Remove vertex/entry helpers that are replaced by the standard quad vertex.
    src = removeFunction(src, /AdouacVaryings\s+vert\s*\([^)]*\)\s*(?:\{|:\s*SV_Target)/);
    src = removeFunction(src, /v2f\s+vert\s*\([^)]*\)\s*(?:\{|:\s*SV_Target)/);
    src = removeFunction(src, /AdouacVaryings\s+AdouacOutput_vs\s*\([^)]*\)\s*\{/);
    src = removeFunction(src, /(?:float4|vec4)\s+AdouacOutput_vs\s*\([^)]*\)\s*\{/);
    // AdouacOutput_ps is kept as a helper below.
    src = removeFunction(src, /(?:float4|vec4)\s+AdouacOutput_ps\s*\([^)]*\)\s*\{/);

    const declarations = extractTopLevelDeclarations(src);
    for (const d of declarations) {
        src = src.replace(d.line, '');
    }

    // Remove the generated vertex IO structs; main() supplies their values.
    src = src.replace(/struct\s+AdouacVaryings\s*\{[\s\S]*?\}\s*;/g, '');
    src = src.replace(/struct\s+v2f\s*\{[\s\S]*?\}\s*;/g, '');
    // Remove includes and sampler declarations.
    src = src.replace(/^\s*#include[^\n]*$/gm, '');
    src = src.replace(/^\s*#pragma[^\n]*$/gm, '');
    src = src.replace(/\bSamplerState\s+[A-Za-z_]\w*\s*;\s*/g, '');
    src = src.replace(/\bTexture2D(?:<[^>]+>)?\s+[A-Za-z_]\w*\s*;\s*/g, '');
    src = src.replace(/\bsampler2D\s+[A-Za-z_]\w*\s*;\s*/g, '');

    // Texture2D.Sample(sampler_X, uv) -> texture(X, uv)
    src = src.replace(/([A-Za-z_]\w*)\.\s*Sample\s*\(\s*sampler_[A-Za-z_]\w*\s*,/g,
        (_m, object) => `texture(${object},`);
    // SampleLevel(..., 0.0) is the same as texture() for filters.
    src = src.replace(/([A-Za-z_]\w*)\.\s*SampleLevel\s*\(\s*sampler_[A-Za-z_]\w*\s*,\s*([\s\S]*?),\s*0\.0\s*\)/g,
        (_m, object, uv) => `texture(${object}, ${uv})`);

    src = stripHlslSemantics(convertTypes(src));

    // HLSL allows scalar-to-vector initialization (`uint4 r = 0u`); GLSL
    // requires a constructor. This pattern is everywhere in DXBC output.
    src = src.replace(/\b(uvec[234]|ivec[234]|vec[234])\s+([^;\n{}]+);/g,
        (_m, type, decl) => {
            if (!decl.includes('=')) return `${type} ${decl};`;
            const fixed = decl
                .replace(/(=\s*)0u\b/g, (_x, prefix) => `${prefix}${type}(0u)`)
                .replace(/(=\s*)0\b/g, (_x, prefix) => `${prefix}${type}(0)`);
            return `${type} ${fixed};`;
        });

    // HLSL `const T a[N] = { ... };` -> GLSL `T[N](...)`.
    src = src.replace(/\b(const\s+)?(uvec[234]|ivec[234]|vec[234]|float|int|uint)\s+([A-Za-z_]\w*)\[(\d+)\]\s*=\s*\{([\s\S]*?)\}\s*;/g,
        (_m, isConst, type, name, size, body) =>
            `${isConst ?? ''}${type} ${name}[${size}] = ${type}[${size}](${body.trim()});`);

    // HLSL permits `vecVar = 0u`; GLSL needs a constructor. Collect local
    // vector names first, then patch scalar-zero assignments.
    const vectorNames = new Map();
    for (const dm of src.matchAll(/\b(uvec[234]|ivec[234]|vec[234])\s+([^;\n{}]+);/g)) {
        const type = dm[1];
        for (const part of dm[2].split(',')) {
            const name = part.trim().match(/^([A-Za-z_]\w*)/)?.[1];
            if (name) vectorNames.set(name, type);
        }
    }
    src = src.replace(/\b([A-Za-z_]\w*)(\[[^\]]+\])?\s*=\s*0u\b/g,
        (m, name, index) => {
            const type = vectorNames.get(name);
            return type ? `${name}${index ?? ''} = ${type}(0u)` : m;
        });
    src = src.replace(/\b([A-Za-z_]\w*)(\[[^\]]+\])?\s*=\s*0\b/g,
        (m, name, index) => {
            const type = vectorNames.get(name);
            return type ? `${name}${index ?? ''} = ${type}(0)` : m;
        });

    src = src
        // GLSL has no C-style casts; handle the casts DXBC emits.
        .replace(/\(float\)\s*(asint\([^)]*\))/g, 'float($1)')
        .replace(/\(int\)\s*(asfloat\([^)]*\))/g, 'int($1)')
        .replace(/\(int\)\s*([A-Za-z_]\w*)/g, 'int($1)')
        .replace(/\bfrac\s*\(/g, 'fract(')
        .replace(/\blerp\s*\(/g, 'mix(')
        .replace(/\brsqrt\s*\(/g, 'inversesqrt(')
        .replace(/\bddx\s*\(/g, 'dFdx(')
        .replace(/\bddy\s*\(/g, 'dFdy(')
        .replace(/\btex2D\s*\(/g, 'texture(')
        .replace(/\bAdouacOutput_ps\s*\(/g, 'AdouacOutputPs(')
        .replace(/for\s*\(\s*;\s*;\s*\)/g, 'while (true)');

    // Frag signature can be generated (AdouacVaryings) or original (v2f).
    let inputType = 'AdouacVaryings';
    if (/float4\s+frag\s*\(v2f\b/.test(src) || /vec4\s+frag\s*\(v2f\b/.test(src)) inputType = 'v2f';
    src = src.replace(/\b(?:float4|vec4)\s+frag\s*\(\s*(?:AdouacVaryings|v2f)\s+([A-Za-z_]\w*)\s*\)/g,
        (_m, name) => `vec4 frag(${inputType} ${name})`);

    const uniformLines = declarations.map(d => {
        if (d.texture) return `uniform sampler2D ${d.name};`;
        if (d.sampler) return '';
        if (d.isConst) return convertTypes(d.line.trim());
        return `uniform ${glslType(d.rawType)} ${d.name};`;
    }).filter(Boolean);

    const prelude = `precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

${uniformLines.join('\n')}
uniform vec4 _Time;
uniform vec4 _ScreenParams;

struct AdouacVaryings {
    vec4 pos;
    vec4 texcoord0;
    vec4 color0;
};
struct v2f {
    vec2 texcoord;
    vec4 vertex;
    vec4 color;
};

uint asuint(float x) { return floatBitsToUint(x); }
uvec2 asuint(vec2 x) { return floatBitsToUint(x); }
uvec3 asuint(vec3 x) { return floatBitsToUint(x); }
uvec4 asuint(vec4 x) { return floatBitsToUint(x); }
uint asuint(int x) { return uint(x); }
uvec2 asuint(ivec2 x) { return uvec2(x); }
uvec3 asuint(ivec3 x) { return uvec3(x); }
uvec4 asuint(ivec4 x) { return uvec4(x); }
float asfloat(uint x) { return uintBitsToFloat(x); }
vec2 asfloat(uvec2 x) { return uintBitsToFloat(x); }
vec3 asfloat(uvec3 x) { return uintBitsToFloat(x); }
vec4 asfloat(uvec4 x) { return uintBitsToFloat(x); }
float asfloat(int x) { return float(x); }
vec2 asfloat(ivec2 x) { return vec2(x); }
vec3 asfloat(ivec3 x) { return vec3(x); }
vec4 asfloat(ivec4 x) { return vec4(x); }
int asint(float x) { return floatBitsToInt(x); }
ivec2 asint(vec2 x) { return floatBitsToInt(x); }
ivec3 asint(vec3 x) { return floatBitsToInt(x); }
ivec4 asint(vec4 x) { return floatBitsToInt(x); }
int asint(uint x) { return int(x); }
ivec2 asint(uvec2 x) { return ivec2(x); }
ivec3 asint(uvec3 x) { return ivec3(x); }
ivec4 asint(uvec4 x) { return ivec4(x); }
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
vec4 saturate(vec4 x) { return clamp(x, 0.0, 1.0); }
vec4 AdouacOutputPs(uvec4 o) { return uintBitsToFloat(o); }
vec4 AdouacOutputPs(vec4 o) { return o; }
`;

    const main = inputType === 'v2f'
        ? `void main() {
    v2f IN;
    IN.texcoord = vUv;
    IN.vertex = gl_FragCoord;
    IN.color = vec4(1.0);
    fragColor = frag(IN);
}
`
        : `void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
`;

    return {
        source: `${prelude}\n${src.trim()}\n\n${main}`,
        inputType,
        uniforms: declarations.map(d => ({ name: d.name, rawType: d.rawType, texture: !!d.texture })),
    };
}

const manifest = {};
let converted = 0;
const failures = [];
for (const [key, { file, text }] of shaderByKey) {
    const component = file.replace(/\.shader$/, '');
    const program = text.match(/HLSLPROGRAM([\s\S]*?)ENDHLSL/)?.[1];
    if (!program) {
        failures.push({ component, key, reason: 'no HLSLPROGRAM' });
        continue;
    }
    try {
        const out = convertProgram(program, component);
        const filename = component.replace(/[^A-Za-z0-9_]/g, '_') + '.glsl';
        fs.writeFileSync(path.join(outDir, filename), out.source, 'utf8');
        manifest[component] = {
            key,
            file: filename,
            input: out.inputType,
            uniforms: out.uniforms,
        };
        converted++;
    } catch (e) {
        failures.push({ component, key, reason: e instanceof Error ? e.message : String(e) });
    }
}

const mlines = [
    '// AUTO-GENERATED by scripts/gen-filter-glsl.mjs. Do not edit by hand.',
    '',
    'export interface GeneratedFilterShader {',
    '    key: string;',
    '    file: string;',
    '    input: string;',
    '    uniforms: Array<{ name: string; rawType: string; texture: boolean }>;',
    '}',
    '',
    'export const GENERATED_FILTER_MANIFEST: Record<string, GeneratedFilterShader> = {',
];
for (const name of Object.keys(manifest).sort()) {
    const m = manifest[name];
    mlines.push(`    ${JSON.stringify(name)}: { key: ${JSON.stringify(m.key)}, file: ${JSON.stringify(m.file)}, input: ${JSON.stringify(m.input)}, uniforms: ${JSON.stringify(m.uniforms)} },`);
}
mlines.push('};', '');
fs.writeFileSync(path.join(outDir, 'manifest.generated.ts'), mlines.join('\n'), 'utf8');

console.log(`converted ${converted}/${shaderByKey.size} shaders`);
if (failures.length) {
    console.log('failures:');
    for (const f of failures.slice(0, 30)) console.log(' ', f.component, '-', f.reason);
    fs.writeFileSync(path.join(outDir, 'failures.json'), JSON.stringify(failures, null, 2), 'utf8');
}
