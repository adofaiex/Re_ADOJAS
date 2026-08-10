/**
 * ADOFAI 判定数学（纯函数，无 Three.js 依赖）。
 * 规则来源：官方源码 scrMisc.GetHitMargin / GetAdjustedAngleBoundaryInDeg。
 *
 * 核心换算：角速度 = 3 × bpm × speed × pitch °/s（1拍 = 180°）
 *   error_deg = error_ms/1000 × 3 × bpm × speed × pitch
 *
 * 边界 = max(角度保底, 时间保底换算的角度)：
 *   Counted = max(HITMARGIN_COUNTED×marginScale, 0.065s角度)
 *   Perfect = max(45×marginScale,            0.03s角度)
 *   Pure    = max(30×marginScale,            0.025s角度)
 */

export enum HitMargin {
  TooEarly = 0,
  VeryEarly,
  EarlyPerfect,
  Perfect,
  LatePerfect,
  VeryLate,
  TooLate,
  Multipress,
  FailMiss,
  FailOverload,
  Auto,
  OverPress,
}

export enum HitMarginLimit {
  None,
  PerfectsOnly,
  PurePerfectOnly,
}

export type Difficulty = 'Lenient' | 'Normal' | 'Strict';

export interface JudgeConfig {
  difficulty?: Difficulty;
  mobile?: boolean;
  speedTrial?: number;
  hitMarginCounted?: number;
  hitMarginLimit?: HitMarginLimit;
}

export interface MarginBounds {
  countedDeg: number;
  perfectDeg: number;
  pureDeg: number;
}

// 时间基数（秒）。官方：Lenient 0.091 / Normal 0.065 / Strict 0.04
const BASE_TIMES: Record<Difficulty, number> = {
  Lenient: 0.091,
  Normal: 0.065,
  Strict: 0.04,
};

/**
 * 计算三个判定边界（角度，度）。bpmTimesSpeed = bpm × speed。
 * 纯算术，无循环。
 */
export function getBoundariesInDeg(
  bpmTimesSpeed: number,
  pitch: number,
  marginScale: number,
  config: JudgeConfig = {},
): MarginBounds {
  const diff: Difficulty = config.difficulty ?? 'Normal';
  const speedTrial = Math.max(config.speedTrial ?? 1, 0.1);
  const mobile = config.mobile ?? false;
  const hitMarginCounted = config.hitMarginCounted ?? 60;

  // 时间基数 → 角度换算因子：秒 × 3 × bpm × speed × pitch
  const rate = 3 * bpmTimesSpeed * pitch;

  // Counted 时间基数：桌面 base/speedTrial，移动端固定 0.09，下限 0.025
  const countedT = Math.max(mobile ? 0.09 : BASE_TIMES[diff] / speedTrial, 0.025);
  // Perfect 时间基数：0.03/speedTrial，移动端 0.07，下限 0.025
  const perfectT = Math.max(mobile ? 0.07 : 0.03 / speedTrial, 0.025);
  // Pure 时间基数：0.02/speedTrial，移动端 0.05，下限 0.025
  const pureT = Math.max(mobile ? 0.05 : 0.02 / speedTrial, 0.025);

  return {
    countedDeg: Math.max(hitMarginCounted * marginScale, countedT * rate),
    perfectDeg: Math.max(45 * marginScale, perfectT * rate),
    pureDeg: Math.max(30 * marginScale, pureT * rate),
  };
}

/**
 * 由角度误差（度，正=晚负=早）得到判定等级。
 * 官方是递增条件覆盖，这里用无分支的区间判断（几个比较即可）。
 */
export function getHitMarginFromErrorDeg(errorDeg: number, bounds: MarginBounds): HitMargin {
  if (errorDeg > bounds.countedDeg) return HitMargin.TooLate;
  if (errorDeg > bounds.perfectDeg) return HitMargin.VeryLate;
  if (errorDeg > bounds.pureDeg) return HitMargin.LatePerfect;
  if (errorDeg >= -bounds.pureDeg) return HitMargin.Perfect;
  if (errorDeg >= -bounds.perfectDeg) return HitMargin.EarlyPerfect;
  if (errorDeg >= -bounds.countedDeg) return HitMargin.VeryEarly;
  return HitMargin.TooEarly;
}

/**
 * 由 ms 误差直接得判定（无需先转角度）。
 */
export function getHitMarginFromErrorMs(
  errorMs: number,
  bpmTimesSpeed: number,
  pitch: number,
  marginScale: number,
  config: JudgeConfig = {},
): HitMargin {
  const errDeg = (errorMs / 1000) * 3 * bpmTimesSpeed * pitch;
  const bounds = getBoundariesInDeg(bpmTimesSpeed, pitch, marginScale, config);
  return getHitMarginFromErrorDeg(errDeg, bounds);
}

/** 该判定是否算有效命中（IsValidHit）。 */
export function isValidHit(margin: HitMargin, limit: HitMarginLimit = HitMarginLimit.None): boolean {
  if (margin === HitMargin.Auto) return true;
  switch (limit) {
    case HitMarginLimit.PerfectsOnly:
      return margin >= HitMargin.EarlyPerfect && margin <= HitMargin.LatePerfect;
    case HitMarginLimit.PurePerfectOnly:
      return margin === HitMargin.Perfect;
    default:
      return margin >= HitMargin.VeryEarly && margin <= HitMargin.VeryLate;
  }
}
