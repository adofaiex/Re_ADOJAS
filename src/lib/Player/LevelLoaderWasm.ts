/**
 * LevelLoaderWasm — JS wrapper for the AS/WASM level precomputation module.
 *
 * Packs level data into flat typed arrays in WASM linear memory,
 * calls precompute(), and unpacks results into the same format
 * as levelLoaderWorker.ts's precomputeLevelData().
 */

import loaderBase64 from 'virtual:wasm-level-loader';

// Max supported tile count (prevents unbounded memory allocation)
const MAX_TILES = 2000;
const MAX_EVENTS = 10000;

/** One i32 = 4 bytes, one f64 = 8 bytes */
const SZ = { i32: 4, f64: 8 };

export interface PrecomputedData {
  cumulativeRotations: number[];
  tileStartTimes: number[];
  tileDurations: number[];
  tileExtraRotations: number[];
  tileIsCW: boolean[];
  tileBPM: number[];
  tileStartAngle: number[];
  tileTotalAngle: number[];
  tileStartDist: number[];
  tileEndDist: number[];
  totalLevelRotation: number;
  tileEvents: Record<number, any[]>;
  tileCameraEvents: Record<number, any[]>;
  cameraTimeline: { time: number; event: any }[];
}

/**
 * Decode a base64 string into a Uint8Array.
 */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode event type to an integer code.
 */
function eventCode(eventType: string): number {
  switch (eventType) {
    case 'Twirl': return 0;
    case 'SetSpeed': return 1;
    case 'Pause': return 3;
    default: return -1;
  }
}

/**
 * Flatten tile events into typed arrays.
 * Returns { eventTile, eventType, eventParam, count }.
 */
function flattenEvents(
  tileEvents: Record<number, any[]>,
  tileCount: number
): { eventTile: Int32Array; eventType: Int32Array; eventParam: Float64Array; count: number } {
  // Count total events
  let total = 0;
  for (let i = 0; i < tileCount; i++) {
    const evs = tileEvents[i];
    if (evs) total += evs.length;
  }

  const tileArr = new Int32Array(total);
  const typeArr = new Int32Array(total);
  const paramArr = new Float64Array(total * 3);
  let idx = 0;

  for (let i = 0; i < tileCount; i++) {
    const evs = tileEvents[i];
    if (!evs) continue;
    for (const ev of evs) {
      tileArr[idx] = i;
      typeArr[idx] = eventCode(ev.eventType);
      if (ev.eventType === 'SetSpeed') {
        paramArr[idx * 3] = ev.speedType === 'Multiplier' ? ev.bpmMultiplier : ev.beatsPerMinute;
      } else if (ev.eventType === 'Pause') {
        paramArr[idx * 3] = ev.duration || 0;
      }
      // Twirl: no params needed
      idx++;
    }
  }

  return { eventTile: tileArr, eventType: typeArr, eventParam: paramArr, count: total };
}

let wasmModule: WebAssembly.Module | null = null;
let wasmInstance: WebAssembly.Instance | null = null;
let wasmReady: Promise<void> | null = null;

/**
 * Ensure WASM is loaded. Safe to call multiple times.
 */
export function ensureWasm(): Promise<void> {
  if (wasmInstance) return Promise.resolve();
  if (wasmReady) return wasmReady;

  wasmReady = (async () => {
    const b64 = loaderBase64 as string;
    const bytes = base64ToBytes(b64);
    const mod = new WebAssembly.Module(bytes.buffer as ArrayBuffer);
    wasmModule = mod;
    wasmInstance = await WebAssembly.instantiate(mod);
  })();

  return wasmReady;
}

/**
 * Precompute level data using WASM.
 *
 * Accepts the same levelData shape as levelLoaderWorker.ts's precomputeLevelData().
 * Returns a PrecomputedData object with all computed arrays.
 *
 * Falls back to JS if WASM fails to load or if tile count exceeds MAX_TILES.
 */
