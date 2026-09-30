import { useId, type ReactNode } from 'react';
import type { CardColors } from '../DayCard/cardColors';
import styles from './Row.module.css';

interface RowProps {
  /** The id of the section, for links to the row. */
  id?: string;
  title: string;
  /** An emoji for the icon tile. */
  icon: string;
  /** The right side of the header, usually a RowBadge. */
  badge?: ReactNode;
  children?: ReactNode;
}

/** The frame of 1 activity row: the header and the content. */
export function Row({ id, title, icon, badge, children }: RowProps) {
  const headingId = useId();
  return (
    <section id={id} className={styles.row} aria-labelledby={headingId}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
          <h3 id={headingId} className={styles.title}>
            {title}
          </h3>
        </div>
        {badge}
      </header>
      {children}
    </section>
  );
}

/**
 * A pill in the row header. With `colors`, it has the gradient of a label
 * (for example, the weekly score). Without `colors`, it is neutral.
 */
export function RowBadge({
  colors,
  children,
}: {
  colors?: CardColors;
  children: ReactNode;
}) {
  return (
    <p
      className={colors ? styles.badge : `${styles.badge} ${styles.neutral}`}
      style={
        colors ? { background: colors.background, color: colors.color } : {}
      }
    >
      {children}
    </p>
  );
}

/** The inset panel under the day cards: the summary or the breakdown. */
export function RowPanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
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
