import { ratio } from '../outdoor/score.js';
import { sharedConfig } from '../shared/config.js';
import { evaluateOptional } from '../shared/curve.js';
import { buildDayScore } from '../shared/day.js';
import {
  addDays,
  at,
  forecastDates,
  localNow,
  mean,
  pick,
  round,
  sum,
  valueAt,
  windowIndices,
} from '../shared/time.js';
import { buildActivityResult, isEnded, notApplicable } from '../shared/week.js';
import type { ActivityResult, DayScore, Explanation } from '../types.js';
import type { Forecast, ScoringContext, Terrain } from '../weather.js';
import { skiingConfig, type SkiingConfig } from './config.js';
import {
  mountainConditions,
  mountainNote,
  mountainTerrain,
  type MountainTerrain,
} from './mountain.js';

export interface SnowDepth {
  /** m, snow_depth at 09:00 from the forecast */
  forecast: number | null;
  /** m, the value after the snow depth check */
  used: number | null;
}

/**
 * scoring.md, section 3, snow depth check:
 * depth[d] ≤ depth[d−1] + snowfall(09:00 on day d−1 → 09:00 on day d) / 100
 * For day 1, depth[d−1] is the snow depth at 09:00 on day −1 (past_days).
 */
export function checkedSnowDepths(
  forecast: Forecast,
  dates: readonly string[],
  config: SkiingConfig = skiingConfig,
): SnowDepth[] {
  const h = forecast.hourly;
  const hour = config.liftsOpenHour;
  const depthAt = (date: string) =>
    valueAt(h.snowDepth, h.time.indexOf(at(date, hour)));

  const first = dates[0];
  let previousDate = first === undefined ? '' : addDays(first, -1);
  let previous = depthAt(previousDate);

  return dates.map((date) => {
    const raw = depthAt(date);
    let used = raw;
    if (raw !== null && previous !== null) {
      const window = { start: at(previousDate, hour), end: at(date, hour) };
      const snowfallCm =
        sum(pick(h.snowfall, windowIndices(h.time, window, 'amount'))) ?? 0;
      used = Math.min(raw, previous + snowfallCm / 100);
    }
    previous = used;
    previousDate = date;
    return { forecast: raw, used };
  });
}

/** scoring.md, section 3. */
export function scoreSkiing(
  { forecast, now }: ScoringContext,
  terrain: Terrain | null,
  config: SkiingConfig = skiingConfig,
): ActivityResult {
  const dates = forecastDates(forecast, now, sharedConfig.forecastDays);
  const depths = checkedSnowDepths(forecast, dates, config);
  const minDepth = config.gates.minSnowDepthM;

  if (!depths.some((d) => d.used !== null && d.used >= minDepth)) {
    return notApplicable({ key: 'NO_SNOW', params: { minDepthM: minDepth } });
  }

  const notes: Explanation[] = [];
  const mountain = terrain === null ? null : mountainTerrain(terrain, config);
  if (terrain === null) {
    notes.push({
      key: 'TERRAIN_UNAVAILABLE',
      params: { feature: 'MOUNTAIN_NOTE' },
    });
  } else if (mountain) {
    notes.push(mountainNote(mountain));
  }

  const nowLocal = localNow(now, forecast.utcOffsetSeconds);
  const days = dates.map((date, dayIndex) =>
    scoreSkiingDay(
      forecast,
      date,
      dayIndex,
      depths[dayIndex]!,
      mountain,
      nowLocal,
      config,
    ),
  );
  return buildActivityResult(days, notes);
}

