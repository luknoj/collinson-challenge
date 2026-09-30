import { Drawer } from '@base-ui/react/drawer';
import type { PanelSection } from '../../text/templates';

/**
 * Connects the "How the scores work" panel with its triggers: the button in
 * the header and the "More" links in the popovers. The payload is the
 * section to show. null shows the start of the panel.
 */
export const howScoresWork = Drawer.createHandle<PanelSection | null>();

export function openHowScoresWork(section: PanelSection): void {
  howScoresWork.openWithPayload(section);
}
