const PI: f64 = 3.141592653589793;
const SCRATCH: usize = 1024;

function writeResult(a: f64, b: f64, c: f64): void {
  store<f64>(SCRATCH, a);
  store<f64>(SCRATCH + 8, b);
  store<f64>(SCRATCH + 16, c);
}

function fmod(a: f64, b: f64): f64 {
  return a - b * Math.floor(a / b);
}

function rgbToHsv(r: f64, g: f64, b: f64): void {
  let max: f64 = r;
  let min: f64 = r;
  if (g > max) { max = g; }
  if (g < min) { min = g; }
  if (b > max) { max = b; }
  if (b < min) { min = b; }

  const v: f64 = max / 255.0;
  const d: f64 = max - min;
  const s: f64 = max == 0 ? 0 : d / max;
  let h: f64;

  if (max == min) {
    h = 0;
  } else if (max == r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max == g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  writeResult(h, s, v);
}

function hsvToRgb(h: f64, s: f64, v: f64): void {
  const i: i32 = i32(Math.floor(h * 6));
  const f: f64 = h * 6 - f64(i);
  const p: f64 = v * (1 - s);
  const q: f64 = v * (1 - f * s);
  const t: f64 = v * (1 - (1 - f) * s);

  const mod6: i32 = i % 6;
  if (mod6 == 0) {
    writeResult(v * 255, t * 255, p * 255);
  } else if (mod6 == 1) {
    writeResult(q * 255, v * 255, p * 255);
  } else if (mod6 == 2) {
    writeResult(p * 255, v * 255, t * 255);
  } else if (mod6 == 3) {
    writeResult(p * 255, q * 255, v * 255);
  } else if (mod6 == 4) {
    writeResult(t * 255, p * 255, v * 255);
  } else {
    writeResult(v * 255, p * 255, q * 255);
  }
}

export function addBlack(opa: f64, r: f64, g: f64, b: f64): void {
  writeResult(opa * r, opa * g, opa * b);
}

export function halfColor(r: f64, g: f64, b: f64): void {
  writeResult(r / 2, g / 2, b / 2);
}

export function rainbow(r: f64, g: f64, b: f64, percent: f64): void {
  rgbToHsv(r, g, b);
  const h: f64 = load<f64>(SCRATCH);
  const s: f64 = load<f64>(SCRATCH + 8);
  const v: f64 = load<f64>(SCRATCH + 16);

  const h2: f64 = fmod(percent, 1.0);
  hsvToRgb(h2, s, v);
}

export function lerpColor(r1: f64, g1: f64, b1: f64, r2: f64, g2: f64, b2: f64, t: f64): void {
  writeResult(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t
  );
}

export function getScratchPtr(): usize {
  return SCRATCH;
}
