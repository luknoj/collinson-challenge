// Changes the scoring test data (scoring/testing/fixtures.ts) back to
// Open-Meteo responses. The API tests use these bodies with msw.

import type { Forecast, MarineHourly, Terrain } from '../../scoring/weather.js';
import { DAILY_VARIABLES, HOURLY_VARIABLES } from '../forecast.js';
import { MARINE_VARIABLES } from '../marine.js';

type Body = Record<string, unknown>;

function rename<K extends string>({
  names,
  source,
}: {
  names: Record<K, string>;
  source: Record<NoInfer<K>, unknown>;
}): Body {
  const result: Body = {};
  for (const key of Object.keys(names) as K[]) {
    result[names[key]] = source[key];
  }
  return result;
}

export function toForecastBody(forecast: Forecast) {
  return {
    utc_offset_seconds: forecast.utcOffsetSeconds,
    hourly: {
      time: forecast.hourly.time,
      ...rename({ names: HOURLY_VARIABLES, source: forecast.hourly }),
    },
    daily: {
      time: forecast.daily.date,
      sunrise: forecast.daily.sunrise,
      sunset: forecast.daily.sunset,
      ...rename({ names: DAILY_VARIABLES, source: forecast.daily }),
    },
  };
}

export function toMarineBody(marine: MarineHourly) {
  return {
    utc_offset_seconds: 0,
    hourly: {
      time: marine.time,
      ...rename({ names: MARINE_VARIABLES, source: marine }),
    },
  };
}

/** The 81 elevations in the order of the request: the grid, then the ring. */
export function toElevationBody(terrain: Terrain) {
  return {
    elevation: [...terrain.grid, ...terrain.ring.map((p) => p.elevation)],
  };
}
