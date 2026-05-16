/**
 * WasmTileColor — JS wrapper for the AS/WASM tile-color module.
 *
 * Provides color calculation utilities via WASM:
 *   - addBlack, halfColor, rainbow, lerpColor
 * Falls back to JS if WASM fails to load.
 */

import wasmBase64 from 'virtual:wasm-tile-color';

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

let wasmInstance: WebAssembly.Instance | null = null;
let wasmReady: Promise<void> | null = null;
let wasmFailed = false;
let scratchPtr = 0;

async function loadWasm(): Promise<void> {
  if (wasmInstance || wasmFailed) return;
  if (wasmReady) return wasmReady;

  wasmReady = (async () => {
    try {
      const b64 = wasmBase64 as string;
      const bytes = base64ToBytes(b64);
      const mod = new WebAssembly.Module(bytes.buffer as ArrayBuffer);
      wasmInstance = await WebAssembly.instantiate(mod);
      const exports = wasmInstance.exports as any;
      scratchPtr = exports.getScratchPtr() as number;
    } catch (e) {
      wasmFailed = true;
      console.warn('[WasmTileColor] Failed to load WASM, falling back to JS:', e);
    }
  })();

  return wasmReady;
}

function readScratch3(): [number, number, number] {
  if (!wasmInstance) return [0, 0, 0];
  const mem = new Float64Array((wasmInstance!.exports as any).memory.buffer);
  const base = scratchPtr >> 3; // byte offset → f64 index
  return [mem[base], mem[base + 1], mem[base + 2]];
}

export async function ensureWasm(): Promise<void> {
  await loadWasm();
}

export function addBlackWasm(opa: number, r: number, g: number, b: number): [number, number, number] {
  if (!wasmInstance) return [opa * r, opa * g, opa * b];
  const exports = wasmInstance.exports as any;
  exports.addBlack(opa, r, g, b);
  return readScratch3();
}

export function halfColorWasm(r: number, g: number, b: number): [number, number, number] {
  if (!wasmInstance) return [r / 2, g / 2, b / 2];
  const exports = wasmInstance.exports as any;
  exports.halfColor(r, g, b);
  return readScratch3();
}

export function rainbowWasm(r: number, g: number, b: number, percent: number): [number, number, number] {
  if (!wasmInstance) return [0, 0, 0];
  const exports = wasmInstance.exports as any;
  exports.rainbow(r, g, b, percent);
  return readScratch3();
}

export function lerpColorWasm(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): [number, number, number] {
  if (!wasmInstance) return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
  const exports = wasmInstance.exports as any;
  exports.lerpColor(r1, g1, b1, r2, g2, b2, t);
  return readScratch3();
}
