## Approach

Ive started working on the APP by "checking" how the scoring system should work for the required activities. From there i was incrementally adjusting it, from AI findings to pushing it with any data evidence to confirm the assumptions on the scoring. First there was one big document with examples, sources etc. It got split to build an [architecture plan](docs/architecture.md) and finally the [implementation-plan](docs/implementation-plan.md). When all of that was done i was building everything step by step and testing parts that i could easily test. In between i was facing some misalignments with the scoring that was being adjusted and somewhere i think around phase 3 i checked the progress and documents with another coding agent. From that ive created the [future-improvements](docs/future-improvements.md) plan with gaps and additional ideas like the usage of Air Quality API - this also came from checking the Open Meteo API by myself, but didn't want to flip everything midway and left it as an improvement. From the commits and PR history you can see that some of the gaps surfaced while testing and were fixed during the development.

## Requirements

- Node.js 24 or later. The repository has an `.nvmrc` file, thus you can use `nvm use`.
- pnpm 11. With Corepack, run `corepack enable`. The `packageManager` field in `package.json` sets the version.

## Start the app

```sh
pnpm install
pnpm dev
```

Then open http://localhost:5173.

`pnpm dev` makes the GraphQL types, then starts 2 servers:

| App | Folder | URL |
|---|---|---|
| Frontend (React, Vite) | `apps/web` | http://localhost:5173 |
| Backend (Apollo Server) | `apps/api` | http://localhost:4000 |

Vite sends the `/graphql` requests to port 4000. To use a different port for the backend, set `PORT` (for example, `PORT=4100 pnpm dev`). The Vite proxy then does not find the backend, thus change `apps/web/vite.config.ts` also.

## Commands

| Command | Result |
|---|---|
| `pnpm install` | Installs the dependencies of the 2 apps. |
| `pnpm dev` | Runs `pnpm codegen`, then starts the backend and the frontend. |
| `pnpm codegen` | Makes the TypeScript types from `apps/api/src/schema.graphql` and the `.graphql` documents. |
| `pnpm test` | Runs `pnpm codegen`, then the tests (Vitest). |
| `pnpm typecheck` | Runs `pnpm codegen`, then the TypeScript checks in the 2 apps. |
| `pnpm lint` | Runs the ESLint and Prettier checks. |
| `pnpm format` | Formats the code with Prettier. |

The generated files are not in git. `pnpm dev`, `pnpm test` and `pnpm typecheck` make them. If your editor shows missing types after `pnpm install`, run `pnpm codegen`.

## Tests

- **Scoring unit tests:** the curves, factors, gates, adjustments, weekly scores, ended days, summary rules and the config checks. The tests use fixed weather data.
- **API tests:** GraphQL queries to Apollo Server with a mocked Open-Meteo (`msw`). They check the partial failures, the retries, the joined calls, the cache, the 10 s limit and the input checks.

No test calls the real Open-Meteo. There are no frontend tests and no end-to-end tests.

## Documents

| Document | Contents |
|---|---|
| [docs/scoring.md](docs/scoring.md) | The scoring rules: factors, weights, curves, gates and adjustments for each activity. |
| [docs/scoring-examples.md](docs/scoring-examples.md) | The calculations for 5 towns and for 1 full week. |
| [docs/scoring-evidence.md](docs/scoring-evidence.md) | The research for each factor, the results of our API tests, and the sources. |
| [docs/architecture.md](docs/architecture.md) | The technology, the repository structure, the data flow, the backend and the GraphQL schema. |
| [docs/ui-spec.md](docs/ui-spec.md) | What the screen shows and what it does. |
| [docs/implementation-plan.md](docs/implementation-plan.md) | The phases of the work. |
| [docs/future-improvements.md](docs/future-improvements.md) | Known problems and ideas for later. |
