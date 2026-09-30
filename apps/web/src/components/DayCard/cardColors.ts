// The colors of a day card. Each label and each indoor level has a gradient
// in styles/tokens.css. The text color is black or white: the one with the
// higher contrast on the 2 ends of the gradient (ui-spec.md, section 8).

import type { Confidence, IndoorLevel, Label } from '../../generated/graphql';
import { contrast, mix, parseHex, toCss, type Rgb } from '../../utils/color';

interface Gradient {
  from: Rgb;
  to: Rgb;
}

export interface CardTokens {
  labels: Record<Label, Gradient>;
  indoor: Record<IndoorLevel, Gradient>;
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
  /** A CSS linear-gradient. */
  background: string;
  color: string;
  /** The lowest contrast ratio of the text on the gradient. */
  contrast: number;
}

/** Reads the tokens. `read` gives the value of a CSS custom property. */
export function readCardTokens(read: (name: string) => string): CardTokens {
  const color = (name: string) => parseHex(read(name));
  const percent = (name: string) => Number.parseFloat(read(name)) / 100;
  const gradient = (name: string): Gradient => ({
    from: color(`--card-${name}-from`),
    to: color(`--card-${name}-to`),
  });
  return {
    labels: {
      POOR: gradient('poor'),
      FAIR: gradient('fair'),
      MODERATE: gradient('moderate'),
      GOOD: gradient('good'),
      EXCELLENT: gradient('excellent'),
    },
    indoor: {
      RECOMMENDED: gradient('recommended'),
      GOOD_ALTERNATIVE: gradient('good-alternative'),
      SAVE_FOR_LATER: gradient('save-for-later'),
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

/** Mixes the 2 ends of a gradient with a base color. */
function mixGradient({
  gradient,
  base,
  strength,
}: {
  gradient: Gradient;
  base: Rgb;
  strength: number;
}): Gradient {
  return {
    from: mix({ color: gradient.from, base, strength }),
    to: mix({ color: gradient.to, base, strength }),
  };
}

function withText({
  gradient,
  tokens,
}: {
  gradient: Gradient;
  tokens: CardTokens;
}): CardColors {
  const lowest = (text: Rgb) =>
    Math.min(
      contrast({ a: gradient.from, b: text }),
      contrast({ a: gradient.to, b: text }),
    );
  const dark = lowest(tokens.textDark);
  const light = lowest(tokens.textLight);
  return {
    background: `linear-gradient(135deg, ${toCss(gradient.from)}, ${toCss(gradient.to)})`,
    color: toCss(dark >= light ? tokens.textDark : tokens.textLight),
    contrast: Math.max(dark, light),
  };
}

function cardColors({
  gradient,
  lowConfidence,
  ended,
  tokens,
}: {
  gradient: Gradient;
  lowConfidence: boolean;
  ended: boolean;
  tokens: CardTokens;
}): CardColors {
  let result = gradient;
  if (lowConfidence) {
    result = mixGradient({
      gradient: result,
      base: tokens.surface,
      strength: tokens.lowConfidenceStrength,
    });
  }
  if (ended) {
    result = mixGradient({
      gradient: result,
      base: tokens.background,
      strength: tokens.endedStrength,
    });
  }
  return withText({ gradient: result, tokens });
}

export function scoreCardColors({
  label,
  confidence,
  ended,
  tokens = tokensOfPage(),
}: {
  label: Label;
  confidence: Confidence;
  ended: boolean;
  tokens?: CardTokens;
}): CardColors {
  return cardColors({
    gradient: tokens.labels[label],
    lowConfidence: confidence !== 'HIGH',
    ended,
    tokens,
  });
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
  return cardColors({
    gradient: tokens.indoor[level],
    lowConfidence: false,
    ended,
    tokens,
  });
}
