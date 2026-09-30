import type { Curve } from '../shared/config.js';

/** scoring.md, section 4. */
export const surfingConfig = {
  factors: {
    swellHeight: { weight: 0.35 },
    swellPeriod: { weight: 0.25 },
    windSpeed: { weight: 0.25 },
    waveQuality: { weight: 0.05 },
    comfort: { weight: 0.1 },
  },

  curves: {
    /** Mean swell_wave_height from sunrise to sunset (m) */
    swellHeight: [
      [0.3, 0],
      [0.8, 1],
      [2.5, 1],
      [4.0, 0],
    ],
    /** Mean swell_wave_period (s) */
    swellPeriod: [
      [5, 0],
      [12, 1],
    ],
    /** Mean wind_speed_10m (km/h) */
    windSpeed: [
      [12, 1],
      [35, 0],
    ],
    /** wind_wave_height ÷ swell_wave_height */
    waveQuality: [
      [0.3, 1],
      [1.0, 0],
    ],
    /** Mean sea_surface_temperature (°C) */
    comfort: [
      [10, 0.5],
      [18, 1],
    ],
  } satisfies Record<string, Curve>,

  gates: {
    thunderstorm: { maxScore: 0 },
    /**
     * Temporary values: scoring.md says "more than approximately 4 m" and "a
     * maximum value". Refer to future-improvements.md, item 1.1.
     */
    largeSwell: { aboveHeightM: 4, maxScore: 20 },
    strongWind: { aboveMeanKmh: 30, maxScore: 35 },
  },

  windDirection: {
    minWindKmh: 15,
    onshoreMaxAngle: 45,
    offshoreMinAngle: 135,
    onshorePoints: -10,
    offshorePoints: 5,
  },

  coast: {
    minSeaPoints: 4,
    /**
     * Temporary value: scoring.md says "1 clear direction". This is the
     * minimum length of the mean vector of the sea directions (0–1).
     * Refer to future-improvements.md, item 1.1.
     */
    minStrength: 0.5,
  },
};

export type SurfingConfig = typeof surfingConfig;
