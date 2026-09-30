import type { Forecast, Series } from '../weather.js';

/** Adds days to a date (YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The local time of the town: "YYYY-MM-DDTHH:mm". */
export function localNow(now: Date, utcOffsetSeconds: number): string {
  return new Date(now.getTime() + utcOffsetSeconds * 1000)
    .toISOString()
    .slice(0, 16);
}

/** "YYYY-MM-DDTHH:00" */
export function at(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:00`;
}

/** The 7 forecast days, from today in the town. */
export function forecastDates(
  forecast: Forecast,
  now: Date,
  count: number,
): string[] {
  const today = localNow(now, forecast.utcOffsetSeconds).slice(0, 10);
  return forecast.daily.date.filter((d) => d >= today).slice(0, count);
}

export interface TimeWindow {
  /** "YYYY-MM-DDTHH:mm" */
  start: string;
  /** "YYYY-MM-DDTHH:mm" */
  end: string;
}

/**
 * - `instant`: values for the time stamp. Uses start ≤ t < end.
 * - `amount`: values for the hour before the time stamp. Uses start < t ≤ end.
 */
export type ValueKind = 'instant' | 'amount';

export function windowIndices(
  times: readonly string[],
  window: TimeWindow,
  kind: ValueKind,
): number[] {
  const result: number[] = [];
  times.forEach((t, i) => {
    const inside =
      kind === 'instant'
        ? t >= window.start && t < window.end
        : t > window.start && t <= window.end;
    if (inside) result.push(i);
  });
  return result;
}

/** The values at the indices, without null values. */
export function pick(series: Series, indices: readonly number[]): number[] {
  const result: number[] = [];
  for (const i of indices) {
    const v = series[i];
    if (v !== null && v !== undefined) result.push(v);
  }
  return result;
}

export function valueAt(series: Series, index: number): number | null {
  if (index < 0) return null;
  return series[index] ?? null;
}

export function sum(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

export function mean(values: readonly number[]): number | null {
  const s = sum(values);
  return s === null ? null : s / values.length;
}

export function max(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

export function min(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

/** Linear percentile (p from 0 to 100). */
export function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error('No values.');
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const lowValue = sorted[low]!;
  const highValue = sorted[high]!;
  return lowValue + (rank - low) * (highValue - lowValue);
}

export interface CircularMean {
  /** degrees, 0–360 */
  direction: number;
  /** 0 (no clear direction) to 1 (all the same direction) */
  strength: number;
}

export function circularMean(degrees: readonly number[]): CircularMean | null {
  if (degrees.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const d of degrees) {
    const r = (d * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  x /= degrees.length;
  y /= degrees.length;
  const direction = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { direction, strength: Math.hypot(x, y) };
}

/** The smallest angle between 2 directions (0–180 degrees). */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** Negative decimals round to tens (−1), hundreds (−2) and so on. */
export function round(value: number, decimals = 0): number {
  if (decimals < 0) {
    const step = 10 ** -decimals;
    return Math.round(value / step) * step;
  }
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
