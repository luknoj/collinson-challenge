const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** architecture.md, section 4.1. */
export const openMeteoConfig = {
  urls: {
    forecast: 'https://api.open-meteo.com/v1/forecast',
    marine: 'https://marine-api.open-meteo.com/v1/marine',
    elevation: 'https://api.open-meteo.com/v1/elevation',
  },

  ttlMs: {
    forecast: 30 * MINUTE_MS,
    marine: 30 * MINUTE_MS,
    elevation: 30 * DAY_MS,
  },

  /** The wait before each retry. 2 values give 2 retries. */
  retryDelaysMs: [300, 900],
  /** The time limit for each request. */
  timeoutMs: 8000,

  /** scoring.md, section 1. */
  forecast: {
    forecastDays: 7,
    /** The fresh snow window of day 1 starts at 09:00 on day −3. */
    pastDays: 3,
  },

  /** scoring.md, sections 3 and 4. 49 + 32 = 81 points in 1 request. */
  terrain: {
    /** The 7×7 grid around the town (mountain note). */
    gridSize: 7,
    gridStepKm: 3,
    /** The ring around the town (coast direction). */
    ringBearings: 16,
    ringDistancesKm: [3, 6],
  },
};

export type OpenMeteoConfig = typeof openMeteoConfig;
