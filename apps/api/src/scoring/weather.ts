// Normalized weather model. The Open-Meteo clients (phase 2) make it.
// All times are local times of the town: "YYYY-MM-DDTHH:mm".
// Instant values (for example, temperature) are for the time stamp.
// Amounts and maximums (precipitation, rain, snowfall, precipitation
// probability, gusts) are for the hour before the time stamp.

export type Series = readonly (number | null)[];

export interface HourlyForecast {
  time: readonly string[];
  /** °C */
  temperature: Series;
  /** °C */
  apparentTemperature: Series;
  /** mm, hour before the time stamp */
  precipitation: Series;
  /** mm, hour before the time stamp */
  rain: Series;
  /** %, hour before the time stamp */
  precipitationProbability: Series;
  /** cm, hour before the time stamp */
  snowfall: Series;
  /** m */
  snowDepth: Series;
  /** WMO code */
  weatherCode: Series;
  /** km/h */
  windSpeed: Series;
  /** km/h, hour before the time stamp */
  windGusts: Series;
  /** degrees, the direction that the wind comes from */
  windDirection: Series;
  /** m */
  visibility: Series;
  /** m */
  freezingLevelHeight: Series;
}

export interface DailyForecast {
  date: readonly string[];
  sunrise: readonly (string | null)[];
  sunset: readonly (string | null)[];
  /** s */
  daylightDuration: Series;
  /** s */
  sunshineDuration: Series;
  uvIndexMax: Series;
  /** mm */
  rainSum: Series;
  /** km/h */
  windSpeedMax: Series;
  /** km/h */
  windGustsMax: Series;
}

export interface Forecast {
  utcOffsetSeconds: number;
  hourly: HourlyForecast;
  /** Includes the days from past_days. */
  daily: DailyForecast;
}

export interface MarineHourly {
  time: readonly string[];
  /** m */
  swellWaveHeight: Series;
  /** s */
  swellWavePeriod: Series;
  /** m */
  windWaveHeight: Series;
  /** °C */
  seaSurfaceTemperature: Series;
}

export interface RingPoint {
  /** degrees from north, from the town to the point */
  bearing: number;
  distanceKm: number;
  /** m. Exactly 0 means sea. */
  elevation: number;
}

export interface Terrain {
  /** m, the elevation at the town (center of the grid) */
  center: number;
  /** m, the 7×7 grid around the town */
  grid: readonly number[];
  ring: readonly RingPoint[];
}

export interface Place {
  population: number | null;
  featureCode: string | null;
}

export interface ScoringContext {
  forecast: Forecast;
  now: Date;
}
