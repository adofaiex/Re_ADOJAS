const PI: f64 = 3.141592653589793;

export function linear(t: f64): f64 { return t; }

export function inSine(t: f64): f64 {
  return 1 - Math.cos(t * PI / 2);
}

export function outSine(t: f64): f64 {
  return Math.sin(t * PI / 2);
}

export function inOutSine(t: f64): f64 {
  return -(Math.cos(PI * t) - 1) / 2;
}

export function inQuad(t: f64): f64 {
  return t * t;
}

export function outQuad(t: f64): f64 {
  return 1 - (1 - t) * (1 - t);
}

export function inOutQuad(t: f64): f64 {
  if (t < 0.5) {
    return 2 * t * t;
  }
  return 1 - (-2 * t + 2) * (-2 * t + 2) / 2;
}

export function inCubic(t: f64): f64 {
  return t * t * t;
}

export function outCubic(t: f64): f64 {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

export function inOutCubic(t: f64): f64 {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  return 1 - (-2 * t + 2) * (-2 * t + 2) * (-2 * t + 2) / 2;
}

export function inQuart(t: f64): f64 {
  return t * t * t * t;
}

export function outQuart(t: f64): f64 {
  return 1 - (1 - t) * (1 - t) * (1 - t) * (1 - t);
}

export function inOutQuart(t: f64): f64 {
  if (t < 0.5) {
    return 8 * t * t * t * t;
  }
  const u: f64 = -2 * t + 2;
  return 1 - u * u * u * u / 2;
}

export function inQuint(t: f64): f64 {
  return t * t * t * t * t;
}

export function outQuint(t: f64): f64 {
  return 1 - (1 - t) * (1 - t) * (1 - t) * (1 - t) * (1 - t);
}

export function inOutQuint(t: f64): f64 {
  if (t < 0.5) {
    return 16 * t * t * t * t * t;
  }
  const u: f64 = -2 * t + 2;
  return 1 - u * u * u * u * u / 2;
}

export function inExpo(t: f64): f64 {
  if (t == 0) return 0;
  return Math.pow(2, 10 * t - 10);
}

export function outExpo(t: f64): f64 {
  if (t == 1) return 1;
  return 1 - Math.pow(2, -10 * t);
}

export function inOutExpo(t: f64): f64 {
  if (t == 0) return 0;
  if (t == 1) return 1;
  if (t < 0.5) {
    return Math.pow(2, 20 * t - 10) / 2;
  }
  return (2 - Math.pow(2, -20 * t + 10)) / 2;
}

export function inCirc(t: f64): f64 {
  return 1 - Math.sqrt(1 - t * t);
}

export function outCirc(t: f64): f64 {
  return Math.sqrt(1 - (t - 1) * (t - 1));
}

export function inOutCirc(t: f64): f64 {
  if (t < 0.5) {
    return (1 - Math.sqrt(1 - 4 * t * t)) / 2;
  }
  return (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2;
}

export function inBack(t: f64): f64 {
  const c1: f64 = 1.70158;
  const c3: f64 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

export function outBack(t: f64): f64 {
  const c1: f64 = 1.70158;
  const c3: f64 = c1 + 1;
  return 1 + c3 * (t - 1) * (t - 1) * (t - 1) + c1 * (t - 1) * (t - 1);
}

export function inOutBack(t: f64): f64 {
  const c1: f64 = 1.70158;
  const c2: f64 = c1 * 1.525;
  if (t < 0.5) {
    return (2 * t) * (2 * t) * ((c2 + 1) * 2 * t - c2) / 2;
  }
  const u: f64 = 2 * t - 2;
  return (u * u * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

export function inElastic(t: f64): f64 {
  const c4: f64 = 2 * PI / 3;
  if (t == 0) return 0;
  if (t == 1) return 1;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}

export function outElastic(t: f64): f64 {
  const c4: f64 = 2 * PI / 3;
  if (t == 0) return 0;
  if (t == 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function inOutElastic(t: f64): f64 {
  const c5: f64 = 2 * PI / 4.5;
  if (t == 0) return 0;
  if (t == 1) return 1;
  if (t < 0.5) {
    return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2;
  }
  return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
}

export function outBounce(t: f64): f64 {
  const n1: f64 = 7.5625;
  const d1: f64 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  }
  if (t < 2 / d1) {
    const u: f64 = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u: f64 = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u: f64 = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
}

export function inBounce(t: f64): f64 {
  return 1 - outBounce(1 - t);
}

export function inOutBounce(t: f64): f64 {
  if (t < 0.5) {
    return (1 - outBounce(1 - 2 * t)) / 2;
  }
  return (1 + outBounce(2 * t - 1)) / 2;
}
