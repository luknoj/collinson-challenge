import { percentile, round } from '../shared/time.js';
import type { Explanation } from '../types.js';
import type { Terrain } from '../weather.js';
import { skiingConfig, type SkiingConfig } from './config.js';

export interface MountainTerrain {
  /** m, the 90th percentile of the 7×7 grid */
  terrainElevation: number;
  /** m, above the town */
  heightDifference: number;
  /** °C, lower on the high terrain */
  temperatureDifference: number;
}

/**
 * scoring.md, section 3, mountain town note. Returns null when the terrain
 * around the town is not high.
 */
export function mountainTerrain({
  terrain,
  config = skiingConfig,
}: {
  terrain: Terrain;
  config?: SkiingConfig;
}): MountainTerrain | null {
  const m = config.mountain;
  if (terrain.grid.length === 0) return null;
  const high = percentile({ values: terrain.grid, p: m.gridPercentile });
  const difference = high - terrain.center;
  if (difference < m.minHeightDifferenceM) return null;
  return {
    terrainElevation: high,
    heightDifference: difference,
    temperatureDifference: (difference / 100) * m.lapseRatePer100m,
  };
}

export function mountainNote(mountain: MountainTerrain): Explanation {
  return {
    key: 'MOUNTAIN_NOTE',
    params: {
      terrainElevation: round({
        value: mountain.terrainElevation,
        decimals: -1,
      }),
      heightDifference: round({
        value: mountain.heightDifference,
        decimals: -1,
      }),
      temperatureDifference: round({ value: mountain.temperatureDifference }),
    },
  };
}

export interface MountainConditionsInput {
  mountain: MountainTerrain;
  /** °C, the mean temperature in the town in the lift hours */
  townTemperature: number | null;
  /** m, the mean freezing level in the lift hours */
  freezingLevel: number | null;
  /** mm, the precipitation in the lift hours */
  precipitationMm: number | null;
  config?: SkiingConfig;
}

/**
 * The conditions on the high terrain for 1 day. The snow altitude shows only
 * when the forecast has precipitation in the lift hours.
 */
export function mountainConditions({
  mountain,
  townTemperature,
  freezingLevel,
  precipitationMm,
  config = skiingConfig,
}: MountainConditionsInput): Explanation {
  const hasPrecipitation = precipitationMm !== null && precipitationMm > 0;
  return {
    key: 'MOUNTAIN_CONDITIONS',
    params: {
      terrainTemperature:
        townTemperature === null
          ? null
          : round({ value: townTemperature - mountain.temperatureDifference }),
      snowAltitude:
        hasPrecipitation && freezingLevel !== null
          ? round({
              value:
                freezingLevel - config.mountain.snowLineBelowFreezingLevelM,
              decimals: -2,
            })
          : null,
    },
  };
}
