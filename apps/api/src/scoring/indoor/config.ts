import { sharedConfig } from '../shared/config.js';

/** scoring.md, section 6. */
export const indoorConfig = {
  window: sharedConfig.windows.sightseeing,

  /** Recommendation levels from the outdoor score. */
  levels: { recommendedBelow: 40, goodAlternativeBelow: 60 },

  travel: {
    aboveSnowfallCm: 10,
    aboveGustsKmh: 75,
    aboveApparentC: 38,
    belowApparentC: -15,
  },

  busy: { minProbability: 60, minPrecipitationMm: 1 },

  townSize: {
    capitalFeatureCode: 'PPLC',
    largeCityPopulation: 1_000_000,
    cityPopulation: 100_000,
    townPopulation: 10_000,
  },
};

export type IndoorConfig = typeof indoorConfig;
