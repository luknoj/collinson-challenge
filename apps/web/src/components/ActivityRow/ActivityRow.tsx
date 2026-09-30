import { explanationText, LABELS } from '../../text/simpleText';
import { formatDayName } from '../../utils/time';
import type { ActivityQuery } from '../ActivityRows/useRowQueries';
import { DayBreakdown } from '../DayBreakdown/DayBreakdown';
import { scoreCardColors } from '../DayCard/cardColors';
import { DayCard, DayCardList } from '../DayCard/DayCard';
import { Row, RowBadge, RowFailure, RowPanel } from '../Row/Row';
import { WeeklySummary } from '../WeeklySummary/WeeklySummary';
import styles from './ActivityRow.module.css';

interface ActivityRowProps {
  id: string;
  /** For example, "Skiing". */
  title: string;
  /** An emoji for the icon tile. */
  icon: string;
  placeName: string;
  query: ActivityQuery;
  /** The date of the selected day card. null: the weekly summary shows. */
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

/** 1 row for skiing, surfing or outdoor sightseeing (ui-spec.md, section 4). */
export function ActivityRow({
  id,
  title,
  icon,
  placeName,
  query,
  selectedDate,
  onSelectDate,
}: ActivityRowProps) {
  const result = query.data;

  if (result === undefined) {
    return (
      <Row id={id} title={title} icon={icon}>
        <RowFailure retrying={query.retrying} onRetry={query.retry} />
      </Row>
    );
  }

  if (result.status === 'NOT_APPLICABLE') {
    return (
      <Row
        id={id}
        title={title}
        icon={icon}
        badge={<RowBadge>Not applicable</RowBadge>}
      >
        {result.notApplicableReason && (
          <p className={styles.reason}>
            {explanationText(result.notApplicableReason)}
          </p>
        )}
      </Row>
    );
  }

  const weekly =
    result.weeklyScore !== null && result.weeklyLabel !== null ? (
      <RowBadge
        colors={scoreCardColors({
          label: result.weeklyLabel,
          confidence: 'HIGH',
          ended: false,
        })}
      >
        {result.weeklyScore} · {LABELS[result.weeklyLabel]}
      </RowBadge>
    ) : (
      <RowBadge>No score</RowBadge>
    );
  const selectedDay = result.days.find((day) => day.date === selectedDate);

  return (
    <Row id={id} title={title} icon={icon} badge={weekly}>
      <DayCardList label={`${title}: 7 days`}>
        {result.days.map((day, i) => (
          <DayCard
            key={day.date}
            dayName={i === 0 ? 'Today' : formatDayName(day.date)}
            colors={scoreCardColors({
              label: day.label,
              confidence: day.confidence,
              ended: day.ended,
            })}
            ended={day.ended}
            selected={day.date === selectedDate}
            onSelect={() =>
              onSelectDate(day.date === selectedDate ? null : day.date)
            }
            main={day.score}
            caption={LABELS[day.label]}
          />
        ))}
      </DayCardList>
      <RowPanel>
        {selectedDay ? (
          <DayBreakdown
            activity={title}
            placeName={placeName}
            day={selectedDay}
          />
        ) : (
          <WeeklySummary summary={result.summary} notes={result.notes} />
        )}
      </RowPanel>
    </Row>
  );
}
