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
import type { Plugin } from 'vite';
export declare function wasmInlinePlugin(): Plugin;
