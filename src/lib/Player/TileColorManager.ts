/**
 * Tile Color Manager
 *
 * Based on the PixiJS reference implementation (ColorType.js).
 *
 * Architecture:
 *   ShiftType manages a color event instance — it holds colors, pulse config, and floor style.
 *   doCalculateColor(time, floor) → [fillColor hex, strokeColor hex, useTexture]
 *
 * Flow:
 *   initTileColors() pre-computes static colors from ColorTrack events.
 *   During gameplay, RecolorTrack events update the influencing array dynamically.
 *   getTileRenderer() computes the final fill/stroke for a tile at a given time.
 */

// ========== Hex utilities ==========

const HEX: Record<string, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15,
  a: 10, b: 11, c: 12, d: 13, e: 14, f: 15
};

const SIXTH = [1 / 6, 1 / 3, 1 / 2, 2 / 3, 5 / 6];

const RAINBOW_PROCESS: Record<string, [string, number, number]> = {
  RB: ['G', 1, 0],
  GB: ['R', -1, 0.16666666],
  GR: ['B', 1, 0.3333333333],
  BR: ['G', -1, 0.5],
  BG: ['R', 1, 0.66666666666],
  RG: ['B', -1, 0.83333333333]
};

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0');
}

function parseHex(hex: string): number[] {
  const c = hex.replace('#', '');
  return [
    HEX[c[0]] * 16 + HEX[c[1]],
    HEX[c[2]] * 16 + HEX[c[3]],
    HEX[c[4]] * 16 + HEX[c[5]]
  ];
}

function fmod(a: number, b: number): number {
  return a - b * Math.floor(a / b);
}

export function parseHexAlpha(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length >= 8) {
    return (HEX[c[6]] * 16 + HEX[c[7]]) / 255;
  }
  return 1;
}

// ========== Color type calculation functions ==========
// Each takes (inst: ShiftType, percent: number) → hex fill color string

type ColorFunc = (inst: any, p: number) => string;

const COLOR_FUNCS: Record<string, ColorFunc> = {
  Single:    (inst, p) => inst.colorString.slice(0, 6),
  Stripe:    (inst, p) => p < 0.5 ? inst.colorString.slice(0, 6) : inst.seccolorString.slice(0, 6),
  Stripes:   (inst, p) => p < 0.5 ? inst.colorString.slice(0, 6) : inst.seccolorString.slice(0, 6),
  Glow:      (inst, p) => {
    const pp = 1 - Math.abs(1 - 2 * p);
    const r = inst.r + (inst.r2 - inst.r) * pp;
    const g = inst.g + (inst.g2 - inst.g) * pp;
    const b = inst.b + (inst.b2 - inst.b) * pp;
    return toHex(r) + toHex(g) + toHex(b);
  },
  Blink:     (inst, p) => {
    const r = inst.r + (inst.r2 - inst.r) * p;
    const g = inst.g + (inst.g2 - inst.g) * p;
    const b = inst.b + (inst.b2 - inst.b) * p;
    return toHex(r) + toHex(g) + toHex(b);
  },
  Switch:    (inst, p) => p < 0.5 ? inst.colorString.slice(0, 6) : inst.seccolorString.slice(0, 6),
  Rainbow:   (inst, p) => inst._rainbow(p),
  Volume:    (inst, p) => inst.colorString.slice(0, 6)
};

// ========== Floor style functions ==========
// Each takes (inst: ShiftType, fillColor: string) → [fill, stroke, useTexture]

type FloorFunc = (inst: any, fc: string) => [string, string, boolean];

const FLOOR_FUNCS: Record<string, FloorFunc> = {
  Standard:  (inst, fc) => [fc, inst.addBlack(0.7, fc), true],
  Neon:      (inst, fc) => ['000000', fc, false],
  NeonLight: (inst, fc) => [inst.halfColor(fc), fc, false],
  Basic:     (inst, fc) => [fc, '000000', false],
  Gems:      (inst, fc) => [fc, inst.addBlack(0.7, fc), false],
  Minimal:   (inst, fc) => [fc, fc, false]
};

// ========== RGBcolor base ==========

class RGBcolor {
  colorString: string;
  seccolorString: string;
  r = 0; g = 0; b = 0;
  r2 = 0; g2 = 0; b2 = 0;
  alpha = 1;

