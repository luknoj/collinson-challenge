// Reads the `params` of an explanation for the text templates. Each unit has
// its own function. A missing value gives "no data".

import { formatNumber } from '../utils/number';
import { formatDayName } from '../utils/time';

export type Params = Record<string, unknown> | null;

export interface ParamReader {
  raw(name: string): unknown;
  /** A number with no unit ("12.3"). */
  number(name: string): string;
  mm(name: string): string;
  cm(name: string): string;
  m(name: string): string;
  km(name: string): string;
  kmh(name: string): string;
  celsius(name: string): string;
  seconds(name: string): string;
  /** A value from 0 to 100 ("90%"). */
  percent(name: string): string;
  /** A value from 0 to 1 ("0.62" → "62%"). */
  share(name: string): string;
  /** A direction in degrees ("270" → "west"). */
  compass(name: string): string;
  /** An hour of the day ("9" → "09:00"). */
  hour(name: string): string;
  /** The dates of the explanation ("Wed, Thu and Sat"). */
  days(): string;
  /** The day names of the explanation, 1 for each date. */
  dayNames(): string[];
}

const NO_DATA = 'no data';

const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

/** ["a", "b", "c"] → "a, b and c". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

export function paramReader({
  params,
  days,
}: {
  params: Params;
  days?: readonly string[] | null;
}): ParamReader {
  const raw = (name: string): unknown => params?.[name] ?? null;
  const numeric = (name: string): number | null => {
    const value = raw(name);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const withUnit = (unit: string) => (name: string) => {
    const value = numeric(name);
    return value === null ? NO_DATA : `${formatNumber(value)}${unit}`;
  };
  const dayNames = () => (days ?? []).map((date) => formatDayName(date));

  return {
    raw,
    number: withUnit(''),
    mm: withUnit(' mm'),
    cm: withUnit(' cm'),
    m: withUnit(' m'),
    km: withUnit(' km'),
    kmh: withUnit(' km/h'),
    celsius: withUnit(' °C'),
    seconds: withUnit(' s'),
    percent: withUnit('%'),
    share: (name) => {
      const value = numeric(name);
      return value === null ? NO_DATA : `${Math.round(value * 100)}%`;
    },
    compass: (name) => {
      const value = numeric(name);
      if (value === null) return NO_DATA;
      const index = Math.round((((value % 360) + 360) % 360) / 45) % 8;
      return COMPASS[index] ?? NO_DATA;
    },
    hour: (name) => {
      const value = numeric(name);
      return value === null ? NO_DATA : `${String(value).padStart(2, '0')}:00`;
    },
    days: () => joinWords(dayNames()),
    dayNames,
  };
}
