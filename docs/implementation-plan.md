# Implementation Plan

This document tells the order of the work. It divides the work into phases. Each phase has a goal, tasks, a result and a "done when" condition.

- **What to build:** [architecture.md](architecture.md) and [ui-spec.md](ui-spec.md)
- **Scoring rules:** [scoring.md](scoring.md)

## Rules for all phases

- Use 1 branch for each phase (for example, `phase-1-scoring`). The owner of the repository merges each branch.
- When the code and a doc do not agree, change the doc in the same branch.
- A phase is complete only when `pnpm lint` and `pnpm test` pass.

## Status

| Phase | Name | Depends on | Status |
|---|---|---|---|
| 0 | Workspace setup | – | Done |
| 1 | Scoring functions | 0 | Done |
| 2 | Open-Meteo clients and data layer | 0 | Not started |
| 3 | GraphQL API | 1, 2 | Not started |
| 4 | Search, header and URL | 0 | Not started |
| 5 | Activity rows | 3, 4 | Not started |
| 6 | Explanations | 5 | Not started |
| 7 | Final checks | 6 | Not started |

Phases 2 and 4 do not need the scoring functions. Thus, you can do them before phase 1 or at the same time.

## Phase 0: Workspace setup

**Goal:** An empty app that starts with 1 command.

**Tasks:**

1. Add `.nvmrc` (Node.js 24) and a root `package.json` with the `packageManager` field for pnpm.
2. Add `pnpm-workspace.yaml` with `apps/*`.
3. Add a base `tsconfig` with strict mode. Each app extends it.
4. Make `apps/api`: Apollo Server with `startStandaloneServer` on port 4000, and a temporary `health` query.
5. Make `apps/web` with Vite (React, TypeScript). Add the dev proxy: `/graphql` → port 4000.
6. Add ESLint and Prettier with 1 config at the root.
7. Add Vitest to the 2 apps.
8. Add `codegen.ts` for GraphQL Code Generator. It makes the resolver types (API) and the typed documents (web).
9. Add the root scripts: `dev`, `test`, `lint`, `codegen`.
10. Add `styles/tokens.css` with the first colors and sizes.

**Result:** The browser shows a page that sends the `health` query and shows the answer.

**Done when:**

- `pnpm install` and `pnpm dev` start the 2 apps.
- `pnpm lint`, `pnpm test` and `pnpm codegen` pass.

## Phase 1: Scoring functions

**Goal:** Pure functions that calculate all scores from weather data. They do not call an API.

**Tasks:**

1. Define the input type: a normalized weather model with hourly and daily arrays in the local time of the town. The Open-Meteo clients (phase 2) make this model.
2. `scoring/shared/`:
   - The curve function.
   - Labels.
   - The weekly score.
   - Confidence.
   - Ended days.
   - Config validation at startup.
3. `scoring/outdoor/`: factors, gates, the UV note and fog.
4. `scoring/indoor/`: levels from the outdoor score, and the travel, busy and town size hints.
5. `scoring/skiing/`:
   - Factors and gates.
   - The fresh snow window (72 h before 09:00).
   - The snow depth check.
   - The mountain town note (from the elevation points).
6. `scoring/surfing/`:
   - Factors and gates.
   - The coast direction from the ring points.
   - The wind direction adjustment.
7. `scoring/shared/summary.ts`: the weekly summary items.
8. 1 config file for each activity, and `shared/config.ts`.

Do the tasks in this order: 2, 3, 4, 5, 6, 7. Indoor needs outdoor. The summary needs all activities.

**Result:** A scoring module that returns results in the shape of the GraphQL types.

**Done when:**

- Each factor, gate, adjustment and note has at least 1 unit test.
- The tests include the limits of each curve and each gate (the value at the limit, and 1 value on each side).
- The startup validation stops the server when a config is not correct. A test shows this.

## Phase 2: Open-Meteo clients and data layer

**Goal:** Reliable calls to the Forecast, Marine and Elevation APIs.

**Tasks:**

1. `openMeteo/dataLayer.ts`: joined calls, the TTL cache, retries, the time limit, and no cache for failures. Use the values in [architecture.md](architecture.md), section 4.1.
2. `openMeteo/forecast.ts`: the request with `forecast_days=7`, `past_days=3` and `timezone=auto`. Change the response to the normalized weather model.
3. `openMeteo/marine.ts`: the request and the "all null" check.
4. `openMeteo/elevation.ts`: 1 request with 81 points (the 7×7 grid and the ring).

**Result:** Functions that return typed data or a typed error.

**Done when:** API tests with `msw` show these results:

