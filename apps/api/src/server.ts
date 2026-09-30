import { ApolloServer } from '@apollo/server';
import { resolvers } from './resolvers/index.js';
import { typeDefs } from './schema.js';

export function createServer(): ApolloServer {
  return new ApolloServer({ typeDefs, resolvers });
}
