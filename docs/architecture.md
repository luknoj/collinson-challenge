# Architecture

This document tells how the app is built: the technology, the repository structure, the data flow, the backend and the GraphQL schema. The app has 1 screen. The user finds a town, and the app shows the scores for 4 activities for the next 7 days.

- **UI specification:** [ui-spec.md](ui-spec.md)
- **Order of the work:** [implementation-plan.md](implementation-plan.md)
- **Scoring rules:** [scoring.md](scoring.md)
- **Examples:** [scoring-examples.md](scoring-examples.md)
- **Evidence:** [scoring-evidence.md](scoring-evidence.md)
- **Known problems and ideas for later:** [future-improvements.md](future-improvements.md)

## 1. Technology

| Part | Selection |
|---|---|
| Package manager | pnpm, with a workspace |
| Frontend | React, TypeScript, Vite, CSS modules |
| UI components | Base UI (`@base-ui/react`): Combobox, Popover, Drawer, Meter |
| GraphQL client | Apollo Client |
| Backend | Node.js, TypeScript, Apollo Server (`startStandaloneServer`) |
| GraphQL schema | Schema-first (`.graphql` file) |
| Types | GraphQL Code Generator for the 2 apps |
| Tests | Vitest, `msw` |
| Code quality | TypeScript strict mode, ESLint, Prettier |
| Data | Open-Meteo only. The frontend calls Geocoding. The backend calls Forecast, Marine and Elevation. |

The app runs only on a local computer. There is no deployment and no Docker setup.

**Versions:** Some latest versions do not work together. Thus, the workspace uses these versions:

- `graphql` 16, because Apollo Server 5 needs `graphql` 16.
- TypeScript 6.0, because `typescript-eslint` supports only versions lower than 6.1.
- pnpm blocks packages that are less than 1 day old. Do not add exceptions for new versions. Use an older version.

## 2. Repository structure

```
.nvmrc                      Node.js 24 (LTS)
package.json                root scripts, "packageManager" field for pnpm
pnpm-workspace.yaml         apps/*, allowed install scripts
tsconfig.base.json          strict settings, each app extends it
codegen.ts                  GraphQL Code Generator config for the 2 apps
eslint.config.js
.prettierrc                 .prettierignore excludes the Markdown docs

apps/api/src/
  index.ts                  Apollo Server start (startStandaloneServer)
  server.ts                 createServer(), also used by the tests
  schema.graphql            the contract between the 2 apps
  schema.ts                 reads schema.graphql
  resolvers/                Query, activity fields
    validateLocation.ts     input checks (BAD_USER_INPUT)
  openMeteo/
    forecast.ts
    marine.ts
    elevation.ts            1 request with 81 points (7×7 grid + ring)
    dataLayer.ts            joined calls, cache, retries, time limit
  scoring/
    shared/
      config.ts             labels, weekly score, confidence, windows
      curve.ts              piecewise-linear curve
      week.ts               weekly score, ended days
      summary.ts            weekly summary rules
      validate.ts           config checks at startup
    skiing/                 config.ts, score.ts, score.test.ts
    surfing/                config.ts, score.ts, score.test.ts
    outdoor/                config.ts, score.ts, score.test.ts
    indoor/                 config.ts, recommend.ts, recommend.test.ts
  generated/                resolver types (made by codegen, not in git)

apps/web/src/
  main.tsx
  App.tsx
  api/                      Apollo Client, queries (.graphql)
  geocoding/
    geocoding.ts            direct calls to Geocoding /search and /get
  generated/                typed documents (made by codegen, not in git)
  components/
    SearchBox/              Base UI Combobox
    PlaceHeader/
    ActivityRow/            header, day cards, summary or breakdown
    DayCard/
    DayBreakdown/
    WeeklySummary/
    IndoorRow/
    Explanation/            text with a popover
    HowScoresWork/          side panel (Base UI Drawer)
  text/
    templates.ts            1 text template for each ExplanationKey
  url/
    placeUrl.ts             read and write ?place= and &name=
  styles/
    tokens.css              all colors and sizes
    global.css              base styles for the page (uses the tokens)

docs/                       scoring, architecture and UI docs
```

Each component folder contains the component and its CSS module (for example, `DayCard.tsx` and `DayCard.module.css`).

## 3. Data flow

