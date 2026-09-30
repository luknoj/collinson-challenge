import { Meter } from '@base-ui/react/meter';
import type { DayScoreFieldsFragment } from '../../generated/graphql';
import { LABELS } from '../../text/labels';
import { TERMS } from '../../text/templates';
import { formatDate } from '../../utils/time';
import { Explanation, type ExplanationData } from '../Explanation/Explanation';
import { ExplanationList } from '../Explanation/ExplanationList';
import { InfoPopover } from '../Explanation/InfoPopover';
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
        {LABELS[day.label]} (
        <InfoPopover
          {...TERMS.CONFIDENCE}
          label={`confidence: ${day.confidence.toLowerCase()}`}
        />
        )
        {day.ended && (
          <>
            , <InfoPopover {...TERMS.ENDED} label="ended" />
          </>
        )}
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
              {adjustment.points}{' '}
              <Explanation
                explanation={{ key: adjustment.key, params: adjustment.params }}
              />
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
              <Explanation explanation={gate} />
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
  // The same params as in the reasons: the value, the unit and the inputs.
  const explanation: ExplanationData = {
    key: factor.key,
    params: { value: factor.value, unit: factor.unit, ...factor.params },
  };
  return (
    <Meter.Root
      className={styles.factor}
      value={factor.points}
      max={max}
      aria-valuetext={`${points} of ${max} points`}
    >
      <Meter.Label className={styles.name}>
        <Explanation explanation={explanation} part="title" />
      </Meter.Label>
      <span className={styles.value}>
        <Explanation explanation={explanation} part="value" />
      </span>
      <Meter.Track className={styles.track}>
        <Meter.Indicator className={styles.indicator} />
      </Meter.Track>
      <span className={styles.points}>
        {points} / {max}
      </span>
    </Meter.Root>
  );
}
