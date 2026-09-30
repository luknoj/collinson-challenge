import { delay, http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { createContext } from '../context.js';
import type { Activities } from '../generated/graphql.js';
import { createDataLayer } from '../openMeteo/dataLayer.js';
import {
  toElevationBody,
  toForecastBody,
  toMarineBody,
} from '../openMeteo/testing/bodies.js';
import { URLS, useMockServer } from '../openMeteo/testing/mockServer.js';
import {
  buildForecast,
  buildMarine,
  NO_MARINE,
  NOW,
  terrain,
  WEST_COAST,
} from '../scoring/testing/fixtures.js';
import { createServer } from '../server.js';

const server = useMockServer();

const LOCATION = {
  id: '2641589',
  latitude: 50.415,
  longitude: -5.073,
  elevation: 30,
  population: 20000,
  featureCode: 'PPL',
};

const SNOWY = buildForecast({
  hour: () => ({ snowDepth: 1, temperature: -5, apparentTemperature: -8 }),
});

type Reply = () => Response | Promise<Response>;

const json =
  (body: JsonBodyType): Reply =>
  () =>
    HttpResponse.json(body);
const serverError: Reply = () =>
  HttpResponse.json({ error: true }, { status: 500 });

/** Mocks the 3 APIs. Returns the number of requests to each API. */
function mockOpenMeteo({
  forecast = json(toForecastBody(buildForecast())),
  marine = json(toMarineBody(buildMarine())),
  elevation = json(toElevationBody(terrain({ ring: WEST_COAST }))),
}: { forecast?: Reply; marine?: Reply; elevation?: Reply } = {}) {
  const calls = { forecast: 0, marine: 0, elevation: 0 };
  server.use(
    http.get(URLS.forecast, () => (calls.forecast++, forecast())),
    http.get(URLS.marine, () => (calls.marine++, marine())),
    http.get(URLS.elevation, () => (calls.elevation++, elevation())),
  );
  return calls;
}

type Field = 'skiing' | 'surfing' | 'outdoor' | 'indoor';

const RESULT_FIELDS = `
  status
  weeklyScore
  notApplicableReason { key params }
  notes { key params }
  days { date score ended factors { key params } }
`;
const INDOOR_FIELDS = `
  recommendedDays
  townSize { key params }
  days { date level ended outdoorScore }
`;

/** 1 query for 1 row, the same as the frontend (architecture.md, section 3). */
function rowQuery(field: Field): string {
  const fields = field === 'indoor' ? INDOOR_FIELDS : RESULT_FIELDS;
  return `query Row($location: LocationInput!) {
    activities(location: $location) { id ${field} { ${fields} } }
  }`;
}

interface Result {
  data: { activities: Activities } | null | undefined;
  errors: readonly { message: string; extensions?: Record<string, unknown> }[];
}

function newContext(options: { now?: Date; timeLimitMs?: number } = {}) {
  return createContext({
    dataLayer: createDataLayer({ retryDelaysMs: [] }),
    now: NOW,
    ...options,
  });
}

async function query({
  field,
  location = LOCATION,
  context = newContext(),
}: {
  field: Field;
  location?: Record<string, unknown>;
  context?: ReturnType<typeof newContext>;
}): Promise<Result> {
  const response = await createServer().executeOperation(
    { query: rowQuery(field), variables: { location } },
    { contextValue: context },
  );
  if (response.body.kind !== 'single') throw new Error('Expected 1 result.');
  const { data, errors } = response.body.singleResult;
  return { data: data as Result['data'], errors: errors ?? [] };
}

/** The 4 row queries at the same time, with 1 shared data layer. */
async function allRows(context = newContext()) {
  const [skiing, surfing, outdoor, indoor] = await Promise.all(
    (['skiing', 'surfing', 'outdoor', 'indoor'] as const).map((field) =>
      query({ field, context }),
    ),
  );
  return { skiing, surfing, outdoor, indoor } as Record<Field, Result>;
}

const codes = (result: Result) => result.errors.map((e) => e.extensions?.code);

describe('activities', () => {
  it('returns 4 results for a town near the sea', async () => {
    mockOpenMeteo({ forecast: json(toForecastBody(SNOWY)) });

    const rows = await allRows();

    for (const row of Object.values(rows)) expect(row.errors).toEqual([]);
    expect(rows.skiing.data?.activities.id).toBe(LOCATION.id);
    expect(rows.skiing.data?.activities.skiing.status).toBe('OK');
    expect(rows.surfing.data?.activities.surfing.status).toBe('OK');
    expect(rows.outdoor.data?.activities.outdoor.status).toBe('OK');
    expect(rows.outdoor.data?.activities.outdoor.days).toHaveLength(7);
    expect(rows.indoor.data?.activities.indoor.days).toHaveLength(7);
    expect(rows.indoor.data?.activities.indoor.townSize.key).toBe(
      'TOWN_SIZE_TOWN',
    );
  });

  it('sends 1 request to each API for the 4 rows (joined calls)', async () => {
    const calls = mockOpenMeteo();

    await allRows();

    expect(calls).toEqual({ forecast: 1, marine: 1, elevation: 1 });
  });

  it('returns NOT_APPLICABLE for surfing far from the sea', async () => {
    mockOpenMeteo({ marine: json(toMarineBody(NO_MARINE)) });

    const result = await query({ field: 'surfing' });

    expect(result.errors).toEqual([]);
    expect(result.data?.activities.surfing).toMatchObject({
      status: 'NOT_APPLICABLE',
      weeklyScore: null,
      notApplicableReason: { key: 'NO_SEA_NEARBY', params: null },
      days: [],
    });
  });

  it('sends the params of the factors as JSON', async () => {
    mockOpenMeteo();

    const result = await query({ field: 'outdoor' });

    const factors = result.data?.activities.outdoor.days[0]?.factors;
    // The default test data has no rain.
    expect(factors).toContainEqual({
      key: 'PRECIPITATION',
      params: { probability: 0, amountMm: 0 },
    });
  });

  it('marks today as ended after the activity window', async () => {
    mockOpenMeteo();
    // 19:30 local time (UTC+1): after 18:00.
    const context = newContext({ now: new Date('2026-01-12T18:30:00Z') });

    const result = await query({ field: 'outdoor', context });

    const days = result.data?.activities.outdoor.days as { ended: boolean }[];
    expect(days.map((d) => d.ended)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('failures', () => {
  it('gives an error only on surfing when Marine fails', async () => {
    mockOpenMeteo({ marine: serverError });

    const rows = await allRows();

    expect(codes(rows.surfing)).toEqual(['UPSTREAM_UNAVAILABLE']);
    expect(rows.surfing.errors[0]?.extensions).toMatchObject({
      api: 'marine',
      reason: 'HTTP',
    });
    expect(rows.skiing.errors).toEqual([]);
    expect(rows.outdoor.errors).toEqual([]);
    expect(rows.indoor.errors).toEqual([]);
  });

  it('gives an error on all 4 rows when Forecast fails', async () => {
    mockOpenMeteo({ forecast: serverError });

    const rows = await allRows();

    for (const row of Object.values(rows)) {
      expect(codes(row)).toEqual(['UPSTREAM_UNAVAILABLE']);
      expect(row.data).toBeNull();
    }
  });

  it('gives a note and no error when Elevation fails', async () => {
    mockOpenMeteo({
      forecast: json(toForecastBody(SNOWY)),
      elevation: serverError,
    });

    const rows = await allRows();

    expect(rows.skiing.errors).toEqual([]);
    expect(rows.surfing.errors).toEqual([]);
    expect(rows.skiing.data?.activities.skiing.notes).toContainEqual({
      key: 'TERRAIN_UNAVAILABLE',
      params: { feature: 'MOUNTAIN_NOTE' },
    });
    expect(rows.surfing.data?.activities.surfing.notes).toContainEqual({
      key: 'TERRAIN_UNAVAILABLE',
      params: { feature: 'COAST_DIRECTION' },
    });
  });

  it('stops a field after the time limit', async () => {
    mockOpenMeteo({
      forecast: async () => {
        await delay(5000);
        return HttpResponse.json(toForecastBody(buildForecast()));
      },
    });
    const context = newContext({ timeLimitMs: 50 });

    const start = performance.now();
    const result = await query({ field: 'outdoor', context });

    expect(performance.now() - start).toBeLessThan(1000);
    expect(codes(result)).toEqual(['UPSTREAM_UNAVAILABLE']);
    expect(result.errors[0]?.extensions).toMatchObject({
      reason: 'TIME_LIMIT',
    });
  });

  it('uses a time limit of 10 s by default', () => {
    expect(newContext({ timeLimitMs: undefined }).timeLimitMs).toBe(10_000);
  });
});

describe('location input', () => {
  it.each([
    ['latitude', { latitude: 91 }],
    ['latitude', { latitude: -90.5 }],
    ['longitude', { longitude: 181 }],
    ['elevation', { elevation: 9001 }],
    ['elevation', { elevation: -501 }],
    ['population', { population: -1 }],
    ['id', { id: ' ' }],
  ])('gives BAD_USER_INPUT for an incorrect %s', async (field, change) => {
    const calls = mockOpenMeteo();

    const result = await query({
      field: 'outdoor',
      location: { ...LOCATION, ...change },
    });

    expect(codes(result)).toEqual(['BAD_USER_INPUT']);
    expect(result.errors[0]?.extensions?.fields).toEqual([field]);
    expect(calls).toEqual({ forecast: 0, marine: 0, elevation: 0 });
  });

  it('accepts a location without the optional values', async () => {
    mockOpenMeteo();

    const result = await query({
      field: 'indoor',
      location: { id: '1', latitude: 0, longitude: 0 },
    });

    expect(result.errors).toEqual([]);
    expect(result.data?.activities.indoor.townSize.key).toBe(
      'TOWN_SIZE_NO_DATA',
    );
  });
});
