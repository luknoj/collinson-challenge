import { describe, expect, it } from 'vitest';
import { buildForecast, NOW, TODAY } from '../testing/fixtures.js';
import {
  addDays,
  angleBetween,
  circularMean,
  forecastDates,
  localNow,
  percentile,
  round,
  windowIndices,
} from './time.js';

describe('dates and local time', () => {
  it('adds days across a month', () => {
    expect(addDays({ date: '2026-01-31', days: 1 })).toBe('2026-02-01');
    expect(addDays({ date: '2026-03-01', days: -1 })).toBe('2026-02-28');
  });

  it('uses the offset of the town, not the time of the computer', () => {
    expect(
      localNow({
        now: new Date('2026-01-12T23:30:00Z'),
        utcOffsetSeconds: 3600,
      }),
    ).toBe('2026-01-13T00:30');
    expect(
      localNow({
        now: new Date('2026-01-12T01:00:00Z'),
        utcOffsetSeconds: -5 * 3600,
      }),
    ).toBe('2026-01-11T20:00');
  });

  it('gives 7 forecast days from today, without the past days', () => {
    const dates = forecastDates({
      forecast: buildForecast(),
      now: NOW,
      count: 7,
    });
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe(TODAY);
  });
});

describe('windowIndices', () => {
  const times = ['08:00', '09:00', '17:00', '18:00'].map(
    (t) => `2026-01-12T${t}`,
  );
  const window = { start: '2026-01-12T09:00', end: '2026-01-12T18:00' };

  it('uses the stamps from the start to before the end for instant values', () => {
    expect(windowIndices({ times, window, kind: 'instant' })).toEqual([1, 2]);
  });

  it('uses the stamps after the start to the end for amounts', () => {
    expect(windowIndices({ times, window, kind: 'amount' })).toEqual([2, 3]);
  });
});

describe('directions', () => {
  it('finds the mean direction across north', () => {
    const m = circularMean([350, 10]);
    expect(m?.direction).toBeCloseTo(0, 6);
    expect(m?.strength).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 6);
  });

  it('gives a strength of 0 for opposite directions', () => {
    expect(circularMean([90, 270])?.strength).toBeCloseTo(0, 9);
  });

  it('gives the smallest angle between 2 directions', () => {
    expect(angleBetween({ a: 300, b: 320 })).toBe(20);
    expect(angleBetween({ a: 10, b: 350 })).toBe(20);
    expect(angleBetween({ a: 90, b: 270 })).toBe(180);
  });
});

describe('numbers', () => {
  it('calculates a linear percentile', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(percentile({ values, p: 90 })).toBeCloseTo(10);
    expect(percentile({ values: [0, 100], p: 90 })).toBeCloseTo(90);
  });

  it('rounds to tens and hundreds without float errors', () => {
    expect(round({ value: 1683, decimals: -1 })).toBe(1680);
    expect(round({ value: 1149, decimals: -2 })).toBe(1100);
    expect(round({ value: 0.456, decimals: 2 })).toBe(0.46);
    expect(round({ value: 2.5 })).toBe(3);
  });
});
