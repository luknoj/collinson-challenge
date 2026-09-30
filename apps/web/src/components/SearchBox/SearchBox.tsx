import { Combobox } from '@base-ui/react/combobox';
import { useEffect, useId } from 'react';
import { placeLabel, type Place } from '../../geocoding/geocoding';
import styles from './SearchBox.module.css';
import { useTownSearch, type SearchStatus } from './useTownSearch';

interface SearchBoxProps {
  /** The town in the header. The field shows its name. */
  selected: Place | null;
  /** The text in the field at the start (a URL with only `name`). */
  initialText?: string;
  onSelect: (place: Place) => void;
}

export function SearchBox({
  selected,
  initialText = '',
  onSelect,
}: SearchBoxProps) {
  const id = useId();
  const { results, status, search } = useTownSearch();

  // A URL with only `name`: get the suggestions, but do not select a town.
  useEffect(() => {
    if (initialText !== '') search(initialText);
  }, [initialText, search]);

  const message = statusMessage(status);

  return (
    <Combobox.Root
      items={results}
      value={selected}
      onValueChange={(place: Place | null) => {
        if (place) onSelect(place);
      }}
      itemToStringLabel={placeLabel}
      isItemEqualToValue={(item: Place, value: Place) => item.id === value.id}
      filter={null}
      defaultInputValue={initialText}
      onInputValueChange={(text, { reason }) => {
        // Only the text that the user types starts a search.
        if (reason === 'input-change' || reason === 'input-clear') {
          search(text);
        }
      }}
    >
      <label className={styles.label} htmlFor={id}>
        Town
      </label>
      <Combobox.Input
        id={id}
        className={styles.input}
        placeholder="Search for a town…"
      />

      <Combobox.Portal>
        <Combobox.Positioner className={styles.positioner} sideOffset={4}>
          <Combobox.Popup
            className={styles.popup}
            aria-busy={status === 'searching' || undefined}
          >
            <Combobox.Status className={styles.status}>
              {message}
            </Combobox.Status>
            <Combobox.Empty className={styles.status}>
              {status === 'done' ? 'No town found.' : null}
            </Combobox.Empty>
            <Combobox.List className={styles.list}>
              {(place: Place) => (
                <Combobox.Item
                  key={place.id}
                  value={place}
                  className={styles.item}
                >
                  <span className={styles.name}>{place.name}</span>
                  <span className={styles.region}>
                    {[place.admin1, place.country]
                      .filter((part) => part !== null)
                      .join(', ')}
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function statusMessage(status: SearchStatus): string | null {
  switch (status) {
    case 'idle':
      return 'Type 2 or more letters.';
    case 'searching':
      return 'Searching…';
    case 'failed':
      return 'The search is not available. Try again.';
    case 'done':
      return null;
  }
}
