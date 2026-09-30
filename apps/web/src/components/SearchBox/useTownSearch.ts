import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPlaces, type Place } from '../../geocoding/geocoding';

/** ui-spec.md, section 2. */
const MIN_LENGTH = 2;
const DELAY_MS = 300;

export type SearchStatus =
  /** The text is shorter than 2 characters. */
  | 'idle'
  /** The 300 ms delay or the request is open. */
  | 'searching'
  | 'done'
  | 'failed';

export interface TownSearch {
  results: Place[];
  status: SearchStatus;
  /** Starts a new search after the delay. It cancels the search before it. */
  search: (text: string) => void;
}

export function useTownSearch(): TownSearch {
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const timer = useRef<number | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    controller.current?.abort();
    controller.current = null;
  }, []);

  const search = useCallback(
    (text: string) => {
      cancel();
      const trimmed = text.trim();
      if (trimmed.length < MIN_LENGTH) {
        setResults([]);
        setStatus('idle');
        return;
      }

      setStatus('searching');
      timer.current = window.setTimeout(() => {
        const current = new AbortController();
        controller.current = current;
        searchPlaces({ text: trimmed, signal: current.signal }).then(
          (places) => {
            if (current.signal.aborted) return;
            setResults(places);
            setStatus('done');
          },
          () => {
            if (current.signal.aborted) return;
            setResults([]);
            setStatus('failed');
          },
        );
      }, DELAY_MS);
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);

  return { results, status, search };
}
