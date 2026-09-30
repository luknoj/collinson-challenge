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
export function mountainTerrain(
  terrain: Terrain,
  config: SkiingConfig = skiingConfig,
): MountainTerrain | null {
  const m = config.mountain;
  if (terrain.grid.length === 0) return null;
  const high = percentile(terrain.grid, m.gridPercentile);
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
      terrainElevation: round(mountain.terrainElevation, -1),
      heightDifference: round(mountain.heightDifference, -1),
      temperatureDifference: round(mountain.temperatureDifference),
    },
  };
}

/**
 * The conditions on the high terrain for 1 day. The snow altitude shows only
 * when the forecast has precipitation in the lift hours.
 */
export function mountainConditions(
  mountain: MountainTerrain,
  townTemperature: number | null,
  freezingLevel: number | null,
  precipitationMm: number | null,
  config: SkiingConfig = skiingConfig,
): Explanation {
  const hasPrecipitation = precipitationMm !== null && precipitationMm > 0;
  return {
    key: 'MOUNTAIN_CONDITIONS',
    params: {
      terrainTemperature:
        townTemperature === null
          ? null
          : round(townTemperature - mountain.temperatureDifference),
      snowAltitude:
        hasPrecipitation && freezingLevel !== null
          ? round(
              freezingLevel - config.mountain.snowLineBelowFreezingLevelM,
              -2,
            )
          : null,
    },
  };
}
