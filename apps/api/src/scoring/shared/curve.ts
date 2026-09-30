import type { Curve } from './config.js';

/**
 * Piecewise-linear curve (scoring.md, section 2, step 1). Between 2 points,
 * the score changes linearly. Below the first point and above the last point,
 * the score does not change.
 */
export function evaluateCurve({
  curve,
  value,
}: {
  curve: Curve;
  value: number;
}): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) throw new Error('A curve needs at least 1 point.');

  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];

  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i - 1]!;
    const [x2, y2] = curve[i]!;
    if (value <= x2) {
      return y1 + ((value - x1) / (x2 - x1)) * (y2 - y1);
    }
  }
  return last[1];
}

/** Returns null when the value is null. */
export function evaluateOptional({
  curve,
  value,
}: {
  curve: Curve;
  value: number | null;
}): number | null {
  return value === null ? null : evaluateCurve({ curve, value });
}
