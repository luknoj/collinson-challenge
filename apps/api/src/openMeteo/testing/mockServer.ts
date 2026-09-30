// A mocked Open-Meteo for the tests. No test calls the real API.

import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { openMeteoConfig } from '../config.js';

export const URLS = openMeteoConfig.urls;

/** Starts msw for the test file. A request without a handler fails. */
export function useMockServer() {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}

const TIMES = ['2026-01-12T00:00', '2026-01-12T01:00'];

/** A Forecast response with 2 hours and 1 day. */
export function forecastBody() {
  const hourly = (value: number | null) => TIMES.map(() => value);
  return {
    latitude: 50.06,
    longitude: 19.94,
    utc_offset_seconds: 3600,
    timezone: 'Europe/Warsaw',
    hourly: {
      time: TIMES,
      temperature_2m: [-1.5, -2],
      apparent_temperature: hourly(-5),
      precipitation: hourly(0),
      rain: hourly(0),
      precipitation_probability: hourly(10),
      snowfall: [0.7, null],
      snow_depth: hourly(0.4),
      weather_code: hourly(71),
      wind_speed_10m: hourly(12),
      wind_gusts_10m: hourly(25),
      wind_direction_10m: hourly(270),
      visibility: hourly(8000),
      freezing_level_height: hourly(600),
    },
    daily: {
      time: ['2026-01-12'],
      sunrise: ['2026-01-12T07:31'],
      sunset: [null],
      daylight_duration: [30000],
      sunshine_duration: [7200],
      uv_index_max: [1.2],
      rain_sum: [0],
      wind_speed_10m_max: [18],
      wind_gusts_10m_max: [35],
    },
  };
}

/** A Marine response with 2 hours. `null` gives the response for a place far from the sea. */
export function marineBody({ swell }: { swell: number | null }) {
  const hourly = (value: number | null) => TIMES.map(() => value);
  return {
    latitude: 50.04,
    longitude: 19.96,
    utc_offset_seconds: 3600,
    hourly: {
      time: TIMES,
      swell_wave_height: hourly(swell),
      swell_wave_period: hourly(swell === null ? null : 11),
      wind_wave_height: hourly(swell === null ? null : 0.3),
      sea_surface_temperature: hourly(swell === null ? null : 14),
    },
  };
}
