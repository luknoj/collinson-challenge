import type { DayScore, Explanation, ExplanationKey } from '../types.js';
import { sharedConfig } from './config.js';
import { round } from './time.js';

/**
 * architecture.md, section 4.6: the weekly summary items. Ended days are not
 * used. The frontend writes the sentences.
 */
export function activitySummary(days: readonly DayScore[]): Explanation[] {
  const { bestDaysCount, bestDayMinScore } = sharedConfig.summary;
  const indexed = days.map((day, index) => ({ day, index }));
  const usable = indexed.filter(({ day }) => !day.ended);
  const items: Explanation[] = [];

  const best = usable
    .filter(({ day }) => day.score >= bestDayMinScore)
    .sort((a, b) => b.day.score - a.day.score || a.index - b.index)
    .slice(0, bestDaysCount)
    .map(({ day }) => day);

  if (best.length > 0) {
    items.push({
      key: 'BEST_DAYS',
      days: best.map((d) => d.date),
      params: { scores: best.map((d) => d.score) },
    });
    const uncertain = best.filter((d) => d.confidence !== 'HIGH');
    if (uncertain.length > 0) {
      items.push({ key: 'LOW_CONFIDENCE', days: uncertain.map((d) => d.date) });
    }
  } else {
    items.push({ key: 'NO_GOOD_DAYS', params: { minScore: bestDayMinScore } });
  }

  const trend = trendItem(
    usable.filter(({ index }) => index <= 2).map(({ day }) => day),
    usable.filter(({ index }) => index >= 4).map(({ day }) => day),
  );
  if (trend) items.push(trend);

  items.push(...gateWarnings(usable.map(({ day }) => day)));
  return items;
}

/** Compares the mean of days 1–3 with the mean of days 5–7. */
function trendItem(
  early: readonly DayScore[],
  late: readonly DayScore[],
): Explanation | null {
  if (early.length === 0 || late.length === 0) return null;
  const change = meanScore(late) - meanScore(early);
  if (Math.abs(change) < sharedConfig.summary.trendMinChange) return null;

  const earlyPoints = meanPoints(early);
  const latePoints = meanPoints(late);
  let factor: ExplanationKey | null = null;
  let largest = 0;
  for (const [key, earlyValue] of earlyPoints) {
    const lateValue = latePoints.get(key);
    if (lateValue === undefined) continue;
    const diff = lateValue - earlyValue;
    // Only a factor that changes in the same direction as the score.
    if (Math.sign(diff) === Math.sign(change) && Math.abs(diff) > largest) {
      largest = Math.abs(diff);
      factor = key;
    }
  }

  return {
    key: change > 0 ? 'TREND_UP' : 'TREND_DOWN',
    params: { change: round(change), factor },
  };
}

function gateWarnings(days: readonly DayScore[]): Explanation[] {
  const byGate = new Map<ExplanationKey, string[]>();
  for (const day of days) {
    for (const gate of day.gates) {
      const dates = byGate.get(gate.key) ?? [];
      dates.push(day.date);
      byGate.set(gate.key, dates);
    }
  }
  return [...byGate].map(([gate, dates]) => ({
    key: 'GATE_WARNING',
    params: { gate },
    days: dates,
  }));
}

function meanScore(days: readonly DayScore[]): number {
  return days.reduce((a, d) => a + d.score, 0) / days.length;
}

function meanPoints(days: readonly DayScore[]): Map<ExplanationKey, number> {
  const totals = new Map<ExplanationKey, { sum: number; count: number }>();
  for (const day of days) {
    for (const f of day.factors) {
      const t = totals.get(f.key) ?? { sum: 0, count: 0 };
      t.sum += f.points;
      t.count += 1;
      totals.set(f.key, t);
    }
  }
  return new Map([...totals].map(([k, t]) => [k, t.sum / t.count]));
}
