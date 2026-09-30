import { useId, type ReactNode } from 'react';
import styles from './Row.module.css';

interface RowProps {
  /** The id of the section, for links to the row. */
  id?: string;
  title: string;
  /** The right side of the header (for example, "95 Excellent"). */
  aside?: ReactNode;
  children?: ReactNode;
}

/** The frame of 1 activity row: the header and the content. */
export function Row({ id, title, aside, children }: RowProps) {
  const headingId = useId();
  return (
    <section id={id} className={styles.row} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h3 id={headingId} className={styles.title}>
          {title}
        </h3>
        {aside !== undefined && <p className={styles.aside}>{aside}</p>}
      </header>
      {children}
    </section>
  );
}

/** The shape of a row while the 4 queries are open. */
export function RowPlaceholder() {
  return <div className={styles.placeholder} aria-hidden="true" />;
}

/** "Data not available" with "Try again" (ui-spec.md, section 4). */
export function RowFailure({
  retrying,
  onRetry,
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className={styles.failure} role="alert">
      <p>Data not available.</p>
      <button
        type="button"
        className={styles.button}
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? 'Trying again…' : 'Try again'}
      </button>
    </div>
  );
}
