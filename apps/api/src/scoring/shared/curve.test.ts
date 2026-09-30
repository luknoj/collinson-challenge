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
    expect(evaluateCurve({ curve, value: 5 })).toBeCloseTo(0.5);
    expect(evaluateCurve({ curve, value: 25 })).toBeCloseTo(0.75);
  });

  it('does not change below the first point or above the last point', () => {
    expect(evaluateCurve({ curve, value: -100 })).toBe(0);
    expect(evaluateCurve({ curve, value: 100 })).toBe(0.5);
  });

  it('returns null for a null value', () => {
    expect(evaluateOptional({ curve, value: null })).toBeNull();
  });
});

// The limits of each curve in the configs: the value at each point, and 1
// value on each side of it.
const named = ({
  prefix,
  curves,
}: {
  prefix: string;
  curves: Record<string, Curve>;
}) =>
  Object.entries(curves).map(
    ([name, curve]) => [`${prefix}.${name}`, curve] as [string, Curve],
  );

const allCurves: [string, Curve][] = [
  ...named({ prefix: 'skiing', curves: skiingConfig.curves }),
  ...named({ prefix: 'surfing', curves: surfingConfig.curves }),
  ...named({ prefix: 'outdoor', curves: outdoorConfig.curves }),
];

describe.each(allCurves)('curve %s', (_name, curve) => {
  const e = 1e-3;
  const points = curve.map((point, i) => [i, point] as const);

  it.each(points)('point %i', (i, [x, y]) => {
    expect(evaluateCurve({ curve, value: x })).toBeCloseTo(y, 9);

    const before = curve[i - 1];
    const expectedBelow = before
      ? y - ((y - before[1]) * e) / (x - before[0])
      : y;
    expect(evaluateCurve({ curve, value: x - e })).toBeCloseTo(
      expectedBelow,
      9,
    );

    const after = curve[i + 1];
    const expectedAbove = after ? y + ((after[1] - y) * e) / (after[0] - x) : y;
    expect(evaluateCurve({ curve, value: x + e })).toBeCloseTo(
      expectedAbove,
      9,
    );
  });
});
