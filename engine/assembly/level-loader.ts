/**
 * LevelLoader — AssemblyScript WASM module
 *
 * Computes tile timing/rotation/distance arrays.
 * Input/output are flat arrays in WASM linear memory (passed as usize pointers).
 *
 * Event type encoding (stored as i32):
 *   0 = Twirl
 *   1 = SetSpeed (Multiplier)
 *   2 = SetSpeed (Absolute)
 *   3 = Pause
 *
 * Event params: 3 f64 values per event, stored contiguously.
 */

const PI: f64 = 3.141592653589793;
const DEG: f64 = PI / 180.0;

function readF64(ptr: usize, idx: i32): f64 {
  return load<f64>(ptr + (idx << 3));
}

function writeF64(ptr: usize, idx: i32, val: f64): void {
  store<f64>(ptr + (idx << 3), val);
}

function readI32(ptr: usize, idx: i32): i32 {
  return load<i32>(ptr + (idx << 2));
}

function writeI32(ptr: usize, idx: i32, val: i32): void {
  store<i32>(ptr + (idx << 2), val);
}

/**
 * Main precomputation entry point.
 *
 * Inputs (read from WASM memory):
 *   positions    — f64[tileCount * 2], xy pairs
 *   angles       — f64[tileCount], tile.angle values (degrees)
 *   eventTile    — i32[eventCount], tile index per event
 *   eventType    — i32[eventCount], event type code
 *   eventParam   — f64[eventCount * 3], 3 params per event
 *   bpm, rotation — f64 scalars
 *
 * Outputs (written to WASM memory, caller allocates):
 *   Segments (length = tileCount - 1):
 *     outStartTimes   — f64[segCount]
 *     outDurations    — f64[segCount]
 *     outStartAngle   — f64[segCount]
 *     outTotalAngle   — f64[segCount]
 *     outStartDist    — f64[segCount]
 *     outEndDist      — f64[segCount]
 *     outCumulRot     — f64[segCount]
 *   Tiles (length = tileCount):
 *     outIsCW         — i32[tileCount]
 *     outBPM          — f64[tileCount]
 *     outExtraRot     — f64[tileCount]
 *
 * Returns: segCount (or 0 if tileCount < 2)
 */
export function precompute(
  positionsPtr: usize, tileCount: i32,
  anglesPtr: usize,
  eventTilePtr: usize, eventTypePtr: usize, eventParamPtr: usize, eventCount: i32,
  bpm: f64, rotation: f64,
  outStartTimesPtr: usize,
  outDurationsPtr: usize,
  outIsCWPtr: usize,
  outBPMPtr: usize,
  outStartAnglePtr: usize,
  outTotalAnglePtr: usize,
  outStartDistPtr: usize,
  outEndDistPtr: usize,
  outExtraRotationsPtr: usize,
  outCumulativeRotationsPtr: usize
): i32 {
  if (tileCount < 2) return 0;
  const segs: i32 = tileCount - 1;

  let totalTime: f64 = 0.0;
  let totalRotation: f64 = 0.0;
  let currentBPM: f64 = bpm;
  let isCW: i32 = 1; // 1 = true, 0 = false
  let evIdx: i32 = 0;

  for (let i: i32 = 0; i < segs; i++) {
    let extraRotation: f64 = 0.0;

    // Process events for this tile
    while (evIdx < eventCount && readI32(eventTilePtr, evIdx) == i) {
      const etype: i32 = readI32(eventTypePtr, evIdx);
      const param0: f64 = readF64(eventParamPtr, evIdx * 3);
      // param1, param2 at (evIdx*3+1), (evIdx*3+2) — unused for now

      if (etype == 0) {
        // Twirl
        isCW = isCW == 1 ? 0 : 1;
      } else if (etype == 1) {
        // SetSpeed Multiplier
        currentBPM *= param0;
      } else if (etype == 2) {
        // SetSpeed Absolute
        currentBPM = param0;
      } else if (etype == 3) {
        // Pause
        extraRotation += param0 / 2.0;
      }
      evIdx++;
    }

    writeI32(outIsCWPtr, i, isCW);
    writeF64(outBPMPtr, i, currentBPM);

    // Tile positions
    const px: f64 = readF64(positionsPtr, i * 2);
    const py: f64 = readF64(positionsPtr, i * 2 + 1);
    const nx: f64 = readF64(positionsPtr, (i + 1) * 2);
    const ny: f64 = readF64(positionsPtr, (i + 1) * 2 + 1);

    // Start angle
    let startAngle: f64;
    if (i == 0) {
      startAngle = (rotation + 180.0) * DEG;
    } else {
      const ppx: f64 = readF64(positionsPtr, (i - 1) * 2);
      const ppy: f64 = readF64(positionsPtr, (i - 1) * 2 + 1);
      startAngle = Math.atan2(ppy - py, ppx - px);
    }

    // Total angle
    const rawAngle: f64 = readF64(anglesPtr, i);
    const relAngle: f64 = rawAngle == 0.0 ? 180.0 : rawAngle;
    let totalAngle: f64 = relAngle * DEG;
    if (isCW == 1) {
      totalAngle = -totalAngle;
    }

    // Extra rotation from Pause
    if (isCW == 1) {
      totalAngle -= extraRotation * 2.0 * PI;
    } else {
      totalAngle += extraRotation * 2.0 * PI;
    }

    const rotAmount: f64 = Math.abs(totalAngle) / (2.0 * PI);
    const duration: f64 = (rotAmount * 2.0) * (60.0 / currentBPM);

    totalRotation += rotAmount;
    totalTime += duration;

    writeF64(outStartAnglePtr, i, startAngle);
    writeF64(outTotalAnglePtr, i, totalAngle);
    writeF64(outCumulativeRotationsPtr, i, totalRotation);
    writeF64(outDurationsPtr, i, duration);
    writeF64(outStartTimesPtr, i, totalTime);

    // Distances
    let startDist: f64 = 1.0;
    if (i > 0) {
      const ppx: f64 = readF64(positionsPtr, (i - 1) * 2);
      const ppy: f64 = readF64(positionsPtr, (i - 1) * 2 + 1);
      const dx: f64 = ppx - px;
      const dy: f64 = ppy - py;
      startDist = Math.sqrt(dx * dx + dy * dy);
    }
    writeF64(outStartDistPtr, i, startDist);

    const edx: f64 = nx - px;
    const edy: f64 = ny - py;
    writeF64(outEndDistPtr, i, Math.sqrt(edx * edx + edy * edy));
    writeF64(outExtraRotationsPtr, i, extraRotation);
  }

  // Handle last tile (events, isCW, BPM, extraRotation)
  while (evIdx < eventCount) {
    const etype: i32 = readI32(eventTypePtr, evIdx);
    const param0: f64 = readF64(eventParamPtr, evIdx * 3);

    if (etype == 0) {
      isCW = isCW == 1 ? 0 : 1;
    } else if (etype == 1) {
      currentBPM *= param0;
    } else if (etype == 2) {
      currentBPM = param0;
    } else if (etype == 3) {
      // Pause on last tile — extra rotation for camera timing
      // Not stored in extraRot for last tile in original code
    }
    evIdx++;
  }

  const lastIdx: i32 = tileCount - 1;
  writeI32(outIsCWPtr, lastIdx, isCW);
  writeF64(outBPMPtr, lastIdx, currentBPM);
  writeF64(outExtraRotationsPtr, lastIdx, 0.0);

  return segs;
}
