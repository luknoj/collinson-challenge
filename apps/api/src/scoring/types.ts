// Result types of the scoring. They have the same shape as the GraphQL types
// in architecture.md, section 5.

import type { ExplanationKey } from '../generated/graphql.js';

export type { ExplanationKey };

export type ParamValue =
  number | string | boolean | null | readonly number[] | readonly string[];

export type Params = Readonly<Record<string, ParamValue>>;

export interface Explanation {
  key: ExplanationKey;
  params?: Params;
  /** Dates (YYYY-MM-DD) for weekly summary items. */
  days?: string[];
}

export type Label = 'POOR' | 'FAIR' | 'MODERATE' | 'GOOD' | 'EXCELLENT';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ActivityStatus = 'OK' | 'NOT_APPLICABLE';

export interface Factor {
  key: ExplanationKey;
  value: number | null;
  unit: string | null;
  params?: Params;
  /** 0–1 */
  subScore: number;
  /** 0–1 */
  weight: number;
  /** weight × subScore × 100 */
  points: number;
}

export interface Adjustment {
  key: ExplanationKey;
  points: number;
  params?: Params;
}

export interface DayScore {
  /** YYYY-MM-DD, local date of the town */
  date: string;
  score: number;
  label: Label;
  confidence: Confidence;
  ended: boolean;
  scoreBeforeGates: number;
  factors: Factor[];
  /** Only the gates with an effect. */
  gates: Explanation[];
  adjustments: Adjustment[];
  /** The 1–2 factors that decrease the score most. */
  reasons: Explanation[];
  /** Notes for this day only. */
  notes: Explanation[];
}

export interface ActivityResult {
  status: ActivityStatus;
  notApplicableReason: Explanation | null;
  weeklyScore: number | null;
  weeklyLabel: Label | null;
  days: DayScore[];
  summary: Explanation[];
  notes: Explanation[];
}

export type IndoorLevel = 'RECOMMENDED' | 'GOOD_ALTERNATIVE' | 'SAVE_FOR_LATER';

export interface IndoorDay {
  date: string;
  level: IndoorLevel;
  ended: boolean;
  outdoorScore: number;
  mainCause: Explanation | null;
  hints: Explanation[];
}

export interface IndoorResult {
  recommendedDays: number;
  days: IndoorDay[];
  summary: Explanation[];
  townSize: Explanation;
}
