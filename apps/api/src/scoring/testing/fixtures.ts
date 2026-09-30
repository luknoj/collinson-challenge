// Test data builders. Day 0 is today. Days −3 to −1 are from past_days.

import { addDays, at } from '../shared/time.js';
import type {
  Forecast,
  MarineHourly,
  RingPoint,
  ScoringContext,
  Terrain,
} from '../weather.js';

export const TODAY = '2026-01-12';
/** 08:00 local time (UTC+1): before all activity windows. */
export const NOW = new Date('2026-01-12T07:00:00Z');
export const UTC_OFFSET = 3600;

export interface HourValues {
  temperature: number | null;
  apparentTemperature: number | null;
  precipitation: number | null;
  rain: number | null;
  precipitationProbability: number | null;
  snowfall: number | null;
  snowDepth: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  windDirection: number | null;
  visibility: number | null;
  freezingLevelHeight: number | null;
}

export interface DayValues {
  sunrise: string | null;
  sunset: string | null;
  daylightDuration: number | null;
  sunshineDuration: number | null;
  uvIndexMax: number | null;
  rainSum: number | null;
  windSpeedMax: number | null;
  windGustsMax: number | null;
}

/** Good weather for sightseeing. */
export const DEFAULT_HOUR: HourValues = {
  temperature: 20,
  apparentTemperature: 20,
  precipitation: 0,
  rain: 0,
  precipitationProbability: 0,
  snowfall: 0,
  snowDepth: 0,
  weatherCode: 0,
  windSpeed: 10,
  windGusts: 15,
  windDirection: 90,
  visibility: 20000,
  freezingLevelHeight: 3000,
};

/** 12 h of daylight and 10 h of sunshine (ratio 0.83). */
export const DEFAULT_DAY: Omit<DayValues, 'sunrise' | 'sunset'> = {
  daylightDuration: 12 * 3600,
  sunshineDuration: 10 * 3600,
  uvIndexMax: 3,
  rainSum: 0,
  windSpeedMax: 15,
  windGustsMax: 20,
};

export interface ForecastOptions {
  /** Values for 1 hour. `day` is from −3 to 6. */
  hour?: (day: number, hour: number) => Partial<HourValues>;
  day?: (day: number) => Partial<DayValues>;
}

const PAST_DAYS = 3;
const DAYS = 10;

export function hourTimes(): string[] {
  const times: string[] = [];
  for (let day = -PAST_DAYS; day < DAYS - PAST_DAYS; day++) {
    for (let hour = 0; hour < 24; hour++)
      times.push(at(addDays(TODAY, day), hour));
  }
  return times;
}

export function buildForecast(options: ForecastOptions = {}): Forecast {
  const rows: HourValues[] = [];
  for (let day = -PAST_DAYS; day < DAYS - PAST_DAYS; day++) {
    for (let hour = 0; hour < 24; hour++) {
      rows.push({ ...DEFAULT_HOUR, ...options.hour?.(day, hour) });
    }
  }
  const days: (DayValues & { date: string })[] = [];
  for (let day = -PAST_DAYS; day < DAYS - PAST_DAYS; day++) {
    const date = addDays(TODAY, day);
    days.push({
      date,
      sunrise: `${date}T07:00`,
      sunset: `${date}T19:00`,
      ...DEFAULT_DAY,
      ...options.day?.(day),
    });
  }
  const col = <K extends keyof HourValues>(k: K) => rows.map((r) => r[k]);
  const dayCol = <K extends keyof DayValues>(k: K) => days.map((d) => d[k]);
  return {
    utcOffsetSeconds: UTC_OFFSET,
    hourly: {
      time: hourTimes(),
      temperature: col('temperature'),
      apparentTemperature: col('apparentTemperature'),
      precipitation: col('precipitation'),
      rain: col('rain'),
      precipitationProbability: col('precipitationProbability'),
      snowfall: col('snowfall'),
      snowDepth: col('snowDepth'),
      weatherCode: col('weatherCode'),
      windSpeed: col('windSpeed'),
      windGusts: col('windGusts'),
      windDirection: col('windDirection'),
      visibility: col('visibility'),
      freezingLevelHeight: col('freezingLevelHeight'),
    },
    daily: {
      date: days.map((d) => d.date),
      sunrise: dayCol('sunrise'),
      sunset: dayCol('sunset'),
      daylightDuration: dayCol('daylightDuration'),
      sunshineDuration: dayCol('sunshineDuration'),
      uvIndexMax: dayCol('uvIndexMax'),
      rainSum: dayCol('rainSum'),
      windSpeedMax: dayCol('windSpeedMax'),
      windGustsMax: dayCol('windGustsMax'),
    },
  };
}

export interface MarineValues {
  swellWaveHeight: number | null;
  swellWavePeriod: number | null;
  windWaveHeight: number | null;
  seaSurfaceTemperature: number | null;
}

/** Good surf: 1.5 m at 12 s, clean, warm water. */
export const DEFAULT_MARINE: MarineValues = {
  swellWaveHeight: 1.5,
  swellWavePeriod: 12,
  windWaveHeight: 0.3,
  seaSurfaceTemperature: 18,
};

export function buildMarine(
  values?: (day: number, hour: number) => Partial<MarineValues>,
): MarineHourly {
  const rows: MarineValues[] = [];
  for (let day = -PAST_DAYS; day < DAYS - PAST_DAYS; day++) {
    for (let hour = 0; hour < 24; hour++)
      rows.push({ ...DEFAULT_MARINE, ...values?.(day, hour) });
  }
  const col = <K extends keyof MarineValues>(k: K) => rows.map((r) => r[k]);
  return {
    time: hourTimes(),
    swellWaveHeight: col('swellWaveHeight'),
    swellWavePeriod: col('swellWavePeriod'),
    windWaveHeight: col('windWaveHeight'),
    seaSurfaceTemperature: col('seaSurfaceTemperature'),
  };
}

export const NO_MARINE: MarineHourly = buildMarine(() => ({
  swellWaveHeight: null,
  swellWavePeriod: null,
  windWaveHeight: null,
  seaSurfaceTemperature: null,
}));

/** 16 bearings × 3 km and 6 km. The points in `seaBearings` are in the sea. */
export function ring(seaBearings: readonly number[]): RingPoint[] {
  const points: RingPoint[] = [];
  for (let i = 0; i < 16; i++) {
    const bearing = i * 22.5;
    for (const distanceKm of [3, 6]) {
      points.push({
        bearing,
        distanceKm,
        elevation: seaBearings.includes(bearing) ? 0 : 50,
      });
    }
  }
  return points;
}

/** A coast that faces west: the sea is from 225° to 315°. */
export const WEST_COAST = ring([225, 247.5, 270, 292.5, 315]);

export function terrain(
  options: { center?: number; grid?: number[]; ring?: RingPoint[] } = {},
): Terrain {
  const center = options.center ?? 100;
  return {
    center,
    grid: options.grid ?? Array.from({ length: 49 }, () => center),
    ring: options.ring ?? ring([]),
  };
}

export function context(forecast: Forecast, now: Date = NOW): ScoringContext {
  return { forecast, now };
}

/** The hour values for all hours of 1 day. */
export function onDay(
  target: number,
  values: Partial<HourValues>,
): (day: number, hour: number) => Partial<HourValues> {
  return (day) => (day === target ? values : {});
}
