import { Meter } from '@base-ui/react/meter';
import type { DayScoreFieldsFragment } from '../../generated/graphql';
import {
  explanationText,
  keyText,
  LABELS,
  paramsText,
} from '../../text/simpleText';
import { formatNumber } from '../../utils/number';
import { formatDate } from '../../utils/time';
import { ExplanationList } from '../Explanation/ExplanationList';
import styles from './DayBreakdown.module.css';

type Factor = DayScoreFieldsFragment['factors'][number];

interface DayBreakdownProps {
  /** For example, "Skiing". */
  activity: string;
  placeName: string;
  day: DayScoreFieldsFragment;
}

/** The breakdown of 1 day (ui-spec.md, section 4). */
export function DayBreakdown({ activity, placeName, day }: DayBreakdownProps) {
  return (
    <div className={styles.breakdown}>
      <h4 className={styles.heading}>
        {formatDate(day.date)} — {placeName}, {activity} {day.score}{' '}
        {LABELS[day.label]} (confidence: {day.confidence.toLowerCase()})
        {day.ended && ', ended'}
      </h4>

      <div className={styles.factors}>
        {day.factors.map((factor) => (
          <FactorBar key={factor.key} factor={factor} />
        ))}
      </div>

      {day.adjustments.length > 0 && (
        <ul className={styles.lines}>
          {day.adjustments.map((adjustment) => (
            <li key={adjustment.key}>
              {adjustment.points > 0 ? '+' : ''}
              {adjustment.points} {keyText(adjustment.key)}
              {adjustment.params && ` (${paramsText(adjustment.params)})`}
            </li>
          ))}
        </ul>
      )}

      <p className={styles.total}>Total before gates: {day.scoreBeforeGates}</p>

      {day.gates.length > 0 && (
        <ul className={styles.lines}>
          {day.gates.map((gate) => (
            <li key={gate.key} className={styles.gate}>
              <span aria-hidden="true">⚠ </span>
              {explanationText(gate)}
            </li>
          ))}
        </ul>
      )}

      {day.reasons.length > 0 && (
        <>
          <h5 className={styles.subheading}>Main reasons</h5>
          <ExplanationList items={day.reasons} />
        </>
      )}

      {day.notes.length > 0 && (
        <>
          <h5 className={styles.subheading}>Notes</h5>
          <ExplanationList items={day.notes} />
        </>
      )}
    </div>
  );
}

function FactorBar({ factor }: { factor: Factor }) {
  const max = Math.round(factor.weight * 100);
  const points = factor.points.toFixed(1);
  return (
    <Meter.Root
      className={styles.factor}
      value={factor.points}
      max={max}
      aria-valuetext={`${points} of ${max} points`}
    >
      <Meter.Label className={styles.name}>{keyText(factor.key)}</Meter.Label>
      <span className={styles.value}>{factorValue(factor)}</span>
      <Meter.Track className={styles.track}>
        <Meter.Indicator className={styles.indicator} />
      </Meter.Track>
      <span className={styles.points}>
        {points} / {max}
      </span>
    </Meter.Root>
  );
}

/** "0.6 m". A factor with 2 inputs shows its params. */
function factorValue(factor: Factor): string {
  if (factor.value === null) return paramsText(factor.params) || 'no data';
  const value = formatNumber(factor.value);
  return factor.unit ? `${value} ${factor.unit}` : value;
}
