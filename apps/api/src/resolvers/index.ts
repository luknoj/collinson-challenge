import type { Resolvers } from '../generated/graphql.js';

export const resolvers: Resolvers = {
  Query: {
    health: () => 'ok',
  },
};
