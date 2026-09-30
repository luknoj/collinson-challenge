import { useEffect, useMemo, useState } from 'react';
import { placeLabel, type Place } from '../../geocoding/geocoding';
import styles from './PlaceHeader.module.css';

/** The local time changes each minute. A shorter interval keeps it correct. */
const CLOCK_INTERVAL_MS = 10_000;

export function PlaceHeader({ place }: { place: Place }) {
  const now = useNow(CLOCK_INTERVAL_MS);
  const format = useMemo(() => timeFormat(place.timezone), [place.timezone]);

  return (
    <header className={styles.header}>
      <h2 className={styles.name}>{placeLabel(place)}</h2>
      {format && (
        <p className={styles.time}>
          Local time: <time>{format.format(now)}</time>
        </p>
      )}
    </header>
  );
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "Tue 08:00" in the time zone of the town. null when the time zone is not known. */
function timeFormat(timeZone: string | null): Intl.DateTimeFormat | null {
  if (timeZone === null) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    // An unknown time zone gives a RangeError.
    return null;
  }
}
