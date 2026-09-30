export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ForecastLocation extends Coordinates {
  /** m, from Geocoding. null: Open-Meteo uses its own terrain model. */
  elevation: number | null;
}
