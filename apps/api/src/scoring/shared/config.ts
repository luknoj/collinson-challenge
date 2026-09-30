import type { Confidence, Label } from '../types.js';

/** Curve points (value → sub-score). Refer to scoring.md, section 2. */
export type Curve = readonly (readonly [number, number])[];

export interface HourWindow {
  startHour: number;
  endHour: number;
}

function codes({ from, to }: { from: number; to: number }): readonly number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export const sharedConfig = {
  forecastDays: 7,

  /** scoring.md, section 2: labels. Highest limit first. */
  labels: [
    { min: 80, label: 'EXCELLENT' },
    { min: 60, label: 'GOOD' },
    { min: 40, label: 'MODERATE' },
    { min: 20, label: 'FAIR' },
    { min: 0, label: 'POOR' },
  ] as const satisfies readonly { min: number; label: Label }[],

  /** scoring.md, section 7: confidence for days 1–7. */
  confidence: [
    'HIGH',
    'HIGH',
    'HIGH',
    'MEDIUM',
    'MEDIUM',
    'LOW',
    'LOW',
  ] as const satisfies readonly Confidence[],

  /** scoring.md, section 7: 0.5 × best day + 0.5 × mean of the best 3 days. */
  weeklyScore: { bestDayWeight: 0.5, topDaysCount: 3 },

  /** scoring.md, section 2: daytime hours. */
  windows: {
    sightseeing: { startHour: 9, endHour: 18 },
    skiing: { startHour: 9, endHour: 16 },
  } satisfies Record<string, HourWindow>,

  /** scoring.md, section 2: WMO weather codes. */
  weatherCodes: {
    fog: [45, 48],
    freezingRain: codes({ from: 66, to: 67 }),
    thunderstorm: codes({ from: 95, to: 99 }),
  },

  /** scoring.md, section 2, step 4: show 1 or 2 factors as reasons. */
  maxReasons: 2,

  /** architecture.md, section 4.6: weekly summary rules. */
  summary: {
    bestDaysCount: 2,
    bestDayMinScore: 40,
    /**
     * Temporary value: scoring.md does not give a limit for the trend.
     * Refer to future-improvements.md, item 1.1.
     */
    trendMinChange: 10,
  },
};

export type SharedConfig = typeof sharedConfig;
