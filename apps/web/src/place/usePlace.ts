import { useCallback, useEffect, useState } from 'react';
import { getPlace, GeocodingError, type Place } from '../geocoding/geocoding';
import {
  needsNameCorrection,
  readPlaceUrl,
  writePlaceUrl,
} from '../url/placeUrl';

export type PlaceState =
  /** No town. `searchText` comes from a URL with only `name`. */
  | { status: 'empty'; searchText: string }
  /** Geocoding /get is open (after a page reload). */
  | { status: 'loading' }
  | { status: 'ready'; place: Place }
  | { status: 'notFound' }
  /** Geocoding /get failed. "Try again" sends it again. */
  | { status: 'failed' };

interface GetRequest {
  id: number;
  /** The `name` in the URL, to correct it after the response. */
  urlName: string | null;
}

/**
 * The town on the screen. At the start, it comes from the URL (Geocoding
 * /get). After a selection, it comes from the suggestion, with no call.
 * architecture.md, sections 3 and 4.2.
 */
export function usePlace(): {
  state: PlaceState;
  select: (place: Place) => void;
  retry: () => void;
} {
  const [start] = useState(() => readPlaceUrl());
  const [request, setRequest] = useState<GetRequest | null>(() =>
    start.kind === 'place' ? { id: start.id, urlName: start.name } : null,
  );
  const [state, setState] = useState<PlaceState>(() => {
    switch (start.kind) {
      case 'place':
        return { status: 'loading' };
      case 'badPlace':
        return { status: 'notFound' };
      case 'name':
        return { status: 'empty', searchText: start.name };
      case 'empty':
        return { status: 'empty', searchText: '' };
    }
  });

  useEffect(() => {
    if (request === null) return;
    const controller = new AbortController();
    getPlace({ id: request.id, signal: controller.signal }).then(
      (place) => {
        if (controller.signal.aborted) return;
        if (
          needsNameCorrection({ urlName: request.urlName, name: place.name })
        ) {
          writePlaceUrl({ id: place.id, name: place.name, mode: 'replace' });
        }
        setState({ status: 'ready', place });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const notFound =
          error instanceof GeocodingError && error.reason === 'NOT_FOUND';
        setState({ status: notFound ? 'notFound' : 'failed' });
      },
    );
    // A selection or "Try again" cancels this request.
    return () => controller.abort();
  }, [request]);

  const select = useCallback((place: Place) => {
    setRequest(null);
    writePlaceUrl({ id: place.id, name: place.name, mode: 'push' });
    setState({ status: 'ready', place });
  }, []);

  const retry = useCallback(() => {
    // A new object starts the request again.
    setRequest((current) => (current ? { ...current } : null));
    setState({ status: 'loading' });
  }, []);

  return { state, select, retry };
}
