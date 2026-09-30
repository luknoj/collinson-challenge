import { sharedConfig, type HourWindow } from '../shared/config.js';
import { evaluateOptional } from '../shared/curve.js';
import { buildDayScore, type GateInput } from '../shared/day.js';
import {
  at,
  forecastDates,
  localNow,
  max,
  mean,
  min,
  pick,
  sum,
  valueAt,
  windowIndices,
} from '../shared/time.js';
import { buildActivityResult, isEnded } from '../shared/week.js';
import type {
  ActivityResult,
  Adjustment,
  DayScore,
  Explanation,
} from '../types.js';
import type { Forecast, ScoringContext } from '../weather.js';
import { outdoorConfig, type OutdoorConfig } from './config.js';

/** The weather values of 1 day in the sightseeing window. */
export interface SightseeingDay {
  maxProbability: number | null;
  precipitationMm: number | null;
  snowfallCm: number | null;
  meanApparent: number | null;
  maxApparent: number | null;
  minApparent: number | null;
  maxGusts: number | null;
  codes: number[];
}

export function sightseeingDay({
  forecast,
  date,
  window = sharedConfig.windows.sightseeing,
}: {
  forecast: Forecast;
  date: string;
  window?: HourWindow;
}): SightseeingDay {
  const h = forecast.hourly;
  const range = {
    start: at({ date, hour: window.startHour }),
    end: at({ date, hour: window.endHour }),
  };
  const instant = windowIndices({
    times: h.time,
    window: range,
    kind: 'instant',
  });
  const amount = windowIndices({
    times: h.time,
    window: range,
    kind: 'amount',
  });
  const apparent = pick({ series: h.apparentTemperature, indices: instant });
  return {
    maxProbability: max(
      pick({ series: h.precipitationProbability, indices: amount }),
    ),
    precipitationMm: sum(pick({ series: h.precipitation, indices: amount })),
    snowfallCm: sum(pick({ series: h.snowfall, indices: amount })),
    meanApparent: mean(apparent),
    maxApparent: max(apparent),
    minApparent: min(apparent),
    maxGusts: max(pick({ series: h.windGusts, indices: amount })),
    codes: pick({ series: h.weatherCode, indices: instant }),
  };
}

export interface OutdoorInput extends ScoringContext {
  config?: OutdoorConfig;
}

/** scoring.md, section 5. */
export function scoreOutdoor({
  forecast,
  now,
  config = outdoorConfig,
}: OutdoorInput): ActivityResult {
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
    scoreOutdoorDay({ forecast, date, dayIndex, nowLocal, config }),
  );
  return buildActivityResult({ days, notes: [] });
}

