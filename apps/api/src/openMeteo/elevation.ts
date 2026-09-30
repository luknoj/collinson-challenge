import type { RingPoint, Terrain } from '../scoring/weather.js';
import { openMeteoConfig, type OpenMeteoConfig } from './config.js';
import type { DataLayer } from './dataLayer.js';
import type { Coordinates } from './location.js';
import { fetchJson, responseReader } from './response.js';

const EARTH_RADIUS_KM = 6371;

const read = responseReader('elevation');

interface TerrainPoints {
  /** Row by row. The town is the center point. */
  grid: Coordinates[];
  ring: (Omit<RingPoint, 'elevation'> & Coordinates)[];
}

/**
 * The terrain around the town: the 7×7 grid (mountain note) and the ring
 * (coast direction). 1 request with 81 points.
 */
export function getTerrain({
  dataLayer,
  location,
  config = openMeteoConfig,
}: {
  dataLayer: DataLayer;
  location: Coordinates;
  config?: OpenMeteoConfig;
}): Promise<Terrain> {
  const points = terrainPoints({ town: location, config });
  const all = [...points.grid, ...points.ring];

  const url = new URL(config.urls.elevation);
  url.searchParams.set('latitude', all.map((p) => p.latitude).join(','));
  url.searchParams.set('longitude', all.map((p) => p.longitude).join(','));

  return dataLayer.load({
    key: url.href,
    ttlMs: config.ttlMs.elevation,
    request: async ({ signal }) => {
      const body = await fetchJson({ api: 'elevation', url, signal });
      const root = read.block({ value: body, name: 'response' });
      const elevations = read
        .array({ source: root, name: 'elevation', length: all.length })
        .map((value) => read.number({ value, name: 'elevation' }));
      return toTerrain({ points, elevations });
    },
  });
}

export function terrainPoints({
  town,
  config = openMeteoConfig,
}: {
  town: Coordinates;
  config?: OpenMeteoConfig;
}): TerrainPoints {
  const { gridSize, gridStepKm, ringBearings, ringDistancesKm } =
    config.terrain;
  const half = (gridSize - 1) / 2;

  const grid: Coordinates[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const northKm = (half - row) * gridStepKm;
      const eastKm = (col - half) * gridStepKm;
      grid.push(
        destination({
          from: town,
          bearing: toDegrees(Math.atan2(eastKm, northKm)),
          distanceKm: Math.hypot(northKm, eastKm),
        }),
      );
    }
  }

  const ring: TerrainPoints['ring'] = [];
  for (let i = 0; i < ringBearings; i++) {
    const bearing = (i * 360) / ringBearings;
    for (const distanceKm of ringDistancesKm) {
      ring.push({
        bearing,
        distanceKm,
        ...destination({ from: town, bearing, distanceKm }),
      });
    }
  }

  return { grid, ring };
}

function toTerrain({
  points,
  elevations,
}: {
  points: TerrainPoints;
  elevations: number[];
}): Terrain {
  // getTerrain checked that there is 1 elevation for each point.
  const elevationAt = (index: number): number => {
    const value = elevations[index];
    if (value === undefined) throw new Error(`No elevation at ${index}.`);
    return value;
  };
  const gridCount = points.grid.length;
  return {
    center: elevationAt(Math.floor(gridCount / 2)),
    grid: elevations.slice(0, gridCount),
    ring: points.ring.map((p, i) => ({
      bearing: p.bearing,
      distanceKm: p.distanceKm,
      elevation: elevationAt(gridCount + i),
    })),
  };
}

/** The point at a distance and a bearing from a start point (on a sphere). */
function destination({
  from,
  bearing,
  distanceKm,
}: {
  from: Coordinates;
  bearing: number;
  distanceKm: number;
}): Coordinates {
  const d = distanceKm / EARTH_RADIUS_KM;
  const b = toRadians(bearing);
  const lat1 = toRadians(from.latitude);
  const lon1 = toRadians(from.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: fixed(toDegrees(lat2)),
    // From −180 to 180.
    longitude: fixed(((toDegrees(lon2) + 540) % 360) - 180),
  };
}

/** 4 decimals: approximately 10 m. The Elevation API has a 90 m resolution. */
function fixed(value: number): number {
  return Number(value.toFixed(4));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
