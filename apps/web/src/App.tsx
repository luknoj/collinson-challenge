import { useQuery } from '@apollo/client/react';
import styles from './App.module.css';
import { HealthDocument } from './generated/graphql';

export function App() {
  const { data, loading, error } = useQuery(HealthDocument);

  let status = 'Checking the API…';
  if (error) status = `The API is not available: ${error.message}`;
  else if (!loading && data) status = `API status: ${data.health}`;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Activity Forecast</h1>
      <p className={styles.status}>{status}</p>
    </main>
  );
}
