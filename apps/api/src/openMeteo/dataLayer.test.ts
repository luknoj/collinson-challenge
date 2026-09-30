import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { openMeteoConfig } from './config.js';
import { createDataLayer, type DataLayerOptions } from './dataLayer.js';
import { OpenMeteoError } from './errors.js';
import { getForecast } from './forecast.js';
import { forecastBody, URLS, useMockServer } from './testing/mockServer.js';

const server = useMockServer();

const LOCATION = { latitude: 50.06, longitude: 19.94, elevation: 219 };
/** Short waits, so that the tests are fast. */
const FAST: DataLayerOptions = { retryDelaysMs: [1, 1], timeoutMs: 1000 };

/**
 * The Forecast API gives the responses in the list, 1 for each request. The
 * last response is used again. Returns the number of requests.
 */
function mockForecast(responses: (() => Response | Promise<Response>)[]) {
  const calls = { count: 0 };
  server.use(
    http.get(URLS.forecast, () => {
      const response = responses[Math.min(calls.count, responses.length - 1)];
      calls.count++;
      return response?.();
    }),
  );
  return calls;
}

const ok = () => HttpResponse.json(forecastBody());
const serverError = () =>
  HttpResponse.json({ error: true, reason: 'Busy' }, { status: 503 });

async function failure(promise: Promise<unknown>): Promise<OpenMeteoError> {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof OpenMeteoError)) {
    throw new Error('Expected an OpenMeteoError.');
  }
  return error;
}

describe('joined calls', () => {
  it('sends 1 request for 2 calls at the same time', async () => {
    const calls = mockForecast([ok]);
    const dataLayer = createDataLayer(FAST);

    const [a, b] = await Promise.all([
      getForecast({ dataLayer, location: LOCATION }),
      getForecast({ dataLayer, location: LOCATION }),
    ]);

    expect(calls.count).toBe(1);
    expect(a).toBe(b);
  });

  it('sends 1 request for each different location', async () => {
    const calls = mockForecast([ok]);
    const dataLayer = createDataLayer(FAST);

    await Promise.all([
      getForecast({ dataLayer, location: LOCATION }),
      getForecast({ dataLayer, location: { ...LOCATION, latitude: 51 } }),
    ]);

    expect(calls.count).toBe(2);
  });
});

describe('cache', () => {
  it('keeps a result until the TTL ends', async () => {
    const calls = mockForecast([ok]);
    let now = 0;
    const dataLayer = createDataLayer({ ...FAST, now: () => now });

    await getForecast({ dataLayer, location: LOCATION });
    now += openMeteoConfig.ttlMs.forecast - 1;
    await getForecast({ dataLayer, location: LOCATION });
    expect(calls.count).toBe(1);

    now += 1;
    await getForecast({ dataLayer, location: LOCATION });
    expect(calls.count).toBe(2);
  });

  it('does not keep a failure: the next call sends a new request', async () => {
    const calls = mockForecast([serverError, serverError, serverError, ok]);
    const dataLayer = createDataLayer(FAST);

    await expect(
      getForecast({ dataLayer, location: LOCATION }),
    ).rejects.toThrow(OpenMeteoError);
    expect(calls.count).toBe(3);

    await expect(
      getForecast({ dataLayer, location: LOCATION }),
    ).resolves.toMatchObject({ utcOffsetSeconds: 3600 });
    expect(calls.count).toBe(4);
  });
});

describe('retries', () => {
  it('tries again after a server failure', async () => {
    const calls = mockForecast([serverError, ok]);
    const dataLayer = createDataLayer(FAST);

    await expect(
      getForecast({ dataLayer, location: LOCATION }),
    ).resolves.toMatchObject({ utcOffsetSeconds: 3600 });
    expect(calls.count).toBe(2);
  });

  it('tries again after a network failure', async () => {
    const calls = mockForecast([() => HttpResponse.error(), ok]);
    const dataLayer = createDataLayer(FAST);

    await getForecast({ dataLayer, location: LOCATION });
    expect(calls.count).toBe(2);
  });

  it('stops after 2 retries and gives the last error', async () => {
    const calls = mockForecast([serverError]);
    const dataLayer = createDataLayer(FAST);

    const error = await failure(getForecast({ dataLayer, location: LOCATION }));

    expect(calls.count).toBe(3);
    expect(error).toMatchObject({
      api: 'forecast',
      reason: 'HTTP',
      status: 503,
    });
    expect(error.message).toBe('forecast: HTTP 503, Busy');
  });

  it('waits 300 ms and 900 ms by default', () => {
    expect(openMeteoConfig.retryDelaysMs).toEqual([300, 900]);
  });

  it.each([400, 404])('does not try again after HTTP %i', async (status) => {
    const calls = mockForecast([
      () => HttpResponse.json({ error: true }, { status }),
    ]);
    const dataLayer = createDataLayer(FAST);

    const error = await failure(getForecast({ dataLayer, location: LOCATION }));

    expect(calls.count).toBe(1);
    expect(error).toMatchObject({ reason: 'HTTP', status });
  });

  it('does not try again after an incorrect response', async () => {
    const calls = mockForecast([() => HttpResponse.json({ hourly: 'none' })]);
    const dataLayer = createDataLayer(FAST);

    const error = await failure(getForecast({ dataLayer, location: LOCATION }));

    expect(calls.count).toBe(1);
    expect(error.reason).toBe('INVALID_RESPONSE');
  });
});

describe('time limit', () => {
  it('stops a slow request at the time limit', async () => {
    const calls = mockForecast([
      async () => {
        await delay(5000);
        return ok();
      },
    ]);
    const dataLayer = createDataLayer({ retryDelaysMs: [], timeoutMs: 50 });

    const start = performance.now();
    const error = await failure(getForecast({ dataLayer, location: LOCATION }));

    expect(error.reason).toBe('TIMEOUT');
    expect(performance.now() - start).toBeLessThan(1000);
    expect(calls.count).toBe(1);
  });

  it('tries again after a time-out', async () => {
    const calls = mockForecast([
      async () => {
        await delay(5000);
        return ok();
      },
      ok,
    ]);
    const dataLayer = createDataLayer({ retryDelaysMs: [1], timeoutMs: 50 });

    await getForecast({ dataLayer, location: LOCATION });
    expect(calls.count).toBe(2);
  });

  it('uses 8 s by default', () => {
    expect(openMeteoConfig.timeoutMs).toBe(8000);
  });
});
