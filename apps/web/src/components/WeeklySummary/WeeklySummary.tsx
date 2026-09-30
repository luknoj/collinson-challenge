import type { ExplanationFieldsFragment } from '../../generated/graphql';
import { ExplanationList } from '../Explanation/ExplanationList';
import styles from './WeeklySummary.module.css';

interface WeeklySummaryProps {
  summary: readonly ExplanationFieldsFragment[];
  /** Notes for the week (for example, the mountain note). */
  notes: readonly ExplanationFieldsFragment[];
}

/** The default view under the day cards (architecture.md, section 4.6). */
export function WeeklySummary({ summary, notes }: WeeklySummaryProps) {
  return (
    <div className={styles.summary}>
      <h4 className={styles.heading}>This week</h4>
      <ExplanationList items={summary} />
      {notes.length > 0 && (
        <>
          <h4 className={styles.heading}>Notes</h4>
          <ExplanationList items={notes} />
        </>
      )}
      <p className={styles.hint}>Select a day to see its breakdown.</p>
    </div>
  );
}
