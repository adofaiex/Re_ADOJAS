/**
 * Level Loader Web Worker
 * Precomputes tile timing/rotation data using WASM (fast path) or JS (fallback).
 * The WASM binary is received from the main thread via the 'load' message.
 */

// ── Message types ──────────────────────────────────────────────

interface LoadMessage {
  type: 'load';
  levelData: {
    settings: any;
    tiles: any[];
    actions: any[];
    angleData: any[];
  };
  /** Base64-encoded WASM binary (optional — from main thread) */
  wasmBase64?: string;
}

type WorkerMessage = LoadMessage;

interface ResultMessage {
  type: 'result';
  data: any;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

type WorkerResponse = ResultMessage | ErrorMessage;

function postRes(data: any): void { self.postMessage({ type: 'result', data } satisfies ResultMessage); }
function postErr(error: string): void { self.postMessage({ type: 'error', error } satisfies ErrorMessage); }

// ── WASM module (lazily instantiated) ──────────────────────────

let wasmExports: Record<string, any> | null = null;
let pendingWasmBase64: string | null = null;

/** Called before 'load' to supply the WASM binary from the main thread */
export function setWasmBase64(b64: string): void {
  pendingWasmBase64 = b64;
}

async function ensureWasm(): Promise<boolean> {
  if (wasmExports) return true;
  const b64 = pendingWasmBase64;
  if (!b64) return false;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mod = new WebAssembly.Module(bytes);
    const inst = await WebAssembly.instantiate(mod);
    wasmExports = inst.exports as any;
    return true;
  } catch {
    return false;
  }
}

// ── Event encoding ─────────────────────────────────────────────

function eventCode(type: string): number {
  switch (type) {
    case 'Twirl': return 0;
    case 'SetSpeed': return 1;
    case 'Pause': return 3;
    default: return -1;
  }
}

// ── JS fallback ────────────────────────────────────────────────

function precomputeLevelDataJS(levelData: any): any {
  const tiles = levelData.tiles || [];
  const actions = levelData.actions || [];
  const settings = levelData.settings || {};

  const out = {
    cumulativeRotations: [] as number[],
    tileStartTimes: [] as number[],
    tileDurations: [] as number[],
    tileExtraRotations: [] as number[],
    tileIsCW: [] as boolean[],
    tileBPM: [] as number[],
    tileStartAngle: [] as number[],
    tileTotalAngle: [] as number[],
    tileStartDist: [] as number[],
    tileEndDist: [] as number[],
    totalLevelRotation: 0,
    tileEvents: {} as Record<number, any[]>,
    tileCameraEvents: {} as Record<number, any[]>,
    cameraTimeline: [] as { time: number; event: any }[],
  };

  for (const a of actions) {
    const f = a.floor;
    if (a.eventType === 'MoveCamera') {
      (out.tileCameraEvents[f] ||= []).push(a);
    } else {
      (out.tileEvents[f] ||= []).push(a);
    }
  }

  let totalRotation = 0, totalTime = 0;
  let currentBPM = settings.bpm || 100;
  let isCW = true;

  for (let i = 0; i < tiles.length - 1; i++) {
    let extraRotation = 0;
    if (out.tileEvents[i]) {
      for (const e of out.tileEvents[i]) {
        if (e.eventType === 'Twirl') isCW = !isCW;
        else if (e.eventType === 'SetSpeed') {
          currentBPM = e.speedType === 'Multiplier' ? currentBPM * e.bpmMultiplier : e.beatsPerMinute;
        } else if (e.eventType === 'Pause') extraRotation += (e.duration || 0) / 2.0;
      }
    }
    out.tileIsCW.push(isCW);
    out.tileBPM.push(currentBPM);

    const pivot = tiles[i], next = tiles[i + 1];
    const startAngle = i === 0
      ? ((settings.rotation || 0) + 180) * Math.PI / 180
      : Math.atan2(tiles[i - 1].position[1] - pivot.position[1], tiles[i - 1].position[0] - pivot.position[0]);
    const relAngle = (pivot.angle ?? 180) * Math.PI / 180;
    let totalAngle = isCW ? -relAngle : relAngle;
    totalAngle += (isCW ? -1 : 1) * extraRotation * 2 * Math.PI;

    const rotAmt = Math.abs(totalAngle) / (2 * Math.PI);
    const duration = (rotAmt * 2) * (60 / currentBPM);
    totalRotation += rotAmt;
    totalTime += duration;

    out.tileStartAngle.push(startAngle);
    out.tileTotalAngle.push(totalAngle);
    out.cumulativeRotations.push(totalRotation);
    out.tileDurations.push(duration);
    out.tileStartTimes.push(totalTime);

    if (i > 0) {
      const p = tiles[i - 1];
      const dx = p.position[0] - pivot.position[0], dy = p.position[1] - pivot.position[1];
      out.tileStartDist.push(Math.sqrt(dx * dx + dy * dy));
    } else out.tileStartDist.push(1.0);
    const edx = next.position[0] - pivot.position[0], edy = next.position[1] - pivot.position[1];
    out.tileEndDist.push(Math.sqrt(edx * edx + edy * edy));
    out.tileExtraRotations.push(extraRotation);
  }

  if (out.tileStartTimes.length > 1) {
    const shift = out.tileStartTimes[1];
    for (let i = 0; i < out.tileStartTimes.length; i++) out.tileStartTimes[i] -= shift;
  }

  if (tiles.length > 0) {
    const li = tiles.length - 1;
    let extra = 0;
    if (out.tileEvents[li]) {
      for (const e of out.tileEvents[li]) {
        if (e.eventType === 'Twirl') isCW = !isCW;
        else if (e.eventType === 'SetSpeed') {
          currentBPM = e.speedType === 'Multiplier' ? currentBPM * e.bpmMultiplier : e.beatsPerMinute;
        } else if (e.eventType === 'Pause') extra += (e.duration || 0) / 2.0;
      }
    }
    out.tileIsCW.push(isCW);
    out.tileBPM.push(currentBPM);
    out.tileExtraRotations.push(extra);
  }

  out.totalLevelRotation = totalRotation;
  return out;
}

