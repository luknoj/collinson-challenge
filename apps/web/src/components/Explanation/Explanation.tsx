import { Fragment } from 'react';
import type { ExplanationKey } from '../../generated/graphql';
import { paramReader, type Params } from '../../text/params';
import { TEMPLATES } from '../../text/templates';
import { InfoPopover } from './InfoPopover';

export interface ExplanationData {
  key: ExplanationKey;
  params: Params;
  days?: readonly string[] | null;
}

interface ExplanationProps {
  explanation: ExplanationData;
  /**
   * text: the sentence (default). title: the short name of the key. value:
   * the value of a factor ("0.6 m").
   */
  part?: 'text' | 'title' | 'value';
}

/**
 * The text of an explanation from its template (text/templates.ts). A term in
 * [brackets] opens a popover with the details.
 */
export function Explanation({ explanation, part = 'text' }: ExplanationProps) {
  const template = TEMPLATES[explanation.key];
  const p = paramReader({
    params: explanation.params,
    days: explanation.days,
  });

  if (part === 'value') return <>{template.value?.(p) ?? ''}</>;

  const hasPopover =
    template.details !== undefined || template.more !== undefined;
  const text =
    part === 'title'
      ? hasPopover
        ? `[${template.title}]`
        : template.title
      : template.text(p);

  return (
    <>
      {splitTerms(text).map((piece, i) =>
        piece.term && hasPopover ? (
          <InfoPopover
            key={i}
            label={piece.text}
            title={template.title}
            details={template.details?.(p)}
            more={template.more}
          />
        ) : (
          <Fragment key={i}>{piece.text}</Fragment>
        ),
      )}
    </>
  );
}

/** "[Fog] for 3 hours" → [{ text: "Fog", term: true }, { text: " for 3 hours" }]. */
function splitTerms(text: string): { text: string; term: boolean }[] {
  return text
    .split(/(\[[^\]]+\])/)
    .filter((piece) => piece !== '')
    .map((piece) =>
      piece.startsWith('[') && piece.endsWith(']')
        ? { text: piece.slice(1, -1), term: true }
        : { text: piece, term: false },
    );
}
