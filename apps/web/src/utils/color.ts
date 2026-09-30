// sRGB colors and the WCAG contrast ratio.

export type Rgb = readonly [number, number, number];

/** "#1b1f24" or "#fff" → [27, 31, 36]. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toCss(color: Rgb): string {
  return `rgb(${color.map((c) => Math.round(c)).join(' ')})`;
}

/** `strength` of `color` and the remaining part of `base` (0–1). */
export function mix({
  color,
  base,
  strength,
}: {
  color: Rgb;
  base: Rgb;
  strength: number;
}): Rgb {
  const part = (c: number, b: number) => c * strength + b * (1 - strength);
  return [
    part(color[0], base[0]),
    part(color[1], base[1]),
    part(color[2], base[2]),
  ];
}

/** WCAG 2 relative luminance (0–1). */
function luminance(color: Rgb): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(color[0]) +
    0.7152 * linear(color[1]) +
    0.0722 * linear(color[2])
  );
}

/** WCAG 2 contrast ratio (1–21). */
export function contrast({ a, b }: { a: Rgb; b: Rgb }): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
