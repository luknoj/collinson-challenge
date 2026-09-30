const NUMBER = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

/**
 * A number for the screen, with 1 decimal or less: 12.3456 → "12.3",
 * 4 → "4". The API sends the values with no rounding.
 */
export function formatNumber(value: number): string {
  return NUMBER.format(value);
}
