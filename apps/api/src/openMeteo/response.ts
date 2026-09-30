import type { Series } from '../scoring/weather.js';
import { OpenMeteoError, type OpenMeteoApi } from './errors.js';

type Block = Record<string, unknown>;

/** Sends a GET request. Changes each failure to an OpenMeteoError. */
export async function fetchJson({
  api,
  url,
  signal,
}: {
  api: OpenMeteoApi;
  url: URL;
  signal: AbortSignal;
}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    throw requestError({ api, signal, error });
  }

  if (!response.ok) {
    // Open-Meteo gives the cause in the body: {"error":true,"reason":"…"}.
    const body: unknown = await response.json().catch(() => null);
    const detail =
      isBlock(body) && typeof body.reason === 'string'
        ? `, ${body.reason}`
        : '';
    throw new OpenMeteoError({
      api,
      reason: 'HTTP',
      status: response.status,
      message: `HTTP ${response.status}${detail}`,
    });
  }

  try {
    return await response.json();
  } catch (error) {
    if (signal.aborted) throw requestError({ api, signal, error });
    throw new OpenMeteoError({
      api,
      reason: 'INVALID_RESPONSE',
      message: 'the body is not JSON',
      cause: error,
    });
  }
}

function requestError({
  api,
  signal,
  error,
}: {
  api: OpenMeteoApi;
  signal: AbortSignal;
  error: unknown;
}): OpenMeteoError {
  if (signal.aborted) {
    return new OpenMeteoError({
      api,
      reason: 'TIMEOUT',
      message: 'the request did not end in the time limit',
      cause: error,
    });
  }
  return new OpenMeteoError({
    api,
    reason: 'NETWORK',
    message: 'the request failed',
    cause: error,
  });
}

function isBlock(value: unknown): value is Block {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks the shape of a response. Each function throws an OpenMeteoError with
 * the reason INVALID_RESPONSE when the shape is not correct.
 */
export function responseReader(api: OpenMeteoApi) {
  const invalid = (message: string) =>
    new OpenMeteoError({ api, reason: 'INVALID_RESPONSE', message });

  function block({ value, name }: { value: unknown; name: string }): Block {
    if (!isBlock(value)) throw invalid(`"${name}" is not an object`);
    return value;
  }

  function number({ value, name }: { value: unknown; name: string }): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalid(`"${name}" is not a number`);
    }
    return value;
  }

  function array({
    source,
    name,
    length,
  }: {
    source: Block;
    name: string;
    length?: number;
  }): unknown[] {
    const value = source[name];
    if (!Array.isArray(value)) throw invalid(`"${name}" is not an array`);
    if (length !== undefined && value.length !== length) {
      throw invalid(`"${name}" has ${value.length} values, not ${length}`);
    }
    return value;
  }

  /** Time stamps. No value can be null. */
  function times({ source, name }: { source: Block; name: string }): string[] {
    return array({ source, name }).map((v) => {
      if (typeof v !== 'string') throw invalid(`"${name}" has a bad value`);
      return v;
    });
  }

  /** Numbers or null. */
  function series({
    source,
    name,
    length,
  }: {
    source: Block;
    name: string;
    length: number;
  }): Series {
    return array({ source, name, length }).map((v) => {
      if (v === null || (typeof v === 'number' && Number.isFinite(v))) return v;
      throw invalid(`"${name}" has a bad value`);
    });
  }

  /** Strings or null (for example, sunrise near the poles). */
  function strings({
    source,
    name,
    length,
  }: {
    source: Block;
    name: string;
    length: number;
  }): (string | null)[] {
    return array({ source, name, length }).map((v) => {
      if (v === null || typeof v === 'string') return v;
      throw invalid(`"${name}" has a bad value`);
    });
  }

  /** Many series. `names` gives the Open-Meteo name of each key. */
  function seriesGroup<K extends string>({
    names,
    source,
    length,
  }: {
    names: Record<K, string>;
    source: Block;
    length: number;
  }): Record<K, Series> {
    const result = {} as Record<K, Series>;
    for (const key of Object.keys(names) as K[]) {
      result[key] = series({ source, name: names[key], length });
    }
    return result;
  }

  return { block, number, array, times, series, seriesGroup, strings };
}
