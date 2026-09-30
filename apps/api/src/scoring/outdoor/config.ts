import { sharedConfig, type Curve } from '../shared/config.js';

/** scoring.md, section 5. Weights from HCI:Urban (Scott et al. 2016). */
export const outdoorConfig = {
  window: sharedConfig.windows.sightseeing,

  factors: {
    precipitation: { weight: 0.3 },
    thermalComfort: { weight: 0.4 },
    sky: { weight: 0.2 },
    wind: { weight: 0.1 },
  },

  curves: {
    /** Maximum precipitation probability in the window (%). */
    precipitationProbability: [
      [20, 1],
      [80, 0],
    ],
    /** Precipitation in the window (mm). */
    precipitationAmount: [
      [0.5, 1],
      [5, 0],
    ],
    /** Mean "feels like" temperature in the window (°C). */
    thermalComfort: [
      [0, 0],
      [16, 1],
      [24, 1],
      [32, 0],
    ],
    /** sunshine_duration ÷ daylight_duration */
    sunshineRatio: [
      [0, 0.4],
      [0.6, 1],
    ],
    /** Maximum hourly wind_speed_10m in the daytime hours (km/h) */
    wind: [
      [20, 1],
      [45, 0],
    ],
  } satisfies Record<string, Curve>,

  gates: {
    thunderstorm: { maxScore: 20 },
    extremeTemperature: { aboveC: 38, belowC: -15, maxScore: 20 },
    strongGusts: { aboveKmh: 75, maxScore: 20 },
    heavyRain: { aboveMm: 5, aboveProbability: 70, maxScore: 25 },
    highWind: { aboveKmh: 40, maxScore: 40 },
  },

  uv: { veryHighIndex: 9 },

  /**
   * Temporary values: scoring.md says only "a small quantity".
   * Refer to future-improvements.md, item 1.1.
   */
  fog: { minHours: 3, points: -5 },
};

export type OutdoorConfig = typeof outdoorConfig;
