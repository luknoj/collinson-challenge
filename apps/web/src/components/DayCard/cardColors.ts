// The colors of a day card. The values come from styles/tokens.css. The text
// color is black or white: the one with the higher contrast (ui-spec.md,
// section 8).

import type { Confidence, IndoorLevel } from '../../generated/graphql';
import { contrast, mix, parseHex, toCss, type Rgb } from '../../utils/color';

export interface CardTokens {
  /** The score gradient, from 0 to 100. */
  scale: readonly { at: number; color: Rgb }[];
  indoor: Record<IndoorLevel, Rgb>;
  surface: Rgb;
  background: Rgb;
  textDark: Rgb;
  textLight: Rgb;
  /** 0–1: the part of the card color for days with less confidence. */
  lowConfidenceStrength: number;
  /** 0–1: the part of the card color for ended days. */
  endedStrength: number;
}

export interface CardColors {
  background: string;
  color: string;
  /** The contrast ratio of the text. */
  contrast: number;
}

/** Reads the tokens. `read` gives the value of a CSS custom property. */
export function readCardTokens(read: (name: string) => string): CardTokens {
  const color = (name: string) => parseHex(read(name));
  const percent = (name: string) => Number.parseFloat(read(name)) / 100;
  return {
    scale: [0, 25, 50, 75, 100].map((at) => ({
      at,
      color: color(`--score-${at}`),
    })),
    indoor: {
      RECOMMENDED: color('--indoor-recommended'),
      GOOD_ALTERNATIVE: color('--indoor-good-alternative'),
      SAVE_FOR_LATER: color('--indoor-save-for-later'),
    },
    surface: color('--color-surface'),
    background: color('--color-bg'),
    textDark: color('--color-card-text-dark'),
    textLight: color('--color-card-text-light'),
    lowConfidenceStrength: percent('--card-low-confidence-strength'),
    endedStrength: percent('--card-ended-strength'),
  };
}

let pageTokens: CardTokens | null = null;

/** The tokens of the page. The page reads them 1 time. */
function tokensOfPage(): CardTokens {
  pageTokens ??= readCardTokens((name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return pageTokens;
}

/** The color on the gradient for a score from 0 to 100. */
function scaleColor({
  score,
  tokens,
}: {
  score: number;
  tokens: CardTokens;
}): Rgb {
  let from = tokens.scale[0];
  for (const to of tokens.scale) {
    if (from !== undefined && score <= to.at) {
      if (to.at === from.at) return to.color;
      return mix({
        color: to.color,
        base: from.color,
        strength: (score - from.at) / (to.at - from.at),
      });
    }
    from = to;
  }
  if (from === undefined) throw new Error('The score gradient has no colors.');
  return from.color;
}

function withText({
  color,
  tokens,
}: {
  color: Rgb;
  tokens: CardTokens;
}): CardColors {
  const dark = contrast({ a: color, b: tokens.textDark });
  const light = contrast({ a: color, b: tokens.textLight });
  return {
    background: toCss(color),
    color: toCss(dark >= light ? tokens.textDark : tokens.textLight),
    contrast: Math.max(dark, light),
  };
}

export function scoreCardColors({
  score,
  confidence,
  ended,
  tokens = tokensOfPage(),
}: {
  score: number;
  confidence: Confidence;
  ended: boolean;
  tokens?: CardTokens;
}): CardColors {
  let color = scaleColor({ score, tokens });
  if (confidence !== 'HIGH') {
    color = mix({
      color,
      base: tokens.surface,
      strength: tokens.lowConfidenceStrength,
    });
  }
  if (ended) {
    color = mix({
      color,
      base: tokens.background,
      strength: tokens.endedStrength,
    });
  }
  return withText({ color, tokens });
}

export function indoorCardColors({
  level,
  ended,
  tokens = tokensOfPage(),
}: {
  level: IndoorLevel;
  ended: boolean;
  tokens?: CardTokens;
}): CardColors {
  const color = ended
    ? mix({
        color: tokens.indoor[level],
        base: tokens.background,
        strength: tokens.endedStrength,
      })
    : tokens.indoor[level];
  return withText({ color, tokens });
}