  constructor(colorString: string, seccolorString: string) {
    // Strip '#' if present
    this.colorString = colorString.replace('#', '');
    this.seccolorString = seccolorString.replace('#', '');
  }

  convert() {
    const c = HEX;
    const cs = this.colorString;
    const ss = this.seccolorString;
    this.r = c[cs[0]] * 16 + c[cs[1]];
    this.g = c[cs[2]] * 16 + c[cs[3]];
    this.b = c[cs[4]] * 16 + c[cs[5]];
    this.r2 = c[ss[0]] * 16 + c[ss[1]];
    this.g2 = c[ss[2]] * 16 + c[ss[3]];
    this.b2 = c[ss[4]] * 16 + c[ss[5]];
    // Parse alpha from chars 6-7 (RRGGBBAA format) if available
    this.alpha = 1;
    if (cs.length >= 8) {
      this.alpha = (HEX[cs[6]] * 16 + HEX[cs[7]]) / 255;
    }
  }

  addBlack(opa: number, frontColor: string): string {
    const fc = frontColor.replace('#', '');
    const fr = HEX[fc[0]] * 16 + HEX[fc[1]];
    const fg = HEX[fc[2]] * 16 + HEX[fc[3]];
    const fb = HEX[fc[4]] * 16 + HEX[fc[5]];
    return toHex(opa * fr) + toHex(opa * fg) + toHex(opa * fb);
  }

  halfColor(color: string): string {
    const c = color.replace('#', '');
    return toHex((HEX[c[0]] * 16 + HEX[c[1]]) / 2) +
           toHex((HEX[c[2]] * 16 + HEX[c[3]]) / 2) +
           toHex((HEX[c[4]] * 16 + HEX[c[5]]) / 2);
  }
}

// ========== ColorType ==========

// Map channel key letter to lowercase property name
const _ch = (k: string): 'r' | 'g' | 'b' =>
  k === 'R' ? 'r' : k === 'G' ? 'g' : 'b';

class ColorType extends RGBcolor {
  constructor(color: string, seccolor: string) {
    super(color, seccolor);
    this.convert();
  }

  _rainbow(percent: number): string {
    let max = 'R', min = 'R';
    if (this.g > this.r) max = 'G';
    if (this.b > (this as any)[_ch(max)]) max = 'B';
    if (this.g < this.r) min = 'G';
    if (this.b < (this as any)[_ch(min)]) min = 'B';
    if (max === min) return this.colorString.slice(0, 6);

    const deal = RAINBOW_PROCESS[max + min];
    const range = (this as any)[_ch(max)] - (this as any)[_ch(min)];
    if (range === 0) return this.colorString.slice(0, 6);

    let per: number;
    if (deal[1] === 1) {
      per = deal[2] + ((this as any)[_ch(deal[0])] - (this as any)[_ch(min)]) / range / 6;
    } else {
      per = deal[2] + ((this as any)[_ch(max)] - (this as any)[_ch(deal[0])]) / range / 6;
    }
    per = fmod(per + percent, 1);
    const base = (this as any)[_ch(min)];
    const rr = base + range * Rchange(per);
    const gg = base + range * Gchange(per);
    const bb = base + range * Bchange(per);
    return toHex(rr) + toHex(gg) + toHex(bb);
  }
}

function Rchange(p: number): number {
  if (p > 0 && p < SIXTH[0]) return 1;
  else if (p < SIXTH[1]) return 1 - (p - SIXTH[0]) / SIXTH[0];
  else if (p < SIXTH[3]) return 0;
  else if (p < SIXTH[4]) return (p - SIXTH[3]) / SIXTH[0];
  else return 1;
}
function Gchange(p: number): number {
  if (p > 0 && p < SIXTH[0]) return p / SIXTH[0];
  else if (p < SIXTH[2]) return 1;
  else if (p < SIXTH[3]) return 1 - (p - SIXTH[2]) / SIXTH[0];
  else return 0;
}
function Bchange(p: number): number {
  if (p > 0 && p < SIXTH[1]) return 0;
  else if (p < SIXTH[2]) return (p - SIXTH[1]) / SIXTH[0];
  else if (p < SIXTH[4]) return 1;
  else return 1 - (p - SIXTH[4]) / SIXTH[0];
}

// ========== Pulse ==========

class Pulse {
  type: string;
  startTime: number;
  startFloor: number;
  pulseLength: number;
  animationLength: number;

