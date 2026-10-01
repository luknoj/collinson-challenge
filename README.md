# Activity Forecast

Find a town to see the best days for skiing, surfing, and outdoor and indoor sightseeing in the next 7 days. All data comes from Open-Meteo.

## Approach

1. **Scoring first.** Before any code, I worked out how each activity should be scored. AI research gave me a starting point, and then I checked the assumptions against real evidence (studies, industry rules and actual Open-Meteo responses). That's in [scoring.md](docs/scoring.md), with the [evidence](docs/scoring-evidence.md) and [worked examples](docs/scoring-examples.md).
2. **Plan.** It started as one big document. I split it into the [architecture](docs/architecture.md), the [UI spec](docs/ui-spec.md) and an [implementation plan](docs/implementation-plan.md) with eight phases.
3. **A second opinion.** I had another coding agent go through the docs. The gaps it found, plus a few ideas of my own, went into [future improvements](docs/future-improvements.md). For example, I came across the Air Quality API while digging through Open-Meteo, but I didn't want to change the plan halfway through, so it's parked there.
4. **Implementation.** One phase at a time, one pull request per phase, and I reviewed each one before merging. I tested whatever was easy to test along the way.
5. **Fixes from testing.** Some gaps only showed up once I went through the app. For example: skiing was using the strongest gusts of the whole day, instead of only the lift hours (PR #11).

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