function scoreOutdoorDay({
  forecast,
  date,
  dayIndex,
  nowLocal,
  config,
}: {
  forecast: Forecast;
  date: string;
  dayIndex: number;
  nowLocal: string;
  config: OutdoorConfig;
}): DayScore {
  const { curves, gates, factors } = config;
  const codes = sharedConfig.weatherCodes;
  const w = sightseeingDay({ forecast, date, window: config.window });
  const d = forecast.daily.date.indexOf(date);
  const daily = forecast.daily;
  const sunshineRatio = ratio({
    part: valueAt({ series: daily.sunshineDuration, index: d }),
    whole: valueAt({ series: daily.daylightDuration, index: d }),
  });
  const windMax = valueAt({ series: daily.windSpeedMax, index: d });
  const uv = valueAt({ series: daily.uvIndexMax, index: d });

  const probabilityScore = evaluateOptional({
    curve: curves.precipitationProbability,
    value: w.maxProbability,
  });
  const amountScore = evaluateOptional({
    curve: curves.precipitationAmount,
    value: w.precipitationMm,
  });
  const precipitationParts = [probabilityScore, amountScore].filter(
    (v) => v !== null,
  );
  const precipitationScore =
    precipitationParts.length === 0
      ? null
      : precipitationParts.reduce((a, b) => a + b, 0) /
        precipitationParts.length;

  const gateInputs: GateInput[] = [
    {
      key: 'THUNDERSTORM_GATE',
      active: w.codes.some((c) => codes.thunderstorm.includes(c)),
      maxScore: gates.thunderstorm.maxScore,
    },
    {
      key: 'EXTREME_TEMPERATURE_GATE',
      active:
        (w.maxApparent !== null &&
          w.maxApparent > gates.extremeTemperature.aboveC) ||
        (w.minApparent !== null &&
          w.minApparent < gates.extremeTemperature.belowC),
      maxScore: gates.extremeTemperature.maxScore,
      params: {
        maxApparent: w.maxApparent,
        minApparent: w.minApparent,
        aboveC: gates.extremeTemperature.aboveC,
        belowC: gates.extremeTemperature.belowC,
      },
    },
    {
      key: 'STRONG_GUSTS_GATE',
      active: w.maxGusts !== null && w.maxGusts > gates.strongGusts.aboveKmh,
      maxScore: gates.strongGusts.maxScore,
      params: { gustsKmh: w.maxGusts, aboveKmh: gates.strongGusts.aboveKmh },
    },
    {
      key: 'HEAVY_RAIN_GATE',
      active:
        w.precipitationMm !== null &&
        w.maxProbability !== null &&
        w.precipitationMm > gates.heavyRain.aboveMm &&
        w.maxProbability > gates.heavyRain.aboveProbability,
      maxScore: gates.heavyRain.maxScore,
      params: {
        amountMm: w.precipitationMm,
        probability: w.maxProbability,
        aboveMm: gates.heavyRain.aboveMm,
        aboveProbability: gates.heavyRain.aboveProbability,
      },
    },
    {
      key: 'HIGH_WIND_GATE',
      active: windMax !== null && windMax > gates.highWind.aboveKmh,
      maxScore: gates.highWind.maxScore,
      params: { windKmh: windMax, aboveKmh: gates.highWind.aboveKmh },
    },
  ];

  const adjustments: Adjustment[] = [];
  const fogHours = w.codes.filter((c) => codes.fog.includes(c)).length;
  if (fogHours >= config.fog.minHours) {
    adjustments.push({
      key: 'FOG',
      points: config.fog.points,
      params: { hours: fogHours, minHours: config.fog.minHours },
    });
  }

  const notes: Explanation[] = [];
  if (uv !== null && uv >= config.uv.veryHighIndex) {
    notes.push({
      key: 'UV_VERY_HIGH',
      params: { uvIndex: uv, minIndex: config.uv.veryHighIndex },
    });
  }

  return buildDayScore({
    date,
    dayIndex,
    ended: isEnded({
      localNow: nowLocal,
      windowEnd: at({ date, hour: config.window.endHour }),
    }),
    factors: [
      {
        key: 'PRECIPITATION',
        weight: factors.precipitation.weight,
        subScore: precipitationScore,
        value: null,
        unit: null,
        params: { probability: w.maxProbability, amountMm: w.precipitationMm },
      },
      {
        key: 'THERMAL_COMFORT',
        weight: factors.thermalComfort.weight,
        subScore: evaluateOptional({
          curve: curves.thermalComfort,
          value: w.meanApparent,
        }),
        value: w.meanApparent,
        unit: '°C',
      },
      {
        key: 'OUTDOOR_SKY',
        weight: factors.sky.weight,
        subScore: evaluateOptional({
          curve: curves.sunshineRatio,
          value: sunshineRatio,
        }),
        value: sunshineRatio,
        unit: null,
      },
      {
        key: 'OUTDOOR_WIND',
        weight: factors.wind.weight,
        subScore: evaluateOptional({ curve: curves.wind, value: windMax }),
        value: windMax,
        unit: 'km/h',
      },
    ],
    adjustments,
    gates: gateInputs,
    notes,
  });
}

export function ratio({
  part,
  whole,
}: {
  part: number | null;
  whole: number | null;
}): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return part / whole;
}
