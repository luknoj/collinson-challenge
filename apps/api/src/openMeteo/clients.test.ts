import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { createDataLayer } from './dataLayer.js';
import { getTerrain, terrainPoints } from './elevation.js';
import { OpenMeteoError } from './errors.js';
import { getForecast } from './forecast.js';
import { getMarine } from './marine.js';
import {
  forecastBody,
  marineBody,
  URLS,
  useMockServer,
} from './testing/mockServer.js';

const server = useMockServer();

const KRAKOW = { latitude: 50.06, longitude: 19.94 };
const noRetries = () => createDataLayer({ retryDelaysMs: [] });

/** Gives the body for each request and keeps the request URLs. */
function mock({ url, body }: { url: string; body: JsonBodyType }) {
  const requests: URL[] = [];
  server.use(
    http.get(url, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(body);
    }),
  );
  return requests;
}

describe('getForecast', () => {
  it('sends the parameters from scoring.md', async () => {
    const requests = mock({ url: URLS.forecast, body: forecastBody() });

    await getForecast({
      dataLayer: noRetries(),
      location: { ...KRAKOW, elevation: 219 },
    });

    const params = requests[0]?.searchParams;
    expect(params?.get('latitude')).toBe('50.06');
    expect(params?.get('longitude')).toBe('19.94');
    expect(params?.get('elevation')).toBe('219');
    expect(params?.get('forecast_days')).toBe('7');
    expect(params?.get('past_days')).toBe('3');
    expect(params?.get('timezone')).toBe('auto');
    expect(params?.get('hourly')?.split(',')).toContain('snow_depth');
    expect(params?.get('daily')?.split(',')).toContain('sunshine_duration');
  });

  it('does not send the elevation when Geocoding has none', async () => {
    const requests = mock({ url: URLS.forecast, body: forecastBody() });

    await getForecast({
      dataLayer: noRetries(),
      location: { ...KRAKOW, elevation: null },
    });

    expect(requests[0]?.searchParams.has('elevation')).toBe(false);
  });

  it('changes the response to the normalized weather model', async () => {
    mock({ url: URLS.forecast, body: forecastBody() });

    const forecast = await getForecast({
      dataLayer: noRetries(),
      location: { ...KRAKOW, elevation: 219 },
    });

    expect(forecast.utcOffsetSeconds).toBe(3600);
    expect(forecast.hourly.time).toEqual([
      '2026-01-12T00:00',
      '2026-01-12T01:00',
    ]);
    expect(forecast.hourly.temperature).toEqual([-1.5, -2]);
    expect(forecast.hourly.snowfall).toEqual([0.7, null]);
    expect(forecast.hourly.windDirection).toEqual([270, 270]);
    expect(forecast.hourly.freezingLevelHeight).toEqual([600, 600]);
    expect(forecast.daily).toEqual({
      date: ['2026-01-12'],
      sunrise: ['2026-01-12T07:31'],
      sunset: [null],
      daylightDuration: [30000],
      sunshineDuration: [7200],
      uvIndexMax: [1.2],
    });
  });

  it.each([
    [
      'a variable is missing',
      { visibility: undefined },
      '"visibility" is not an array',
    ],
    ['a series is too short', { rain: [0] }, '"rain" has 1 values, not 2'],
    ['a value is not a number', { rain: [0, 'x'] }, '"rain" has a bad value'],
  ])('fails when %s', async (_, change, message) => {
    const body = forecastBody();
    mock({
      url: URLS.forecast,
      body: { ...body, hourly: { ...body.hourly, ...change } },
    });

    const result = getForecast({
      dataLayer: noRetries(),
      location: { ...KRAKOW, elevation: 219 },
    });

    await expect(result).rejects.toThrow(OpenMeteoError);
    await expect(result).rejects.toMatchObject({
      reason: 'INVALID_RESPONSE',
      message: `forecast: ${message}`,
    });
  });
});

