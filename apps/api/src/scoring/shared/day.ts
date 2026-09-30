import type {
  Adjustment,
  DayScore,
  Explanation,
  ExplanationKey,
  Factor,
  Params,
} from '../types.js';
import { sharedConfig } from './config.js';
import { confidenceFor, labelFor } from './week.js';

export interface FactorInput {
  key: ExplanationKey;
  weight: number;
  /** null when the input data is missing. */
  subScore: number | null;
  value: number | null;
  unit: string | null;
  params?: Params;
}

export interface GateInput {
  key: ExplanationKey;
  active: boolean;
  maxScore: number;
  params?: Params;
}

export interface DayInput {
  date: string;
  /** 0 for today, 6 for the last day. */
  dayIndex: number;
  ended: boolean;
  factors: FactorInput[];
  adjustments?: Adjustment[];
  gates?: GateInput[];
  notes?: Explanation[];
}

/**
 * scoring.md, section 2:
 * 1. Sub-score for each factor (done by the caller).
 * 2. Weighted sum, then the adjustments.
 * 3. The gates last.
 * 4. The 1–2 factors that decrease the score most are the reasons.
 *
 * Missing data (temporary rule, refer to future-improvements.md, item 1.2):
 * a factor with no data is not used. The weights of the other factors are
 * scaled so that their sum is 1. A DATA_MISSING note tells the user.
 */
export function buildDayScore(input: DayInput): DayScore {
  const available = input.factors.filter((f) => f.subScore !== null);
  const totalWeight = available.reduce((a, f) => a + f.weight, 0);

  const factors: Factor[] = available.map((f) => {
    const weight = totalWeight > 0 ? f.weight / totalWeight : 0;
    const subScore = f.subScore ?? 0;
    return {
      key: f.key,
      value: f.value,
      unit: f.unit,
      ...(f.params ? { params: f.params } : {}),
      subScore,
      weight,
      points: 100 * weight * subScore,
    };
  });

  const notes: Explanation[] = input.factors
    .filter((f) => f.subScore === null)
    .map((f) => ({ key: 'DATA_MISSING', params: { factor: f.key } }));
  notes.push(...(input.notes ?? []));

  const adjustments = input.adjustments ?? [];
  const weightedSum = factors.reduce((a, f) => a + f.points, 0);
  const adjusted = clamp(
    weightedSum + adjustments.reduce((a, adj) => a + adj.points, 0),
  );

  const effectiveGates = (input.gates ?? []).filter(
    (g) => g.active && g.maxScore < adjusted,
  );
  const final = effectiveGates.reduce(
    (s, g) => Math.min(s, g.maxScore),
    adjusted,
  );

  const reasons: Explanation[] = factors
    .map((f) => ({ factor: f, loss: 100 * f.weight * (1 - f.subScore) }))
    .filter((r) => r.loss > 0)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, sharedConfig.maxReasons)
    .map(({ factor }) => ({
      key: factor.key,
      params: { value: factor.value, unit: factor.unit, ...factor.params },
    }));

  const score = Math.round(final);
  return {
    date: input.date,
    score,
    label: labelFor(score),
    confidence: confidenceFor(input.dayIndex),
    ended: input.ended,
    scoreBeforeGates: Math.round(adjusted),
    factors,
    gates: effectiveGates.map((g) => ({
      key: g.key,
      params: { ...g.params, maxScore: g.maxScore },
    })),
    adjustments,
    reasons,
    notes,
  };
}

function clamp(score: number): number {
  return Math.min(100, Math.max(0, score));
}
