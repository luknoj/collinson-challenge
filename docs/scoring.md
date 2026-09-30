# Activity Scores

This document gives the method to calculate scores for **skiing**, **surfing** and **outdoor sightseeing** for the next 7 days. It also gives the method to recommend days for **indoor sightseeing**.

- **Data:** The app uses only Open-Meteo data (Geocoding, Elevation, Forecast and Marine APIs).
- **Examples:** [scoring-examples.md](scoring-examples.md) shows the calculations for 5 cities and for 1 full week.
- **Evidence:** [scoring-evidence.md](scoring-evidence.md) gives the research for each factor, the results of our API tests, and the sources.

## 1. Data

| API | Use |
|---|---|
| Geocoding | Find the coordinates, elevation, time zone and population of a city. |
| Elevation | Send 1 request with 81 points. The 7×7 grid (49 points) finds mountain towns (skiing). The ring (32 points) finds the coast direction (surfing). |
| Forecast | Get the weather data for all activities. Use `forecast_days=7`, `past_days=2`, `timezone=auto` and the elevation from Geocoding. |
| Marine | Get the wave data and the sea temperature (surfing). |

`past_days=2` adds the 2 days before today to the response (9 days in total). Use these 2 days only for the fresh snow factor and the snow depth check. Do not show scores for these 2 days.

Units: `snowfall` is in cm. `snow_depth` is in m. Wind speed is in km/h.

## 2. Score calculation

Do these steps for each activity and each day:

1. Calculate a sub-score (0 to 1) for each factor. Use the curve points (value → score) of that factor. Between 2 points, the score changes linearly. Below the first point and above the last point, the score does not change.
2. Calculate the weighted sum: `score = 100 × Σ(weight × sub-score)`. Then add the adjustments, if there are adjustments.
3. Apply the gates last. A gate sets a maximum score when the conditions are dangerous or bad.
4. Find the 1 or 2 factors that decrease the score most. Show these factors to the user as reasons.

"Not applicable" means that the activity is not possible at the place (for example, surfing in Madrid). "Not applicable" is different from a low score.

Rules:

- **Daytime hours:** Use only the data for daytime hours. Sightseeing: 09:00 to 18:00. Skiing: 09:00 to 16:00. Surfing: sunrise to sunset. Rain at 03:00 has no effect on the score.
- **Labels:** 0–19 Poor · 20–39 Fair · 40–59 Moderate · 60–79 Good · 80–100 Excellent.
- **Weather codes (WMO):**
  - 45 and 48: fog
  - 61–67: rain (66–67: freezing rain)
  - 71–77: snow
  - 95–99: thunderstorm
- **Configuration:** Keep all weights, curves, gates and limits in 1 configuration file. Use the worked examples as unit tests.

## 3. Skiing

**Gates:**

- If `snow_depth` is less than 0.3 m for all the week, skiing is "Not applicable". If `snow_depth` is less than 0.3 m on 1 day, the score for that day is 0.
- If there is freezing rain (codes 66–67) during the lift hours, the maximum score is 20.
- If there is rain on snow (`rain_sum` more than 2 mm and temperature more than 0 °C), the maximum score is 30.

| Factor | Input | Curve (value → score) | Weight |
|---|---|---|---|
| Snow base | `snow_depth` at 09:00, the start of the lift hours (m) | 0.3 → 0.3 · 1.0 → 1 | 30% |
| Fresh snow | Hourly `snowfall` in the 72 h before 09:00 of that day (cm) | 0 → 0.5 · 5 → 1 · 25 → 1 · 40 → 0.3 | 20% |
| Temperature | `apparent_temperature`, mean during the lift hours (°C) | −22 → 0 · −7 → 1 · +2 → 1 · +7 → 0 | 15% |
| Wind | `wind_gusts_10m_max` (km/h) | 30 → 1 · 60 → 0 | 20% |
| Sky | 0.6 × visibility + 0.4 × sunshine | visibility: 1 km → 0 · 5 km → 1; sunshine ratio: 0 → 0 · 0.6 → 1 | 15% |

**Fresh snow:** This factor measures the fresh snow that is on the slopes when the lifts open at 09:00. Snow that falls after 09:00 counts for the next day. Snowfall during the lift hours decreases the visibility. The sky factor shows this effect.

