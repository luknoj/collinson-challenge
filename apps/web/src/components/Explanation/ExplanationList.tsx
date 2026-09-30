import type { ExplanationFieldsFragment } from '../../generated/graphql';
import { explanationText } from '../../text/simpleText';
import styles from './ExplanationList.module.css';

/** A list of explanations. Phase 6 adds the popovers. */
export function ExplanationList({
  items,
}: {
  items: readonly ExplanationFieldsFragment[];
}) {
  return (
    <ul className={styles.list}>
      {items.map((item, i) => (
        <li key={`${item.key}-${i}`}>{explanationText(item)}</li>
      ))}
    </ul>
  );
}
