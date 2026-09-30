# Future Improvements

This document lists known problems in the plan and ideas for later versions.

- **Sections 1–3** are errors or missing rules in [scoring.md](scoring.md), [architecture.md](architecture.md) and [ui-spec.md](ui-spec.md). Fix each item before you write the code for that part.
- **Section 4** gives data sources that we examined. They are not part of the plan now.

## 1. Scoring rules (scoring.md)

### 1.1 Activity windows

- **Location:** [scoring.md](scoring.md), sections 3–5.
- **Problem:** Section 2 tells you to use only the data for the activity window. But some inputs are daily values for 24 h: `rain_sum` (rain on snow gate) and `wind_gusts_10m_max` (skiing wind factor).
- **Correction:** Calculate all rain totals and wind maxima from the hourly data in the activity window. Examples:
  - Skiing: the sum of hourly `rain` from 09:00 to 16:00, and the maximum hourly `wind_gusts_10m` from 09:00 to 16:00.
  - Outdoor: the same method from 09:00 to 18:00.
  - Surfing: the same method from sunrise to sunset.

### 1.2 Scoring limits that are not specified

- **Location:** [scoring.md](scoring.md), sections 2, 4 and 5.
- **Problem:** Some rules have no exact value.
- **Correction:** Specify these values:

| Item | Current text | Necessary value |
|---|---|---|
| Large swell gate (surfing) | "more than approximately 4 m", "a maximum value" | The exact height and the maximum score |
| Fog (outdoor) | "decreases the score by a small quantity" | The number of points, and the number of fog hours that start the penalty |
| Coast direction test (surfing) | "1 clear direction" | A test with a number. For example: the length of the mean vector of the sea directions is 0.5 or more. |
| Missing data | No rule | What to do when a value or an hour is `null`. For example: ignore the missing hours if 50% or more of the window has data. If not, the factor gets no score and a note. |
| Rounding | "Scores are integers" | When to round. For example: calculate with decimals, and round only the final score, the weekly score and the points that the UI shows. |

## 2. Backend (architecture.md)

### 2.1 Retries and timeout

- **Location:** [architecture.md](architecture.md), section 4.1.
- **Problem:** 3 attempts of 8 s, plus the delays of 300 ms and 900 ms, can take 25.2 s. This is more than the 10 s limit for each resolver. Also, the rules for joined calls are not clear. 2 resolvers can share 1 call, but they can have different start times.
- **Correction:** Define the retries inside the 10 s limit. For example:
  - The data layer has a total limit of 10 s for each call, with all attempts included.
  - Each attempt uses the time that is left. Do not start a retry when less than 2 s is left.
  - A joined call has 1 limit, from the start of the first request. A resolver that joins later waits only until this limit.

### 2.2 Time and refresh

- **Location:** [architecture.md](architecture.md), section 4.5.
- **Problem:** The plan does not tell what occurs when the page stays open. A day can become "Ended" while the user looks at the screen. At midnight in the town, "today" changes.
- **Correction:**
  - Use the time zone of the town for all these rules, never the time zone of the user.
  - The frontend starts a timer for the next event: the end of an activity window, or midnight in the town.
  - At the end of an activity window, send the query for that row again. The day becomes "Ended".
  - At midnight in the town, send all 4 queries again. The 7 days move by 1 day.

### 2.3 Explanation parameters

- **Location:** [architecture.md](architecture.md), section 5.
- **Problem:** `params` is a `JSON` scalar. The plan does not define the parameters for each key. Thus, the backend and the frontend can send and expect different names.
- **Correction:**
  - Make a table with each `ExplanationKey` and its parameters (name, type, unit).
  - Keep 1 TypeScript type for each key in a shared file. Both apps use this file.
  - The backend validates `params` before it sends the response (for example, with zod). The frontend validates `params` before it uses a template.

## 3. Frontend (ui-spec.md)

### 3.1 Search cancellation

- **Location:** [ui-spec.md](ui-spec.md), section 2.
- **Problem:** The plan cancels a request only when a new request starts. An old response can arrive during the 300 ms delay, or after the user clears the field. Then the list shows old suggestions.
- **Correction:**
  - Cancel the open request when the text changes, not when the next request starts.
  - Accept a response only if its search text is the same as the current text in the field.
  - When the field is empty, close the list and cancel the open request.