  constructor(type: string, startTime: number, startFloor: number, pulseLength: number, animationLength: number) {
    this.type = type;
    this.startTime = startTime;
    this.startFloor = startFloor;
    this.pulseLength = pulseLength;
    this.animationLength = animationLength;
  }

  pulseNone(nowTime: number, nowFloor: number): number {
    return fmod(nowTime - this.startTime, this.animationLength) / this.animationLength;
  }

  pulseForward(nowTime: number, nowFloor: number): number {
    const t = fmod(nowTime - this.startTime, this.animationLength) / this.animationLength;
    const f = fmod(nowFloor - this.startFloor, this.pulseLength) / this.pulseLength;
    return fmod(t - f, 1);
  }

  pulseBackward(nowTime: number, nowFloor: number): number {
    const t = fmod(nowTime - this.startTime, this.animationLength) / this.animationLength;
    const f = fmod(nowFloor - this.startFloor, this.pulseLength) / this.pulseLength;
    return fmod(t + f, 1);
  }

  doPulse(nowTime: number, nowFloor: number): number {
    switch (this.type) {
      case 'None':    return this.pulseNone(nowTime, nowFloor);
      case 'Forward':  return this.pulseForward(nowTime, nowFloor);
      case 'Backward': return this.pulseBackward(nowTime, nowFloor);
      default:         return this.pulseNone(nowTime, nowFloor);
    }
  }
}

// ========== ShiftType ==========

class ShiftType extends ColorType {
  onType: string;
  pulsecal: Pulse;
  startFloor: number;
  floortype: string;

  constructor(colortype: string, color1: string, color2: string, type: string, startTime: number, startFloor: number, pulseLength: number, animationLength: number, floortype: string) {
    super(color1, color2);
    this.onType = colortype;
    this.pulsecal = new Pulse(type, startTime, startFloor, pulseLength, animationLength);
    this.startFloor = startFloor;
    this.floortype = floortype;
  }

  doColor(nowTime: number, nowFloor: number): number {
    if (this.onType === 'Stripes' || this.onType === 'Stripe') {
      return ((nowFloor - this.startFloor) % 2 + 2) % 2 === 1 ? 1 : 0;
    }
    return this.pulsecal.doPulse(nowTime, nowFloor);
  }

  doCalculateColor(nowTime: number, nowFloor: number): [string, string, boolean] {
    const percent = this.doColor(nowTime, nowFloor);
    const colorFunc = COLOR_FUNCS[this.onType] || COLOR_FUNCS.Single;
    const fillColor = colorFunc(this, percent);
    const floorFunc = FLOOR_FUNCS[this.floortype] || FLOOR_FUNCS.Standard;
    return floorFunc(this, fillColor);
  }
}

// ========== Interfaces ==========

export interface TileColorConfig {
  trackStyle: string;
  trackColorType: string;
  trackColor: string;
  secondaryTrackColor: string;
  trackColorPulse: string;
  trackColorAnimDuration: number;
  trackPulseLength: number;
  trackOpacity: number;
}

export interface VolumePulseData {
  startFloor: number;
  pulseLength: number;
  amplitudes: number[];
}

/**
 * Check if an event is active (should be processed)
 */
export const isEventActive = (event: any): boolean => {
  return ![false, 'Disabled'].includes(event.active);
};

// ========== TileColorManager ==========

export class TileColorManager {
  private levelData: any;
  private tileColors: { color: string; secondaryColor: string }[] = [];
  private tileRecolorConfigs: (TileColorConfig | null)[] = [];

  // Influencing array: for each tile, which event index controls it
  private colorInfluencing: number[] = [];
  // Event instances keyed by event index
  private colorEvents: Map<number, ShiftType> = new Map();
  // RecolorTrack trigger times: [eventIndex, triggerTime][]
  private recolorTimes: [number, number][] = [];

  // Volume pulse data
  private volumePulseMap: Map<number, number> = new Map();

  constructor(levelData: any) {
    this.levelData = levelData;
  }

  // ==================== Initialization ====================

