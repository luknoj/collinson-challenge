import type { IndoorLevel, Label } from '../generated/graphql';

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