- 2 calls at the same time for the same data cause 1 request.
- A retry follows a failure.
- A failed call is not in the cache. The next call sends a new request.
- A slow API stops at the time limit.

## Phase 3: GraphQL API

**Goal:** The `activities` query returns all 4 results.

**Tasks:**

1. Write `schema.graphql` from [architecture.md](architecture.md), section 5. Run `pnpm codegen`.
2. `resolvers/validateLocation.ts`: the input checks. Return `BAD_USER_INPUT` when a check fails.
3. 1 resolver for each activity. The indoor resolver uses the outdoor score function.
4. The errors: `UPSTREAM_UNAVAILABLE` for Forecast and Marine failures. A note (not an error) for Elevation failures.
5. The ended days: use the current UTC time and `utc_offset_seconds` from the Forecast API.
6. Remove the `health` query from phase 0.

**Result:** A working API. You can test it in the Apollo Sandbox.

**Done when:** API tests with a mocked Open-Meteo show these results:

- A town near the sea returns 4 results. A town far from the sea returns `NOT_APPLICABLE` for surfing.
- A Marine failure gives an error only on `surfing`.
- A Forecast failure gives an error on all 4 fields.
- An Elevation failure gives a note and no error.
- An incorrect latitude gives `BAD_USER_INPUT`.

## Phase 4: Search, header and URL

**Goal:** The user can find a town and see the header. There are no activity rows yet.

**Tasks:**

1. `geocoding/geocoding.ts`: `/search` and `/get`.
2. `SearchBox` with the Base UI `Combobox`: 2 characters or more, a delay of 300 ms, "No town found".
3. `PlaceHeader`: name, region, country and the local time (`Intl.DateTimeFormat`).
4. `url/placeUrl.ts`: read and write `?place=` and `&name=`, and make the slug.
5. The empty state, "Town not found", and "The town data is not available. Try again."

**Result:** Search, selection, header and page reload work.

**Done when:** A manual check shows these results:

- "Paris" gives more than 1 match (France and the USA).
- A page reload with `?place=2988507` shows Paris.
- An unknown `id` shows "Town not found".

## Phase 5: Activity rows

**Goal:** The screen shows the 4 rows with all the data.

**Tasks:**

1. Apollo Client and the 4 row queries. The screen waits until all 4 settle.
2. `ActivityRow` and `DayCard`:
   - The gradient, the score, the label and the confidence shade.
   - The "Ended" state.
   - "Not applicable".
   - "Data not available" with "Try again".
3. `WeeklySummary` (the default view) and `DayBreakdown` (after a click on a day). The breakdown uses the Base UI `Meter` for the factor bars.
4. `IndoorRow`:
   - The 3 blue colors and "Recommended on X of 7 days".
   - The explanation at the top.
   - The town size hint.
5. The phone layout: horizontal scroll with snap.
6. Check the contrast of the gradient (4.5:1 or more).

**Result:** The main screen is complete. At this time, the sentences use simple text, with no popovers.

**Done when:** A manual check with the 5 towns from [scoring-examples.md](scoring-examples.md) (Zermatt, Ericeira, Newquay, Kraków, Zakopane) shows the correct rows. For example, Kraków shows surfing as "Not applicable". The layout works at a width of 360 px.

## Phase 6: Explanations

**Goal:** Each word that needs an explanation has a popover. The rules are in 1 panel.

**Tasks:**

1. `text/templates.ts`: 1 template for each `ExplanationKey`. A missing template gives a TypeScript error.
2. The `Explanation` component with the Base UI `Popover`.
3. The `HowScoresWork` panel with the Base UI `Drawer`:
   - Labels and colors.
   - Weekly score.
   - Confidence.
   - Ended days.
   - Local time.
   - Indoor sightseeing.
   - Data source and limits.
4. The "More" links from a popover to the correct section of the panel.
5. Replace the simple text from phase 5 with the templates.

**Result:** The complete UI from [ui-spec.md](ui-spec.md).

**Done when:**

- Each key has a template. `pnpm lint` shows no errors.
- The popovers and the panel close with Escape, and the focus goes back to the button.

## Phase 7: Final checks

**Goal:** The app is ready for review.

**Tasks:**

1. Update `README.md`: what the app does, the requirements (Node.js 24, pnpm), the commands, and links to the docs.
2. Do a full manual check with the 5 example towns and with 1 town that has no population data.
3. Compare the docs with the code. Correct all differences.

**Result:** A complete app and correct docs.

**Done when:**

- A new clone of the repository starts with `pnpm install` and `pnpm dev`.
- `pnpm lint` and `pnpm test` pass.
