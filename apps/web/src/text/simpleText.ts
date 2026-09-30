// Simple text for phase 5. Phase 6 replaces it with 1 template for each
// ExplanationKey (text/templates.ts).

import type {
  ExplanationFieldsFragment,
  ExplanationKey,
  IndoorLevel,
  Label,
} from '../generated/graphql';
import { formatNumber } from '../utils/number';
import { formatDayName } from '../utils/time';

export const LABELS: Record<Label, string> = {
  POOR: 'Poor',
  FAIR: 'Fair',
  MODERATE: 'Moderate',
  GOOD: 'Good',
  EXCELLENT: 'Excellent',
};

export const LEVELS: Record<IndoorLevel, string> = {
  RECOMMENDED: 'Recommended',
  GOOD_ALTERNATIVE: 'Good alternative',
  SAVE_FOR_LATER: 'Save for later',
};

/** RAIN_ON_SNOW_GATE → "Rain on snow gate". */
export function keyText(key: ExplanationKey): string {
  const words = key.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "tempC: 4, rainMm: 6". An empty text when there are no params. */
export function paramsText(params: Record<string, unknown> | null): string {
  if (params === null) return '';
  return Object.entries(params)
    .map(([name, value]) => `${name}: ${valueText(value)}`)
    .join(', ');
}

function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.map(valueText).join(' / ');
  if (value === null || value === undefined) return 'no data';
  if (typeof value === 'number') return formatNumber(value);
  return String(value);
}

/** "Rain on snow gate (rainMm: 6, tempC: 4) — Wed, Thu". */
export function explanationText(
  explanation: ExplanationFieldsFragment,
): string {
  const params = paramsText(explanation.params);
  const days = explanation.days?.map((date) => formatDayName(date)) ?? [];
  return [
    keyText(explanation.key),
    params ? ` (${params})` : '',
    days.length > 0 ? ` — ${days.join(', ')}` : '',
  ].join('');
}
