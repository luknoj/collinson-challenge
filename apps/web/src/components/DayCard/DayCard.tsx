import type { ReactNode } from 'react';
import { TERMS } from '../../text/templates';
import { InfoPopover } from '../Explanation/InfoPopover';
import type { CardColors } from './cardColors';
import styles from './DayCard.module.css';

interface DayCardProps {
  /** "Today" or the day name ("Wed"). */
  dayName: string;
  colors: CardColors;
  ended: boolean;
  selected: boolean;
  onSelect: () => void;
  /** The score, or the icon of the indoor level. */
  main: ReactNode;
  /** The label, or the indoor level. */
  caption: string;
}

/**
 * 1 day. A click shows the breakdown of the day (ui-spec.md, section 4).
 * The select button covers the full card. The "Ended" pill is a separate
 * button with a popover, above the select button.
 */
export function DayCard({
  dayName,
  colors,
  ended,
  selected,
  onSelect,
  main,
  caption,
}: DayCardProps) {
  return (
    <li
      className={styles.card}
      style={{ background: colors.background, color: colors.color }}
      data-selected={selected || undefined}
    >
      <span className={styles.top}>
        <span className={styles.day} aria-hidden="true">
          {dayName}
        </span>
        {ended && (
          <span className={styles.ended}>
            <InfoPopover {...TERMS.ENDED} label="Ended" />
          </span>
        )}
      </span>
      <button
        type="button"
        className={styles.select}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className={styles.visuallyHidden}>
          {dayName}
          {ended ? ', ended' : ''}:{' '}
        </span>
        <span className={styles.main}>{main}</span>
        <span className={styles.caption}>{caption}</span>
      </button>
    </li>
  );
}

/** The 7 day cards in 1 line. On a phone, the line scrolls. */
export function DayCardList({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <ul className={styles.list} aria-label={label}>
      {children}
    </ul>
  );
}
