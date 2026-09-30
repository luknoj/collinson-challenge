import { sightseeingDay } from '../outdoor/score.js';
import { sharedConfig } from '../shared/config.js';
import type {
  ActivityResult,
  DayScore,
  Explanation,
  IndoorDay,
  IndoorLevel,
  IndoorResult,
} from '../types.js';
import type { Forecast, Place } from '../weather.js';
import { indoorConfig, type IndoorConfig } from './config.js';

/**
 * scoring.md, section 6: indoor sightseeing is a recommendation from the
 * outdoor score of the same day. The hints do not change the level.
 */
export interface IndoorInput {
  forecast: Forecast;
  /** The outdoor result for the same place and week. */
  outdoor: ActivityResult;
  place: Place;
  config?: IndoorConfig;
}

export function recommendIndoor({
  forecast,
  outdoor,
  place,
  config = indoorConfig,
}: IndoorInput): IndoorResult {
  const days = outdoor.days.map((outdoorDay) =>
    indoorDay({ forecast, outdoorDay, config }),
  );
  const usable = days.filter((d) => !d.ended);
  return {
    recommendedDays: usable.filter((d) => d.level === 'RECOMMENDED').length,
    days,
    summary: indoorSummary(usable),
    townSize: townSize({ place, config }),
  };
}

export function levelFor({
  outdoorScore,
  config = indoorConfig,
}: {
  outdoorScore: number;
  config?: IndoorConfig;
}): IndoorLevel {
  if (outdoorScore < config.levels.recommendedBelow) return 'RECOMMENDED';
  if (outdoorScore < config.levels.goodAlternativeBelow)
    return 'GOOD_ALTERNATIVE';
  return 'SAVE_FOR_LATER';
}

function indoorDay({
  forecast,
  outdoorDay,
  config,
}: {
  forecast: Forecast;
  outdoorDay: DayScore;
  config: IndoorConfig;
}): IndoorDay {
  const level = levelFor({ outdoorScore: outdoorDay.score, config });
  return {
    date: outdoorDay.date,
    level,
    ended: outdoorDay.ended,
    outdoorScore: outdoorDay.score,
    mainCause: level === 'SAVE_FOR_LATER' ? null : mainCause(outdoorDay),
    hints: hints({ forecast, date: outdoorDay.date, config }),
  };
}

/** The gate with the lowest maximum score, or else the worst factor. */
function mainCause(day: DayScore): Explanation | null {
  const gate = [...day.gates].sort(
    (a, b) => Number(a.params?.maxScore ?? 0) - Number(b.params?.maxScore ?? 0),
  )[0];
  return gate ?? day.reasons[0] ?? null;
}

function hints({
  forecast,
  date,
  config,
}: {
  forecast: Forecast;
  date: string;
  config: IndoorConfig;
}): Explanation[] {
  const w = sightseeingDay({ forecast, date, window: config.window });
  const codes = sharedConfig.weatherCodes;
  const t = config.travel;
  const result: Explanation[] = [];

  const travel: string[] = [];
  if (w.codes.some((c) => codes.thunderstorm.includes(c)))
    travel.push('THUNDERSTORM');
  if (w.codes.some((c) => codes.freezingRain.includes(c)))
    travel.push('FREEZING_RAIN');
  if (w.snowfallCm !== null && w.snowfallCm > t.aboveSnowfallCm)
    travel.push('SNOWFALL');
  if (w.maxGusts !== null && w.maxGusts > t.aboveGustsKmh) travel.push('GUSTS');
  if (
    (w.maxApparent !== null && w.maxApparent > t.aboveApparentC) ||
    (w.minApparent !== null && w.minApparent < t.belowApparentC)
  ) {
    travel.push('EXTREME_TEMPERATURE');
  }
  if (travel.length > 0)
    result.push({ key: 'TRAVEL_HINT', params: { conditions: travel } });

  if (
    w.maxProbability !== null &&
    w.precipitationMm !== null &&
    w.maxProbability >= config.busy.minProbability &&
    w.precipitationMm >= config.busy.minPrecipitationMm
  ) {
    result.push({
      key: 'BUSY_HINT',
      params: { probability: w.maxProbability, amountMm: w.precipitationMm },
    });
  }
  return result;
}

export function townSize({
  place,
  config = indoorConfig,
}: {
  place: Place;
  config?: IndoorConfig;
}): Explanation {
  const s = config.townSize;
  const { population, featureCode } = place;
  const params = { population, featureCode };
  if (featureCode === s.capitalFeatureCode)
    return { key: 'TOWN_SIZE_LARGE', params };
  if (population === null) return { key: 'TOWN_SIZE_NO_DATA', params };
  if (population >= s.largeCityPopulation)
    return { key: 'TOWN_SIZE_LARGE', params };
  if (population >= s.cityPopulation) return { key: 'TOWN_SIZE_CITY', params };
  if (population >= s.townPopulation) return { key: 'TOWN_SIZE_TOWN', params };
  return { key: 'TOWN_SIZE_SMALL', params };
}

function indoorSummary(days: readonly IndoorDay[]): Explanation[] {
  const datesWith = (test: (d: IndoorDay) => boolean) =>
    days.filter(test).map((d) => d.date);
  const recommended = datesWith((d) => d.level === 'RECOMMENDED');
  const alternative = datesWith((d) => d.level === 'GOOD_ALTERNATIVE');
  const busy = datesWith((d) => d.hints.some((h) => h.key === 'BUSY_HINT'));

  const items: Explanation[] = [];
  if (recommended.length > 0)
    items.push({ key: 'INDOOR_RECOMMENDED_DAYS', days: recommended });
  if (alternative.length > 0) {
    items.push({ key: 'INDOOR_GOOD_ALTERNATIVE_DAYS', days: alternative });
  }
  if (busy.length > 0) items.push({ key: 'INDOOR_BUSY_DAYS', days: busy });
  if (recommended.length === 0 && alternative.length === 0) {
    items.push({ key: 'GOOD_OUTDOOR_WEEK' });
  }
  return items;
}
