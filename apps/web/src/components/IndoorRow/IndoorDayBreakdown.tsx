import type {
  DayScoreFieldsFragment,
  IndoorRowQuery,
} from '../../generated/graphql';
import { explanationText, labelText, levelText } from '../../text/simpleText';
import { formatDate } from '../../utils/time';
import { ExplanationList } from '../Explanation/ExplanationList';
import styles from './IndoorRow.module.css';

type IndoorDay = IndoorRowQuery['activities']['indoor']['days'][number];

interface IndoorDayBreakdownProps {
  day: IndoorDay;
  /** undefined when the outdoor row failed. */
  outdoorDay: DayScoreFieldsFragment | undefined;
  onShowOutdoorDay: (date: string) => void;
}

/** The breakdown of 1 indoor day (ui-spec.md, section 5). */
export function IndoorDayBreakdown({
  day,
  outdoorDay,
  onShowOutdoorDay,
}: IndoorDayBreakdownProps) {
  const outdoorLabel = outdoorDay ? ` ${labelText(outdoorDay.label)}` : '';
  return (
    <div className={styles.summary}>
      <h4 className={styles.heading}>
        {formatDate(day.date)} — Indoor: {levelText(day.level)}
        {day.ended && ', ended'}
      </h4>
      <p className={styles.line}>
        Outdoor score: {day.outdoorScore}
        {outdoorLabel}
        {outdoorDay && (
          <>
            {' '}
            <button
              type="button"
              className={styles.link}
              onClick={() => onShowOutdoorDay(day.date)}
            >
              Show the outdoor breakdown
            </button>
          </>
        )}
      </p>
      {day.mainCause && (
        <p className={styles.line}>
          Main cause: {explanationText(day.mainCause)}
        </p>
      )}
      {day.hints.length > 0 && (
        <>
          <h5 className={styles.subheading}>Hints</h5>
          <ExplanationList items={day.hints} />
        </>
      )}
    </div>
  );
}
