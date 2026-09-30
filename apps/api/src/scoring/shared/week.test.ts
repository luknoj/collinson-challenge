import { describe, expect, it } from 'vitest';
import { day } from '../testing/days.js';
import {
  buildActivityResult,
  confidenceFor,
  isEnded,
  labelFor,
  weeklyScore,
} from './week.js';

describe('labels', () => {
  it.each([
    [0, 'POOR'],
    [19, 'POOR'],
    [20, 'FAIR'],
    [39, 'FAIR'],
    [40, 'MODERATE'],
    [59, 'MODERATE'],
    [60, 'GOOD'],
    [79, 'GOOD'],
    [80, 'EXCELLENT'],
    [100, 'EXCELLENT'],
  ])('score %i is %s', (score, label) => {
    expect(labelFor(score)).toBe(label);
  });
});

describe('confidence', () => {
  it('is High for days 1–3, Medium for days 4–5 and Low for days 6–7', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(confidenceFor)).toEqual([
      'HIGH',
      'HIGH',
      'HIGH',
      'MEDIUM',
      'MEDIUM',
      'LOW',
      'LOW',
    ]);
  });
});

describe('weeklyScore', () => {
  it('uses 0.5 × best day + 0.5 × mean of the best 3 days (Ericeira week)', () => {
    const scores = [99, 88, 57, 35, 40, 72, 81];
    expect(weeklyScore(scores.map((s) => day(s)))).toBe(94);
  });

  it('does not use an ended day', () => {
    const days = [day(99, { ended: true }), day(50), day(40), day(30)];
    expect(weeklyScore(days)).toBe(Math.round(0.5 * 50 + 0.5 * 40));
  });

  it('uses the available days when there are fewer than 3', () => {
    expect(weeklyScore([day(80), day(60)])).toBe(75);
  });

  it('is null when no day can be used', () => {
    expect(weeklyScore([day(80, { ended: true })])).toBeNull();
  });

  it('gives the weekly label in the activity result', () => {
    const result = buildActivityResult([day(99), day(88), day(81)], []);
    expect(result.status).toBe('OK');
    expect(result.weeklyLabel).toBe('EXCELLENT');
  });
});

describe('isEnded', () => {
  it('is true at and after the end of the window', () => {
    expect(isEnded('2026-01-12T17:59', '2026-01-12T18:00')).toBe(false);
    expect(isEnded('2026-01-12T18:00', '2026-01-12T18:00')).toBe(true);
    expect(isEnded('2026-01-12T18:01', '2026-01-12T18:00')).toBe(true);
  });

  it('is false for a later day', () => {
    expect(isEnded('2026-01-12T23:00', '2026-01-13T18:00')).toBe(false);
  });
});
