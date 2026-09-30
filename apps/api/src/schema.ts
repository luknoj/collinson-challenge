import { readFileSync } from 'node:fs';

export const typeDefs = readFileSync(
  new URL('./schema.graphql', import.meta.url),
  'utf8',
);
