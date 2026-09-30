// 1 text template for each ExplanationKey (ui-spec.md, section 6). The
// numbers come from `params`, so they always agree with the backend config.
// A missing template gives a TypeScript error.
//
// Text in [brackets] is a term with a popover. The popover shows `title`,
// `details` and a "More" link to `more`.

import type { ExplanationKey } from '../generated/graphql';
import { joinWords, type ParamReader } from './params';

/** The sections of the "How the scores work" panel. */
export type PanelSection =
  | 'labels'
  | 'weekly'
  | 'confidence'
  | 'ended'
  | 'gates'
  | 'local-time'
  | 'indoor'
  | 'data';

export interface Template {
  /** A short name: the popover title and the factor name. */
  title: string;
  /** The text on the screen. */
  text: (p: ParamReader) => string;
  /** Factors only: the value in the breakdown ("0.6 m"). */
  value?: (p: ParamReader) => string;
  /** The longer explanation in the popover. */
  details?: (p: ParamReader) => string;
  /** The section of the panel for the "More" link. */
  more?: PanelSection;
}

/**
 * A factor. The params are the factor params with `value` and `unit`. The
 * text is for the reasons ("Snow base: 0.4 m").
 */
function factor({
  title,
  value,
  details,
}: {
  title: string;
  value: (p: ParamReader) => string;
  details?: (p: ParamReader) => string;
}): Template {
  const name = details ? `[${title}]` : title;
  return { title, value, details, text: (p) => `${name}: ${value(p)}` };
}

/** A gate. The text shows the values and the maximum score. */
function gate({
  title,
  values,
  details,
}: {
  title: string;
  values?: (p: ParamReader) => string;
  details: (p: ParamReader) => string;
}): Template {
  return {
    title,
    details,
    more: 'gates',
    text: (p) =>
      `[${title}]${values ? ` (${values(p)})` : ''}: maximum score ${p.number('maxScore')}`,
  };
}

/** The activity hours of a factor ("09:00–16:00"). */
function hours(p: ParamReader): string {
  return `${p.hour('startHour')}–${p.hour('endHour')}`;
}

const TRAVEL_CONDITIONS: Record<string, string> = {
  THUNDERSTORM: 'a thunderstorm',
  FREEZING_RAIN: 'freezing rain',
  SNOWFALL: 'heavy snowfall',
  GUSTS: 'strong gusts',
  EXTREME_TEMPERATURE: 'an extreme temperature',
};

const WIND_TYPES: Record<string, { name: string; effect: string }> = {
  ONSHORE: { name: 'onshore', effect: 'The waves can be rough.' },
  CROSS_SHORE: { name: 'cross-shore', effect: '' },
  OFFSHORE: { name: 'offshore', effect: 'The waves can be clean.' },
  LIGHT: {
    name: 'light',
    effect: 'The wind direction has almost no effect.',
  },
};

const WIND_DIRECTION_DETAILS =
  'Onshore wind blows from the sea to the land and makes the waves rough. Offshore wind blows from the land to the sea and keeps the waves clean. The coast direction is an estimate from the terrain. Each beach can have a different direction.';

/** The title of the key in a param (for example, the gate of a warning). */
function keyTitle({ p, name }: { p: ParamReader; name: string }): string {
  const key = p.raw(name);
  if (typeof key !== 'string' || !(key in TEMPLATES)) return 'no data';
  return TEMPLATES[key as ExplanationKey].title.toLowerCase();
}

function trend({ p, direction }: { p: ParamReader; direction: string }) {
  const change = p.number('change').replace('-', '');
  const cause =
    p.raw('factor') === null
      ? ''
      : `, mainly because of the ${keyTitle({ p, name: 'factor' })}`;
  return `The conditions get ${direction} later in the week (${change} points)${cause}.`;
}

