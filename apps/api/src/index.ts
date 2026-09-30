import { startStandaloneServer } from '@apollo/server/standalone';
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 4000);

const { url } = await startStandaloneServer(createServer(), {
  listen: { port },
});

console.log(`API ready at ${url}`);