```
Frontend                          Backend resolvers    Data layer             Open-Meteo
────────                          ─────────────────    ──────────             ──────────
Search field  ──────────────────────────────────────────────────────────→  Geocoding /search
Selection: header from the suggestion (no call)
Page reload: ?place=<id>  ──────────────────────────────────────────────→  Geocoding /get
Header shows (it does not wait for the rows)

SkiingRow query    (location) →   skiing   ─┐
SurfingRow query   (location) →   surfing  ─┤→ forecast(lat, lon) ───→  Forecast  (1 call)
OutdoorRow query   (location) →   outdoor  ─┤→ marine(lat, lon)   ───→  Marine    (1 call, surfing only)
IndoorRow query    (location) →   indoor   ─┘→ elevation(points)  ───→  Elevation (1 call, skiing and surfing)
                                    │
                                    └→ indoor uses the outdoor score function
```

- **Header:** The frontend gets the header data directly from Open-Meteo Geocoding. The Geocoding API allows calls from a browser (`access-control-allow-origin: *`).
  - After a selection, the suggestion already has all the data. There is no call.
  - After a page reload, the frontend calls `/get` with the `id` from the URL.
  - The header does not wait for the activity rows.
- **Activity rows:** The frontend sends 4 queries in parallel, 1 for each row. Each query sends the location from Geocoding. Each query has its own resolver on the backend.

| Activity | Forecast | Marine | Elevation |
|---|---|---|---|
| Skiing | Yes | No | Only for the mountain note |
| Surfing | Yes | Yes | Only for the coast direction |
| Outdoor | Yes | No | No |
| Indoor | Yes (from the outdoor score) | No | No |

## 4. Backend

### 4.1 Data layer

All calls to Open-Meteo go through the data layer. It has these functions:

- **Joined calls:** The data layer keeps the promise of each open call in a map. The key is the API and the parameters. When a second resolver asks for the same data during the call, it gets the same promise. Thus, 4 resolvers cause only 1 Forecast call.
- **Cache with a time limit (TTL):** The data layer keeps each result in memory.

  | API | TTL |
  |---|---|
  | Forecast | 30 min |
  | Marine | 30 min |
  | Elevation | 30 days |

- **Retries:** The data layer tries each failed call again 2 times, after 300 ms and after 900 ms. Each call has a timeout of 8 s.
- **Time limit for each resolver:** 10 s. After 10 s, the resolver stops and returns an error.
- **No cache for failures:** When a call fails, the data layer removes the promise from the map. It does not keep the error. Thus, "Try again" sends a new call.

### 4.2 Failures

| Failure | Result |
|---|---|
| Geocoding `/get` fails (frontend, after a page reload) | The header and the rows do not show. The screen shows "The town data is not available. Try again." The rows do not start, because they need the coordinates. |
| The `id` is not found (Geocoding returns HTTP 400, "Location ID not found") | The screen shows "Town not found" and the search field. There is no "Try again". |
| The location input is not correct | The backend returns a GraphQL error with `extensions.code = "BAD_USER_INPUT"`. |
| Forecast fails | All activity fields fail. Each row shows "Data not available" and "Try again". |
| Marine fails | Only the `surfing` field fails. |
| Elevation fails | No error. Skiing: the score does not change, but there is no mountain note. Surfing: there is no wind direction adjustment (−10 to +5), so the score can change. A note in each row tells the user. |

The screen texts for these cases are in [ui-spec.md](ui-spec.md). A failed field returns a GraphQL error with `extensions.code = "UPSTREAM_UNAVAILABLE"`. "Not applicable" is not an error. It is a valid result with `status: NOT_APPLICABLE`.

### 4.3 Location input

The backend gets the location from the frontend. It does not call Geocoding. Thus, it must check the input:

- Latitude: from −90 to 90.
- Longitude: from −180 to 180.
- Elevation: from −500 to 9,000 m.
- Population: 0 or more.

If a value is not correct, the backend returns `BAD_USER_INPUT`. The risk of incorrect data is low. The data is public, and incorrect data gives an incorrect result only for the person who sent it.

### 4.4 Scoring

- The scoring functions are pure functions. They get the weather data and the config. They return the result for the schema.
- Each activity has its own config file. `shared/config.ts` contains the values that all activities use.
- At startup, `validate.ts` checks all configs:
  - The weights of each activity add up to 1.
  - The x values of each curve increase.
  - All sub-scores are from 0 to 1.

  If a check fails, the server does not start and shows the error.
- The indoor resolver calls the outdoor score function. The calculation is fast, and the weather data comes from the cache.
- The optional indoor value (refer to [scoring.md](scoring.md), section 6) is not in the API.

### 4.5 Days and local time

