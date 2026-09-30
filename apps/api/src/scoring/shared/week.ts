import type {
  ActivityResult,
  Confidence,
  DayScore,
  Explanation,
  Label,
} from '../types.js';
import { sharedConfig } from './config.js';
import { activitySummary } from './summary.js';

export function labelFor(score: number): Label {
  const match = sharedConfig.labels.find((l) => score >= l.min);
  return match ? match.label : 'POOR';
}

export function confidenceFor(dayIndex: number): Confidence {
  const levels = sharedConfig.confidence;
  return levels[Math.min(dayIndex, levels.length - 1)] ?? 'LOW';
}

/**
 * scoring.md, section 7: the window of today has ended when the local time
 * of the town is at or after the end of the window.
 */
export function isEnded(localNow: string, windowEnd: string): boolean {
  return localNow >= windowEnd;
}

/**
 * scoring.md, section 7: 0.5 × best day + 0.5 × mean of the best 3 days.
 * Ended days are not used. Returns null when no day can be used.
 */
export function weeklyScore(days: readonly DayScore[]): number | null {
  const { bestDayWeight, topDaysCount } = sharedConfig.weeklyScore;
  const scores = days
    .filter((d) => !d.ended)
    .map((d) => d.score)
    .sort((a, b) => b - a);
  const best = scores[0];
  if (best === undefined) return null;
  const top = scores.slice(0, topDaysCount);
  const topMean = top.reduce((a, b) => a + b, 0) / top.length;
  return Math.round(bestDayWeight * best + (1 - bestDayWeight) * topMean);
}

export function buildActivityResult(
  days: DayScore[],
  notes: Explanation[],
): ActivityResult {
  const weekly = weeklyScore(days);
  return {
    status: 'OK',
    notApplicableReason: null,
    weeklyScore: weekly,
    weeklyLabel: weekly === null ? null : labelFor(weekly),
    days,
    summary: activitySummary(days),
    notes,
  };
}

export function notApplicable(
  reason: Explanation,
  notes: Explanation[] = [],
): ActivityResult {
  return {
    status: 'NOT_APPLICABLE',
    notApplicableReason: reason,
    weeklyScore: null,
    weeklyLabel: null,
    days: [],
    summary: [],
    notes,
  };
}