  initTileColors(): void {
    const totalTiles = this.levelData.tiles.length;
    const settings = this.levelData.settings;
    const actions = this.levelData.actions || [];

    const defaultColor = settings.trackColor || 'debb7b';
    const defaultSecondary = settings.secondaryTrackColor || 'ffffff';
    const defaultStyle = settings.trackStyle || 'Standard';
    const defaultColorType = settings.trackColorType || 'Single';
    const defaultPulse = settings.trackColorPulse || 'None';
    const defaultAnimDur = settings.trackColorAnimDuration || 2;
    const defaultPulseLen = settings.trackPulseLength || 10;

    this.tileColors = new Array(totalTiles);
    this.tileRecolorConfigs = new Array(totalTiles).fill(null);
    this.colorInfluencing = new Array(totalTiles).fill(-1);
    this.colorEvents = new Map();
    this.recolorTimes = [];

    // --- Step 1: assign global config as base ---
    const defaultOpacity = parseHexAlpha(defaultColor);
    const globalConfig: TileColorConfig = {
      trackStyle: defaultStyle,
      trackColorType: defaultColorType,
      trackColor: defaultColor,
      secondaryTrackColor: defaultSecondary,
      trackColorPulse: defaultPulse,
      trackColorAnimDuration: defaultAnimDur,
      trackPulseLength: defaultPulseLen,
      trackOpacity: defaultOpacity
    };

    // --- Step 2: collect non-justThisTile ColorTrack events, sorted by floor ---
    const colorTrackEvents: any[] = [];
    let eventIndex = 0;

    actions.forEach((event: any) => {
      if (event.eventType === 'ColorTrack' && !event.justThisTile) {
        colorTrackEvents.push({ ...event, _idx: eventIndex++ });
      }
    });
    colorTrackEvents.sort((a, b) => a.floor - b.floor);

    // --- Step 3: create ShiftType instances for each event ---
    colorTrackEvents.forEach((evt) => {
      const shift = this.createShiftType(evt, evt.floor);
      this.colorEvents.set(evt._idx, shift);
    });

    // --- Step 4: one-pass tile color assignment using influencing ---
    let currentEventIdx = -1;  // -1 means global default

    for (let i = 0; i < totalTiles; i++) {
      // Does a ColorTrack start at this floor?
      while (colorTrackEvents.length > 0 && colorTrackEvents[0].floor <= i) {
        const evt = colorTrackEvents.shift()!;
        currentEventIdx = evt._idx;
      }

      // Store config for recolor later
      if (currentEventIdx >= 0) {
        const evt = actions.find((a: any) => a.eventType === 'ColorTrack' && !a.justThisTile);
        // Reconstruct config from the event controlling this tile
        this.tileRecolorConfigs[i] = this.buildTileConfig(i, currentEventIdx, globalConfig);
      } else {
        this.tileRecolorConfigs[i] = globalConfig;
      }

      // Compute static color
      this.colorInfluencing[i] = currentEventIdx;
      const rendered = this.getTileRenderer(i, 0, this.tileRecolorConfigs[i]!);
      this.tileColors[i] = { color: rendered.color, secondaryColor: rendered.bgcolor };
    }

    // --- Step 5: handle justThisTile events ---
    actions.forEach((event: any) => {
      if (event.eventType === 'ColorTrack' && event.justThisTile) {
        const floor = event.floor;
        if (floor >= 0 && floor < totalTiles) {
          const config: TileColorConfig = {
            trackStyle: event.trackStyle || defaultStyle,
            trackColorType: event.trackColorType || defaultColorType,
            trackColor: event.trackColor || defaultColor,
            secondaryTrackColor: event.secondaryTrackColor || defaultSecondary,
            trackColorPulse: event.trackColorPulse || defaultPulse,
            trackColorAnimDuration: event.trackColorAnimDuration || defaultAnimDur,
            trackPulseLength: event.trackPulseLength || defaultPulseLen,
            trackOpacity: parseHexAlpha(event.trackColor || defaultColor)
          };
          this.tileRecolorConfigs[floor] = config;
          const rendered = this.getTileRenderer(floor, 0, config);
          this.tileColors[floor] = { color: rendered.color, secondaryColor: rendered.bgcolor };

          // Create ShiftType for this justThisTile event
          const evtIdx = eventIndex++;
          const shift = this.createShiftType(event, floor);
          this.colorEvents.set(evtIdx, shift);
          this.colorInfluencing[floor] = evtIdx;
        }
      }
    });

    // --- Step 6: collect RecolorTrack events sorted by trigger time ---
    actions.forEach((event: any) => {
      if (event.eventType === 'RecolorTrack') {
        const evtIdx = eventIndex++;
        const shift = this.createShiftType(event, event.floor);
        this.colorEvents.set(evtIdx, shift);
        this.recolorTimes.push([evtIdx, event.floor]);
      }
    });
    this.recolorTimes.sort((a, b) => a[1] - b[1]);

    // Also save recolor event influencing ranges
    this.recolorTimes.forEach(([evtIdx, _time]) => {
      const event = actions.find((a: any) => a.eventType === 'RecolorTrack' && a.floor === _time);
      // The influencing range will be applied dynamically in processRecolorEvent
    });
  }

