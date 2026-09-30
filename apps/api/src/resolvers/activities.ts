import { GraphQLError } from 'graphql';
import type { Context } from '../context.js';
import type { ActivitiesResolvers } from '../generated/graphql.js';
import { getTerrain } from '../openMeteo/elevation.js';
import { OpenMeteoError } from '../openMeteo/errors.js';
import { getForecast } from '../openMeteo/forecast.js';
import { getMarine } from '../openMeteo/marine.js';
import {
  recommendIndoor,
  scoreOutdoor,
  scoreSkiing,
  scoreSurfing,
  type Terrain,
} from '../scoring/index.js';
import type { Location } from './validateLocation.js';

/** The value of Query.activities. Each activity field uses the location. */
export interface ActivitiesParent {
  location: Location;
}

export const UPSTREAM_UNAVAILABLE = 'UPSTREAM_UNAVAILABLE';

/**
 * 1 resolver for each activity (architecture.md, section 3). The data layer
 * joins the calls, so 4 fields cause only 1 Forecast request.
 */
export const activitiesResolvers: ActivitiesResolvers<Context> = {
  id: ({ location }) => location.id,

  skiing: ({ location }, _args, context) =>
    resolveField({
      context,
      run: async () => {
        const [forecast, terrain] = await Promise.all([
          getForecast({ dataLayer: context.dataLayer, location }),
          terrainOrNull({ context, location }),
        ]);
        return scoreSkiing({ forecast, now: context.now, terrain });
      },
    }),

  surfing: ({ location }, _args, context) =>
    resolveField({
      context,
      run: async () => {
        const [forecast, marine, terrain] = await Promise.all([
          getForecast({ dataLayer: context.dataLayer, location }),
          getMarine({ dataLayer: context.dataLayer, location }),
          terrainOrNull({ context, location }),
        ]);
        return scoreSurfing({ forecast, now: context.now, marine, terrain });
      },
    }),

  outdoor: ({ location }, _args, context) =>
    resolveField({
      context,
      run: async () => {
        const forecast = await getForecast({
          dataLayer: context.dataLayer,
          location,
        });
        return scoreOutdoor({ forecast, now: context.now });
      },
    }),

  indoor: ({ location }, _args, context) =>
    resolveField({
      context,
      run: async () => {
        const forecast = await getForecast({
          dataLayer: context.dataLayer,
          location,
        });
        // The calculation is fast, and the weather data is in the cache.
        const outdoor = scoreOutdoor({ forecast, now: context.now });
        return recommendIndoor({
          forecast,
          outdoor,
          place: {
            population: location.population,
            featureCode: location.featureCode,
          },
        });
      },
    }),
};

/**
 * An Elevation failure is not an error (architecture.md, section 4.2). The
 * scoring functions add a note when the terrain is null.
 */
async function terrainOrNull({
  context,
  location,
}: {
  context: Context;
  location: Location;
}): Promise<Terrain | null> {
  try {
    return await getTerrain({ dataLayer: context.dataLayer, location });
  } catch (error) {
    if (!(error instanceof OpenMeteoError)) throw error;
    console.warn(`Location ${location.id}: no terrain data. ${error.message}`);
    return null;
  }
}

class TimeLimitError extends Error {
  constructor(ms: number) {
    super(`The resolver did not end in ${ms} ms.`);
    this.name = 'TimeLimitError';
  }
}

/**
 * Stops the field after the time limit (architecture.md, section 4.1).
 * Changes an Open-Meteo failure to UPSTREAM_UNAVAILABLE (section 4.2).
 */
async function resolveField<T>({
  context,
  run,
}: {
  context: Context;
  run: () => Promise<T>;
}): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeLimit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeLimitError(context.timeLimitMs)),
      context.timeLimitMs,
    );
  });

  try {
    return await Promise.race([run(), timeLimit]);
  } catch (error) {
    if (error instanceof OpenMeteoError || error instanceof TimeLimitError) {
      console.warn(error.message);
      throw new GraphQLError('The weather data is not available.', {
        originalError: error,
        extensions: {
          code: UPSTREAM_UNAVAILABLE,
          api: error instanceof OpenMeteoError ? error.api : null,
          reason: error instanceof OpenMeteoError ? error.reason : 'TIME_LIMIT',
        },
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
