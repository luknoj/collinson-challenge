// Result types of the scoring. They have the same shape as the GraphQL types
// in architecture.md, section 5.

export const EXPLANATION_KEYS = [
  // Skiing factors
  'SNOW_BASE',
  'FRESH_SNOW',
  'SKI_TEMPERATURE',
  'SKI_WIND',
  'SKI_SKY',
  // Surfing factors
  'SWELL_HEIGHT',
  'SWELL_PERIOD',
  'SURF_WIND_SPEED',
  'WAVE_QUALITY',
  'WATER_COMFORT',
  // Outdoor factors
  'PRECIPITATION',
  'THERMAL_COMFORT',
  'OUTDOOR_SKY',
  'OUTDOOR_WIND',
  // Gates
  'NO_SNOW_BASE_GATE',
  'FREEZING_RAIN_GATE',
  'RAIN_ON_SNOW_GATE',
  'THUNDERSTORM_GATE',
  'LARGE_SWELL_GATE',
  'STRONG_WIND_GATE',
  'EXTREME_TEMPERATURE_GATE',
  'STRONG_GUSTS_GATE',
  'HEAVY_RAIN_GATE',
  'HIGH_WIND_GATE',
  // Adjustments
  'ONSHORE_WIND',
  'OFFSHORE_WIND',
  'FOG',
  // Notes
  'WIND_DIRECTION',
  'COAST_DIRECTION_UNCLEAR',
  'TERRAIN_UNAVAILABLE',
  'MOUNTAIN_NOTE',
  'MOUNTAIN_CONDITIONS',
  'SNOW_DEPTH_CORRECTED',
  'UV_VERY_HIGH',
  'DATA_MISSING',
  // Not applicable
  'NO_SEA_NEARBY',
  'NO_SNOW',
  // Indoor
  'TRAVEL_HINT',
  'BUSY_HINT',
  'TOWN_SIZE_LARGE',
  'TOWN_SIZE_CITY',
  'TOWN_SIZE_TOWN',
  'TOWN_SIZE_SMALL',
  'TOWN_SIZE_NO_DATA',
  // Weekly summary
  'BEST_DAYS',
  'NO_GOOD_DAYS',
  'LOW_CONFIDENCE',
  'TREND_UP',
  'TREND_DOWN',
  'GATE_WARNING',
  'INDOOR_RECOMMENDED_DAYS',
  'INDOOR_GOOD_ALTERNATIVE_DAYS',
  'INDOOR_BUSY_DAYS',
  'GOOD_OUTDOOR_WEEK',
] as const;

export type ExplanationKey = (typeof EXPLANATION_KEYS)[number];

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