  private createShiftType(event: any, startFloor: number): ShiftType {
    const ct = event.trackColorType || 'Single';
    const c1 = (event.trackColor || 'debb7b').replace('#', '');
    const c2 = (event.secondaryTrackColor || 'ffffff').replace('#', '');
    const pulseType = event.trackColorPulse || 'None';
    const animDur = event.trackColorAnimDuration || 2;
    const pulseLen = event.trackPulseLength || 10;
    const style = event.trackStyle || 'Standard';
    return new ShiftType(ct, c1, c2, pulseType, 0, startFloor, pulseLen, animDur, style);
  }

  private buildTileConfig(index: number, eventIdx: number, globalConfig: TileColorConfig): TileColorConfig {
    const shift = this.colorEvents.get(eventIdx);
    if (!shift) return globalConfig;
    return {
      trackStyle: shift.floortype,
      trackColorType: shift.onType,
      trackColor: '#' + shift.colorString,
      secondaryTrackColor: '#' + shift.seccolorString,
      trackColorPulse: shift.pulsecal.type,
      trackColorAnimDuration: shift.pulsecal.animationLength,
      trackPulseLength: shift.pulsecal.pulseLength,
      trackOpacity: shift.alpha
    };
  }

  // ==================== Public API ====================

  getTileColors(): { color: string; secondaryColor: string }[] {
    return this.tileColors;
  }

  getTileRecolorConfigs(): (TileColorConfig | null)[] {
    return this.tileRecolorConfigs;
  }

  getTileColor(index: number): { color: string; secondaryColor: string } | undefined {
    return this.tileColors[index];
  }

  getTileRecolorConfig(index: number): TileColorConfig | null {
    return this.tileRecolorConfigs[index];
  }

  setTileColor(index: number, color: string, bgcolor: string): void {
    if (index >= 0 && index < this.tileColors.length) {
      this.tileColors[index] = { color, secondaryColor: bgcolor };
    }
  }

  setTileRecolorConfig(index: number, config: TileColorConfig): void {
    if (index >= 0 && index < this.tileRecolorConfigs.length) {
      this.tileRecolorConfigs[index] = config;
    }
  }

  getTotalTiles(): number {
    return this.tileColors.length;
  }

  // ==================== Volume pulse API ====================

  setVolumePulseAmplitude(floor: number, amplitude: number): void {
    this.volumePulseMap.set(floor, Math.max(0, Math.min(1, amplitude)));
  }

  getVolumePulseAmplitude(floor: number): number {
    return this.volumePulseMap.get(floor) ?? 0;
  }

  clearVolumePulseData(): void {
    this.volumePulseMap.clear();
  }

  setVolumePulseArray(startFloor: number, amplitudes: number[]): void {
    amplitudes.forEach((amp, index) => {
      this.setVolumePulseAmplitude(startFloor + index, amp);
    });
  }

  // ==================== RecolorTrack runtime processing ====================

  /**
   * Process recolor events up to the given game time.
   * Call this each frame with the current beat-time before getTileRenderer.
   * @param time  current game time in beats
   */
  processRecolorEvents(time: number): void {
    while (this.recolorTimes.length > 0 && time >= this.recolorTimes[0][1]) {
      const [evtIdx, triggerFloor] = this.recolorTimes.shift()!;
      this.applyRecolorInfluence(evtIdx, triggerFloor);
    }
  }

  private applyRecolorInfluence(evtIdx: number, triggerFloor: number): void {
    const event = this.findEventByIndex(evtIdx);
    if (!event) return;

    // Determine tile range
    const start = this.PosRelativeTo(event.startTile?.[0] ?? event.startTile ?? 0, triggerFloor);
    const end = this.PosRelativeTo(event.endTile?.[0] ?? event.endTile ?? 0, triggerFloor);
    const gap = event.gapLength || 0;

    if (gap <= 0) {
      // Continuous range
      for (let i = start; i <= end; i++) {
        if (i >= 0 && i < this.tileColors.length) {
          this.colorInfluencing[i] = evtIdx;
        }
      }
    } else {
      // Gap pattern
      for (let i = start; i <= end; i += gap + 1) {
        if (i >= 0 && i < this.tileColors.length) {
          this.colorInfluencing[i] = evtIdx;
        }
      }
    }
  }

