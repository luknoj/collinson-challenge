import { startStandaloneServer } from '@apollo/server/standalone';
import { createContext } from './context.js';
import { createDataLayer } from './openMeteo/dataLayer.js';
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 4000);
// 1 data layer for all requests: the cache and the joined calls are shared.
const dataLayer = createDataLayer();

const { url } = await startStandaloneServer(createServer(), {
  listen: { port },
  context: async () => createContext({ dataLayer }),
});

console.log(`API ready at ${url}`);