**Hourly snowfall values:** Each hourly `snowfall` value is the snowfall in the hour before its time stamp. Thus, the period "from 09:00 on day A to 09:00 on day B" contains the values from 10:00 on day A to 09:00 on day B.

**Snow depth check:** The snow depth at 09:00 cannot increase more than the snowfall since 09:00 on the day before:

```
depth[d] ≤ depth[d−1] + snowfall(09:00 on day d−1 → 09:00 on day d) / 100
```

- `depth` is `snow_depth` at 09:00, in m.
- `snowfall` is the sum of the hourly values, in cm. Divide by 100 to get m.
- If the forecast depth is more than this limit, use the limit.
- This rule removes sudden jumps in the forecast data. For day 1, use the snow depth at 09:00 on day −1 from `past_days`.

**Mountain town note:** The score uses the forecast for the town. The note does not change the score.

- **When to show the note:** Show the note if the terrain around the town is high. The 90th percentile of the 7×7 terrain grid (approximately 10 km around the town) must be 300 m or more above the town.
- **Contents of the note:**
  - The height difference between the town and the high terrain.
  - The estimated temperature on the high terrain: the town temperature minus 0.65 °C for each 100 m.
  - The altitude above which the precipitation can be snow: approximately 300 m below `freezing_level_height`. Show this only when the forecast has precipitation.
  - A statement that the snow depth is for the area of the town.
- **Example:** *"The terrain around the town goes up to approximately 1,680 m. This is 870 m above the town. The temperature there is approximately 6 °C lower. Above approximately 1,100 m, the precipitation can be snow."*

The score shows the weather and snow conditions at the place. Open-Meteo does not give data about ski resorts, lifts or artificial snow.

## 4. Surfing

**Gates:**

- If all the marine data is null, surfing is "Not applicable". The place is not near the coast.
- If there is a thunderstorm (codes 95–99), the score is 0.
- If the swell is more than approximately 4 m, the score has a maximum value. These waves are only for expert surfers.
- If the daytime mean wind is more than 30 km/h, the maximum score is 35. Strong wind makes the waves bad.

| Factor | Input | Curve (value → score) | Weight |
|---|---|---|---|
| Swell height | `swell_wave_height` (m) | 0.3 → 0 · 0.8 → 1 · 2.5 → 1 · 4.0 → 0 | 35% |
| Swell period | `swell_wave_period` (s) | 5 → 0 · 12 → 1 | 25% |
| Wind speed | `wind_speed_10m`, daytime mean (km/h) | 12 → 1 · 35 → 0 | 25% |
| Wave quality | `wind_wave_height ÷ swell_wave_height` | 0.3 → 1 · 1.0 → 0 | 5% |
| Comfort | `sea_surface_temperature` (°C) | 10 → 0.5 · 18 → 1 | 10% |

**Wind direction adjustment:** This adjustment is small. Always show a note with it.

1. Find the coast direction. Use a ring of points around the town (16 directions × 3 km and 6 km). A point with an elevation of exactly 0 m is in the sea. The mean direction of the sea points is the coast direction.
2. Use the coast direction only if there are 4 or more sea points and they show 1 clear direction. If not, do not adjust the score. Show the note *"The coast direction is not clear."*
3. Find the wind type. Calculate the angle between the wind direction and the coast direction. 0–45° is onshore. 45–135° is cross-shore. 135–180° is offshore.
4. Adjust the score only when the daytime mean wind is 15 km/h or more.

| Wind | Adjustment | Note |
|---|---|---|
| Onshore | −10 | "The wind is onshore. The waves can be rough." |
| Cross-shore | 0 | "The wind is cross-shore." |
| Offshore | +5 | "The wind is offshore. The waves can be clean." |
| Less than 15 km/h | 0 | "The wind is light. The wind direction has almost no effect." |

Add this text to each note: *"The coast direction is an estimate. Each beach can have a different direction."*

**Limits:** The score shows the sea conditions near the coast. It does not show the conditions at a specific surf spot. The data does not include tides.

## 5. Outdoor sightseeing

**Gates:**

- If there is a thunderstorm, the maximum score is 20.
- If the "feels like" temperature is more than 38 °C or less than −15 °C, the maximum score is 20.
- If the gusts are more than 75 km/h, the maximum score is 20.
- If the rain is more than 5 mm and the probability is more than 70%, the maximum score is 25.
- If `wind_speed_10m_max` is more than 40 km/h, the maximum score is 40.

