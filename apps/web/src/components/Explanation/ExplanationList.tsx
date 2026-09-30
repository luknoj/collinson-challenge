import { Explanation, type ExplanationData } from './Explanation';
import styles from './ExplanationList.module.css';

/** A list of explanations, with dividers. */
export function ExplanationList({
  items,
}: {
  items: readonly ExplanationData[];
}) {
  return (
    <ul className={styles.list}>
      {items.map((item, i) => (
        <li key={`${item.key}-${i}`}>
          <Explanation explanation={item} />
        </li>
      ))}
    </ul>
  );
}
