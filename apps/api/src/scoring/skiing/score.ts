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
export function checkedSnowDepths({
  forecast,
  dates,
  config = skiingConfig,
}: {
  forecast: Forecast;
  dates: readonly string[];
  config?: SkiingConfig;
}): SnowDepth[] {
  const h = forecast.hourly;
  const hour = config.liftsOpenHour;
  const depthAt = (date: string) =>
    valueAt({ series: h.snowDepth, index: h.time.indexOf(at({ date, hour })) });

  const first = dates[0];
  let previousDate =
    first === undefined ? '' : addDays({ date: first, days: -1 });
  let previous = depthAt(previousDate);

  return dates.map((date) => {
    const raw = depthAt(date);
    let used = raw;
    if (raw !== null && previous !== null) {
      const window = {
        start: at({ date: previousDate, hour }),
        end: at({ date, hour }),
      };
      const indices = windowIndices({ times: h.time, window, kind: 'amount' });
      const snowfallCm = sum(pick({ series: h.snowfall, indices })) ?? 0;
      used = Math.min(raw, previous + snowfallCm / 100);
    }
    previous = used;
    previousDate = date;
    return { forecast: raw, used };
  });
}

export interface SkiingInput extends ScoringContext {
  /** null when the Elevation API failed. */
  terrain: Terrain | null;
  config?: SkiingConfig;
}

/** scoring.md, section 3. */
export function scoreSkiing({
  forecast,
  now,
  terrain,
  config = skiingConfig,
}: SkiingInput): ActivityResult {
  const dates = forecastDates({
    forecast,
    now,
    count: sharedConfig.forecastDays,
  });
  const depths = checkedSnowDepths({ forecast, dates, config });
  const minDepth = config.gates.minSnowDepthM;

  if (!depths.some((d) => d.used !== null && d.used >= minDepth)) {
    return notApplicable({
      reason: { key: 'NO_SNOW', params: { minDepthM: minDepth } },
    });
  }

  const notes: Explanation[] = [];
  const mountain =
    terrain === null ? null : mountainTerrain({ terrain, config });
  if (terrain === null) {
    notes.push({
      key: 'TERRAIN_UNAVAILABLE',
      params: { feature: 'MOUNTAIN_NOTE' },
    });
  } else if (mountain) {
    notes.push(mountainNote(mountain));
  }

  const nowLocal = localNow({
    now,
    utcOffsetSeconds: forecast.utcOffsetSeconds,
  });
  const days = dates.map((date, dayIndex) =>
    scoreSkiingDay({
      forecast,
      date,
      dayIndex,
      depth: depths[dayIndex]!,
      mountain,
      nowLocal,
      config,
    }),
  );
  return buildActivityResult({ days, notes });
}

function scoreSkiingDay({
  forecast,
  date,
  dayIndex,
  depth,
  mountain,
  nowLocal,
  config,
}: {
  forecast: Forecast;
  date: string;
  dayIndex: number;
  depth: SnowDepth;
  mountain: MountainTerrain | null;
  nowLocal: string;
  config: SkiingConfig;
}): DayScore {
  const { curves, factors, gates, skyParts } = config;
  const h = forecast.hourly;
  const lift = {
    start: at({ date, hour: config.window.startHour }),
    end: at({ date, hour: config.window.endHour }),
  };
  const instant = windowIndices({
    times: h.time,
    window: lift,
    kind: 'instant',
  });
  const amount = windowIndices({ times: h.time, window: lift, kind: 'amount' });
  const hourly = (series: (typeof h)['temperature']) =>
    pick({ series, indices: instant });

  const freshWindow = {
    start: at({
      date: addDays({ date, days: -config.freshSnowHours / 24 }),
      hour: config.liftsOpenHour,
    }),
    end: at({ date, hour: config.liftsOpenHour }),
  };
  const freshSnowCm = sum(
    pick({
      series: h.snowfall,
      indices: windowIndices({
        times: h.time,
        window: freshWindow,
        kind: 'amount',
      }),
    }),
  );
  const meanApparent = mean(hourly(h.apparentTemperature));
  const meanTemperature = mean(hourly(h.temperature));
  const visibilityM = mean(hourly(h.visibility));
  const visibilityKm = visibilityM === null ? null : visibilityM / 1000;
  const codes = hourly(h.weatherCode);

  const d = forecast.daily.date.indexOf(date);
  const daily = forecast.daily;
  const gustsMax = valueAt({ series: daily.windGustsMax, index: d });
  const rainSum = valueAt({ series: daily.rainSum, index: d });
  const sunshineRatio = ratio({
    part: valueAt({ series: daily.sunshineDuration, index: d }),
    whole: valueAt({ series: daily.daylightDuration, index: d }),
  });

  const skyScore = weightedParts([
    {
      weight: skyParts.visibility.weight,
      value: evaluateOptional({
        curve: curves.visibility,
        value: visibilityKm,
      }),
    },
    {
      weight: skyParts.sunshine.weight,
      value: evaluateOptional({
        curve: curves.sunshineRatio,
        value: sunshineRatio,
      }),
    },
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
        usedDepthM: round({ value: depth.used, decimals: 2 }),
      },
    });
  }
  if (mountain) {
    notes.push(
      mountainConditions({
        mountain,
        townTemperature: meanTemperature,
        freezingLevel: mean(hourly(h.freezingLevelHeight)),
        precipitationMm: sum(
          pick({ series: h.precipitation, indices: amount }),
        ),
        config,
      }),
    );
  }

  return buildDayScore({
    date,
    dayIndex,
    ended: isEnded({ localNow: nowLocal, windowEnd: lift.end }),
    factors: [
      {
        key: 'SNOW_BASE',
        weight: factors.snowBase.weight,
        subScore: evaluateOptional({
          curve: curves.snowBase,
          value: depth.used,
        }),
        value: depth.used,
        unit: 'm',
      },
      {
        key: 'FRESH_SNOW',
        weight: factors.freshSnow.weight,
        subScore: evaluateOptional({
          curve: curves.freshSnow,
          value: freshSnowCm,
        }),
        value: freshSnowCm,
        unit: 'cm',
      },
      {
        key: 'SKI_TEMPERATURE',
        weight: factors.temperature.weight,
        subScore: evaluateOptional({
          curve: curves.temperature,
          value: meanApparent,
        }),
        value: meanApparent,
        unit: '°C',
      },
      {
        key: 'SKI_WIND',
        weight: factors.wind.weight,
        subScore: evaluateOptional({ curve: curves.wind, value: gustsMax }),
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
  parts: readonly { weight: number; value: number | null }[],
): number | null {
  let total = 0;
  let weights = 0;
  for (const { weight, value } of parts) {
    if (value === null) continue;
    total += weight * value;
    weights += weight;
  }
  return weights === 0 ? null : total / weights;
}
