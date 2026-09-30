import { ApolloServerErrorCode } from '@apollo/server/errors';
import { GraphQLError } from 'graphql';
import type { LocationInput } from '../generated/graphql.js';

export interface Location {
  id: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  population: number | null;
  featureCode: string | null;
}

interface Check {
  field: keyof LocationInput;
  valid: boolean;
  rule: string;
}

/**
 * architecture.md, section 4.3. The backend does not call Geocoding. Thus, it
 * checks the location from the frontend. Gives BAD_USER_INPUT for each
 * incorrect value.
 */
export function validateLocation(input: LocationInput): Location {
  const elevation = input.elevation ?? null;
  const population = input.population ?? null;
  const checks: Check[] = [
    {
      field: 'id',
      valid: input.id.trim() !== '',
      rule: 'must not be empty',
    },
    {
      field: 'latitude',
      valid: inRange({ value: input.latitude, min: -90, max: 90 }),
      rule: 'must be from -90 to 90',
    },
    {
      field: 'longitude',
      valid: inRange({ value: input.longitude, min: -180, max: 180 }),
      rule: 'must be from -180 to 180',
    },
    {
      field: 'elevation',
      valid:
        elevation === null ||
        inRange({ value: elevation, min: -500, max: 9000 }),
      rule: 'must be from -500 to 9000',
    },
    {
      field: 'population',
      valid: population === null || population >= 0,
      rule: 'must be 0 or more',
    },
  ];

  const failed = checks.filter((c) => !c.valid);
  if (failed.length > 0) {
    throw new GraphQLError(
      `The location is not correct: ${failed.map((c) => `${c.field} ${c.rule}`).join(', ')}.`,
      {
        extensions: {
          code: ApolloServerErrorCode.BAD_USER_INPUT,
          fields: failed.map((c) => c.field),
        },
      },
    );
  }

  return {
    id: input.id,
    latitude: input.latitude,
    longitude: input.longitude,
    elevation,
    population,
    featureCode: input.featureCode ?? null,
  };
}

function inRange({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): boolean {
  return value >= min && value <= max;
}
