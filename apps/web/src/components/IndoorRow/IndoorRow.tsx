import type {
  DayScoreFieldsFragment,
  IndoorLevel,
} from '../../generated/graphql';
import { explanationText, LEVELS } from '../../text/simpleText';
import { formatDayName } from '../../utils/time';
import type { IndoorQuery } from '../ActivityRows/useRowQueries';
import { indoorCardColors } from '../DayCard/cardColors';
import { DayCard, DayCardList } from '../DayCard/DayCard';
import { ExplanationList } from '../Explanation/ExplanationList';
import { Row, RowBadge, RowFailure, RowPanel } from '../Row/Row';
import { IndoorDayBreakdown } from './IndoorDayBreakdown';
import styles from './IndoorRow.module.css';

const TITLE = 'Indoor sightseeing';
const ICON = '🏛️';

/** The cards show an icon and the level text, with no number. */
const ICONS: Record<IndoorLevel, string> = {
  RECOMMENDED: '★',
  GOOD_ALTERNATIVE: '◐',
  SAVE_FOR_LATER: '○',
};

interface IndoorRowProps {
  id: string;
  query: IndoorQuery;
  /** The outdoor days, for the labels of the outdoor scores. */
  outdoorDays: readonly DayScoreFieldsFragment[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  /** Opens the breakdown of the day in the outdoor row. */
  onShowOutdoorDay: (date: string) => void;
}

/** The indoor recommendation (ui-spec.md, section 5). */
export function IndoorRow({
  id,
  query,
  outdoorDays,
  selectedDate,
  onSelectDate,
  onShowOutdoorDay,
}: IndoorRowProps) {
  const result = query.data;

  if (result === undefined) {
    return (
      <Row id={id} title={TITLE} icon={ICON}>
        <RowFailure retrying={query.retrying} onRetry={query.retry} />
      </Row>
    );
  }

  const selectedDay = result.days.find((day) => day.date === selectedDate);

  return (
    <Row
      id={id}
      title={TITLE}
      icon={ICON}
      badge={
        <RowBadge>
          Recommended on {result.recommendedDays} of {result.days.length} days
        </RowBadge>
      }
    >
      <p className={styles.intro}>
        Indoor sightseeing has no score. We recommend it when the outdoor
        weather is bad.
      </p>
      <DayCardList label={`${TITLE}: 7 days`}>
        {result.days.map((day, i) => (
          <DayCard
            key={day.date}
            dayName={i === 0 ? 'Today' : formatDayName(day.date)}
            colors={indoorCardColors({ level: day.level, ended: day.ended })}
            ended={day.ended}
            selected={day.date === selectedDate}
            onSelect={() =>
              onSelectDate(day.date === selectedDate ? null : day.date)
            }
            main={<span aria-hidden="true">{ICONS[day.level]}</span>}
            caption={LEVELS[day.level]}
          />
        ))}
      </DayCardList>
      <RowPanel>
        {selectedDay ? (
          <IndoorDayBreakdown
            day={selectedDay}
            outdoorDay={outdoorDays.find((d) => d.date === selectedDay.date)}
            onShowOutdoorDay={onShowOutdoorDay}
          />
        ) : (
          <>
            <h4 className={styles.heading}>This week</h4>
            <ExplanationList items={result.summary} />
            <p className={styles.hint}>Select a day to see its breakdown.</p>
          </>
        )}
        <p className={styles.townSize}>{explanationText(result.townSize)}</p>
      </RowPanel>
    </Row>
  );
}