  private findEventByIndex(idx: number): any {
    const actions = this.levelData.actions || [];
    // Walk backwards through recolor times to find the event
    let foundIdx = 0;
    for (const act of actions) {
      if (act.eventType === 'RecolorTrack' || act.eventType === 'ColorTrack') {
        if (foundIdx === idx) return act;
        foundIdx++;
      }
    }
    return null;
  }

  // ==================== Color Computation ====================

  /**
   * Core color renderer: computes fill + stroke for a tile.
   * Matches the PixiJS reference formulas exactly.
   *
   * @param id    tile index
   * @param time  current game time in beats
   * @param rct   tile color config
   * @param amplitude  optional volume amplitude (0-1)
   */
  getTileRenderer(id: number, time: number, rct: TileColorConfig, amplitude?: number): { color: string; bgcolor: string; opacity: number } {
    const { trackColorType, trackColor, secondaryTrackColor, trackColorPulse, trackColorAnimDuration, trackPulseLength, trackStyle } = rct;

    // Create a temporary ShiftType for this calculation
    const shift = new ShiftType(
      trackColorType,
      trackColor,
      secondaryTrackColor,
      trackColorPulse,
      time,
      id,
      trackPulseLength,
      trackColorAnimDuration,
      trackStyle
    );

    // Override volume amplitude if applicable
    if (trackColorType === 'Volume') {
      let amp = 0;
      if (trackColorPulse === 'None') {
        amp = amplitude || this.getVolumePulseAmplitude(id);
      } else {
        amp = this.getVolumePulseAmplitude(id);
      }
      // Volume modulates: border gets the color, fill stays black for Neon
      // For non-Neon, modulate fill lightness
      const baseColor = trackStyle === 'Neon' ? secondaryTrackColor : trackColor;
      const [r, g, b] = parseHex(baseColor);
      const volR = r * (0.2 + amp * 0.8);
      const volG = g * (0.2 + amp * 0.8);
      const volB = b * (0.2 + amp * 0.8);
      const volHex = toHex(volR) + toHex(volG) + toHex(volB);
      const floorFunc = FLOOR_FUNCS[trackStyle] || FLOOR_FUNCS.Standard;
      const [fill, stroke] = floorFunc(shift, volHex);
      return { color: '#' + fill, bgcolor: '#' + stroke, opacity: shift.alpha };
    }

    const [fill, stroke, _useTex] = shift.doCalculateColor(time, id);
    return { color: '#' + fill, bgcolor: '#' + stroke, opacity: shift.alpha };
  }

  // ==================== Utility ====================

  /**
   * Ensure hex color string has '#' prefix.
   */
  formatHexColor(hex: string): string {
    if (!hex) return '#ffffff';
    return hex.startsWith('#') ? hex : `#${hex}`;
  }

  /**
   * Parse position reference to absolute tile index.
   */
  PosRelativeTo(input: any, thisid: number): number {
    const totalTiles = this.levelData.tiles.length;

    if (Array.isArray(input) && input.length >= 2) {
      const offset = Number(input[0]) || 0;
      const relativeTo = input[1];
      let result: number;
      if (relativeTo === 'ThisTile' || relativeTo === 0) {
        result = thisid + offset;
      } else if (relativeTo === 'Start' || relativeTo === 1) {
        result = offset;
      } else if (relativeTo === 'End' || relativeTo === 2) {
        result = totalTiles - 1 + offset;
      } else {
        result = thisid + offset;
      }
      return Math.max(0, Math.min(result, totalTiles - 1));
    }

    if (typeof input === 'string') {
      const replaced = input
        .replace(/Start/g, '0')
        .replace(/ThisTile/g, String(thisid))
        .replace(/End/g, String(totalTiles - 1));
      return Math.max(0, Math.min(Number(replaced), totalTiles - 1));
    }

    return Math.max(0, Math.min(Number(input) || 0, totalTiles - 1));
  }
}
