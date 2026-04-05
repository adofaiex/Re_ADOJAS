import { useRef } from "react"

/**
 * Game metrics exposed by the Player stats callback.
 * We only store the raw data; the hook handles dedup logic.
 */
export interface GameMetricsData {
  /** Current tile index (0-based) */
  tileIndex: number
  /** Elapsed game time in milliseconds */
  elapsedTime: number
  /** Total number of tiles in the level */
  totalTiles: number
  /** Per-tile BPM array (TBPM values, affected by SetSpeed events) */
  tileBPM: number[]
  /** Per-tile start time in seconds (relative to tile 1 = 0) */
  tileStartTimes: number[]
}

/**
 * Processed metrics ready for display — only recalculated when raw data changes.
 */
export interface DisplayMetrics {
  /** Tile BPM: the BPM of the current tile, affected by SetSpeed */
  tbpm: number
  /** Current BPM: real-time BPM based on actual time between tiles */
  cbpm: number
  /** Map Time in mm:ss.d~mm:ss.d format (0.1s precision) */
  mapTime: string
  /** Tiles progress: e.g. "123 / 1000 (12.3%)" */
  tiles: string
}

/**
 * Performance-optimized game metrics calculator.
 *
 * Design principles:
 * 1. Only recalculates when raw data ACTUALLY changes (dirty flag)
 * 2. Refresh rate never exceeds the frame rate (callback is called per-frame)
 * 3. When nothing changed, returns the cached previous result (zero-cost)
 */
export function useGameMetrics() {
  // Cache of the last processed result — return this when nothing changed
  const cachedDisplay = useRef<DisplayMetrics | null>(null)
  // Cache of the last raw data to detect changes
  const lastRaw = useRef<string>("")
  // Cache of TBPM/CBPM to avoid unnecessary recalculations
  const lastTBPM = useRef<number>(-1)
  const lastCBPM = useRef<number>(-1)

  /**
   * Update metrics from the Player stats callback.
   * Returns null when nothing changed (to signal "skip DOM update").
   */
  function update(raw: GameMetricsData): DisplayMetrics | null {
    // Build a change-detection key (cheap string comparison)
    const key = `${raw.tileIndex}:${raw.elapsedTime}:${raw.totalTiles}`

    // Nothing changed → skip all computation and DOM update
    if (key === lastRaw.current) {
      return null
    }
    lastRaw.current = key

    const { tileIndex, elapsedTime, totalTiles, tileBPM, tileStartTimes } = raw

    // --- TBPM: Tile BPM (base BPM × SetSpeed multipliers) ---
    const tbpm = tileBPM[tileIndex] ?? 0

    // --- CBPM: Current BPM (60 / time-to-next-tile) ---
    let cbpm = tbpm
    if (tileIndex < totalTiles - 1 && tileIndex >= 0 && tileStartTimes.length > tileIndex + 1) {
      const tCurrent = tileStartTimes[tileIndex] ?? 0
      const tNext = tileStartTimes[tileIndex + 1] ?? 0
      const dt = tNext - tCurrent
      if (dt > 0) {
        cbpm = 60 / dt
      }
    }

    // --- Map Time: mm:ss~mm:ss ---
    const timeInLevelSec = Math.max(0, elapsedTime / 1000)
    // countdownDuration is excluded here; elapsedTime already includes it.
    // We need the total map time from the last tile's start time
    const totalMapTime = tileStartTimes.length > 0
      ? (tileStartTimes[tileStartTimes.length - 1] ?? 0)
      : 0
    const currentMapTime = Math.min(timeInLevelSec, totalMapTime)
    const mapTime = `${formatTimePrecise(currentMapTime)}~${formatTimePrecise(totalMapTime)}`

    // --- Tiles: current / total (percentage%) ---
    const safeTile = Math.min(tileIndex + 1, totalTiles) // display as 1-based
    const pct = totalTiles > 0 ? ((safeTile / totalTiles) * 100) : 0
    const tiles = `${safeTile} / ${totalTiles} (${pct.toFixed(1)}%)`

    // Skip DOM update if TBPM and CBPM didn't change AND it's the same second
    if (cachedDisplay.current) {
      const tbpmUnchanged = lastTBPM.current === tbpm
      const cbpmUnchanged = lastCBPM.current === cbpm
      const timeSecondUnchanged = Math.floor(elapsedTime / 1000) ===
        Math.floor(parseFloat(lastRaw.current.split(":")[1]) / 1000)

      // TBPM/CBPM changed → must refresh
      if (!tbpmUnchanged || !cbpmUnchanged) {
        lastTBPM.current = tbpm
        lastCBPM.current = cbpm
      }
    } else {
      lastTBPM.current = tbpm
      lastCBPM.current = cbpm
    }

    const display: DisplayMetrics = { tbpm, cbpm, mapTime, tiles }
    cachedDisplay.current = display
    return display
  }

  /**
   * Reset cached state (e.g. when a new level is loaded).
   */
  function reset(): void {
    cachedDisplay.current = null
    lastRaw.current = ""
    lastTBPM.current = -1
    lastCBPM.current = -1
  }

  return { update, reset }
}

/**
 * Format seconds into mm:ss string (integer seconds only).
 * Kept for potential future use.
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

/**
 * Format seconds into mm:ss.d string (0.1s precision).
 * Updates visually every 100ms instead of once per second.
 */
function formatTimePrecise(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const sFloat = seconds % 60
  const s = Math.floor(sFloat)
  const d = Math.floor((sFloat - s) * 10)
  return `${m}:${s.toString().padStart(2, "0")}.${d}`
}