- The Forecast request uses `timezone=auto`. All days and hours are in the local time of the town.
- The local time in the header comes from the frontend. It uses `Intl.DateTimeFormat` with the time zone from Geocoding.
- The 7 days are today to today + 6, in the town.
- **Ended days:** When the activity window of today has ended in the town, the day is "Ended". The backend uses the current UTC time and `utc_offset_seconds` from the Forecast API. The time of the user's computer has no effect.
  - Outdoor and indoor: after 18:00. Skiing: after 16:00. Surfing: after sunset.
  - An ended day has a score and a breakdown.
  - The weekly score and the best days do not use an ended day.

### 4.6 Weekly summary

The backend makes the summary with rules. It returns structured items (key, `params`, days). The frontend writes the sentences.

| Item | Rule |
|---|---|
| Best days | The 1–2 days with the highest score. Only days with a score of 40 or more. No ended days. |
| Trend | Compare the mean of days 1–3 with the mean of days 5–7. Give the factor with the largest change. |
| Warnings | All gates with an effect during the week, with their days. |
| Confidence | A note when the best days have Medium or Low confidence. |
| Notes | The mountain note, the coast direction note, and the note for missing terrain data. |

Indoor summary: the days with "Recommended", the days with the busy hint, and the town size hint. For a good week: "The outdoor weather is good all week. Keep indoor visits for the evenings or for a rest day."

## 5. GraphQL schema

```graphql
input LocationInput {
  id: ID!                 # Geocoding id, for the Apollo cache and the logs
  latitude: Float!
  longitude: Float!
  elevation: Float        # for the Forecast API
  population: Int         # for the town size hint, null if Geocoding has no data
  featureCode: String     # PPLC = capital, for the town size hint
}

type Query {
  activities(location: LocationInput!): Activities!
}

type Activities {
  id: ID!                 # the same as LocationInput.id
  skiing: ActivityResult!
  surfing: ActivityResult!
  outdoor: ActivityResult!
  indoor: IndoorResult!
}

enum ActivityStatus { OK  NOT_APPLICABLE }
enum Label { POOR  FAIR  MODERATE  GOOD  EXCELLENT }
enum Confidence { HIGH  MEDIUM  LOW }

type ActivityResult {
  status: ActivityStatus!
  notApplicableReason: Explanation     # for example, NO_SEA_NEARBY
  weeklyScore: Int                     # null when NOT_APPLICABLE
  weeklyLabel: Label
  days: [DayScore!]!                   # 7 items, empty when NOT_APPLICABLE
  summary: [Explanation!]!
  notes: [Explanation!]!
}

type DayScore {
  date: String!                        # YYYY-MM-DD, local date of the town
  score: Int!
  label: Label!
  confidence: Confidence!
  ended: Boolean!
  scoreBeforeGates: Int!
  factors: [Factor!]!
  gates: [Explanation!]!               # only the gates with an effect
  adjustments: [Adjustment!]!
  reasons: [Explanation!]!             # the 1–2 worst factors
}

type Factor {
  key: ExplanationKey!
  value: Float
  unit: String                         # "m", "cm", "°C", "km/h", "%"
  subScore: Float!                     # 0–1
  weight: Float!                       # 0–1
  points: Float!                       # weight × subScore × 100
}

type Adjustment {
  key: ExplanationKey!
  points: Int!
  params: JSON
}

type Explanation {
  key: ExplanationKey!
  params: JSON                         # the values for the text template
  days: [String!]                      # dates, for weekly summary items
}

enum IndoorLevel { RECOMMENDED  GOOD_ALTERNATIVE  SAVE_FOR_LATER }

type IndoorResult {
  recommendedDays: Int!                # "Recommended on 3 of 7 days"
  days: [IndoorDay!]!
  summary: [Explanation!]!
  townSize: Explanation!               # NO_DATA when population is null
}

type IndoorDay {
  date: String!
  level: IndoorLevel!
  ended: Boolean!
  outdoorScore: Int!
  mainCause: Explanation               # the outdoor gate or the worst factor
  hints: [Explanation!]!               # TRAVEL, BUSY
}

enum ExplanationKey {
  SNOW_BASE
  FRESH_SNOW
  RAIN_ON_SNOW_GATE
  ONSHORE_WIND
  NO_SEA_NEARBY
  MOUNTAIN_NOTE
  # … 1 key for each factor, gate, adjustment, note, hint and summary item
}

scalar JSON
```

Rules for the schema:

- **`params` uses a `JSON` scalar.** Each key has different values. The frontend has a TypeScript type for the `params` of each key.
- **The keys are an `enum`.** The frontend has a `Record<ExplanationKey, Template>`. Thus, a missing template gives a TypeScript error.
- **Scores are integers.** The factor points are decimals. The UI rounds them.
- **Units are metric only.**
- **There is no Geocoding query.** The frontend calls Geocoding directly (section 3).

