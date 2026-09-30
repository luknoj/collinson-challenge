import { ApolloServer } from '@apollo/server';
import type { Context } from './context.js';
import { resolvers } from './resolvers/index.js';
import { typeDefs } from './schema.js';
import { assertValidScoringConfigs } from './scoring/index.js';

export function createServer(): ApolloServer<Context> {
  assertValidScoringConfigs();
  return new ApolloServer<Context>({ typeDefs, resolvers });
}
