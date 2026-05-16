/**
 * WasmEasing — JS wrapper for the AS/WASM easing module.
 *
 * Provides all ADOFAI easing functions via WASM.
 * Falls back to JS EasingFunctions if WASM fails to load.
 */

import wasmBase64 from 'virtual:wasm-easing';

import { EasingFunctions } from './Easing';

const NAME_MAP: Record<string, string> = {
  'Linear.easeNone': 'linear',
  'Linear': 'linear',
  'Quad.easeIn': 'inQuad',
  'Quad.easeOut': 'outQuad',
  'Quad.easeInOut': 'inOutQuad',
  'Cubic.easeIn': 'inCubic',
  'Cubic.easeOut': 'outCubic',
  'Cubic.easeInOut': 'inOutCubic',
  'Quart.easeIn': 'inQuart',
  'Quart.easeOut': 'outQuart',
  'Quart.easeInOut': 'inOutQuart',
  'Quint.easeIn': 'inQuint',
  'Quint.easeOut': 'outQuint',
  'Quint.easeInOut': 'inOutQuint',
  'Sine.easeIn': 'inSine',
  'Sine.easeOut': 'outSine',
  'Sine.easeInOut': 'inOutSine',
  'Expo.easeIn': 'inExpo',
  'Expo.easeOut': 'outExpo',
  'Expo.easeInOut': 'inOutExpo',
  'Circ.easeIn': 'inCirc',
  'Circ.easeOut': 'outCirc',
  'Circ.easeInOut': 'inOutCirc',
  'Elastic.easeIn': 'inElastic',
  'Elastic.easeOut': 'outElastic',
  'Elastic.easeInOut': 'inOutElastic',
  'Back.easeIn': 'inBack',
  'Back.easeOut': 'outBack',
  'Back.easeInOut': 'inOutBack',
  'Bounce.easeIn': 'inBounce',
  'Bounce.easeOut': 'outBounce',
  'Bounce.easeInOut': 'inOutBounce',
};

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

async function loadWasm(): Promise<void> {
  if (wasmInstance || wasmFailed) return;
  if (wasmReady) return wasmReady;

  wasmReady = (async () => {
    try {
      const b64 = wasmBase64 as string;
      const bytes = base64ToBytes(b64);
      const mod = new WebAssembly.Module(bytes.buffer as ArrayBuffer);
      wasmInstance = await WebAssembly.instantiate(mod);
    } catch (e) {
      wasmFailed = true;
      console.warn('[WasmEasing] Failed to load WASM, falling back to JS:', e);
    }
  })();

  return wasmReady;
}

const wasmCache = new Map<string, (t: number) => number>();

function getWasmFn(name: string): ((t: number) => number) | null {
  if (!wasmInstance) return null;

  let fn = wasmCache.get(name);
  if (fn) return fn;

  const wasmName = NAME_MAP[name] || name;
  const exportFn = (wasmInstance!.exports as any)[wasmName];
  if (typeof exportFn === 'function') {
    fn = (t: number) => exportFn(t) as number;
    wasmCache.set(name, fn);
    return fn;
  }

  // Try lowercase-first-letter variant
  const altName = wasmName.charAt(0).toLowerCase() + wasmName.slice(1);
  const altFn = (wasmInstance!.exports as any)[altName];
  if (typeof altFn === 'function') {
    fn = (t: number) => altFn(t) as number;
    wasmCache.set(name, fn);
    return fn;
  }

  return null;
}

export async function ensureWasm(): Promise<void> {
  await loadWasm();
}

export function getEasingFunctionWasm(easeName: string): ((t: number) => number) | null {
  if (!wasmInstance) return null;
  return getWasmFn(easeName);
}

export function getEasingFunction(easeName: string): (t: number) => number {
  const wasmFn = getEasingFunctionWasm(easeName);
  if (wasmFn) return wasmFn;
  return EasingFunctions[easeName] || EasingFunctions.Linear;
}
