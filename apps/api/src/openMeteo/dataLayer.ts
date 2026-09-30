import { setTimeout as wait } from 'node:timers/promises';
import { openMeteoConfig } from './config.js';
import { OpenMeteoError } from './errors.js';

export interface RequestContext {
  /** Aborts when the request is longer than the time limit. */
  signal: AbortSignal;
}

export interface LoadInput<T> {
  /** The API and the parameters. The same key gives the same data. */
  key: string;
  ttlMs: number;
  request: (context: RequestContext) => Promise<T>;
}

export interface DataLayer {
  load<T>(input: LoadInput<T>): Promise<T>;
}

export interface DataLayerOptions {
  retryDelaysMs?: readonly number[];
  timeoutMs?: number;
  /** The current time in ms. The tests use it to move the time. */
  now?: () => number;
}

interface Entry {
  promise: Promise<unknown>;
  /** null while the request is open. */
  expiresAt: number | null;
}

/**
 * architecture.md, section 4.1. Joined calls, a cache with a TTL, retries and
 * a time limit for each request. A failure is not kept in the cache.
 */
export function createDataLayer({
  retryDelaysMs = openMeteoConfig.retryDelaysMs,
  timeoutMs = openMeteoConfig.timeoutMs,
  now = Date.now,
}: DataLayerOptions = {}): DataLayer {
  const entries = new Map<string, Entry>();

  function load<T>({ key, ttlMs, request }: LoadInput<T>): Promise<T> {
    const cached = entries.get(key);
    if (
      cached !== undefined &&
      (cached.expiresAt === null || now() < cached.expiresAt)
    ) {
      return cached.promise as Promise<T>;
    }

    const entry: Entry = {
      promise: withRetries({ request, retryDelaysMs, timeoutMs }),
      expiresAt: null,
    };
    entries.set(key, entry);
    entry.promise.then(
      () => {
        entry.expiresAt = now() + ttlMs;
      },
      () => {
        // Do not remove a newer entry for the same key.
        if (entries.get(key) === entry) entries.delete(key);
      },
    );
    return entry.promise as Promise<T>;
  }

  return { load };
}

async function withRetries<T>({
  request,
  retryDelaysMs,
  timeoutMs,
}: {
  request: LoadInput<T>['request'];
  retryDelaysMs: readonly number[];
  timeoutMs: number;
}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request({ signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const delay = retryDelaysMs[attempt];
      const retryable = error instanceof OpenMeteoError && error.retryable;
      if (delay === undefined || !retryable) throw error;
      await wait(delay);
    }
  }
}
