/**
 * Vite Plugin: WASM Inline + Auto-Compile
 *
 * Provides virtual modules 'virtual:wasm-easing' and 'virtual:wasm-tile-color'
 * that export WASM binaries as inlined base64 strings into the JS bundle.
 *
 * Automatically compiles AssemblyScript sources (*.ts in engine/assembly/)
 * to .wasm when the binary is missing or outdated.
 *
 * This eliminates fetch() at runtime, enabling file:// protocol compatibility
 * (no CORS issues with WASM on static HTML).
 *
 * Usage:
 *   import easingWasmBase64 from 'virtual:wasm-easing';
 *   import tileColorBase64 from 'virtual:wasm-tile-color';
 */

import type { Plugin, ResolvedConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface WasmEntry {
  /** Module logical name (used in virtual module ID) */
  name: string;
  /** Path to .wasm output relative to root */
  wasmRel: string;
  /** Path to .ts AssemblyScript source relative to root */
  srcRel: string;
  /** Extra CLI args for asc compiler */
  ascArgs?: string[];
}

const ENTRIES: WasmEntry[] = [
  {
    name: 'easing',
    wasmRel: 'public/wasm/easing.wasm',
    srcRel: 'engine/assembly/easing.ts',
    ascArgs: ['--noAssert'],
  },
  {
    name: 'tile-color',
    wasmRel: 'public/wasm/tile-color.wasm',
    srcRel: 'engine/assembly/tile-color.ts',
    ascArgs: ['--noAssert'],
  },
];

const VIRTUAL_PREFIX = '\0virtual:wasm-';

/**
 * Compile a single AssemblyScript entry to .wasm using npx asc.
 * Throws on failure.
 */
function compileWasm(rootDir: string, entry: WasmEntry): void {
  const absSrc = path.resolve(rootDir, entry.srcRel);
  const absOut = path.resolve(rootDir, entry.wasmRel);

  if (!fs.existsSync(absSrc)) {
    throw new Error(
      `[wasm-inline] AssemblyScript source not found: ${absSrc}\n` +
      `Cannot auto-compile. Make sure the file exists.`
    );
  }

  // Ensure output directory exists
  const outDir = path.dirname(absOut);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const ascArgs = [
    absSrc,
    '-o', absOut,
    '--optimize',
    '--runtime', 'stub',
    '--exportStart', '_start',
    ...(entry.ascArgs || []),
  ];

  try {
    execSync(`npx asc ${ascArgs.join(' ')}`, {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    throw new Error(
      `[wasm-inline] Failed to compile ${entry.srcRel}:\n${stderr}\n${stdout}`
    );
  }
}

/**
 * Check if .wasm needs recompilation (missing or source is newer).
 */
function needsRecompile(rootDir: string, entry: WasmEntry): boolean {
  const absSrc = path.resolve(rootDir, entry.srcRel);
  const absOut = path.resolve(rootDir, entry.wasmRel);

  if (!fs.existsSync(absOut)) return true;
  if (!fs.existsSync(absSrc)) return false; // No source to compare
  const srcMtime = fs.statSync(absSrc).mtimeMs;
  const outMtime = fs.statSync(absOut).mtimeMs;
  return srcMtime > outMtime;
}

export function wasmInlinePlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'wasm-inline',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    resolveId(id) {
      for (const entry of ENTRIES) {
        const virtualId = `virtual:wasm-${entry.name}`;
        if (id === virtualId) {
          return VIRTUAL_PREFIX + entry.name;
        }
        // Also handle dev mode where Vite may strip the prefix
        if (id === VIRTUAL_PREFIX + entry.name) {
          return id;
        }
      }
      return null;
    },

    load(id) {
      for (const entry of ENTRIES) {
        const resolvedId = VIRTUAL_PREFIX + entry.name;
        if (id === resolvedId) {
          // Auto-compile if needed
          if (needsRecompile(config.root, entry)) {
            try {
              compileWasm(config.root, entry);
              console.log(`[wasm-inline] Compiled ${entry.srcRel} → ${entry.wasmRel}`);
            } catch (err: any) {
              console.error(`[wasm-inline] Compilation failed for ${entry.srcRel}:`, err.message);
              throw err;
            }
          }

          // Read .wasm and inline as base64
          const absPath = path.resolve(config.root, entry.wasmRel);
          if (!fs.existsSync(absPath)) {
            throw new Error(
              `[wasm-inline] WASM file not found after compilation: ${absPath}\n` +
              `Make sure 'asc' (AssemblyScript compiler) is installed.`
            );
          }

          const wasmBuffer = fs.readFileSync(absPath);
          const base64 = wasmBuffer.toString('base64');

          return {
            code: `const base64 = ${JSON.stringify(base64)};\nexport default base64;`,
            map: null,
          };
        }
      }
      return null;
    },
  };
}
