// Direct calls to Open-Meteo Geocoding. The API allows calls from a browser.
// Open-Meteo does not send empty fields. A missing field becomes null here.

const BASE_URL = 'https://geocoding-api.open-meteo.com/v1';

/** ui-spec.md, section 2. */
const SEARCH_COUNT = 10;
const LANGUAGE = 'en';

export interface Place {
  /** The Geocoding id. The URL uses it (?place=<id>). */
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  /** m */
  elevation: number | null;
  /** For example, PPLC for a capital. */
  featureCode: string | null;
  /** The region (for example, a state or a province). */
  admin1: string | null;
  country: string | null;
  /** IANA time zone, for example "Europe/Paris". */
  timezone: string | null;
  population: number | null;
}

export type GeocodingErrorReason =
  /** /get: the id is not known (HTTP 400, "Location ID not found"). */
  | 'NOT_FOUND'
  /** The request did not get a response. */
  | 'NETWORK'
  /** Another HTTP status that is not 2xx. */
  | 'HTTP'
  /** The response does not have the expected shape. */
  | 'INVALID_RESPONSE';

export class GeocodingError extends Error {
  readonly reason: GeocodingErrorReason;
  readonly status: number | null;

  constructor({
    reason,
    message,
    status = null,
  }: {
    reason: GeocodingErrorReason;
    message: string;
    status?: number | null;
  }) {
    super(`geocoding: ${message}`);
    this.name = 'GeocodingError';
    this.reason = reason;
    this.status = status;
  }
}

/** The towns that match the text. An empty list when there is no match. */
export async function searchPlaces({
  text,
  signal,
}: {
  text: string;
  signal?: AbortSignal;
}): Promise<Place[]> {
  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set('name', text);
  url.searchParams.set('count', String(SEARCH_COUNT));
  url.searchParams.set('language', LANGUAGE);
  url.searchParams.set('format', 'json');

  const body = await getJson({ url, signal });
  // Open-Meteo does not send "results" when there is no match.
  if (!isRecord(body)) throw invalid('the response is not an object');
  if (body.results === undefined) return [];
  if (!Array.isArray(body.results)) throw invalid('"results" is not an array');
  return body.results.map(toPlace);
}

/** 1 town from its id. Throws a GeocodingError with NOT_FOUND for an unknown id. */
export async function getPlace({
  id,
  signal,
}: {
  id: number;
  signal?: AbortSignal;
}): Promise<Place> {
  const url = new URL(`${BASE_URL}/get`);
  url.searchParams.set('id', String(id));
  url.searchParams.set('language', LANGUAGE);
  url.searchParams.set('format', 'json');
  return toPlace(await getJson({ url, signal }));
}

async function getJson({
  url,
  signal,
}: {
  url: URL;
  signal?: AbortSignal;
}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    // Let the caller see a cancelled request as an AbortError.
    if (signal?.aborted) throw error;
    throw new GeocodingError({ reason: 'NETWORK', message: 'no response' });
  }

  if (!response.ok) {
    // Open-Meteo gives the cause in the body: {"error":true,"reason":"…"}.
    const body: unknown = await response.json().catch(() => null);
    const detail =
      isRecord(body) && typeof body.reason === 'string' ? body.reason : '';
    const notFound =
      response.status === 400 && detail.startsWith('Location ID not found');
    throw new GeocodingError({
      reason: notFound ? 'NOT_FOUND' : 'HTTP',
      status: response.status,
      message: `HTTP ${response.status}${detail ? `, ${detail}` : ''}`,
    });
  }

  try {
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw invalid('the body is not JSON');
  }
}

function toPlace(value: unknown): Place {
  if (!isRecord(value)) throw invalid('a place is not an object');
  const { id, name, latitude, longitude } = value;
  if (
    typeof id !== 'number' ||
    typeof name !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number'
  ) {
    throw invalid('a place has no id, name or coordinates');
  }
  return {
    id,
    name,
    latitude,
    longitude,
    elevation: optionalNumber(value.elevation),
    featureCode: optionalString(value.feature_code),
    admin1: optionalString(value.admin1),
    country: optionalString(value.country),
    timezone: optionalString(value.timezone),
    population: optionalNumber(value.population),
  };
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): GeocodingError {
  return new GeocodingError({ reason: 'INVALID_RESPONSE', message });
}

/** "Paris, Île-de-France Region, France". Parts that are missing or the same as the name are not shown. */
export function placeLabel(place: Place): string {
  return [place.name, place.admin1, place.country]
    .filter((part, i, parts) => part !== null && parts.indexOf(part) === i)
    .join(', ');
}
