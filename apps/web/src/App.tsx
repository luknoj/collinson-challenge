import styles from './App.module.css';
import { ActivityRows } from './components/ActivityRows/ActivityRows';
import { HowScoresWork } from './components/HowScoresWork/HowScoresWork';
import { PlaceHeader } from './components/PlaceHeader/PlaceHeader';
import { SearchBox } from './components/SearchBox/SearchBox';
import { usePlace, type PlaceState } from './place/usePlace';

export function App() {
  const { state, select, retry } = usePlace();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Activity Forecast</h1>
      <SearchBox
        selected={state.status === 'ready' ? state.place : null}
        initialText={state.status === 'empty' ? state.searchText : ''}
        onSelect={select}
      />
      <section className={styles.content} aria-live="polite">
        <Content state={state} retry={retry} />
      </section>
      <HowScoresWork />
    </main>
  );
}

function Content({ state, retry }: { state: PlaceState; retry: () => void }) {
  switch (state.status) {
    case 'empty':
      return (
        <p className={styles.intro}>
          Find a town to see the best days for skiing, surfing and sightseeing
          in the next 7 days.
        </p>
      );
    case 'loading':
      return <div className={styles.placeholder} aria-busy="true" />;
    case 'ready':
      return (
        <>
          <PlaceHeader place={state.place} />
          <ActivityRows key={state.place.id} place={state.place} />
        </>
      );
    case 'notFound':
      return (
        <p className={styles.message} role="alert">
          Town not found.
        </p>
      );
    case 'failed':
      return (
        <div className={styles.message} role="alert">
          <p>The town data is not available.</p>
          <button type="button" className={styles.button} onClick={retry}>
            Try again
          </button>
        </div>
      );
  }
}
