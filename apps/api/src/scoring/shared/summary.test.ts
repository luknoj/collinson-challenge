import { describe, expect, it } from 'vitest';
import type { DayScore, Factor } from '../types.js';
import { activitySummary } from './summary.js';
import { confidenceFor } from './week.js';
import { day } from '../testing/days.js';

const dates = ['12', '13', '14', '15', '16', '17', '18'].map(
  (d) => `2026-01-${d}`,
);

function week(
  scores: number[],
  extra: (i: number) => Partial<DayScore> = () => ({}),
): DayScore[] {
  return scores.map((s, i) =>
    day(s, { date: dates[i]!, confidence: confidenceFor(i), ...extra(i) }),
  );
}

const find = (items: ReturnType<typeof activitySummary>, key: string) =>
  items.find((i) => i.key === key);

describe('activitySummary', () => {
  it('gives the 2 best days with a score of 40 or more', () => {
    const items = activitySummary(week([50, 90, 39, 70, 10, 20, 30]));
    expect(find(items, 'BEST_DAYS')).toEqual({
      key: 'BEST_DAYS',
      days: [dates[1], dates[3]],
      params: { scores: [90, 70] },
    });
  });

  it('gives only 1 best day when only 1 day has 40 or more', () => {
    expect(
      find(activitySummary(week([40, 39, 39, 39, 39, 39, 39])), 'BEST_DAYS')
        ?.days,
    ).toEqual([dates[0]]);
  });

  it('gives "no good days" when all days are below 40', () => {
    const items = activitySummary(week([39, 30, 20, 10, 0, 5, 15]));
    expect(find(items, 'BEST_DAYS')).toBeUndefined();
    expect(find(items, 'NO_GOOD_DAYS')).toBeDefined();
  });

  it('does not use an ended day', () => {
    const items = activitySummary(
      week([95, 50, 40, 30, 30, 30, 30], (i) => ({ ended: i === 0 })),
    );
    expect(find(items, 'BEST_DAYS')?.days).toEqual([dates[1], dates[2]]);
  });

  it('warns when a best day has Medium or Low confidence', () => {
    const items = activitySummary(week([50, 10, 10, 10, 10, 90, 10]));
    expect(find(items, 'LOW_CONFIDENCE')?.days).toEqual([dates[5]]);
  });

  it('has no confidence warning when the best days have High confidence', () => {
    expect(
      find(
        activitySummary(week([90, 80, 10, 10, 10, 10, 10])),
        'LOW_CONFIDENCE',
      ),
    ).toBeUndefined();
  });

  it('gives the trend and the factor with the largest change', () => {
    const factor = (key: Factor['key'], points: number): Factor => ({
      key,
      value: null,
      unit: null,
      subScore: 0,
      weight: 0,
      points,
    });
    const days = week([80, 80, 80, 60, 40, 40, 40], (i) => ({
      factors: [
        factor('FRESH_SNOW', i < 3 ? 20 : 0),
        factor('SKI_WIND', i < 3 ? 20 : 15),
      ],
    }));
    expect(find(activitySummary(days), 'TREND_DOWN')?.params).toEqual({
      change: -40,
      factor: 'FRESH_SNOW',
    });
  });

  it('gives an upward trend', () => {
    expect(
      find(activitySummary(week([20, 20, 20, 50, 60, 60, 60])), 'TREND_UP')
        ?.params,
    ).toEqual({
      change: 40,
      factor: null,
    });
  });

  it('gives no trend for a change of less than 10 points', () => {
    const items = activitySummary(week([50, 50, 50, 50, 59, 59, 59]));
    expect(find(items, 'TREND_UP')).toBeUndefined();
    expect(find(items, 'TREND_DOWN')).toBeUndefined();
  });

  it('lists each gate with an effect, with its days', () => {
    const rain = {
      key: 'RAIN_ON_SNOW_GATE' as const,
      params: { maxScore: 30 },
    };
    const items = activitySummary(
      week([30, 60, 30, 60, 60, 60, 60], (i) => ({
        gates: i === 0 || i === 2 ? [rain] : [],
      })),
    );
    expect(find(items, 'GATE_WARNING')).toEqual({
      key: 'GATE_WARNING',
      params: { gate: 'RAIN_ON_SNOW_GATE' },
      days: [dates[0], dates[2]],
    });
  });
});
