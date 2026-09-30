import { sharedConfig, type Curve } from '../shared/config.js';

/** scoring.md, section 3. */
export const skiingConfig = {
  window: sharedConfig.windows.skiing,

  /** The snow depth and the fresh snow are measured when the lifts open. */
  liftsOpenHour: 9,
  freshSnowHours: 72,

  factors: {
    snowBase: { weight: 0.3 },
    freshSnow: { weight: 0.2 },
    temperature: { weight: 0.15 },
    wind: { weight: 0.2 },
    sky: { weight: 0.15 },
  },

  /** The 2 parts of the sky factor. */
  skyParts: {
    visibility: { weight: 0.6 },
    sunshine: { weight: 0.4 },
  },

  curves: {
    /** snow_depth at 09:00 (m) */
    snowBase: [
      [0.3, 0.3],
      [1.0, 1],
    ],
    /** Snowfall in the 72 h before 09:00 (cm) */
    freshSnow: [
      [0, 0.5],
      [5, 1],
      [25, 1],
      [40, 0.3],
    ],
    /** Mean "feels like" temperature in the lift hours (°C) */
    temperature: [
      [-22, 0],
      [-7, 1],
      [2, 1],
      [7, 0],
    ],
    /** Maximum hourly wind_gusts_10m in the lift hours (km/h) */
    wind: [
      [30, 1],
      [60, 0],
    ],
    /** Mean visibility in the lift hours (km) */
    visibility: [
      [1, 0],
      [5, 1],
    ],
    /** sunshine_duration ÷ daylight_duration */
    sunshineRatio: [
      [0, 0],
      [0.6, 1],
    ],
  } satisfies Record<string, Curve>,

  gates: {
    /** OECD 100-day rule: 30 cm of natural snow. */
    minSnowDepthM: 0.3,
    noSnowBase: { maxScore: 0 },
    freezingRain: { maxScore: 20 },
    rainOnSnow: { aboveRainMm: 2, aboveTemperatureC: 0, maxScore: 30 },
  },

  mountain: {
    gridPercentile: 90,
    minHeightDifferenceM: 300,
    lapseRatePer100m: 0.65,
    snowLineBelowFreezingLevelM: 300,
  },
};

export type SkiingConfig = typeof skiingConfig;
