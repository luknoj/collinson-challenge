import { angleBetween, circularMean } from '../shared/time.js';
import type { RingPoint } from '../weather.js';
import { surfingConfig, type SurfingConfig } from './config.js';

export interface CoastDirection {
  /** degrees, from the town to the sea */
  direction: number;
  seaPoints: number;
  /** 0–1, the length of the mean vector of the sea directions */
  strength: number;
}

export type CoastResult =
  | { clear: true; coast: CoastDirection }
  | { clear: false; seaPoints: number; strength: number | null };

/**
 * scoring.md, section 4, step 1–2: the points with an elevation of exactly
 * 0 m are in the sea. Their mean direction is the coast direction.
 */
export function estimateCoastDirection({
  ring,
  config = surfingConfig,
}: {
  ring: readonly RingPoint[];
  config?: SurfingConfig;
}): CoastResult {
  const sea = ring.filter((p) => p.elevation === 0).map((p) => p.bearing);
  const m = circularMean(sea);
  if (
    m === null ||
    sea.length < config.coast.minSeaPoints ||
    m.strength < config.coast.minStrength
  ) {
    return {
      clear: false,
      seaPoints: sea.length,
      strength: m?.strength ?? null,
    };
  }
  return {
    clear: true,
    coast: {
      direction: m.direction,
      seaPoints: sea.length,
      strength: m.strength,
    },
  };
}

export type WindType = 'ONSHORE' | 'CROSS_SHORE' | 'OFFSHORE';

/**
 * scoring.md, section 4, step 3. The wind direction is the direction that the
 * wind comes from. The coast direction points from the town to the sea. Thus,
 * a small angle means that the wind comes from the sea (onshore).
 */
export function windType({
  windFrom,
  coastDirection,
  config = surfingConfig,
}: {
  windFrom: number;
  coastDirection: number;
  config?: SurfingConfig;
}): { type: WindType; angle: number } {
  const angle = angleBetween({ a: windFrom, b: coastDirection });
  const w = config.windDirection;
  if (angle <= w.onshoreMaxAngle) return { type: 'ONSHORE', angle };
  if (angle >= w.offshoreMinAngle) return { type: 'OFFSHORE', angle };
  return { type: 'CROSS_SHORE', angle };
}