## 6. Tests

| Level | Tool | What the tests check |
|---|---|---|---|
| Scoring unit tests | Vitest | Curves, factors, gates, adjustments, weekly score, ended days, summary rules, config validation. The tests use fixed weather data. |
| API tests | Vitest, `msw` | GraphQL queries to Apollo Server with a mocked Open-Meteo: partial failures, retries, joined calls, no cache for failures, the 10 s limit, `NOT_APPLICABLE`, `BAD_USER_INPUT`. |

No test calls the real Open-Meteo. There are no frontend tests and no end-to-end tests now.

## 7. Commands

| Command | Result |
|---|---|
| `pnpm install` | Installs the dependencies of the 2 apps. |
| `pnpm dev` | Runs `pnpm codegen`, then starts the API (port 4000) and Vite (port 5173). Vite sends `/graphql` to port 4000. |
| `pnpm codegen` | Makes the types from `schema.graphql` and the `.graphql` documents for the 2 apps. |
| `pnpm test` | Runs `pnpm codegen`, then the tests. |
| `pnpm typecheck` | Runs `pnpm codegen`, then TypeScript checks in the 2 apps. |
| `pnpm lint` | Runs ESLint and Prettier checks. |
| `pnpm format` | Formats the code with Prettier. |

The generated files are not in git. Thus, run `pnpm codegen` (or a command that runs it) after `pnpm install`.

## 8. Decisions

| # | Subject | Decision | Details |
|---|---|---|---|
| 1 | Scoring | On the backend only. | Sections 3, 4.4 |
| 2 | Repository | pnpm workspace: `apps/web` (Vite) and `apps/api`. | Section 2 |
| 3 | GraphQL server | Apollo Server, schema-first, GraphQL Code Generator. | Sections 1, 5 |
| 4 | Search | Suggestions (2 characters or more, 300 ms delay), then a selection. The Geocoding `id` identifies the town. The frontend calls Geocoding directly. | [UI 2](ui-spec.md#2-search) |
| 5 | Layout | 1 full-width row for each activity. 7 day cards with a gradient, a score and a label. | [UI 1](ui-spec.md#1-screen), [UI 4](ui-spec.md#4-activity-rows-skiing-surfing-outdoor) |
| 6 | Day details | Full breakdown: factors, gates and adjustments. | [UI 4](ui-spec.md#4-activity-rows-skiing-surfing-outdoor) |
| 7 | Weekly summary | The default view. Rules and structured items from the backend. | Section 4.6 |
| 8 | Indoor | 3 fixed blue colors. "Recommended on X of 7 days". An explanation at the top. The optional value is not in the API or the UI. | [UI 5](ui-spec.md#5-indoor-row) |
| 9 | Popover text | The backend sends a key and `params`. The frontend has the templates. The keys are a GraphQL `enum`. | [UI 6](ui-spec.md#6-explanations), section 5 |
| 10 | Requests and failures | The header comes from Geocoding and does not wait. 1 query for each row, with the location as input. Shared data layer with joined calls and a TTL cache. 2 retries, 10 s limit for each resolver. No cache for failures. The screen waits for all queries. Each failed row has "Try again". | Sections 3, 4.1, 4.2 |
| 11 | GraphQL client | Apollo Client. | Section 1 |
| 12 | Days | Local days of the town. Today is "Ended" after the activity window. Ended days are not in the weekly score or the best days. | Section 4.5 |
| 13 | Explanations | Popovers for words, and a "How the scores work" side panel. | [UI 6](ui-spec.md#6-explanations) |
| 14 | Config | TypeScript. 1 folder for each activity, and a `shared/` folder. Validation at startup. | Section 4.4 |
| 15 | Tests | Scoring unit tests and API tests with a mocked Open-Meteo. | Section 6 |
| 16 | Run | Local only: `pnpm dev`, Vite proxy, `startStandaloneServer`, `.nvmrc`. | Section 7 |
| 17 | UI library | Base UI (Combobox, Popover, Drawer, Meter). | Section 1 |
| 18 | Phone | Horizontal scroll with snap for the day cards. | [UI 7](ui-spec.md#7-phone-layout) |
| 19 | URL | `/?place=<id>&name=<slug>`. Only the `id` is used. | [UI 3](ui-spec.md#3-url) |
| 20 | Schema | Agreed. | Section 5 |
| 21 | Theme | Light only, with CSS tokens. | [UI 8](ui-spec.md#8-styles) |
| 22 | Geocoding | On the frontend only (`/search` and `/get`). The backend gets the location as input and checks it. | Sections 3, 4.3 |