// ── WASM fast path ─────────────────────────────────────────────

const MAX_TILES = 2000;
const SZ = { i32: 4, f64: 8 };

function precomputeLevelDataWasm(levelData: any): any {
  const wasm = wasmExports;
  if (!wasm || !wasm.precompute) return null;

  const tiles = levelData.tiles || [];
  const tileCount = tiles.length;
  if (tileCount < 2 || tileCount > MAX_TILES) return null;

  const memory = wasm.memory as WebAssembly.Memory;
  const settings = levelData.settings || {};

  // Parse actions into tileEvents
  const actions = levelData.actions || [];
  const tileEvents: Record<number, any[]> = {};
  const tileCameraEvents: Record<number, any[]> = {};
  for (const a of actions) {
    const f = a.floor;
    if (a.eventType === 'MoveCamera') (tileCameraEvents[f] ||= []).push(a);
    else (tileEvents[f] ||= []).push(a);
  }

  // Build flat arrays
  const positions = new Float64Array(tileCount * 2);
  const angles = new Float64Array(tileCount);
  for (let i = 0; i < tileCount; i++) {
    positions[i * 2] = tiles[i].position[0];
    positions[i * 2 + 1] = tiles[i].position[1];
    angles[i] = tiles[i].angle || 0;
  }

  // Flatten events
  let evCount = 0;
  for (let i = 0; i < tileCount; i++) { const e = tileEvents[i]; if (e) evCount += e.length; }
  const evTile = new Int32Array(evCount);
  const evType = new Int32Array(evCount);
  const evParam = new Float64Array(evCount * 3);
  let idx = 0;
  for (let i = 0; i < tileCount; i++) {
    const evs = tileEvents[i];
    if (!evs) continue;
    for (const e of evs) {
      evTile[idx] = i;
      evType[idx] = eventCode(e.eventType);
      if (e.eventType === 'SetSpeed')
        evParam[idx * 3] = e.speedType === 'Multiplier' ? e.bpmMultiplier : e.beatsPerMinute;
      else if (e.eventType === 'Pause')
        evParam[idx * 3] = e.duration || 0;
      idx++;
    }
  }

  // Ensure enough WASM memory
  const needed =
    positions.byteLength + angles.byteLength +
    evTile.byteLength + evType.byteLength + evParam.byteLength +
    SZ.f64 * tileCount * 8 + SZ.i32 * tileCount;
  const curPages = memory.buffer.byteLength / 65536;
  const needPages = Math.ceil(needed / 65536) + 1;
  if (needPages > curPages) memory.grow(needPages - curPages);

  // Bump allocator in WASM memory (start after 1st page)
  let bump = 65536;
  const alloc = (sz: number) => { const p = bump; bump = (bump + sz + 7) & ~7; return p; };
  const wF64 = (p: number, a: Float64Array) => new Float64Array(memory.buffer, p, a.length).set(a);
  const wI32 = (p: number, a: Int32Array) => new Int32Array(memory.buffer, p, a.length).set(a);
  const rF64 = (p: number, l: number): Float64Array => new Float64Array(memory.buffer, p, l);
  const rI32 = (p: number, l: number): Int32Array => new Int32Array(memory.buffer, p, l);

  const posPtr = alloc(positions.byteLength);
  const angPtr = alloc(angles.byteLength);
  const evTilePtr = alloc(evTile.byteLength);
  const evTypePtr = alloc(evType.byteLength);
  const evParamPtr = alloc(evParam.byteLength);

  const segs = tileCount - 1;
  const outStartTimesPtr = alloc(segs * SZ.f64);
  const outDurationsPtr = alloc(segs * SZ.f64);
  const outStartAnglePtr = alloc(segs * SZ.f64);
  const outTotalAnglePtr = alloc(segs * SZ.f64);
  const outStartDistPtr = alloc(segs * SZ.f64);
  const outEndDistPtr = alloc(segs * SZ.f64);
  const outCumulRotPtr = alloc(segs * SZ.f64);
  const outIsCWPtr = alloc(tileCount * SZ.i32);
  const outBPMPtr = alloc(tileCount * SZ.f64);
  const outExtraRotPtr = alloc(tileCount * SZ.f64);

  wF64(posPtr, positions);
  wF64(angPtr, angles);
  wI32(evTilePtr, evTile);
  wI32(evTypePtr, evType);
  wF64(evParamPtr, evParam);

  const resultSegs = wasm.precompute(
    posPtr, tileCount, angPtr,
    evTilePtr, evTypePtr, evParamPtr, evCount,
    settings.bpm || 100, settings.rotation || 0,
    outStartTimesPtr, outDurationsPtr,
    outIsCWPtr, outBPMPtr,
    outStartAnglePtr, outTotalAnglePtr,
    outStartDistPtr, outEndDistPtr,
    outExtraRotPtr, outCumulRotPtr
  ) as number;

  if (resultSegs < 1) return null;

  // Read results
  const readSeg = (p: number) => Array.from(rF64(p, segs));
  const startTimes = readSeg(outStartTimesPtr);
  const durations = readSeg(outDurationsPtr);
  const startAngles = readSeg(outStartAnglePtr);
  const totalAngles = readSeg(outTotalAnglePtr);
  const startDists = readSeg(outStartDistPtr);
  const endDists = readSeg(outEndDistPtr);
  const cumulRots = readSeg(outCumulRotPtr);
  const isCW = Array.from(rI32(outIsCWPtr, tileCount));
  const bpm = Array.from(rF64(outBPMPtr, tileCount));
  const extraRot = Array.from(rF64(outExtraRotPtr, tileCount));

  // Shift tileStartTimes (same as JS path)
  if (startTimes.length > 1) {
    const shift = startTimes[1];
    for (let i = 0; i < startTimes.length; i++) startTimes[i] -= shift;
  }

  return {
    cumulativeRotations: cumulRots,
    tileStartTimes: startTimes,
    tileDurations: durations,
    tileExtraRotations: extraRot,
    tileIsCW: isCW.map(v => v === 1),
    tileBPM: bpm,
    tileStartAngle: startAngles,
    tileTotalAngle: totalAngles,
    tileStartDist: startDists,
    tileEndDist: endDists,
    totalLevelRotation: cumulRots.length > 0 ? cumulRots[cumulRots.length - 1] : 0,
    tileEvents,
    tileCameraEvents,
    cameraTimeline: [],
  };
}

// ── Worker message handler ─────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type !== 'load') return;
  const { levelData, wasmBase64 } = event.data;

  // If main thread sent WASM binary, cache it for instantiation
  if (wasmBase64) pendingWasmBase64 = wasmBase64;

  try {
    // Try WASM path
    await ensureWasm();
    let precomputed = precomputeLevelDataWasm(levelData);

    // Fall back to JS
    if (!precomputed) {
      precomputed = precomputeLevelDataJS(levelData);
    }

    postRes({ levelData, precomputed });
  } catch (err) {
    // Last-resort JS fallback on any error
    try {
      const precomputed = precomputeLevelDataJS(levelData);
      postRes({ levelData, precomputed });
    } catch (err2) {
      postErr(err2 instanceof Error ? err2.message : 'Unknown error');
    }
  }
};

export {};
