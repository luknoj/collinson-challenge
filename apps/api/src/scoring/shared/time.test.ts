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
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('uses the offset of the town, not the time of the computer', () => {
    expect(localNow(new Date('2026-01-12T23:30:00Z'), 3600)).toBe(
      '2026-01-13T00:30',
    );
    expect(localNow(new Date('2026-01-12T01:00:00Z'), -5 * 3600)).toBe(
      '2026-01-11T20:00',
    );
  });

  it('gives 7 forecast days from today, without the past days', () => {
    const dates = forecastDates(buildForecast(), NOW, 7);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe(TODAY);
  });
});

describe('windowIndices', () => {
  const times = ['d T08:00', 'd T09:00', 'd T17:00', 'd T18:00'].map((t) =>
    t.replace('d ', '2026-01-12'),
  );
  const window = { start: '2026-01-12T09:00', end: '2026-01-12T18:00' };

  it('uses the stamps from the start to before the end for instant values', () => {
    expect(windowIndices(times, window, 'instant')).toEqual([1, 2]);
  });

  it('uses the stamps after the start to the end for amounts', () => {
    expect(windowIndices(times, window, 'amount')).toEqual([2, 3]);
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
    expect(angleBetween(300, 320)).toBe(20);
    expect(angleBetween(10, 350)).toBe(20);
    expect(angleBetween(90, 270)).toBe(180);
  });
});

describe('numbers', () => {
  it('calculates a linear percentile', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 90)).toBeCloseTo(10);
    expect(percentile([0, 100], 90)).toBeCloseTo(90);
  });

  it('rounds to tens and hundreds without float errors', () => {
    expect(round(1683, -1)).toBe(1680);
    expect(round(1149, -2)).toBe(1100);
    expect(round(0.456, 2)).toBe(0.46);
  });
});
