import { Popover } from '@base-ui/react/popover';
import type { ReactNode } from 'react';
import type { PanelSection } from '../../text/templates';
import { openHowScoresWork } from '../HowScoresWork/handle';
import styles from './InfoPopover.module.css';

interface InfoPopoverProps {
  /** The term on the screen. A click opens the popover. */
  label: ReactNode;
  title: string;
  details?: string;
  /** The section of the "How the scores work" panel for the "More" link. */
  more?: PanelSection;
}

/** A term with a popover (ui-spec.md, section 6). Escape closes it. */
export function InfoPopover({ label, title, details, more }: InfoPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.term}>{label}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={styles.positioner} sideOffset={8}>
          <Popover.Popup className={styles.popup}>
            <Popover.Title className={styles.title}>{title}</Popover.Title>
            {details && (
              <Popover.Description className={styles.details}>
                {details}
              </Popover.Description>
            )}
            {more && (
              <Popover.Close
                className={styles.more}
                onClick={() => openHowScoresWork(more)}
              >
                More in "How the scores work"
              </Popover.Close>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
