import { isMarineEmpty, type MarineHourly } from '../scoring/weather.js';
import { openMeteoConfig, type OpenMeteoConfig } from './config.js';
import type { DataLayer } from './dataLayer.js';
import type { Coordinates } from './location.js';
import { fetchJson, responseReader } from './response.js';

/** The Open-Meteo name of each hourly variable. */
const HOURLY = {
  swellWaveHeight: 'swell_wave_height',
  swellWavePeriod: 'swell_wave_period',
  windWaveHeight: 'wind_wave_height',
  seaSurfaceTemperature: 'sea_surface_temperature',
} as const satisfies Record<Exclude<keyof MarineHourly, 'time'>, string>;

const read = responseReader('marine');

/**
 * The wave data and the sea temperature for 7 days. Returns null when all
 * values are null: the place is not near the sea.
 */
export async function getMarine({
  dataLayer,
  location,
  config = openMeteoConfig,
}: {
  dataLayer: DataLayer;
  location: Coordinates;
  config?: OpenMeteoConfig;
}): Promise<MarineHourly | null> {
  const url = new URL(config.urls.marine);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('hourly', Object.values(HOURLY).join(','));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(config.forecast.forecastDays));

  const marine = await dataLayer.load({
    key: url.href,
    ttlMs: config.ttlMs.marine,
    request: async ({ signal }) =>
      parseMarine(await fetchJson({ api: 'marine', url, signal })),
  });
  return isMarineEmpty(marine) ? null : marine;
}

function parseMarine(body: unknown): MarineHourly {
  const root = read.block({ value: body, name: 'response' });
  const hourly = read.block({ value: root.hourly, name: 'hourly' });
  const time = read.times({ source: hourly, name: 'time' });
  return {
    time,
    ...read.seriesGroup({ names: HOURLY, source: hourly, length: time.length }),
  };
}