| Factor | Input | Curve (value → score) | Weight |
|---|---|---|---|
| Precipitation | Mean of 2 sub-scores: maximum probability (20% → 1 · 80% → 0) and daytime quantity (0.5 mm → 1 · 5 mm → 0) | – | 30% |
| Thermal comfort | `apparent_temperature`, daytime mean (°C) | 0 → 0 · 16 → 1 · 24 → 1 · 32 → 0 | 40% |
| Sky | `sunshine_duration ÷ daylight_duration` | 0 → 0.4 · 0.6 → 1 | 20% |
| Wind | `wind_speed_10m_max` (km/h) | 20 → 1 · 45 → 0 | 10% |

**Other rules:**

- If the UV index is 9 or more, show the note *"The UV index is very high. Use sun protection."* The UV index does not change the score.
- Fog (codes 45 and 48) decreases the score by a small quantity.

## 6. Indoor sightseeing (a recommendation, not a score)

Weather does not change a museum. But when the user stays inside on a good day, the user loses that good outdoor weather. Thus, indoor sightseeing gets a recommendation level from the outdoor score of that day:

| Outdoor score | Recommendation | Message |
|---|---|---|
| Less than 40 | **Recommended** | "Today is a good day for museums and galleries." |
| 40–59 | **Good alternative** | "The weather is mixed. Indoor activities are a good choice." |
| 60 or more | **Save for later** | "Today is better for outdoor activities." |

**Hints:** The hints do not change the recommendation level.

- **Travel:** *"Travel can be difficult."* Show this hint if one of these conditions occurs:
  - a thunderstorm
  - freezing rain
  - more than 10 cm of snowfall
  - gusts of more than 75 km/h
  - a "feels like" temperature of more than 38 °C or less than −15 °C
- **Busy:** *"Popular indoor places can have more people than usual."* Show this hint if the rain probability is 60% or more and the rain is 1 mm or more. This is only a hint, because the measured effect is small (approximately +2.8% visitors).
- **Town size:** Show this hint only when the level is "Recommended" or "Good alternative". Use `population` and `feature_code` from Geocoding:

| Town size | Hint |
|---|---|
| Capital (`PPLC`) or 1,000,000 people or more | "This is a large city. It has many indoor attractions." |
| 100,000 – 1,000,000 | "This city usually has a good number of indoor attractions." |
| 10,000 – 100,000 | "This town has a small number of indoor attractions. Make sure that they are open before you make a plan for a full day." |
| Less than 10,000 | "This is a small town. It can have very few indoor attractions. A larger town near this place can have more." |
| No data | No hint |

Tourist towns often have more attractions than their size shows. Thus, the hints use careful words.

**Optional 0–100 value:** Use this value only if the UI must show all activities on 1 scale: `50 + 0.3 × (100 − outdoorScore)`.

## 7. The week

- **Daily scores:** Show the score for each day. This is the most useful result (for example, "skiing on Tuesday, museums on Thursday").
- **Weekly score for each activity:** `0.5 × best day + 0.5 × mean of the best 3 days`. A usual mean does not show a small number of very good days.
- **Indoor sightseeing:** Show a plan, not a weekly score. Example: *"Outdoor activities on Monday and Tuesday. Indoor activities on Thursday (rain)."*
- **Confidence:** Show a confidence level for each day. Days 1–3: High. Days 4–5: Medium. Days 6–7: Low.

## 8. Decisions

All decisions are complete. There are no open items.

- Open-Meteo is the only data source.
- 1 configuration file contains all the limits and weights. The worked examples are the unit tests.
- The skiing score uses the forecast for the town. Mountain towns also get a note about the high terrain.
- The snow depth for a day is the value at 09:00. The fresh snow factor uses the snowfall in the 72 h before 09:00. The request includes `past_days=2`, so this data is available for all 7 days.
- If the Marine API gives only null values, surfing is "Not applicable".
- The terrain gives the coast direction. The wind direction adjustment is a maximum of −10 or +5 points. It always has a note.
- Indoor sightseeing is a recommendation. It has hints for travel, crowds and town size.
