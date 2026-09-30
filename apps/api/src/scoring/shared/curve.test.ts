import { describe, expect, it } from 'vitest';
import { outdoorConfig } from '../outdoor/config.js';
import { skiingConfig } from '../skiing/config.js';
import { surfingConfig } from '../surfing/config.js';
import type { Curve } from './config.js';
import { evaluateCurve, evaluateOptional } from './curve.js';

describe('evaluateCurve', () => {
  const curve: Curve = [
    [0, 0],
    [10, 1],
    [20, 1],
    [30, 0.5],
  ];

  it('interpolates linearly between 2 points', () => {
    expect(evaluateCurve(curve, 5)).toBeCloseTo(0.5);
    expect(evaluateCurve(curve, 25)).toBeCloseTo(0.75);
  });

  it('does not change below the first point or above the last point', () => {
    expect(evaluateCurve(curve, -100)).toBe(0);
    expect(evaluateCurve(curve, 100)).toBe(0.5);
  });

  it('returns null for a null value', () => {
    expect(evaluateOptional(curve, null)).toBeNull();
  });
});

// The limits of each curve in the configs: the value at each point, and 1
// value on each side of it.
const allCurves: [string, Curve][] = [
  ...Object.entries(skiingConfig.curves).map(
    ([k, c]) => [`skiing.${k}`, c] as [string, Curve],
  ),
  ...Object.entries(surfingConfig.curves).map(
    ([k, c]) => [`surfing.${k}`, c] as [string, Curve],
  ),
  ...Object.entries(outdoorConfig.curves).map(
    ([k, c]) => [`outdoor.${k}`, c] as [string, Curve],
  ),
];

describe.each(allCurves)('curve %s', (_name, curve) => {
  const e = 1e-3;

  it.each(curve.map((point, i) => [i, point] as const))(
    'point %i',
    (i, [x, y]) => {
      expect(evaluateCurve(curve, x)).toBeCloseTo(y, 9);

      const before = curve[i - 1];
      const expectedBelow = before
        ? y - ((y - before[1]) * e) / (x - before[0])
        : y;
      expect(evaluateCurve(curve, x - e)).toBeCloseTo(expectedBelow, 9);

      const after = curve[i + 1];
      const expectedAbove = after
        ? y + ((after[1] - y) * e) / (after[0] - x)
        : y;
      expect(evaluateCurve(curve, x + e)).toBeCloseTo(expectedAbove, 9);
    },
  );
});
