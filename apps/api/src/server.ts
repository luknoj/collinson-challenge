import { ApolloServer } from '@apollo/server';
import { resolvers } from './resolvers/index.js';
import { typeDefs } from './schema.js';
import { assertValidScoringConfigs } from './scoring/index.js';

export function createServer(): ApolloServer {
  assertValidScoringConfigs();
  return new ApolloServer({ typeDefs, resolvers });
}
