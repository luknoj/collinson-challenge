import type {
  DailyForecast,
  Forecast,
  HourlyForecast,
} from '../scoring/weather.js';
import { openMeteoConfig, type OpenMeteoConfig } from './config.js';
import type { DataLayer } from './dataLayer.js';
import type { ForecastLocation } from './location.js';
import { fetchJson, responseReader } from './response.js';

/** The Open-Meteo name of each hourly variable. */
export const HOURLY_VARIABLES = {
  temperature: 'temperature_2m',
  apparentTemperature: 'apparent_temperature',
  precipitation: 'precipitation',
  rain: 'rain',
  precipitationProbability: 'precipitation_probability',
  snowfall: 'snowfall',
  snowDepth: 'snow_depth',
  weatherCode: 'weather_code',
  windSpeed: 'wind_speed_10m',
  windGusts: 'wind_gusts_10m',
  windDirection: 'wind_direction_10m',
  visibility: 'visibility',
  freezingLevelHeight: 'freezing_level_height',
} as const satisfies Record<Exclude<keyof HourlyForecast, 'time'>, string>;

/** The Open-Meteo name of each daily variable with a number value. */
export const DAILY_VARIABLES = {
  daylightDuration: 'daylight_duration',
  sunshineDuration: 'sunshine_duration',
  uvIndexMax: 'uv_index_max',
} as const satisfies Record<
  Exclude<keyof DailyForecast, 'date' | 'sunrise' | 'sunset'>,
  string
>;

const read = responseReader('forecast');

/**
 * The weather for 7 days and the 3 days before today (scoring.md, section 1).
 * All times are local times of the town (timezone=auto).
 */
export function getForecast({
  dataLayer,
  location,
  config = openMeteoConfig,
}: {
  dataLayer: DataLayer;
  location: ForecastLocation;
  config?: OpenMeteoConfig;
}): Promise<Forecast> {
  const url = forecastUrl({ location, config });
  return dataLayer.load({
    key: url.href,
    ttlMs: config.ttlMs.forecast,
    request: async ({ signal }) =>
      parseForecast(await fetchJson({ api: 'forecast', url, signal })),
  });
}

function forecastUrl({
  location,
  config,
}: {
  location: ForecastLocation;
  config: OpenMeteoConfig;
}): URL {
  const url = new URL(config.urls.forecast);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  if (location.elevation !== null) {
    url.searchParams.set('elevation', String(location.elevation));
  }
  url.searchParams.set('hourly', Object.values(HOURLY_VARIABLES).join(','));
  url.searchParams.set(
    'daily',
    ['sunrise', 'sunset', ...Object.values(DAILY_VARIABLES)].join(','),
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(config.forecast.forecastDays));
  url.searchParams.set('past_days', String(config.forecast.pastDays));
  return url;
}

function parseForecast(body: unknown): Forecast {
  const root = read.block({ value: body, name: 'response' });

  const hourly = read.block({ value: root.hourly, name: 'hourly' });
  const time = read.times({ source: hourly, name: 'time' });
  const hourlySeries = read.seriesGroup({
    names: HOURLY_VARIABLES,
    source: hourly,
    length: time.length,
  });

  const daily = read.block({ value: root.daily, name: 'daily' });
  const date = read.times({ source: daily, name: 'time' });
  const length = date.length;
  const dailySeries = read.seriesGroup({
    names: DAILY_VARIABLES,
    source: daily,
    length,
  });

  return {
    utcOffsetSeconds: read.number({
      value: root.utc_offset_seconds,
      name: 'utc_offset_seconds',
    }),
    hourly: { time, ...hourlySeries },
    daily: {
      date,
      sunrise: read.strings({ source: daily, name: 'sunrise', length }),
      sunset: read.strings({ source: daily, name: 'sunset', length }),
      ...dailySeries,
    },
  };
}
