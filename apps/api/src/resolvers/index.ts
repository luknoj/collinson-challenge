import type { Context } from '../context.js';
import type { Resolvers } from '../generated/graphql.js';
import { activitiesResolvers } from './activities.js';
import { JSONScalar } from './json.js';
import { validateLocation } from './validateLocation.js';

export const resolvers: Resolvers<Context> = {
  Query: {
    activities: (_parent, { location }) => ({
      location: validateLocation(location),
    }),
  },
  Activities: activitiesResolvers,
  JSON: JSONScalar,
};