describe('getMarine', () => {
  it('returns the wave data near the sea', async () => {
    const requests = mock({
      url: URLS.marine,
      body: marineBody({ swell: 1.4 }),
    });

    const marine = await getMarine({
      dataLayer: noRetries(),
      location: KRAKOW,
    });

    expect(requests[0]?.searchParams.get('timezone')).toBe('auto');
    expect(requests[0]?.searchParams.get('forecast_days')).toBe('7');
    expect(marine).toEqual({
      time: ['2026-01-12T00:00', '2026-01-12T01:00'],
      swellWaveHeight: [1.4, 1.4],
      swellWavePeriod: [11, 11],
      windWaveHeight: [0.3, 0.3],
      seaSurfaceTemperature: [14, 14],
    });
  });

  it('returns null when all values are null (far from the sea)', async () => {
    mock({ url: URLS.marine, body: marineBody({ swell: null }) });

    const marine = await getMarine({
      dataLayer: noRetries(),
      location: KRAKOW,
    });

    expect(marine).toBeNull();
  });
});

describe('getTerrain', () => {
  it('sends 81 points in 1 request: the 7×7 grid and the ring', async () => {
    const requests = mock({
      url: URLS.elevation,
      body: { elevation: Array.from({ length: 81 }, () => 100) },
    });

    await getTerrain({ dataLayer: noRetries(), location: KRAKOW });

    expect(requests).toHaveLength(1);
    const latitudes = requests[0]?.searchParams.get('latitude')?.split(',');
    const longitudes = requests[0]?.searchParams.get('longitude')?.split(',');
    expect(latitudes).toHaveLength(81);
    expect(longitudes).toHaveLength(81);
    // The center of the grid is the town.
    expect(latitudes?.[24]).toBe('50.06');
    expect(longitudes?.[24]).toBe('19.94');
  });

  it('makes the terrain from the elevations', async () => {
    // Grid: 0, 1, …, 48. Ring: the points to the west (bearing 270) are sea.
    const { ring } = terrainPoints({ town: KRAKOW });
    const elevation = [
      ...Array.from({ length: 49 }, (_, i) => i),
      ...ring.map((p) => (p.bearing === 270 ? 0 : 50)),
    ];
    mock({ url: URLS.elevation, body: { elevation } });

    const terrain = await getTerrain({
      dataLayer: noRetries(),
      location: KRAKOW,
    });

    expect(terrain.center).toBe(24);
    expect(terrain.grid).toHaveLength(49);
    expect(terrain.ring).toHaveLength(32);
    expect(terrain.ring.filter((p) => p.elevation === 0)).toEqual([
      { bearing: 270, distanceKm: 3, elevation: 0 },
      { bearing: 270, distanceKm: 6, elevation: 0 },
    ]);
  });

  it('fails when the number of elevations is not correct', async () => {
    mock({ url: URLS.elevation, body: { elevation: [100] } });

    await expect(
      getTerrain({ dataLayer: noRetries(), location: KRAKOW }),
    ).rejects.toMatchObject({ api: 'elevation', reason: 'INVALID_RESPONSE' });
  });
});

describe('terrainPoints', () => {
  it('puts the grid points 3 km apart', () => {
    const { grid } = terrainPoints({ town: KRAKOW });
    const center = grid[24];
    const north = grid[17];
    const east = grid[25];

    // 3 km is approximately 0.027° of latitude.
    expect((north?.latitude ?? 0) - (center?.latitude ?? 0)).toBeCloseTo(
      0.027,
      3,
    );
    expect(east?.latitude).toBeCloseTo(center?.latitude ?? 0, 3);
    expect(east?.longitude).toBeGreaterThan(center?.longitude ?? 0);
  });

  it('puts the ring points at 16 bearings and 2 distances', () => {
    const { ring } = terrainPoints({ town: KRAKOW });

    expect(ring).toHaveLength(32);
    expect(ring.slice(0, 4).map((p) => [p.bearing, p.distanceKm])).toEqual([
      [0, 3],
      [0, 6],
      [22.5, 3],
      [22.5, 6],
    ]);
  });

  it('keeps the longitude from −180 to 180 near the date line', () => {
    const { grid, ring } = terrainPoints({
      town: { latitude: -17.7, longitude: 179.99 },
    });

    for (const p of [...grid, ...ring]) {
      expect(p.longitude).toBeGreaterThanOrEqual(-180);
      expect(p.longitude).toBeLessThanOrEqual(180);
    }
  });
});
