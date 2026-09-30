import { useState } from 'react';
import type { Place } from '../../geocoding/geocoding';
import { ActivityRow } from '../ActivityRow/ActivityRow';
import { IndoorRow } from '../IndoorRow/IndoorRow';
import { RowPlaceholder } from '../Row/Row';
import styles from './ActivityRows.module.css';
import { useRowQueries } from './useRowQueries';

type RowName = 'skiing' | 'surfing' | 'outdoor' | 'indoor';

const ACTIVITY_ROWS = [
  { name: 'skiing', title: 'Skiing' },
  { name: 'surfing', title: 'Surfing' },
  { name: 'outdoor', title: 'Outdoor sightseeing' },
] as const;

const rowId = (name: RowName) => `row-${name}`;

/**
 * The 4 rows. They show at the same time, when all 4 queries settle
 * (ui-spec.md, section 1). Use a new instance for each town (a `key`), so
 * that the selected days clear.
 */
export function ActivityRows({ place }: { place: Place }) {
  const queries = useRowQueries(place);
  const [selected, setSelected] = useState<Record<RowName, string | null>>({
    skiing: null,
    surfing: null,
    outdoor: null,
    indoor: null,
  });

  const select = ({ row, date }: { row: RowName; date: string | null }) =>
    setSelected((current) => ({ ...current, [row]: date }));

  if (queries.waiting) {
    return (
      <div className={styles.rows} aria-busy="true">
        {ACTIVITY_ROWS.map(({ name }) => (
          <RowPlaceholder key={name} />
        ))}
        <RowPlaceholder />
      </div>
    );
  }

  const showOutdoorDay = (date: string) => {
    select({ row: 'outdoor', date });
    document
      .getElementById(rowId('outdoor'))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.rows}>
      {ACTIVITY_ROWS.map(({ name, title }) => (
        <ActivityRow
          key={name}
          id={rowId(name)}
          title={title}
          placeName={place.name}
          query={queries[name]}
          selectedDate={selected[name]}
          onSelectDate={(date) => select({ row: name, date })}
        />
      ))}
      <IndoorRow
        id={rowId('indoor')}
        query={queries.indoor}
        outdoorDays={queries.outdoor.data?.days ?? []}
        selectedDate={selected.indoor}
        onSelectDate={(date) => select({ row: 'indoor', date })}
        onShowOutdoorDay={showOutdoorDay}
      />
    </div>
  );
}
