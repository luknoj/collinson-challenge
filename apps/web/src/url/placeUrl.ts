// ui-spec.md, section 3. Format: /?place=<id>&name=<slug>.
// The app uses only `place`. The `name` makes the URL easy to read.

export type PlaceUrl =
  | { kind: 'empty' }
  /** Only `name`: the search field shows the name. The app selects nothing. */
  | { kind: 'name'; name: string }
  | { kind: 'place'; id: number; name: string | null }
  /** `place` is not a Geocoding id. The screen shows "Town not found". */
  | { kind: 'badPlace' };

export function readPlaceUrl(
  search: string = window.location.search,
): PlaceUrl {
  const params = new URLSearchParams(search);
  const place = params.get('place');
  const name = params.get('name');

  if (place === null || place === '') {
    return name ? { kind: 'name', name } : { kind: 'empty' };
  }
  const id = Number(place);
  if (!/^\d+$/.test(place) || !Number.isSafeInteger(id) || id === 0) {
    return { kind: 'badPlace' };
  }
  return { kind: 'place', id, name };
}

/**
 * Sets ?place=<id>&name=<slug>. "push" adds a history entry (a new
 * selection). "replace" changes the current entry (a name correction).
 */
export function writePlaceUrl({
  id,
  name,
  mode,
}: {
  id: number;
  name: string;
  mode: 'push' | 'replace';
}): void {
  const params = new URLSearchParams({ place: String(id) });
  const slug = placeSlug(name);
  if (slug !== '') params.set('name', slug);
  const url = `${window.location.pathname}?${params.toString()}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

/** True when the `name` in the URL is not the slug of the town name. */
export function needsNameCorrection({
  urlName,
  name,
}: {
  urlName: string | null;
  name: string;
}): boolean {
  return (urlName ?? '') !== placeSlug(name);
}

/**
 * Some Latin letters do not change with NFD (for example, "ł" in "Łódź").
 * This list changes them to ASCII letters.
 */
const LETTERS: Record<string, string> = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  þ: 'th',
  ı: 'i',
};

/** "Kraków" → "krakow". Lowercase letters, digits and hyphens only. */
export function placeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[łøđðßæœþı]/g, (letter) => LETTERS[letter] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
