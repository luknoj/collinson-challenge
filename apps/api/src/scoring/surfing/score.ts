import { sharedConfig } from '../shared/config.js';
import { evaluateOptional } from '../shared/curve.js';
import { buildDayScore } from '../shared/day.js';
import {
  at,
  circularMean,
  forecastDates,
  localNow,
  max,
  mean,
  pick,
  round,
  windowIndices,
  type TimeWindow,
} from '../shared/time.js';
import { buildActivityResult, isEnded, notApplicable } from '../shared/week.js';
import type {
  ActivityResult,
  Adjustment,
  DayScore,
  Explanation,
} from '../types.js';
import {
  isMarineEmpty,
  type Forecast,
  type MarineHourly,
  type ScoringContext,
  type Terrain,
} from '../weather.js';
import {
  estimateCoastDirection,
  windType,
  type CoastDirection,
} from './coast.js';
import { surfingConfig, type SurfingConfig } from './config.js';

export interface SurfingInput extends ScoringContext {
  /** null when the place has no marine data. */
  marine: MarineHourly | null;
  /** null when the Elevation API failed. */
  terrain: Terrain | null;
  config?: SurfingConfig;
}

/** scoring.md, section 4. */
export function scoreSurfing({
  forecast,
  now,
  marine,
  terrain,
  config = surfingConfig,
}: SurfingInput): ActivityResult {
  if (marine === null || isMarineEmpty(marine)) {
    return notApplicable({ reason: { key: 'NO_SEA_NEARBY' } });
  }

  const notes: Explanation[] = [];
  let coast: CoastDirection | null = null;
  if (terrain === null) {
    notes.push({
      key: 'TERRAIN_UNAVAILABLE',
      params: { feature: 'COAST_DIRECTION' },
    });
  } else {
    const result = estimateCoastDirection({ ring: terrain.ring, config });
    if (result.clear) {
      coast = result.coast;
    } else {
      notes.push({
        key: 'COAST_DIRECTION_UNCLEAR',
        params: {
          seaPoints: result.seaPoints,
          strength:
            result.strength === null
              ? null
              : round({ value: result.strength, decimals: 2 }),
        },
      });
    }
  }

  const nowLocal = localNow({
    now,
    utcOffsetSeconds: forecast.utcOffsetSeconds,
  });
  const dates = forecastDates({
    forecast,
    now,
    count: sharedConfig.forecastDays,
  });
  const days = dates.map((date, dayIndex) =>
    scoreSurfingDay({
      forecast,
      marine,
      date,
      dayIndex,
      coast,
      nowLocal,
      config,
    }),
  );
  return buildActivityResult({ days, notes });
}

/**
 * Sunrise to sunset. Temporary rule when the forecast has no sunrise or
 * sunset (for example, polar night): 09:00 to 18:00. Refer to
 * future-improvements.md, item 1.2.
 */
function daylightWindow({
  forecast,
  date,
}: {
  forecast: Forecast;
  date: string;
}): TimeWindow {
  const d = forecast.daily.date.indexOf(date);
  const sunrise = forecast.daily.sunrise[d] ?? null;
  const sunset = forecast.daily.sunset[d] ?? null;
  if (sunrise === null || sunset === null) {
    const fallback = sharedConfig.windows.sightseeing;
    return {
      start: at({ date, hour: fallback.startHour }),
      end: at({ date, hour: fallback.endHour }),
    };
  }
  return { start: sunrise, end: sunset };
}

