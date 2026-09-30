import { Drawer } from '@base-ui/react/drawer';
import { useEffect, type ReactNode } from 'react';
import type { IndoorLevel, Label } from '../../generated/graphql';
import { LABELS, LEVELS } from '../../text/labels';
import type { PanelSection } from '../../text/templates';
import { indoorCardColors, scoreCardColors } from '../DayCard/cardColors';
import { howScoresWork } from './handle';
import styles from './HowScoresWork.module.css';

const sectionId = (section: PanelSection) => `how-scores-work-${section}`;

/** The button in the place header. */
export function HowScoresWorkButton() {
  return (
    <Drawer.Trigger
      handle={howScoresWork}
      payload={null}
      className={styles.button}
    >
      How the scores work
    </Drawer.Trigger>
  );
}

/**
 * The "How the scores work" side panel (ui-spec.md, section 6). Escape
 * closes it, and the focus goes back to the button that opened it.
 */
export function HowScoresWork() {
  return (
    <Drawer.Root handle={howScoresWork} swipeDirection="right">
      {({ payload }) => (
        <Drawer.Portal>
          <Drawer.Backdrop className={styles.backdrop} />
          <Drawer.Viewport className={styles.viewport}>
            <Drawer.Popup className={styles.popup}>
              <header className={styles.header}>
                <Drawer.Title className={styles.title}>
                  How the scores work
                </Drawer.Title>
                <Drawer.Close className={styles.close} aria-label="Close">
                  ✕
                </Drawer.Close>
              </header>
              <Drawer.Content className={styles.content}>
                <Sections section={payload ?? null} />
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      )}
    </Drawer.Root>
  );
}

const LABEL_RANGES: [Label, string][] = [
  ['EXCELLENT', '80–100'],
  ['GOOD', '60–79'],
  ['MODERATE', '40–59'],
  ['FAIR', '20–39'],
  ['POOR', '0–19'],
];

const INDOOR_RANGES: [IndoorLevel, string][] = [
  ['RECOMMENDED', 'outdoor score less than 40'],
  ['GOOD_ALTERNATIVE', 'outdoor score 40–59'],
  ['SAVE_FOR_LATER', 'outdoor score 60 or more'],
];

// The numbers in this panel come from scoring.md. They are not in the API.
function Sections({ section }: { section: PanelSection | null }) {
  // A "More" link opens the panel at its section.
  useEffect(() => {
    if (section === null) return;
    document
      .getElementById(sectionId(section))
      ?.scrollIntoView({ block: 'start' });
  }, [section]);

  return (
    <>
      <Section id="labels" title="Labels and colors">
        <p>
          Each day gets a score from 0 to 100 from the weather factors of the
          activity. The label and the color come from the score.
        </p>
        <ul className={styles.swatches}>
          {LABEL_RANGES.map(([label, range]) => (
            <li key={label}>
              <Swatch
                background={
                  scoreCardColors({ label, confidence: 'HIGH', ended: false })
                    .background
                }
              />
              {LABELS[label]}: {range}
            </li>
          ))}
        </ul>
        <p>
          The number and the label are always on the card. Thus, you do not need
          the colors to read a score.
        </p>
      </Section>

      <Section id="weekly" title="Weekly score">
        <p>
          The weekly score is half of the best day plus half of the mean of the
          3 best days. Thus, a small number of very good days gives a good week.
          The best days in the summary are the 2 days with the highest scores,
          if their score is 40 or more.
        </p>
      </Section>

      <Section id="confidence" title="Confidence">
        <p>
          A forecast for a day that is further away is less certain. Days 1–3
          have a high confidence, days 4–5 a medium confidence and days 6–7 a
          low confidence. The cards of days 4–7 have a lighter color.
        </p>
      </Section>

      <Section id="ended" title="Ended days">
        <p>
          When the activity hours of today have ended in the town, today is
          “Ended”. Sightseeing ends at 18:00, skiing at 16:00 and surfing at
          sunset. An ended day keeps its score and its breakdown, but the weekly
          score and the best days do not use it.
        </p>
      </Section>

      <Section id="gates" title="Gates and adjustments">
        <p>
          Some conditions make an activity bad or dangerous, even when the other
          factors are good. For example, a thunderstorm. These conditions are
          gates: each gate sets a maximum score for the day. The breakdown shows
          the score before the gates and each gate with its maximum.
        </p>
        <p>
          Adjustments add or remove a small number of points. For example, the
          wind direction for surfing, or fog for sightseeing.
        </p>
      </Section>

      <Section id="local-time" title="Local time">
        <p>
          All days and hours are in the local time of the town, not of your
          computer. The header shows the local time when the town loaded.
        </p>
      </Section>

      <Section id="indoor" title="Indoor sightseeing">
        <p>
          Indoor sightseeing has no score. The weather does not change a museum,
          but a day inside on a good day loses the good outdoor weather. Thus,
          the recommendation comes from the outdoor score of the same day:
        </p>
        <ul className={styles.swatches}>
          {INDOOR_RANGES.map(([level, range]) => (
            <li key={level}>
              <Swatch
                background={
                  indoorCardColors({ level, ended: false }).background
                }
              />
              {LEVELS[level]}: {range}
            </li>
          ))}
        </ul>
        <p>
          The hints tell you when travel can be difficult, or when indoor places
          can be busy. The town size hint uses the population from Open-Meteo.
        </p>
      </Section>

      <Section id="data" title="Data source and limits">
        <p>
          All data comes from Open-Meteo: the forecast, the marine data, the
          elevation and the town search.
        </p>
        <ul className={styles.list}>
          <li>
            The forecast is for the area of the town. It is not for a ski resort
            or a surf spot. Open-Meteo has no data about lifts, artificial snow
            or tides.
          </li>
          <li>
            The high terrain near the town and the coast direction are estimates
            from the elevation data.
          </li>
          <li>
            The snow depth cannot increase more than the new snowfall. A sudden
            increase is usually a change in the forecast model.
          </li>
        </ul>
      </Section>
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: PanelSection;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={sectionId(id)} className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Swatch({ background }: { background: string }) {
  return (
    <span className={styles.swatch} style={{ background }} aria-hidden="true" />
  );
}