export function precomputeLevelDataWasm(levelData: any): PrecomputedData | null {
  const tiles = levelData.tiles || [];
  const tileCount = tiles.length;
  if (tileCount < 2) return null;
  if (tileCount > MAX_TILES) return null; // too large, fall back to JS

  const wasm = wasmInstance?.exports as any;
  if (!wasm || !wasm.precompute) return null;

  const memory = wasm.memory as WebAssembly.Memory;
  const settings = levelData.settings || {};

  // Parse actions into tileEvents
  const actions = levelData.actions || [];
  const tileEvents: Record<number, any[]> = {};
  const tileCameraEvents: Record<number, any[]> = {};

  for (const action of actions) {
    const floor = action.floor;
    if (action.eventType === 'MoveCamera') {
      if (!tileCameraEvents[floor]) tileCameraEvents[floor] = [];
      tileCameraEvents[floor].push(action);
    } else {
      if (!tileEvents[floor]) tileEvents[floor] = [];
      tileEvents[floor].push(action);
    }
  }

  // Flatten inputs
  const positions = new Float64Array(tileCount * 2);
  const angles = new Float64Array(tileCount);
  for (let i = 0; i < tileCount; i++) {
    const t = tiles[i];
    positions[i * 2] = t.position[0];
    positions[i * 2 + 1] = t.position[1];
    angles[i] = t.angle || 0;
  }

  const flat = flattenEvents(tileEvents, tileCount);

  // Ensure enough WASM memory
  const neededBytes =
    positions.byteLength +          // positions
    angles.byteLength +             // angles
    flat.eventTile.byteLength +     // eventTile (i32)
    flat.eventType.byteLength +     // eventType (i32)
    flat.eventParam.byteLength +    // eventParam (f64)
    // Output arrays:
    SZ.f64 * tileCount * 8 +        // 8 f64 arrays of length tileCount
    SZ.i32 * tileCount;             // 1 i32 array of length tileCount

  const currentPages = memory.buffer.byteLength / 65536;
  const neededPages = Math.ceil(neededBytes / 65536) + 1; // +1 for safety
  if (neededPages > currentPages) {
    memory.grow(neededPages - currentPages);
  }

  // Bump allocator within WASM memory
  let bumpPtr = 65536; // start after first page (module data)

  function allocBytes(size: number): number {
    const ptr = bumpPtr;
    // Align to 8 bytes
    bumpPtr = (bumpPtr + size + 7) & ~7;
    return ptr;
  }

  function writeF64(ptr: number, arr: Float64Array): void {
    const view = new Float64Array(memory.buffer, ptr, arr.length);
    view.set(arr);
  }

  function writeI32(ptr: number, arr: Int32Array): void {
    const view = new Int32Array(memory.buffer, ptr, arr.length);
    view.set(arr);
  }

  function readF64(ptr: number, len: number): Float64Array {
    return new Float64Array(memory.buffer, ptr, len);
  }

  function readI32(ptr: number, len: number): Int32Array {
    return new Int32Array(memory.buffer, ptr, len);
  }

  // Allocate input regions
  const posPtr = allocBytes(positions.byteLength);
  const angPtr = allocBytes(angles.byteLength);
  const evTilePtr = allocBytes(flat.eventTile.byteLength);
  const evTypePtr = allocBytes(flat.eventType.byteLength);
  const evParamPtr = allocBytes(flat.eventParam.byteLength);

  // Allocate output regions
  const segCount = tileCount - 1;
  // Segment-length arrays (f64)
  const outStartTimesPtr = allocBytes(segCount * SZ.f64);
  const outDurationsPtr = allocBytes(segCount * SZ.f64);
  const outStartAnglePtr = allocBytes(segCount * SZ.f64);
  const outTotalAnglePtr = allocBytes(segCount * SZ.f64);
  const outStartDistPtr = allocBytes(segCount * SZ.f64);
  const outEndDistPtr = allocBytes(segCount * SZ.f64);
  const outCumulRotPtr = allocBytes(segCount * SZ.f64);
  // Tile-length arrays
  const outIsCWPtr = allocBytes(tileCount * SZ.i32);
  const outBPMPtr = allocBytes(tileCount * SZ.f64);
  const outExtraRotPtr = allocBytes(tileCount * SZ.f64);

  // Write inputs
  writeF64(posPtr, positions);
  writeF64(angPtr, angles);
  writeI32(evTilePtr, flat.eventTile);
  writeI32(evTypePtr, flat.eventType);
  writeF64(evParamPtr, flat.eventParam);

  // Call WASM
  const segs = wasm.precompute(
    posPtr, tileCount,
    angPtr,
    evTilePtr, evTypePtr, evParamPtr, flat.count,
    settings.bpm || 100,
    settings.rotation || 0,
    outStartTimesPtr,
    outDurationsPtr,
    outIsCWPtr,
    outBPMPtr,
    outStartAnglePtr,
    outTotalAnglePtr,
    outStartDistPtr,
    outEndDistPtr,
    outExtraRotPtr,
    outCumulRotPtr
  ) as number;

  if (segs < 1) return null;

  // Read results
  const readSegF64 = (ptr: number): number[] =>
    Array.from(readF64(ptr, segs));

  const startTimes = readSegF64(outStartTimesPtr);
  const durations = readSegF64(outDurationsPtr);
  const startAngles = readSegF64(outStartAnglePtr);
  const totalAngles = readSegF64(outTotalAnglePtr);
  const startDists = readSegF64(outStartDistPtr);
  const endDists = readSegF64(outEndDistPtr);
  const cumulRots = readSegF64(outCumulRotPtr);

  const isCWArr = Array.from(readI32(outIsCWPtr, tileCount));
  const bpmArr = Array.from(readF64(outBPMPtr, tileCount));
  const extraRotArr = Array.from(readF64(outExtraRotPtr, tileCount));

  // Shift tileStartTimes (original JS logic)
  if (startTimes.length > 1) {
    const shift = startTimes[1];
    for (let i = 0; i < startTimes.length; i++) {
      startTimes[i] -= shift;
    }
  }

  return {
    cumulativeRotations: cumulRots,
    tileStartTimes: startTimes,
    tileDurations: durations,
    tileExtraRotations: extraRotArr,
    tileIsCW: isCWArr.map(v => v === 1),
    tileBPM: bpmArr,
    tileStartAngle: startAngles,
    tileTotalAngle: totalAngles,
    tileStartDist: startDists,
    tileEndDist: endDists,
    totalLevelRotation: cumulRots.length > 0 ? cumulRots[cumulRots.length - 1] : 0,
    tileEvents,
    tileCameraEvents,
    cameraTimeline: [], // populated separately by Player
  };
}

/**
 * Convenience: ensure WASM is loaded, then run precompute.
 * For use in non-worker contexts (Player.ts's calculateCumulativeRotations replacement).
 */
export async function computeWithWasm(levelData: any): Promise<PrecomputedData | null> {
  await ensureWasm();
  return precomputeLevelDataWasm(levelData);
}
