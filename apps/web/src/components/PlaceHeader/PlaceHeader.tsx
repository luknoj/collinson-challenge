import { useMemo } from 'react';
import { placeLabel, type Place } from '../../geocoding/geocoding';
import { formatLocalTime } from '../../utils/time';
import { HowScoresWorkButton } from '../HowScoresWork/HowScoresWork';
import styles from './PlaceHeader.module.css';

export function PlaceHeader({ place }: { place: Place }) {
  // The time when the town shows. It does not change after that.
  const time = useMemo(
    () => formatLocalTime({ date: new Date(), timeZone: place.timezone }),
    [place],
  );

  return (
    <header className={styles.header}>
      <h2 className={styles.name}>{placeLabel(place)}</h2>
      <div className={styles.side}>
        {time && (
          <p className={styles.time}>
            Local time: <time>{time}</time>
          </p>
        )}
        <HowScoresWorkButton />
      </div>
    </header>
  );
}