### 3.2 Back and forward buttons

- **Location:** [ui-spec.md](ui-spec.md), section 3.
- **Problem:** The plan uses `history.pushState`. But the app has no `popstate` handler. Thus, the "back" button changes the URL, but the screen does not change.
- **Correction:**
  - Add a `popstate` handler. It reads `place` from the URL and loads that town.
  - Clear the selected day when the town changes.
  - Do not let an old `/get` response replace a newer town. Keep the `id` of the current request. Ignore a response for a different `id`.

### 3.3 Geocoding failures and missing fields

- **Location:** [architecture.md](architecture.md), section 4.2, and [ui-spec.md](ui-spec.md), section 2.
- **Problem:** The frontend now calls Geocoding. But the plan does not give frontend rules for these cases:
  - The search request fails.
  - The `/get` request fails.
  - A response does not have optional fields.
  - The user selects towns quickly, one after another.
- **Open-Meteo does not include empty fields in the response.** For example, a place with no population data has no `population` field. The field is not `null`. Refer to the [Geocoding API documentation](https://open-meteo.com/en/docs/geocoding-api).
- **Correction:**
  - Search failure: the list shows "The search is not available. Try again."
  - `/get` failure: refer to [architecture.md](architecture.md), section 4.2.
  - Missing fields: change a missing `population`, `elevation`, `admin1` or `feature_code` to `null` before you send the GraphQL input or show the header.
  - Quick town changes: use the rule in 3.2 (ignore responses for an old `id`).

## 4. Data sources for later

### 4.1 Air Quality API (not decided)

We tested the [Air Quality API](https://open-meteo.com/en/docs/air-quality-api) on 30 September 2026.

**Test results (maximum European AQI, 09:00–18:00):**

| Town | Days 1–5 | Days 6–7 |
|---|---|---|
| Zermatt | 20–41 | No data |
| Ericeira | 27–50 | No data |
| Malibu | 36–47 | No data |
| Kraków | 41–54 | No data |
| Delhi | 99–119 | No data |

- The forecast covers only 5 days. Days 6–7 are `null`.
- The grid is coarse: CAMS Europe approximately 11 km (4 days), CAMS Global approximately 45 km (5 days).
- Pollen data is available only in Europe, in the pollen season, for 4 days.

**Evidence:**

- **Research:** More PM2.5 decreases the number of tourists and the ratings that tourists give. For example, in China, 1 μg/m³ more PM2.5 gave 1.2% fewer foreign tourists.
- **Official advice (EEA):** The advice for all people changes only at high levels:
  - Good, Fair and Moderate: "Enjoy your usual outdoor activities."
  - Poor and Very poor: "Consider reducing intense activities outdoors, if you experience symptoms."
  - Extremely poor: "Reduce physical activities outdoors."
- No tourism climate index (TCI, HCI) uses air quality. Thus, we have no evidence for a weight.

**Proposal:** Use gates and notes, not a weighted factor. This is the same method as for the UV index.

| European AQI (maximum in the activity window) | Effect on outdoor, skiing and surfing |
|---|---|
| 0–60 (Good, Fair, Moderate) | None |
| 60–80 (Poor) | Note only |
| 80–100 (Very poor) | Maximum score 50, and a note |
| More than 100 (Extremely poor) | Maximum score 30, and a note |

- Indoor increases automatically, because it uses the outdoor score. A Very poor day becomes at least "Good alternative". An Extremely poor day becomes "Recommended".
- The limits 50 and 30 are an Assumption. They follow the EEA advice levels.
- Days 6–7 get the note "No air quality forecast for this day."
- If the API fails, the scores do not change. A note tells the user.
- The data layer needs 1 more call, with a TTL of 1 h.

**Sources:**

- [EEA: European Air Quality Index, health advice](https://airindex.eea.europa.eu/AQI/index.html)
- [The Impacts of Different Air Pollutants on Domestic and Inbound Tourism in China](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6950462/)
- [Foreign tourists' experiences under air pollution: Evidence from big data](https://www.sciencedirect.com/science/article/abs/pii/S0261517721001424)
- [How Do Air Quality Issues Caused by Particulate Matter Affect Consumers' Emotional Response to Tourism Destinations](https://doi.org/10.3390/ijerph181910364)