function scoreSurfingDay({
  forecast,
  marine,
  date,
  dayIndex,
  coast,
  nowLocal,
  config,
}: {
  forecast: Forecast;
  marine: MarineHourly;
  date: string;
  dayIndex: number;
  coast: CoastDirection | null;
  nowLocal: string;
  config: SurfingConfig;
}): DayScore {
  const { curves, factors, gates } = config;
  const window = daylightWindow({ forecast, date });
  const h = forecast.hourly;
  const instant = windowIndices({ times: h.time, window, kind: 'instant' });
  const sea = windowIndices({ times: marine.time, window, kind: 'instant' });
  const seaValues = (series: MarineHourly['swellWaveHeight']) =>
    pick({ series, indices: sea });

  const swellHeights = seaValues(marine.swellWaveHeight);
  const swell = mean(swellHeights);
  const maxSwell = max(swellHeights);
  const period = mean(seaValues(marine.swellWavePeriod));
  const windWave = mean(seaValues(marine.windWaveHeight));
  const waterTemperature = mean(seaValues(marine.seaSurfaceTemperature));
  const wind = mean(pick({ series: h.windSpeed, indices: instant }));
  const windFrom = circularMean(
    pick({ series: h.windDirection, indices: instant }),
  );
  const codes = pick({ series: h.weatherCode, indices: instant });
  const waveRatio =
    swell !== null && windWave !== null && swell > 0 ? windWave / swell : null;

  const adjustments: Adjustment[] = [];
  const notes: Explanation[] = [];
  if (coast && windFrom && wind !== null) {
    const w = config.windDirection;
    const { type, angle } = windType({
      windFrom: windFrom.direction,
      coastDirection: coast.direction,
      config,
    });
    const light = wind < w.minWindKmh;
    const params = {
      windType: light ? 'LIGHT' : type,
      windDirection: round({ value: windFrom.direction }),
      coastDirection: round({ value: coast.direction }),
      angle: round({ value: angle }),
      windKmh: round({ value: wind }),
    };
    notes.push({ key: 'WIND_DIRECTION', params });
    if (!light && type === 'ONSHORE') {
      adjustments.push({
        key: 'ONSHORE_WIND',
        points: w.onshorePoints,
        params,
      });
    }
    if (!light && type === 'OFFSHORE') {
      adjustments.push({
        key: 'OFFSHORE_WIND',
        points: w.offshorePoints,
        params,
      });
    }
  }

  return buildDayScore({
    date,
    dayIndex,
    ended: isEnded({ localNow: nowLocal, windowEnd: window.end }),
    factors: [
      {
        key: 'SWELL_HEIGHT',
        weight: factors.swellHeight.weight,
        subScore: evaluateOptional({ curve: curves.swellHeight, value: swell }),
        value: swell,
        unit: 'm',
      },
      {
        key: 'SWELL_PERIOD',
        weight: factors.swellPeriod.weight,
        subScore: evaluateOptional({
          curve: curves.swellPeriod,
          value: period,
        }),
        value: period,
        unit: 's',
      },
      {
        key: 'SURF_WIND_SPEED',
        weight: factors.windSpeed.weight,
        subScore: evaluateOptional({ curve: curves.windSpeed, value: wind }),
        value: wind,
        unit: 'km/h',
      },
      {
        key: 'WAVE_QUALITY',
        weight: factors.waveQuality.weight,
        subScore: evaluateOptional({
          curve: curves.waveQuality,
          value: waveRatio,
        }),
        value: waveRatio,
        unit: null,
        params: { windWaveM: windWave, swellM: swell },
      },
      {
        key: 'WATER_COMFORT',
        weight: factors.comfort.weight,
        subScore: evaluateOptional({
          curve: curves.comfort,
          value: waterTemperature,
        }),
        value: waterTemperature,
        unit: '°C',
      },
    ],
    adjustments,
    gates: [
      {
        key: 'THUNDERSTORM_GATE',
        active: codes.some((c) =>
          sharedConfig.weatherCodes.thunderstorm.includes(c),
        ),
        maxScore: gates.thunderstorm.maxScore,
      },
      {
        key: 'LARGE_SWELL_GATE',
        active: maxSwell !== null && maxSwell > gates.largeSwell.aboveHeightM,
        maxScore: gates.largeSwell.maxScore,
        params: { swellM: maxSwell },
      },
      {
        key: 'STRONG_WIND_GATE',
        active: wind !== null && wind > gates.strongWind.aboveMeanKmh,
        maxScore: gates.strongWind.maxScore,
        params: { windKmh: wind },
      },
    ],
    notes,
  });
}
