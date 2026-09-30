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
import type {
  Forecast,
  MarineHourly,
  ScoringContext,
  Terrain,
} from '../weather.js';
import {
  estimateCoastDirection,
  windType,
  type CoastDirection,
} from './coast.js';
import { surfingConfig, type SurfingConfig } from './config.js';

/** scoring.md, section 4. */
export function scoreSurfing(
  { forecast, now }: ScoringContext,
  marine: MarineHourly | null,
  terrain: Terrain | null,
  config: SurfingConfig = surfingConfig,
): ActivityResult {
  if (marine === null || isAllNull(marine)) {
    return notApplicable({ key: 'NO_SEA_NEARBY' });
  }

  const notes: Explanation[] = [];
  let coast: CoastDirection | null = null;
  if (terrain === null) {
    notes.push({
      key: 'TERRAIN_UNAVAILABLE',
      params: { feature: 'COAST_DIRECTION' },
    });
  } else {
    const result = estimateCoastDirection(terrain.ring, config);
    if (result.clear) {
      coast = result.coast;
    } else {
      notes.push({
        key: 'COAST_DIRECTION_UNCLEAR',
        params: {
          seaPoints: result.seaPoints,
          strength: result.strength === null ? null : round(result.strength, 2),
        },
      });
    }
  }

  const nowLocal = localNow(now, forecast.utcOffsetSeconds);
  const days = forecastDates(forecast, now, sharedConfig.forecastDays).map(
    (date, dayIndex) =>
      scoreSurfingDay(
        forecast,
        marine,
        date,
        dayIndex,
        coast,
        nowLocal,
        config,
      ),
  );
  return buildActivityResult(days, notes);
}

function isAllNull(marine: MarineHourly): boolean {
  return [
    marine.swellWaveHeight,
    marine.swellWavePeriod,
    marine.windWaveHeight,
    marine.seaSurfaceTemperature,
  ].every((series) => series.every((v) => v === null));
}

/**
 * Sunrise to sunset. Temporary rule when the forecast has no sunrise or
 * sunset (for example, polar night): 09:00 to 18:00. Refer to
 * future-improvements.md, item 1.2.
 */
function daylightWindow(forecast: Forecast, date: string): TimeWindow {
  const d = forecast.daily.date.indexOf(date);
  const sunrise = forecast.daily.sunrise[d] ?? null;
  const sunset = forecast.daily.sunset[d] ?? null;
  if (sunrise === null || sunset === null) {
    const fallback = sharedConfig.windows.sightseeing;
    return {
      start: at(date, fallback.startHour),
      end: at(date, fallback.endHour),
    };
  }
  return { start: sunrise, end: sunset };
}

function scoreSurfingDay(
  forecast: Forecast,
  marine: MarineHourly,
  date: string,
  dayIndex: number,
  coast: CoastDirection | null,
  nowLocal: string,
  config: SurfingConfig,
): DayScore {
  const { curves, factors, gates } = config;
  const window = daylightWindow(forecast, date);
  const h = forecast.hourly;
  const instant = windowIndices(h.time, window, 'instant');
  const sea = windowIndices(marine.time, window, 'instant');

  const swellHeights = pick(marine.swellWaveHeight, sea);
  const swell = mean(swellHeights);
  const maxSwell = max(swellHeights);
  const period = mean(pick(marine.swellWavePeriod, sea));
  const windWave = mean(pick(marine.windWaveHeight, sea));
  const waterTemperature = mean(pick(marine.seaSurfaceTemperature, sea));
  const wind = mean(pick(h.windSpeed, instant));
  const windFrom = circularMean(pick(h.windDirection, instant));
  const codes = pick(h.weatherCode, instant);
  const waveRatio =
    swell !== null && windWave !== null && swell > 0 ? windWave / swell : null;

  const adjustments: Adjustment[] = [];
  const notes: Explanation[] = [];
  if (coast && windFrom && wind !== null) {
    const w = config.windDirection;
    const { type, angle } = windType(
      windFrom.direction,
      coast.direction,
      config,
    );
    const light = wind < w.minWindKmh;
    const params = {
      windType: light ? 'LIGHT' : type,
      windDirection: round(windFrom.direction),
      coastDirection: round(coast.direction),
      angle: round(angle),
      windKmh: round(wind),
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
    ended: isEnded(nowLocal, window.end),
    factors: [
      {
        key: 'SWELL_HEIGHT',
        weight: factors.swellHeight.weight,
        subScore: evaluateOptional(curves.swellHeight, swell),
        value: swell,
        unit: 'm',
      },
      {
        key: 'SWELL_PERIOD',
        weight: factors.swellPeriod.weight,
        subScore: evaluateOptional(curves.swellPeriod, period),
        value: period,
        unit: 's',
      },
      {
        key: 'SURF_WIND_SPEED',
        weight: factors.windSpeed.weight,
        subScore: evaluateOptional(curves.windSpeed, wind),
        value: wind,
        unit: 'km/h',
      },
      {
        key: 'WAVE_QUALITY',
        weight: factors.waveQuality.weight,
        subScore: evaluateOptional(curves.waveQuality, waveRatio),
        value: waveRatio,
        unit: null,
        params: { windWaveM: windWave, swellM: swell },
      },
      {
        key: 'WATER_COMFORT',
        weight: factors.comfort.weight,
        subScore: evaluateOptional(curves.comfort, waterTemperature),
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