function scoreSkiingDay(
  forecast: Forecast,
  date: string,
  dayIndex: number,
  depth: SnowDepth,
  mountain: MountainTerrain | null,
  nowLocal: string,
  config: SkiingConfig,
): DayScore {
  const { curves, factors, gates, skyParts } = config;
  const h = forecast.hourly;
  const lift = {
    start: at(date, config.window.startHour),
    end: at(date, config.window.endHour),
  };
  const instant = windowIndices(h.time, lift, 'instant');
  const amount = windowIndices(h.time, lift, 'amount');

  const freshWindow = {
    start: at(addDays(date, -config.freshSnowHours / 24), config.liftsOpenHour),
    end: at(date, config.liftsOpenHour),
  };
  const freshSnowCm = sum(
    pick(h.snowfall, windowIndices(h.time, freshWindow, 'amount')),
  );
  const meanApparent = mean(pick(h.apparentTemperature, instant));
  const meanTemperature = mean(pick(h.temperature, instant));
  const visibilityM = mean(pick(h.visibility, instant));
  const visibilityKm = visibilityM === null ? null : visibilityM / 1000;
  const codes = pick(h.weatherCode, instant);

  const d = forecast.daily.date.indexOf(date);
  const daily = forecast.daily;
  const gustsMax = valueAt(daily.windGustsMax, d);
  const rainSum = valueAt(daily.rainSum, d);
  const sunshineRatio = ratio(
    valueAt(daily.sunshineDuration, d),
    valueAt(daily.daylightDuration, d),
  );

  const skyScore = weightedParts([
    [
      skyParts.visibility.weight,
      evaluateOptional(curves.visibility, visibilityKm),
    ],
    [
      skyParts.sunshine.weight,
      evaluateOptional(curves.sunshineRatio, sunshineRatio),
    ],
  ]);

  const notes: Explanation[] = [];
  if (
    depth.forecast !== null &&
    depth.used !== null &&
    depth.used < depth.forecast
  ) {
    notes.push({
      key: 'SNOW_DEPTH_CORRECTED',
      params: {
        forecastDepthM: depth.forecast,
        usedDepthM: round(depth.used, 2),
      },
    });
  }
  if (mountain) {
    notes.push(
      mountainConditions(
        mountain,
        meanTemperature,
        mean(pick(h.freezingLevelHeight, instant)),
        sum(pick(h.precipitation, amount)),
        config,
      ),
    );
  }

  return buildDayScore({
    date,
    dayIndex,
    ended: isEnded(nowLocal, lift.end),
    factors: [
      {
        key: 'SNOW_BASE',
        weight: factors.snowBase.weight,
        subScore: evaluateOptional(curves.snowBase, depth.used),
        value: depth.used,
        unit: 'm',
      },
      {
        key: 'FRESH_SNOW',
        weight: factors.freshSnow.weight,
        subScore: evaluateOptional(curves.freshSnow, freshSnowCm),
        value: freshSnowCm,
        unit: 'cm',
      },
      {
        key: 'SKI_TEMPERATURE',
        weight: factors.temperature.weight,
        subScore: evaluateOptional(curves.temperature, meanApparent),
        value: meanApparent,
        unit: '°C',
      },
      {
        key: 'SKI_WIND',
        weight: factors.wind.weight,
        subScore: evaluateOptional(curves.wind, gustsMax),
        value: gustsMax,
        unit: 'km/h',
      },
      {
        key: 'SKI_SKY',
        weight: factors.sky.weight,
        subScore: skyScore,
        value: null,
        unit: null,
        params: { visibilityKm, sunshineRatio },
      },
    ],
    gates: [
      {
        key: 'NO_SNOW_BASE_GATE',
        active: depth.used === null || depth.used < gates.minSnowDepthM,
        maxScore: gates.noSnowBase.maxScore,
        params: { depthM: depth.used, minDepthM: gates.minSnowDepthM },
      },
      {
        key: 'FREEZING_RAIN_GATE',
        active: codes.some((c) =>
          sharedConfig.weatherCodes.freezingRain.includes(c),
        ),
        maxScore: gates.freezingRain.maxScore,
      },
      {
        key: 'RAIN_ON_SNOW_GATE',
        active:
          rainSum !== null &&
          meanTemperature !== null &&
          rainSum > gates.rainOnSnow.aboveRainMm &&
          meanTemperature > gates.rainOnSnow.aboveTemperatureC,
        maxScore: gates.rainOnSnow.maxScore,
        params: {
          rainMm: rainSum,
          temperatureC: meanTemperature,
          aboveRainMm: gates.rainOnSnow.aboveRainMm,
          aboveTemperatureC: gates.rainOnSnow.aboveTemperatureC,
        },
      },
    ],
    notes,
  });
}

/** Weighted mean of the parts that have data. Null when no part has data. */
function weightedParts(
  parts: readonly (readonly [number, number | null])[],
): number | null {
  let total = 0;
  let weights = 0;
  for (const [weight, value] of parts) {
    if (value === null) continue;
    total += weight * value;
    weights += weight;
  }
  return weights === 0 ? null : total / weights;
}