export const TEMPLATES: Record<ExplanationKey, Template> = {
  // Skiing factors
  SNOW_BASE: factor({
    title: 'Snow base',
    value: (p) => p.m('value'),
    details: () =>
      'The depth of the snow on the ground when the lifts open. A thin snow base makes the slopes hard or closed.',
  }),
  FRESH_SNOW: factor({
    title: 'Fresh snow',
    value: (p) => p.cm('value'),
    details: () =>
      'The new snow of the last days before the lifts open. Snow that falls during the day counts for the next day.',
  }),
  SKI_TEMPERATURE: factor({
    title: 'Temperature',
    value: (p) => `feels like ${p.celsius('value')}, ${hours(p)}`,
    details: (p) =>
      `The mean "feels like" temperature in the lift hours (${hours(p)}). It includes the effect of the wind and the humidity. Outdoor sightseeing uses different hours, thus its value can be different.`,
  }),
  SKI_WIND: factor({
    title: 'Wind',
    value: (p) => `gusts ${p.kmh('value')}`,
    details: (p) =>
      `The strongest gusts in the lift hours (${hours(p)}). Strong gusts make the lifts slow or stop them.`,
  }),
  SKI_SKY: factor({
    title: 'Sky',
    value: (p) =>
      `visibility ${p.km('visibilityKm')}, sun ${p.share('sunshineRatio')} of the day`,
    details: () =>
      'Good visibility and sunshine make skiing safer and more pleasant. Falling snow and fog decrease the visibility.',
  }),

  // Surfing factors
  SWELL_HEIGHT: factor({
    title: 'Swell height',
    value: (p) => p.m('value'),
    details: () =>
      'The height of the waves that come from far away. They are the waves that surfers ride.',
  }),
  SWELL_PERIOD: factor({
    title: 'Swell period',
    value: (p) => p.seconds('value'),
    details: () =>
      'The time between 2 waves. A longer period gives stronger and cleaner waves.',
  }),
  SURF_WIND_SPEED: factor({
    title: 'Wind',
    value: (p) => p.kmh('value'),
  }),
  WAVE_QUALITY: factor({
    title: 'Wave quality',
    value: (p) => `wind waves ${p.m('windWaveM')} on a ${p.m('swellM')} swell`,
    details: () =>
      'The local wind makes small, rough waves on the swell. Fewer wind waves give cleaner waves.',
  }),
  WATER_COMFORT: factor({
    title: 'Water temperature',
    value: (p) => p.celsius('value'),
  }),

  // Outdoor factors
  PRECIPITATION: factor({
    title: 'Rain',
    value: (p) =>
      `probability ${p.percent('probability')}, ${p.mm('amountMm')}`,
  }),
  THERMAL_COMFORT: factor({
    title: 'Temperature',
    value: (p) => `feels like ${p.celsius('value')}, ${hours(p)}`,
    details: (p) =>
      `The mean "feels like" temperature in the daytime hours (${hours(p)}). It includes the effect of the wind and the humidity.`,
  }),
  OUTDOOR_SKY: factor({
    title: 'Sunshine',
    value: (p) => `sun ${p.share('value')} of the day`,
  }),
  OUTDOOR_WIND: factor({
    title: 'Wind',
    value: (p) => p.kmh('value'),
    details: (p) =>
      `The strongest wind speed in the daytime hours (${hours(p)}). The gusts are a different value, with their own gate.`,
  }),

  // Gates
  NO_SNOW_BASE_GATE: gate({
    title: 'No snow base',
    values: (p) => `${p.m('depthM')} of snow`,
    details: (p) =>
      `The slopes need a snow base of ${p.m('minDepthM')} or more. With less snow, the maximum score is ${p.number('maxScore')}.`,
  }),
  FREEZING_RAIN_GATE: gate({
    title: 'Freezing rain',
    details: (p) =>
      `Rain that freezes on the ground makes the slopes and the roads icy. With freezing rain during the lift hours, the maximum score is ${p.number('maxScore')}.`,
  }),
  RAIN_ON_SNOW_GATE: gate({
    title: 'Rain on snow',
    values: (p) => `${p.mm('rainMm')} at ${p.celsius('temperatureC')}`,
    details: (p) =>
      `Rain on snow makes the slopes wet and heavy. When the rain is more than ${p.mm('aboveRainMm')} and the temperature is more than ${p.celsius('aboveTemperatureC')}, the maximum score is ${p.number('maxScore')}.`,
  }),
  THUNDERSTORM_GATE: gate({
    title: 'Thunderstorm',
    details: (p) =>
      `The forecast has a thunderstorm during the activity hours. Lightning is dangerous outdoors and on the water. Thus, the maximum score is ${p.number('maxScore')}.`,
  }),
  LARGE_SWELL_GATE: gate({
    title: 'Large swell',
    values: (p) => p.m('swellM'),
    details: (p) =>
      `Waves of more than ${p.m('aboveM')} are only for expert surfers. Thus, the maximum score is ${p.number('maxScore')}.`,
  }),
  STRONG_WIND_GATE: gate({
    title: 'Strong wind',
    values: (p) => `${p.kmh('windKmh')} on average`,
    details: (p) =>
      `A mean wind of more than ${p.kmh('aboveKmh')} makes the waves bad. Thus, the maximum score is ${p.number('maxScore')}.`,
  }),
  EXTREME_TEMPERATURE_GATE: gate({
    title: 'Extreme temperature',
    values: (p) =>
      `feels like ${p.celsius('minApparent')} to ${p.celsius('maxApparent')}`,
    details: (p) =>
      `A "feels like" temperature of more than ${p.celsius('aboveC')} or less than ${p.celsius('belowC')} is dangerous outdoors. Thus, the maximum score is ${p.number('maxScore')}.`,
  }),
  STRONG_GUSTS_GATE: gate({
    title: 'Strong gusts',
    values: (p) => p.kmh('gustsKmh'),
    details: (p) =>
      `Gusts of more than ${p.kmh('aboveKmh')} are dangerous outdoors. Thus, the maximum score is ${p.number('maxScore')}.`,
  }),
  HEAVY_RAIN_GATE: gate({
    title: 'Heavy rain',
    values: (p) =>
      `${p.mm('amountMm')}, probability ${p.percent('probability')}`,
    details: (p) =>
      `When the rain is more than ${p.mm('aboveMm')} and its probability is more than ${p.percent('aboveProbability')}, the maximum score is ${p.number('maxScore')}.`,
  }),
  HIGH_WIND_GATE: gate({
    title: 'High wind',
    values: (p) => p.kmh('windKmh'),
    details: (p) =>
      `A wind of more than ${p.kmh('aboveKmh')} makes a walk in the town difficult. Thus, the maximum score is ${p.number('maxScore')}.`,
  }),

  // Adjustments
  ONSHORE_WIND: {
    title: 'Onshore wind',
    text: (p) => `[Onshore wind] from the ${p.compass('windDirection')}`,
    details: () => WIND_DIRECTION_DETAILS,
  },
  OFFSHORE_WIND: {
    title: 'Offshore wind',
    text: (p) => `[Offshore wind] from the ${p.compass('windDirection')}`,
    details: () => WIND_DIRECTION_DETAILS,
  },
  FOG: {
    title: 'Fog',
    text: (p) => `[Fog] for ${p.number('hours')} hours`,
    details: (p) =>
      `Fog during ${p.number('minHours')} or more of the day hours hides the views.`,
  },

  // Notes
  WIND_DIRECTION: {
    title: 'Wind direction',
    text: (p) => {
      const type = WIND_TYPES[String(p.raw('windType'))];
      return `The wind is [${type?.name ?? 'no data'}]: it comes from the ${p.compass('windDirection')} at ${p.kmh('windKmh')}, and the coast faces ${p.compass('coastDirection')}. ${type?.effect ?? ''}`.trim();
    },
    details: () => WIND_DIRECTION_DETAILS,
  },
  COAST_DIRECTION_UNCLEAR: {
    title: 'Coast direction',
    text: () =>
      'The [coast direction] is not clear. Thus, the wind direction does not change the score.',
    details: (p) =>
      `We find the coast direction from the terrain points around the town that are in the sea. This town has ${p.number('seaPoints')} of these points. This is not sufficient for 1 clear direction.`,
    more: 'data',
  },
  TERRAIN_UNAVAILABLE: {
    title: 'Terrain data',
    text: (p) =>
      p.raw('feature') === 'COAST_DIRECTION'
        ? 'The terrain data is not available. Thus, the wind direction does not change the score.'
        : 'The terrain data is not available. Thus, there is no note about the mountains near the town.',
  },
  MOUNTAIN_NOTE: {
    title: 'High terrain',
    text: (p) =>
      `The [terrain] around the town goes up to approximately ${p.m('terrainElevation')}. This is ${p.m('heightDifference')} above the town. The temperature there is approximately ${p.celsius('temperatureDifference')} lower.`,
    details: () =>
      'The forecast and the snow depth are for the area of the town. Ski slopes are usually higher, where it is colder and the snow can be deeper. Open-Meteo has no data about ski resorts, lifts or artificial snow.',
    more: 'data',
  },
  MOUNTAIN_CONDITIONS: {
    title: 'High terrain',
    text: (p) => {
      const snow =
        p.raw('snowAltitude') === null
          ? ''
          : ` Above approximately ${p.m('snowAltitude')}, the precipitation can be snow.`;
      return `On the high terrain: approximately ${p.celsius('terrainTemperature')}.${snow}`;
    },
  },
  SNOW_DEPTH_CORRECTED: {
    title: 'Snow depth check',
    text: (p) =>
      `The forecast snow depth (${p.m('forecastDepthM')}) increases more than the snowfall. The score uses ${p.m('usedDepthM')}. [Why?]`,
    details: () =>
      'The snow depth cannot increase more than the new snowfall. A sudden increase is usually a change in the forecast model, not new snow.',
    more: 'data',
  },
  UV_VERY_HIGH: {
    title: 'Very high UV',
    text: (p) =>
      `[Very high UV] (index ${p.number('uvIndex')}). Use sun protection.`,
    details: (p) =>
      `A UV index of ${p.number('minIndex')} or more can burn the skin in a short time. This note does not change the score.`,
  },
  DATA_MISSING: {
    title: 'Missing data',
    text: (p) =>
      `The forecast has no data for the ${keyTitle({ p, name: 'factor' })}. The other factors have more weight.`,
  },

  // Not applicable
  NO_SEA_NEARBY: {
    title: 'No sea nearby',
    text: () => 'There is no sea near this town.',
  },
  NO_SNOW: {
    title: 'No snow',
    text: (p) =>
      `The forecast has less than ${p.m('minDepthM')} of snow on all 7 days.`,
  },

  // Indoor
  TRAVEL_HINT: {
    title: 'Travel',
    text: (p) => {
      const raw = p.raw('conditions');
      const conditions = Array.isArray(raw)
        ? raw.map((c) => TRAVEL_CONDITIONS[String(c)] ?? String(c))
        : [];
      return `Travel can be difficult: ${joinWords(conditions)}.`;
    },
  },
  BUSY_HINT: {
    title: 'Busy',
    text: () =>
      '[Busy]: popular indoor places can have more people than usual.',
    details: (p) =>
      `Rain is probable (${p.percent('probability')}, ${p.mm('amountMm')}). On rainy days, museums have a few more visitors. The effect is small.`,
  },
  TOWN_SIZE_LARGE: {
    title: 'Town size',
    text: () => 'This is a large city. It has many indoor attractions.',
  },
  TOWN_SIZE_CITY: {
    title: 'Town size',
    text: () => 'This city usually has a good number of indoor attractions.',
  },
  TOWN_SIZE_TOWN: {
    title: 'Town size',
    text: () =>
      'This town has a small number of indoor attractions. Make sure that they are open before you make a plan for a full day.',
  },
  TOWN_SIZE_SMALL: {
    title: 'Town size',
    text: () =>
      'This is a small town. It can have very few indoor attractions. A larger town near this place can have more.',
  },
  TOWN_SIZE_NO_DATA: {
    title: 'Town size',
    text: () => '[Town size: no data].',
    details: () =>
      'Open-Meteo has no population data for this place. Thus, we cannot tell how many indoor attractions it has.',
    more: 'indoor',
  },

  // Weekly summary
  BEST_DAYS: {
    title: 'Best days',
    text: (p) => {
      const raw = p.raw('scores');
      const scores = Array.isArray(raw) ? raw : [];
      const days = p
        .dayNames()
        .map((day, i) =>
          scores[i] === undefined ? day : `${day} (${String(scores[i])})`,
        );
      return `The [best days] are ${joinWords(days)}.`;
    },
    details: () =>
      'The days with the highest scores. Ended days are not included.',
    more: 'weekly',
  },
  NO_GOOD_DAYS: {
    title: 'No good days',
    text: (p) => `No day has a score of ${p.number('minScore')} or more.`,
  },
  LOW_CONFIDENCE: {
    title: 'Confidence',
    text: (p) => `The forecast for ${p.days()} is less certain ([confidence]).`,
    details: () =>
      'A forecast for a day that is further away is less certain. Its card has a lighter color.',
    more: 'confidence',
  },
  TREND_UP: {
    title: 'Trend',
    text: (p) => trend({ p, direction: 'better' }),
  },
  TREND_DOWN: {
    title: 'Trend',
    text: (p) => trend({ p, direction: 'worse' }),
  },
  GATE_WARNING: {
    title: 'Warning',
    text: (p) => {
      const title = keyTitle({ p, name: 'gate' });
      const name = title.charAt(0).toUpperCase() + title.slice(1);
      return `[${name}] on ${p.days()}.`;
    },
    details: () =>
      'Some weather conditions set a maximum score for the day, for example a thunderstorm.',
    more: 'gates',
  },
  INDOOR_RECOMMENDED_DAYS: {
    title: 'Recommended days',
    text: (p) => `Indoor activities are recommended on ${p.days()}.`,
  },
  INDOOR_GOOD_ALTERNATIVE_DAYS: {
    title: 'Good alternative',
    text: (p) => `Indoor activities are a good alternative on ${p.days()}.`,
  },
  INDOOR_BUSY_DAYS: {
    title: 'Busy days',
    text: (p) => `Indoor places can be busy on ${p.days()}.`,
  },
  GOOD_OUTDOOR_WEEK: {
    title: 'Good outdoor week',
    text: () =>
      'The outdoor weather is good all week. Keep indoor visits for the evenings or for a rest day.',
  },
};

/** Terms that are not an ExplanationKey. */
export const TERMS = {
  ENDED: {
    title: 'Ended',
    details:
      'The activity hours of today have ended in the town. The day keeps its score and breakdown, but the weekly score and the best days do not use it.',
    more: 'ended',
  },
  CONFIDENCE: {
    title: 'Confidence',
    details:
      'A forecast for a day that is further away is less certain. Days 4–7 have a lighter color.',
    more: 'confidence',
  },
  INDOOR: {
    title: 'Indoor sightseeing',
    details:
      'The recommendation comes from the outdoor score of the same day. When the outdoor weather is bad, we recommend indoor activities. When it is good, we recommend that you keep the indoor visits for later.',
    more: 'indoor',
  },
} satisfies Record<
  string,
  { title: string; details: string; more: PanelSection }
>;
