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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
var ENTRIES = [
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
var VIRTUAL_PREFIX = '\0virtual:wasm-';
/**
 * Compile a single AssemblyScript entry to .wasm using npx asc.
 * Throws on failure.
 */
function compileWasm(rootDir, entry) {
    var _a, _b;
    var absSrc = path.resolve(rootDir, entry.srcRel);
    var absOut = path.resolve(rootDir, entry.wasmRel);
    if (!fs.existsSync(absSrc)) {
        throw new Error("[wasm-inline] AssemblyScript source not found: ".concat(absSrc, "\n") +
            "Cannot auto-compile. Make sure the file exists.");
    }
    // Ensure output directory exists
    var outDir = path.dirname(absOut);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    var ascArgs = __spreadArray([
        absSrc,
        '-o', absOut,
        '--optimize',
        '--runtime', 'stub',
        '--exportStart', '_start'
    ], (entry.ascArgs || []), true);
    try {
        execSync("npx asc ".concat(ascArgs.join(' ')), {
            cwd: rootDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 60000,
        });
    }
    catch (err) {
        var stderr = ((_a = err.stderr) === null || _a === void 0 ? void 0 : _a.toString()) || '';
        var stdout = ((_b = err.stdout) === null || _b === void 0 ? void 0 : _b.toString()) || '';
        throw new Error("[wasm-inline] Failed to compile ".concat(entry.srcRel, ":\n").concat(stderr, "\n").concat(stdout));
    }
}
/**
 * Check if .wasm needs recompilation (missing or source is newer).
 */
function needsRecompile(rootDir, entry) {
    var absSrc = path.resolve(rootDir, entry.srcRel);
    var absOut = path.resolve(rootDir, entry.wasmRel);
    if (!fs.existsSync(absOut))
        return true;
    if (!fs.existsSync(absSrc))
        return false; // No source to compare
    var srcMtime = fs.statSync(absSrc).mtimeMs;
    var outMtime = fs.statSync(absOut).mtimeMs;
    return srcMtime > outMtime;
}
export function wasmInlinePlugin() {
    var config;
    return {
        name: 'wasm-inline',
        enforce: 'pre',
        configResolved: function (resolvedConfig) {
            config = resolvedConfig;
        },
        resolveId: function (id) {
            for (var _i = 0, ENTRIES_1 = ENTRIES; _i < ENTRIES_1.length; _i++) {
                var entry = ENTRIES_1[_i];
                var virtualId = "virtual:wasm-".concat(entry.name);
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
        load: function (id) {
            for (var _i = 0, ENTRIES_2 = ENTRIES; _i < ENTRIES_2.length; _i++) {
                var entry = ENTRIES_2[_i];
                var resolvedId = VIRTUAL_PREFIX + entry.name;
                if (id === resolvedId) {
                    // Auto-compile if needed
                    if (needsRecompile(config.root, entry)) {
                        try {
                            compileWasm(config.root, entry);
                            console.log("[wasm-inline] Compiled ".concat(entry.srcRel, " \u2192 ").concat(entry.wasmRel));
                        }
                        catch (err) {
                            console.error("[wasm-inline] Compilation failed for ".concat(entry.srcRel, ":"), err.message);
                            throw err;
                        }
                    }
                    // Read .wasm and inline as base64
                    var absPath = path.resolve(config.root, entry.wasmRel);
                    if (!fs.existsSync(absPath)) {
                        throw new Error("[wasm-inline] WASM file not found after compilation: ".concat(absPath, "\n") +
                            "Make sure 'asc' (AssemblyScript compiler) is installed.");
                    }
                    var wasmBuffer = fs.readFileSync(absPath);
                    var base64 = wasmBuffer.toString('base64');
                    return {
                        code: "const base64 = ".concat(JSON.stringify(base64), ";\nexport default base64;"),
                        map: null,
                    };
                }
            }
            return null;
        },
    };
}
