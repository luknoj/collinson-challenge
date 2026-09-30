import type { DataLayer } from './openMeteo/dataLayer.js';

/** architecture.md, section 4.1: the time limit for each resolver. */
export const RESOLVER_TIME_LIMIT_MS = 10_000;

export interface Context {
  /** 1 data layer for all requests, so that the cache is shared. */
  dataLayer: DataLayer;
  /** The current UTC time. It sets which days have ended. */
  now: Date;
  /** The time limit for each activity field. */
  timeLimitMs: number;
}

export function createContext({
  dataLayer,
  now = new Date(),
  timeLimitMs = RESOLVER_TIME_LIMIT_MS,
}: {
  dataLayer: DataLayer;
  now?: Date;
  timeLimitMs?: number;
}): Context {
  return { dataLayer, now, timeLimitMs };
}
