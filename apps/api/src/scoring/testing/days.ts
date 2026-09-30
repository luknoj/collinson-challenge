import { labelFor } from '../shared/week.js';
import type { DayScore } from '../types.js';

/** A day result with only a score. The other values are optional. */
export function day({
  score,
  ...overrides
}: Partial<DayScore> & { score: number }): DayScore {
  return {
    date: '2026-01-12',
    score,
    label: labelFor(score),
    confidence: 'HIGH',
    ended: false,
    scoreBeforeGates: score,
    factors: [],
    gates: [],
    adjustments: [],
    reasons: [],
    notes: [],
    ...overrides,
  };
}
