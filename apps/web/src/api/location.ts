import type { LocationInput } from '../generated/graphql';
import type { Place } from '../geocoding/geocoding';

/** The GraphQL input from a Geocoding place. */
export function toLocationInput(place: Place): LocationInput {
  return {
    id: String(place.id),
    latitude: place.latitude,
    longitude: place.longitude,
    elevation: place.elevation,
    population: place.population,
    featureCode: place.featureCode,
  };
}
