import { describe, expect, it } from 'vitest';
import { day } from '../testing/days.js';
import type {
  DayScore,
  Explanation,
  ExplanationKey,
  Factor,
} from '../types.js';
import { activitySummary } from './summary.js';
import { confidenceFor } from './week.js';

const dates = ['12', '13', '14', '15', '16', '17', '18'].map(
  (d) => `2026-01-${d}`,
);

/** 7 days with these scores. `extra` adds values to the day with index i. */
function week({
  scores,
  extra = () => ({}),
}: {
  scores: number[];
  extra?: (i: number) => Partial<DayScore>;
}): DayScore[] {
  return scores.map((score, i) =>
    day({ score, date: dates[i]!, confidence: confidenceFor(i), ...extra(i) }),
  );
}

/** The summary item with this key. */
function item({
  scores,
  extra,
  key,
}: {
  scores: number[];
  extra?: (i: number) => Partial<DayScore>;
  key: ExplanationKey;
}): Explanation | undefined {
  return activitySummary(week({ scores, extra })).find((i) => i.key === key);
}

function factor({
  key,
  points,
}: {
  key: ExplanationKey;
  points: number;
}): Factor {
  return { key, value: null, unit: null, subScore: 0, weight: 0, points };
}

describe('activitySummary', () => {
  it('gives the 2 best days with a score of 40 or more', () => {
    expect(
      item({ scores: [50, 90, 39, 70, 10, 20, 30], key: 'BEST_DAYS' }),
    ).toEqual({
      key: 'BEST_DAYS',
      days: [dates[1], dates[3]],
      params: { scores: [90, 70] },
    });
  });

  it('gives only 1 best day when only 1 day has 40 or more', () => {
    expect(
      item({ scores: [40, 39, 39, 39, 39, 39, 39], key: 'BEST_DAYS' })?.days,
    ).toEqual([dates[0]]);
  });

  it('gives "no good days" when all days are below 40', () => {
    const scores = [39, 30, 20, 10, 0, 5, 15];
    expect(item({ scores, key: 'BEST_DAYS' })).toBeUndefined();
    expect(item({ scores, key: 'NO_GOOD_DAYS' })).toBeDefined();
  });

  it('does not use an ended day', () => {
    const best = item({
      scores: [95, 50, 40, 30, 30, 30, 30],
      extra: (i) => ({ ended: i === 0 }),
      key: 'BEST_DAYS',
    });
    expect(best?.days).toEqual([dates[1], dates[2]]);
  });

  it('warns when a best day has Medium or Low confidence', () => {
    expect(
      item({ scores: [50, 10, 10, 10, 10, 90, 10], key: 'LOW_CONFIDENCE' })
        ?.days,
    ).toEqual([dates[5]]);
  });

  it('has no confidence warning when the best days have High confidence', () => {
    expect(
      item({ scores: [90, 80, 10, 10, 10, 10, 10], key: 'LOW_CONFIDENCE' }),
    ).toBeUndefined();
  });

  it('gives the trend and the factor with the largest change', () => {
    const trend = item({
      scores: [80, 80, 80, 60, 40, 40, 40],
      extra: (i) => ({
        factors: [
          factor({ key: 'FRESH_SNOW', points: i < 3 ? 20 : 0 }),
          factor({ key: 'SKI_WIND', points: i < 3 ? 20 : 15 }),
        ],
      }),
      key: 'TREND_DOWN',
    });
    expect(trend?.params).toEqual({ change: -40, factor: 'FRESH_SNOW' });
  });

  it('gives an upward trend', () => {
    expect(
      item({ scores: [20, 20, 20, 50, 60, 60, 60], key: 'TREND_UP' })?.params,
    ).toEqual({ change: 40, factor: null });
  });

  it('gives no trend for a change of less than 10 points', () => {
    const scores = [50, 50, 50, 50, 59, 59, 59];
    expect(item({ scores, key: 'TREND_UP' })).toBeUndefined();
    expect(item({ scores, key: 'TREND_DOWN' })).toBeUndefined();
  });

  it('lists each gate with an effect, with its days', () => {
    const rain = {
      key: 'RAIN_ON_SNOW_GATE' as const,
      params: { maxScore: 30 },
    };
    const warning = item({
      scores: [30, 60, 30, 60, 60, 60, 60],
      extra: (i) => ({ gates: i === 0 || i === 2 ? [rain] : [] }),
      key: 'GATE_WARNING',
    });
    expect(warning).toEqual({
      key: 'GATE_WARNING',
      params: { gate: 'RAIN_ON_SNOW_GATE' },
      days: [dates[0], dates[2]],
    });
  });
});
