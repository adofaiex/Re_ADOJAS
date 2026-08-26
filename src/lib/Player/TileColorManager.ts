import { addBlackWasm, halfColorWasm, rainbowWasm } from './WasmTileColor';

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

type ColorFunc = (inst: any, p: number) => string;

const COLOR_FUNCS: Record<string, ColorFunc> = {
  Single:    (inst, p) => inst.colorString.slice(0, 6),
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

type FloorFunc = (inst: any, fc: string) => [string, string, boolean];

const FLOOR_FUNCS: Record<string, FloorFunc> = {
  Standard:  (inst, fc) => [fc, inst.addBlack(0.7, fc), true],
  Neon:      (inst, fc) => ['000000', fc, false],
  NeonLight: (inst, fc) => [inst.halfColor(fc), fc, false],
  Basic:     (inst, fc) => [fc, '000000', false],
  Gems:      (inst, fc) => [fc, inst.addBlack(0.7, fc), false],
  Minimal:   (inst, fc) => [fc, fc, false]
};

class RGBcolor {
  colorString: string;
  seccolorString: string;
  r = 0; g = 0; b = 0;
  r2 = 0; g2 = 0; b2 = 0;
  alpha = 1;

  constructor(colorString: string, seccolorString: string) {
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
    const [rr, gg, bb] = addBlackWasm(opa, fr, fg, fb);
    return toHex(rr) + toHex(gg) + toHex(bb);
  }

  halfColor(color: string): string {
    const c = color.replace('#', '');
    const r = HEX[c[0]] * 16 + HEX[c[1]];
    const g = HEX[c[2]] * 16 + HEX[c[3]];
    const b = HEX[c[4]] * 16 + HEX[c[5]];
    const [rr, gg, bb] = halfColorWasm(r, g, b);
    return toHex(rr) + toHex(gg) + toHex(bb);
  }
}

class ColorType extends RGBcolor {
  constructor(color: string, seccolor: string) {
    super(color, seccolor);
    this.convert();
  }

  _rainbow(percent: number): string {
    const cr = this.r, cg = this.g, cb = this.b;
    let max: 'r' | 'g' | 'b' = 'r';
    let min: 'r' | 'g' | 'b' = 'r';
    if (cg > cr) max = 'g';
    if (cb > (max === 'r' ? cr : max === 'g' ? cg : cb)) max = 'b';
    if (cg < cr) min = 'g';
    if (cb < (min === 'r' ? cr : min === 'g' ? cg : cb)) min = 'b';
    const maxVal = max === 'r' ? cr : max === 'g' ? cg : cb;
    const minVal = min === 'r' ? cr : min === 'g' ? cg : cb;
    if (maxVal === minVal) return this.colorString.slice(0, 6);

    const maxKey = max.toUpperCase() as 'R' | 'G' | 'B';
    const minKey = min.toUpperCase() as 'R' | 'G' | 'B';
    const deal = RAINBOW_PROCESS[maxKey + minKey];
    const range = maxVal - minVal;
    const dealVal = deal[0] === 'R' ? cr : deal[0] === 'G' ? cg : cb;
    const midVal = min === 'r' ? cr : min === 'g' ? cg : cb;
    let per: number;
    if (deal[1] === 1) {
      per = deal[2] + (dealVal - midVal) / range / 6;
    } else {
      const maxVal2 = max === 'r' ? cr : max === 'g' ? cg : cb;
      per = deal[2] + (maxVal2 - dealVal) / range / 6;
    }
    per = (per + percent) % 1;
    const base = minVal;
    const rr = base + range * Rchange(per);
    const gg = base + range * Gchange(per);
    const bb = base + range * Bchange(per);
    return toHex(rr) + toHex(gg) + toHex(bb);
  }
}

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

class ShiftType extends ColorType {
  onType: string;
  pulsecal: Pulse;
  startFloor: number;
  floortype: string;
  gapLength: number = 0;
  changeFloors: number[] = [];

  constructor(colortype: string, color1: string, color2: string, type: string, startTime: number, startFloor: number, pulseLength: number, animationLength: number, floortype: string) {
    super(color1, color2);
    this.onType = colortype;
    this.pulsecal = new Pulse(type, startTime, startFloor, pulseLength, animationLength);
    this.startFloor = startFloor;
    this.floortype = floortype;
  }

  doColor(nowTime: number, nowFloor: number): number {
    if (this.onType === 'Stripes') {
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

export interface TileColorFade {
    fromColor: string; fromBg: string;
    toColor: string; toBg: string;
    startTime: number; duration: number;
    fromAlpha: number;
    ease: string;
}

export interface TileColorConfig {
  trackStyle: string;
  trackColorType: string;
  trackColor: string;
  secondaryTrackColor: string;
  trackColorPulse: string;
  trackColorAnimDuration: number;
  trackPulseLength: number;
  trackOpacity: number;
  startFloor?: number;
  recolorTriggerTime?: number;
}

export const isEventActive = (event: any): boolean => {
  return ![false, 'Disabled'].includes(event.active);
};

export class TileColorManager {
  private levelData: any;
  private tileColors: { color: string; secondaryColor: string }[] = [];
  private tileRecolorConfigs: (TileColorConfig | null)[] = [];

  private trackColorEvent: ShiftType[] = [];
  private colorInfluencing: number[] = [];
  private recolorTimes: [number, number][] = [];
  private recolorRecord: number = 0;

  // Official TweenColor semantics (scrFloor.cs): Single/Stripes recolors ease
  // from the CURRENT displayed color to the target over the event duration.
  private colorFades: Map<number, TileColorFade> = new Map();

  private volumePulseMap: Map<number, number> = new Map();

  constructor(levelData: any) {
    this.levelData = levelData;
  }

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
    this.colorInfluencing = new Array(totalTiles).fill(0);
    this.trackColorEvent = [];
    this.recolorTimes = [];
    this.recolorRecord = 0;

    // --- Event index 0: settings default ---
    this.trackColorEvent[0] = this.createShiftType(settings, 0);

    // --- Non-justThisTile ColorTrack events, sorted by floor ---
    const colorTrackEvents = actions
      .filter((e: any) => e.eventType === 'ColorTrack' && !e.justThisTile && isEventActive(e))
      .sort((a: any, b: any) => a.floor - b.floor);

    let eventOrder = 1;
    for (const event of colorTrackEvents) {
      const floor = event.floor;
      this.trackColorEvent[eventOrder] = this.createShiftType(event, floor);
      this.colorInfluencing.fill(eventOrder, floor, totalTiles);
      eventOrder++;
    }

    // --- justThisTile ColorTrack events ---
    const justThisTileEvents = actions.filter(
      (e: any) => e.eventType === 'ColorTrack' && e.justThisTile && isEventActive(e)
    );
    for (const event of justThisTileEvents) {
      const floor = event.floor;
      if (floor >= 0 && floor < totalTiles) {
        this.trackColorEvent[eventOrder] = this.createShiftType(event, floor);
        this.colorInfluencing[floor] = eventOrder;
        eventOrder++;
      }
    }

    // --- Pre-compute static tile colors & build tileRecolorConfigs ---
    const defaultOpacity = parseHexAlpha(defaultColor);
    for (let i = 0; i < totalTiles; i++) {
      const evtIdx = this.colorInfluencing[i];
      const shift = this.trackColorEvent[evtIdx];
      this.tileRecolorConfigs[i] = {
        trackStyle: shift.floortype,
        trackColorType: shift.onType,
        trackColor: '#' + shift.colorString,
        secondaryTrackColor: '#' + shift.seccolorString,
        trackColorPulse: shift.pulsecal.type,
        trackColorAnimDuration: shift.pulsecal.animationLength,
        trackPulseLength: shift.pulsecal.pulseLength,
        trackOpacity: shift.alpha,
        startFloor: 0
      };
      const rendered = this.getTileRenderer(i, 0, this.tileRecolorConfigs[i]!);
      this.tileColors[i] = { color: rendered.color, secondaryColor: rendered.bgcolor };
    }

    // --- RecolorTrack events ---
    const recolorEvents = actions.filter(
      (e: any) => e.eventType === 'RecolorTrack' && isEventActive(e)
    );

    for (const event of recolorEvents) {
      const shift = this.createShiftType(event, event.floor);
      this.trackColorEvent[eventOrder] = shift;

      const T = this.calcRecolorTriggerTime(event);
      let insertIdx = 0;
      while (insertIdx < this.recolorTimes.length && this.recolorTimes[insertIdx][1] <= T) {
        insertIdx++;
      }
      this.recolorTimes.splice(insertIdx, 0, [eventOrder, T]);

      // Pre-calculate affected tiles range
      const start = this.PosRelativeTo(event.startTile, event.floor);
      const end = this.PosRelativeTo(event.endTile, event.floor);
      const gap = event.gapLength || 0;
      shift.gapLength = gap;
      shift.changeFloors = this.buildChangeFloors(start, end, gap);

      eventOrder++;
    }
  }

  private calcRecolorTriggerTime(event: any): number {
    const floor = event.floor;
    const tileTime = this.getTileTime(floor);
    const bpm = this.getTileBpm(floor);
    const angleOffset = event.angleOffset || 0;
    return tileTime + (angleOffset / 180) * (60 / bpm);
  }

  private getTileTime(floor: number): number {
    const tiles = this.levelData.tiles;
    if (tiles && tiles[floor] && tiles[floor].time != null) {
      return tiles[floor].time;
    }
    return floor;
  }

  private getTileBpm(floor: number): number {
    const tiles = this.levelData.tiles;
    if (tiles && tiles[floor] && tiles[floor].bpm != null) {
      return tiles[floor].bpm;
    }
    if (this.levelData.settings && this.levelData.settings.bpm) {
      return this.levelData.settings.bpm;
    }
    return 100;
  }

  private buildChangeFloors(start: number, end: number, gap: number): number[] {
    const floors: number[] = [];
    if (start > end) {
      [start, end] = [end, start];
    }
    if (gap <= 0) {
      for (let i = start; i <= end; i++) {
        floors.push(i);
      }
    } else {
      let g = 0;
      if (start >= 0) floors.push(start);
      for (let i = start + 1; i <= end; i++) {
        if (g === gap) {
          floors.push(i);
          g = 0;
        } else {
          g++;
        }
      }
    }
    return floors;
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

  /** Start an eased color fade for a tile (official TweenColor). */
  startColorFade(index: number, fromColor: string, fromBg: string, toColor: string, toBg: string, startTime: number, duration: number, fromAlpha: number, ease: string = 'Linear'): void {
    if (duration <= 0) return;
    this.colorFades.set(index, { fromColor, fromBg, toColor, toBg, startTime, duration, fromAlpha, ease });
  }

  getColorFade(index: number): TileColorFade | undefined {
    return this.colorFades.get(index);
  }

  /** Advance a tile's fade; returns the blended colors and removes finished fades. */
  tickColorFade(index: number, time: number, easeFn: (t: number) => number): { color: string; bg: string; alpha: number } | null {
    const fade = this.colorFades.get(index);
    if (!fade) return null;
    let t = (time - fade.startTime) / fade.duration;
    if (t >= 1) {
      this.colorFades.delete(index);
      return { color: fade.toColor, bg: fade.toBg, alpha: fade.fromAlpha };
    }
    if (t < 0) t = 0;
    const p = easeFn(t);
    const mix = (a: string, b: string): string => {
      const pa = parseHex(a), pb = parseHex(b);
      return toHex(pa[0] + (pb[0] - pa[0]) * p) + toHex(pa[1] + (pb[1] - pa[1]) * p) + toHex(pa[2] + (pb[2] - pa[2]) * p);
    };
    return { color: '#' + mix(fade.fromColor, fade.toColor), bg: '#' + mix(fade.fromBg, fade.toBg), alpha: fade.fromAlpha };
  }


  getTotalTiles(): number {
    return this.tileColors.length;
  }

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

  processRecolorEvents(time: number): void {
    while (
      this.recolorRecord < this.recolorTimes.length &&
      time >= this.recolorTimes[this.recolorRecord][1]
    ) {
      const [evtIdx] = this.recolorTimes[this.recolorRecord];
      this.applyRecolorInfluence(evtIdx);
      this.recolorRecord++;
    }
  }

  private applyRecolorInfluence(evtIdx: number): void {
    const shift = this.trackColorEvent[evtIdx];
    if (!shift) return;

    const floors = shift.changeFloors;
    if (shift.gapLength <= 0 && floors.length > 0) {
      const start = floors[0];
      const end = floors[floors.length - 1] + 1;
      this.colorInfluencing.fill(evtIdx, start, end);
    } else {
      for (const f of floors) {
        if (f >= 0 && f < this.colorInfluencing.length) {
          this.colorInfluencing[f] = evtIdx;
        }
      }
    }
  }

  getTileRenderer(id: number, time: number, rct: TileColorConfig, amplitude?: number): { color: string; bgcolor: string; opacity: number } {
    const { trackColorType, trackColor, secondaryTrackColor, trackColorPulse, trackColorAnimDuration, trackPulseLength, trackStyle } = rct;

    const shift = new ShiftType(
      trackColorType,
      trackColor,
      secondaryTrackColor,
      trackColorPulse,
      rct.recolorTriggerTime ?? 0,
      rct.startFloor ?? id,
      trackPulseLength,
      trackColorAnimDuration,
      trackStyle
    );

    if (trackColorType === 'Volume') {
      let amp = amplitude ?? this.getVolumePulseAmplitude(id);
      const [r, g, b] = parseHex(trackColor);
      const [r2, g2, b2] = parseHex(secondaryTrackColor);
      const volR = r + (r2 - r) * amp;
      const volG = g + (g2 - g) * amp;
      const volB = b + (b2 - b) * amp;
      const volHex = toHex(volR) + toHex(volG) + toHex(volB);
      const floorFunc = FLOOR_FUNCS[trackStyle] || FLOOR_FUNCS.Standard;
      const [fill, stroke] = floorFunc(shift, volHex);
      return { color: '#' + fill, bgcolor: '#' + stroke, opacity: shift.alpha };
    }

    const [fill, stroke] = shift.doCalculateColor(time, id);
    return { color: '#' + fill, bgcolor: '#' + stroke, opacity: shift.alpha };
  }

  formatHexColor(hex: string): string {
    if (!hex) return '#ffffff';
    const clean = hex.startsWith('#') ? hex.slice(1) : hex;
    // Strip alpha channel from 8-digit hex (RRGGBBAA → RRGGBB)
    return '#' + clean.slice(0, 6);
  }

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
