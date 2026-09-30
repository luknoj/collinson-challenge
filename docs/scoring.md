# Activity Scoring: Research Notes

How we score a place for **skiing**, **surfing** and **outdoor sightseeing**, and recommend days for **indoor sightseeing**, over the next 7 days, using Open-Meteo weather data.

## 1. Data sources

| API | Used for | Key variables |
|---|---|---|
| **Geocoding** (`geocoding-api.open-meteo.com/v1/search`) | Turning a city name into coordinates | `latitude`, `longitude`, `elevation`, `timezone`, `population`, `feature_code` |
| **Forecast** (`api.open-meteo.com/v1/forecast`) | Weather for every activity | Daily: `temperature_2m_max/min`, `apparent_temperature_max/min`, `precipitation_sum`, `rain_sum`, `snowfall_sum`, `precipitation_hours`, `precipitation_probability_max`, `weather_code`, `sunshine_duration`, `daylight_duration`, `wind_speed_10m_max`, `wind_gusts_10m_max`, `uv_index_max`, `sunrise`, `sunset`<br>Hourly: `snow_depth`, `snowfall`, `freezing_level_height`, `visibility`, `cloud_cover`, `precipitation_probability`, `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m` |
| **Marine** (`marine-api.open-meteo.com/v1/marine`) | Surfing | `swell_wave_height`, `swell_wave_period`, `swell_wave_direction`, `wind_wave_height`, `wave_height`, `sea_surface_temperature` (hourly or daily `_max` versions) |

Request settings:

- `forecast_days=7`
- `timezone=auto`, so days follow the place's local calendar
- Pass the geocoded `elevation`. This matters a lot for skiing.

Units: `snowfall` comes in **cm** but `snow_depth` comes in **metres**. Wind is in km/h by default.

## 2. How the scoring works (same for all activities)

For each activity and each day:

1. **Hard gates (knock-outs).** Some conditions make the activity unsafe or impossible, like a thunderstorm or no snow on the ground. These set the score to 0 or cap it at a low value. Some also mark the activity as **"Not applicable"**, which is different from "bad". A surf score for Warsaw is meaningless, not 0.
2. **Factor sub-scores from 0 to 1.** Each factor goes through a piecewise-linear "trapezoid": inside the ideal range it scores 1.0, and it falls linearly to 0 at the outer limits. This is simple, easy to tune and easy to explain.
3. **Weighted sum.** `score = 100 × Σ(weightᵢ × subscoreᵢ)`, then the gates are applied.
4. **Reasons.** Each day also stores the one or two factors that hurt the score most (for example "Gusts up to 70 km/h" or "Swell period only 5 s"). This makes the result explainable in the UI and easy to test.

**Use daytime hours, not the full-day totals.** `precipitation_sum` counts rain at 3 a.m., which doesn't matter to a tourist. Aggregate the hourly data over the activity's window instead:

- Sightseeing: roughly 09:00–18:00, or sunrise to sunset
- Skiing: lift hours, 09:00–16:00
- Surfing: daylight

**Labels:** 0–19 Poor · 20–39 Fair · 40–59 Moderate · 60–79 Good · 80–100 Excellent.

**WMO `weather_code` groups:**

| Codes | Meaning |
|---|---|
| 0 | Clear |
| 1–3 | Partly cloudy / overcast |
| 45, 48 | Fog |
| 51–57 | Drizzle |
| 61–67 | Rain (66–67 freezing) |
| 71–77 | Snow |
| 80–82 | Rain showers |
| 85–86 | Snow showers |
| 95–99 | Thunderstorm |

## 3. Scoring for each activity

### Skiing

**Gates:**

- No snow cover (`snow_depth` below about 0.1 m) means Not applicable if it's absent all week, otherwise 0 for that day.
- Rain on snow (`rain_sum` above 2 mm while temperatures are above 0) caps the score at 30.

**Factors:**

| Factor | Data | Ideal → poor | Weight |
|---|---|---|---|
| Snow base | hourly `snow_depth` | ≥ 1.0 m ideal · 0.5 m OK · < 0.2 m poor | 30% |
| Fresh snow | `snowfall_sum` for the day plus the previous 1–2 days | 5–25 cm ideal ("powder day") · 0 is neutral · > 40 cm is a storm (closures, avalanche risk) | 20% |
| Temperature | `temperature_2m_max/min` | −10 to −2 °C ideal · above +3 °C slush · below −20 °C harsh | 15% |
| Wind | `wind_gusts_10m_max`, `wind_speed_10m` | Gusts < 30 km/h ideal · > 60 km/h lifts usually close (this should also be a gate) | 20% |
| Visibility / sky | `visibility`, `cloud_cover`, `sunshine_duration` | Visibility > 5 km and sunny · < 1 km means "whiteout" | 15% |

**Caveat: town vs. ski slope.** The forecast is for the town's grid point and elevation. A valley town can show 0 snow while the slopes above it have 1.5 m. Two ways to handle it:

- Accept it for v1 and label it "conditions at town elevation".
- Also query a higher elevation using the `elevation` parameter, or `freezing_level_height`, to estimate slope conditions.

Open-Meteo also has no data on resort opening or lift status. The score is a weather proxy only.

### Surfing

**Gates:**

- If the Marine API returns empty or null wave data for the point, surfing is Not applicable. Inland points behave this way. Confirm the exact behaviour during implementation.
- Thunderstorm (`weather_code` 95–99) sets the score to 0.
- Swell above about 4 m caps the score (experts only).

**Factors:**

| Factor | Data | Ideal → poor | Weight |
|---|---|---|---|
| Swell height | `swell_wave_height` | 0.8–2.5 m ideal · < 0.3 m flat · > 3.5 m dangerous for most | 35% |
| Swell period | `swell_wave_period` | ≥ 12 s excellent · 8–10 s decent · < 6 s mushy wind swell | 25% |
| Wind | `wind_speed_10m` | < 12 km/h glassy · 12–25 OK · > 30 km/h blown out | 25% |
| Wave quality | ratio of `wind_wave_height` to `swell_wave_height` | Low ratio is clean groundswell · high ratio is choppy | 5% |
| Comfort | `sea_surface_temperature`, air temperature | > 18 °C ideal · < 10 °C needs a thick wetsuit (minor penalty, never a gate) | 10% |

**Caveats:**

- Whether the wind blows offshore (good) or onshore (bad) depends on which way the coastline faces. Open-Meteo doesn't provide that. v1 uses wind speed only. Later we could add a coast bearing for each location.
- Marine models run at roughly 5–25 km resolution and are less accurate near coasts. The score describes "the sea state off this coast", not a specific surf break.
- There's no tide data built in.

### Outdoor sightseeing

**Gates:**

- Thunderstorm during daytime: cap at 20
- `apparent_temperature_max` above 38 °C, or below −15 °C: cap at 20
- Gusts above 75 km/h: cap at 20

**Factors:**

| Factor | Data | Ideal → poor | Weight |
|---|---|---|---|
| Precipitation | hourly `precipitation_probability` and `precipitation` over daytime | Probability < 20% and < 0.5 mm ideal · several wet hours or > 5 mm poor | 35% |
| Thermal comfort | `apparent_temperature` over daytime | 16–24 °C ideal · 0 °C or 32 °C score 0 | 25% |
| Sunshine / sky | `sunshine_duration ÷ daylight_duration`, `cloud_cover` | > 60% sunny ideal · heavy overcast lower (mild penalty only) | 15% |
| Wind | `wind_speed_10m_max`, `wind_gusts_10m_max` | < 20 km/h ideal · > 45 km/h poor | 15% |
| Usable daylight | `daylight_duration` | ≥ 10 h ideal · < 7 h (northern winter) lower | 5% |
| UV | `uv_index_max` | Minor penalty at ≥ 9 | 5% |

Fog (codes 45 and 48) should also count as a mild penalty through visibility.

### Indoor sightseeing (a recommendation, not a score)

Weather doesn't change the indoor experience itself: a museum is the same museum in sun or rain. What changes is:

1. **What you give up by staying in.** Spending a sunny day inside wastes it. This is the main driver.
2. **Getting there.** Storms, heavy snow and freezing rain make travel harder.
3. **Crowding.** Bad weather pushes more people indoors, but the measured effect is small (see 6.4).

So indoor sightseeing is never "Not applicable" and gets no 0–100 score. Each day gets a **recommendation level** based on that day's final outdoor score (after gates):

| Outdoor score | Recommendation | Message |
|---|---|---|
| < 40 | **Recommended** | "Good day for museums and galleries" |
| 40–59 | **Good alternative** | "Mixed weather – indoor plans work well" |
| ≥ 60 | **Save for later** | "Better to be outside today" |

Two text hints can be added to the recommendation. Neither changes the level:

- **Travel note:** "Getting around may be difficult". Shown when any of these happen during daytime:
  - thunderstorm (codes 95–99)
  - freezing rain (codes 66–67)
  - snowfall above 10 cm
  - gusts above 75 km/h
  - `apparent_temperature` above 38 °C or below −15 °C
- **Busy hint:** "Popular indoor spots may be busier than usual". Shown when daytime rain probability is 60% or more **and** daytime rain is 1 mm or more.

**Why crowding is only a hint, not part of the rating:**

- The measured effect is small: about +2.8% visitors on rainy days (see 6.4).
- Open-Meteo has no crowd data, so we'd be guessing both the size and the shape of the effect.
- A rating that rises with bad weather and then drops again for crowds would confuse users ("pouring rain → 70, light drizzle → 85").

**Optional 0–100 value.** Only add this if the UI needs all four activities on the same scale. It uses a deliberately narrow range, so a rainy day never looks "excellent" in absolute terms:

```
indoorComparable = 50 + 0.3 × (100 − outdoorScore)      // 50 on a perfect day, 80 on the worst
```

## 4. From 7 daily scores to one answer

- **Show the score for each day.** It's the most useful output ("ski Tuesday, museums Thursday").
- **Weekly summary per activity:** `0.5 × best day + 0.5 × average of the top 3 days`. A week with two excellent ski days is a good ski week even if the rest are bad. A plain mean would hide that.
- **Indoor sightseeing has no weekly score.** Instead, the weekly summary becomes a plan: the best outdoor days are for outdoor activities, and the "Recommended" indoor days are for museums. For example: *"Outdoor on Mon–Tue, save indoor for Thursday (rain)."*
- **Forecast confidence:** days 1–3 are reliable and days 6–7 are much less so. Either shrink later days toward neutral a little, or show a confidence badge ("High / Medium / Low"). The badge is recommended because it's more honest and simpler.

## 5. Worked examples

All numbers below are **illustrative**, not real forecasts. Each example takes one day in one city and shows:

- the data we get, already aggregated over the activity's daytime window
- how each activity's score is calculated
- the outcome

### 5.1 Scoring curves used in the examples

Each factor turns a raw value into a sub-score from 0 to 1. Between the listed points the score changes linearly. Below the first point or above the last point it stays flat.

Example: for skiing temperature, −6 °C scores 1.0, and +4 °C scores 0.14 because it is one-seventh of the way from +5 (score 0) back to −2 (score 1).

| Activity | Factor | Input | Curve points `(value → score)` |
|---|---|---|---|
| Skiing | Snow base | `snow_depth` (m) | 0.2 → 0 · 1.0 → 1 |
| Skiing | Fresh snow | `snowfall_sum` over 72 h (cm) | 0 → 0.5 · 5 → 1 · 25 → 1 · 40 → 0.3 |
| Skiing | Temperature | daytime mean `temperature_2m` (°C) | −22 → 0 · −10 → 1 · −2 → 1 · +5 → 0 |
| Skiing | Wind | `wind_gusts_10m_max` (km/h) | 30 → 1 · 60 → 0 |
| Skiing | Sky | `0.6 × visibility score + 0.4 × sunshine score` | visibility: 1 km → 0 · 5 km → 1; sunshine ratio: 0 → 0 · 0.6 → 1 |
| Surfing | Swell height | `swell_wave_height` (m) | 0.3 → 0 · 0.8 → 1 · 2.5 → 1 · 4.0 → 0 |
| Surfing | Swell period | `swell_wave_period` (s) | 5 → 0 · 12 → 1 |
| Surfing | Wind | daytime mean `wind_speed_10m` (km/h) | 12 → 1 · 35 → 0 |
| Surfing | Wave quality | `wind_wave_height ÷ swell_wave_height` | 0.3 → 1 · 1.0 → 0 |
| Surfing | Comfort | `sea_surface_temperature` (°C) | 10 → 0.5 · 18 → 1 |
| Outdoor | Precipitation | average of probability score and amount score | probability: 20% → 1 · 80% → 0; daytime amount: 0.5 mm → 1 · 5 mm → 0 |
| Outdoor | Thermal comfort | daytime mean `apparent_temperature` (°C) | 0 → 0 · 16 → 1 · 24 → 1 · 32 → 0 |
| Outdoor | Sunshine | `sunshine_duration ÷ daylight_duration` | 0 → 0.4 · 0.6 → 1 |
| Outdoor | Wind | `wind_speed_10m_max` (km/h) | 20 → 1 · 45 → 0 |
| Outdoor | Daylight | `daylight_duration` (h) | 7 → 0.5 · 10 → 1 |
| Outdoor | UV | `uv_index_max` | below 9 → 1 · 9 or more → 0.7 |

Each contribution below is `sub-score × weight × 100`.

---

### 5.2 Zermatt, Switzerland: sunny, cold day after fresh snow (January)

**Data we get**

| Data | Value |
|---|---|
| Snow depth | 1.2 m |
| Snowfall, last 72 h | 18 cm (none today) |
| Temperature, daytime mean | −6 °C |
| Feels like, daytime mean | −9 °C |
| Wind max / gusts max | 20 km/h / 35 km/h |
| Visibility | 20 km |
| Sunshine / daylight | 6.3 h of 9.0 h (ratio 0.7) |
| Precipitation | probability 10%, 0 mm |
| UV index max | 3 |
| Marine data | none (inland) |

**Skiing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Snow base | 1.2 m | 1.00 | 30% | 30.0 |
| Fresh snow | 18 cm | 1.00 | 20% | 20.0 |
| Temperature | −6 °C | 1.00 | 15% | 15.0 |
| Wind | gusts 35 km/h | 0.83 | 20% | 16.7 |
| Sky | visibility 20 km, sunshine ratio 0.7 | 1.00 | 15% | 15.0 |
| **Score** | | | | **97** |

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 10%, 0 mm | 1.00 | 35% | 35.0 |
| Thermal comfort | feels like −9 °C | 0.00 | 25% | 0.0 |
| Sunshine | ratio 0.7 | 1.00 | 15% | 15.0 |
| Wind | 20 km/h | 1.00 | 15% | 15.0 |
| Daylight | 9.0 h | 0.83 | 5% | 4.2 |
| UV | 3 | 1.00 | 5% | 5.0 |
| **Score** | | | | **74** |

**Indoor sightseeing:** outdoor score 74 (≥ 60), so **Save for later**. No travel note: no snow falls today. No busy hint: it's dry.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | 97 | Excellent | Fresh snow on a deep base, sunny |
| Surfing | – | Not applicable | Not coastal |
| Outdoor sightseeing | 74 | Good | Dry, sunny and calm, but very cold |
| Indoor sightseeing | – | Save for later | Dry and sunny, better to be outside |

---

### 5.3 Ericeira, Portugal: clean surf day (October)

**Data we get**

| Data | Value |
|---|---|
| Swell height / period | 1.6 m / 13 s |
| Wind-wave height | 0.3 m |
| Sea surface temperature | 17 °C |
| Wind, daytime mean / max | 8 km/h / 15 km/h |
| Feels like, daytime mean | 19 °C |
| Sunshine / daylight | 7.3 h of 11.3 h (ratio 0.65) |
| Precipitation | probability 15%, 0 mm |
| UV index max | 5 |
| Snow depth (whole week) | 0 m |

**Surfing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Swell height | 1.6 m | 1.00 | 35% | 35.0 |
| Swell period | 13 s | 1.00 | 25% | 25.0 |
| Wind | 8 km/h | 1.00 | 25% | 25.0 |
| Wave quality | 0.3 / 1.6 = 0.19 | 1.00 | 5% | 5.0 |
| Comfort | water 17 °C | 0.94 | 10% | 9.4 |
| **Score** | | | | **94** |

**Outdoor sightseeing:** every factor is inside its ideal range (dry, 19 °C, sunny, light wind, long daylight, moderate UV), so the score is **100**.

**Indoor sightseeing:** outdoor score 100 (≥ 60), so **Save for later**. No hints.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow all week |
| Surfing | 94 | Excellent | Clean 1.6 m swell at 13 s, light wind |
| Outdoor sightseeing | 100 | Excellent | Dry, sunny, 19 °C |
| Indoor sightseeing | – | Save for later | Better to be outside today |

---

### 5.4 Newquay, UK: windy, showery day (October)

**Data we get**

| Data | Value |
|---|---|
| Swell height / period | 1.2 m / 7 s |
| Wind-wave height | 0.9 m |
| Sea surface temperature | 14 °C |
| Wind, daytime mean / max | 32 km/h / 38 km/h |
| Feels like, daytime mean | 11 °C |
| Sunshine / daylight | 3.2 h of 10.8 h (ratio 0.3) |
| Precipitation | probability 60%, 2 mm |
| UV index max | 2 |
| Snow depth (whole week) | 0 m |

**Surfing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Swell height | 1.2 m | 1.00 | 35% | 35.0 |
| Swell period | 7 s | 0.29 | 25% | 7.1 |
| Wind | 32 km/h | 0.13 | 25% | 3.3 |
| Wave quality | 0.9 / 1.2 = 0.75 | 0.36 | 5% | 1.8 |
| Comfort | water 14 °C | 0.75 | 10% | 7.5 |
| **Score** | | | | **55** |

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 60% (0.33), 2 mm (0.67) | 0.50 | 35% | 17.5 |
| Thermal comfort | feels like 11 °C | 0.69 | 25% | 17.2 |
| Sunshine | ratio 0.3 | 0.70 | 15% | 10.5 |
| Wind | 38 km/h | 0.28 | 15% | 4.2 |
| Daylight | 10.8 h | 1.00 | 5% | 5.0 |
| UV | 2 | 1.00 | 5% | 5.0 |
| **Score** | | | | **59** |

**Indoor sightseeing:** outdoor score 59 (40–59), so **Good alternative**. The busy hint applies: rain probability is 60% with 2 mm of rain.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow all week |
| Surfing | 55 | Moderate | Strong wind (32 km/h), short 7 s period |
| Outdoor sightseeing | 59 | Moderate | Showers and strong wind |
| Indoor sightseeing | – | Good alternative | Mixed weather; popular spots may be busier |

The surfing score is too generous here. See [5.8](#58-lessons-from-the-examples).

---

### 5.5 Kraków, Poland: rainy autumn day (October)

**Data we get**

| Data | Value |
|---|---|
| Feels like, daytime mean | 9 °C |
| Wind max | 35 km/h |
| Sunshine / daylight | 0.5 h of 11.0 h (ratio 0.05) |
| Precipitation | probability 90%, 8 mm in daytime |
| UV index max | 2 |
| Snow depth (whole week) | 0 m |
| Marine data | none (inland) |

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 90%, 8 mm | 0.00 | 35% | 0.0 |
| Thermal comfort | feels like 9 °C | 0.56 | 25% | 14.1 |
| Sunshine | ratio 0.05 | 0.45 | 15% | 6.8 |
| Wind | 35 km/h | 0.40 | 15% | 6.0 |
| Daylight | 11.0 h | 1.00 | 5% | 5.0 |
| UV | 2 | 1.00 | 5% | 5.0 |
| **Score** | | | | **37** |

**Indoor sightseeing:** outdoor score 37 (< 40), so **Recommended**. The busy hint applies: rain probability is 90% with 8 mm of rain.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow all week |
| Surfing | – | Not applicable | Not coastal |
| Outdoor sightseeing | 37 | Fair | Rain all day (8 mm) |
| Indoor sightseeing | – | Recommended | Rainy day; popular spots may be busier |

---

### 5.6 Zakopane, Poland: warm rain on a thin snowpack (March)

**Data we get**

| Data | Value |
|---|---|
| Snow depth | 0.6 m |
| Snowfall, last 72 h | 0 cm |
| Temperature, daytime mean | +4 °C |
| Feels like, daytime mean | +1 °C |
| Wind max / gusts max | 30 km/h / 45 km/h |
| Visibility | 3 km |
| Sunshine / daylight | 0 h of 11.5 h |
| Precipitation | probability 85%, 6 mm of rain |
| UV index max | 2 |
| Marine data | none (inland) |

**Skiing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Snow base | 0.6 m | 0.50 | 30% | 15.0 |
| Fresh snow | 0 cm | 0.50 | 20% | 10.0 |
| Temperature | +4 °C | 0.14 | 15% | 2.1 |
| Wind | gusts 45 km/h | 0.50 | 20% | 10.0 |
| Sky | visibility 3 km (0.5), no sun (0) | 0.30 | 15% | 4.5 |
| **Weighted sum** | | | | **42** |
| **Gate** | rain on snow: 6 mm above 0 °C, so the score is capped at 30 | | | **30** |

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 85%, 6 mm | 0.00 | 35% | 0.0 |
| Thermal comfort | feels like +1 °C | 0.06 | 25% | 1.6 |
| Sunshine | ratio 0 | 0.40 | 15% | 6.0 |
| Wind | 30 km/h | 0.60 | 15% | 9.0 |
| Daylight | 11.5 h | 1.00 | 5% | 5.0 |
| UV | 2 | 1.00 | 5% | 5.0 |
| **Score** | | | | **27** |

**Indoor sightseeing:** outdoor score 27 (< 40), so **Recommended**. The busy hint applies: rain probability is 85% with 6 mm of rain. No travel note: there is no freezing rain, and gusts stay below 75 km/h.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | 30 | Fair | Rain on snow, +4 °C |
| Surfing | – | Not applicable | Not coastal |
| Outdoor sightseeing | 27 | Fair | Cold rain all day |
| Indoor sightseeing | – | Recommended | Cold rain all day; popular spots may be busier |

---

### 5.7 A full week: surfing in Ericeira

Day 1 is the clean surf day from 5.3.

| Day | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| Score | 94 | 88 | 57 | 35 | 40 | 72 | 81 |
| Confidence | High | High | High | Medium | Medium | Low | Low |

- Best day: 94 (Monday)
- Average of the top 3 days: (94 + 88 + 81) / 3 = 87.7
- **Weekly score = 0.5 × 94 + 0.5 × 87.7 = 91 (Excellent)**
- A plain mean would give 67 (Good). That hides the fact that the week has three great surf days.

**Outcome for the user:** "Excellent surf week. Best on Monday and Tuesday. Sunday also looks good, but that far out the forecast is less certain."

---

### 5.8 Lessons from the examples

Working through the numbers exposed two places where the weighted sum alone is too generous. Both could be fixed with an extra gate:

1. **Surfing in Newquay (5.4).** It scores 55 because swell height outweighs the wind. Proposed gate: **sustained wind above 30 km/h caps the score at 35.** The day would then score 35 (Fair), which matches how surfers would rate it.
2. **Outdoor sightseeing in Kraków (5.5).** It scores 37 partly because daylight and UV add points even in the rain. Proposed gate: **daytime rain above 5 mm with probability above 70% caps the score at 25** (Fair, near the Poor boundary). Indoor stays **Recommended** either way.

This is why the weights, curves and gates should live in one config file, with unit tests built from examples like these.

## 6. Why these factors: evidence and sources

The first draft of the factors and thresholds (sections 3–5) came from general domain knowledge. This section checks them against published research and industry practice. It marks what is backed by evidence, what is only anecdotal, and what is still an assumption, and lists the changes the evidence suggests.

**Evidence levels used below:**

- **Research:** peer-reviewed index or survey
- **Industry:** documented practice of forecasters or operators
- **Anecdotal:** operator examples and forums
- **Assumption:** no source found yet

### 6.1 Outdoor sightseeing

This is the best-researched area. Tourism climatology has two established indices for "how good is the weather for general/urban tourism":

| Index | Thermal comfort | Precipitation | Sky (sunshine / cloud) | Wind | Other |
|---|---|---|---|---|---|
| **Tourism Climate Index (TCI)**, Mieczkowski 1985 | 50% daytime + 10% daily = **60%** | 20% | 20% (sunshine) | 10% | – |
| **Holiday Climate Index: Urban (HCI:Urban)**, Scott et al. 2016 | **40%** | 30% | 20% (cloud cover) | 10% | – |
| **Our draft** | 25% | 35% | 15% | 15% | 10% (daylight + UV) |

What the research tells us:

- **The same four factors appear in every index:** thermal comfort, precipitation, sky and wind (Research). Our factor choice is confirmed.
- **Thermal comfort is the single most important factor** (40–60%). Our draft gives it only 25%, which is too low.
- **Bad physical conditions should override good ones** (Research). HCI is designed so that "a high HCI score cannot be achieved when the physical index rating is low". Poor rain or wind should pull the score down no matter how pleasant the temperature is. This directly supports the rain cap proposed in 5.8.
- **Daytime conditions matter most.** The TCI weights daytime comfort highest because tourists are active during the day (Research). This supports our daytime-window aggregation.
- **Daylight and UV are not part of any validated index** (Assumption). They were also the source of the "free points" problem found in the Kraków example (5.5).
- **The score bands match TCI's.** TCI calls 40+ acceptable, 60+ good and 80+ excellent, which lines up with our 40 / 60 / 80 label boundaries (Research).
- **The ideal temperature band is not verified yet.** The HCI builds on a decade of tourist-preference surveys, but I couldn't access the exact rating table (Scott et al. 2016 was blocked). Our 16–24 °C "feels like" band is an **Assumption** until we check the paper.

**Recommended change:** adopt HCI:Urban weights: thermal comfort 40%, precipitation 30%, sky 20%, wind 10%. Drop daylight and UV as scored factors. Keep UV only as an informational note, and a very short daylight window can simply shrink the daytime aggregation.

### 6.2 Skiing

| Factor | What the evidence says | Level | Our draft | Change needed? |
|---|---|---|---|---|
| Snow depth | **30 cm is the standard minimum for skiable natural snow**. It is the basis of the "100-day rule": at least 100 days a season with ≥ 30 cm, used by the OECD and widely in the literature. | Research | Gate at 0.1 m, curve 0.2 → 1.0 m | **Yes:** raise the gate to 0.3 m |
| Snow as the dominant factor | The Ski Climate Index (SCI) treats snow reliability as the dominating facet. Comfort factors only refine it. | Research | 30% + 20% fresh snow = 50% | Consistent |
| Rain / freezing rain | A survey of Ontario skiers (Rutty & Andrey 2014) found **(freezing) rain** was one of the two most important weather attributes in ski trip decisions. | Research | Rain-on-snow cap | Add freezing rain (codes 66–67) to the gate |
| Wind chill | The same survey named **wind chill temperature** as the other most important attribute. | Research | Air temperature | **Yes:** score `apparent_temperature`, which includes wind chill |
| Temperature range | An "optimal ski day" from stakeholder interviews is **−5 to +5 °C** (Berghammer & Schmude 2014). The SCI comfort range is a wet-bulb temperature of −7 to +2 °C. | Research | Ideal −10 to −2 °C | **Yes:** shift the ideal band to about −7 to +2 °C |
| Sunshine | The optimal day has **≥ 5 h of sunshine** (Berghammer & Schmude). The SCI uses ≥ 6 h. | Research | Sunshine ratio ≥ 0.6 | Roughly consistent; could switch to absolute hours (≥ 5 h) |
| Wind | The SCI uses a daily wind limit of **40 km/h**. Lifts start slowing or stopping at around **50–65 km/h**, and gondolas close at around 60–80 km/h depending on the lift. | Research + Anecdotal | Gusts 30 km/h → 1, 60 km/h → 0 | Consistent. Could add a penalty for sustained wind above 40 km/h |
| Fresh snow ("powder day") | Widely valued by skiers, but I found no study giving numbers. | Assumption | 5–25 cm ideal | Keep; low weight |

### 6.3 Surfing

There is no academic index for surfing. The best evidence is how surf forecasters rate conditions. Surf-Forecast.com documents its star rating:

> "The star rating … is based on swell size and character (bigger the swell and longer the period the higher the rating), however if the wind is onshore the star rating drops in proportion to the wind speed … Flat conditions, blown out waves in onshore winds or very strong winds in any direction will result in 0 star rating."

Surfline gives an example of how much wind direction matters. For the same 3–4 ft of surf, it rates offshore wind "fair to fair-good" but onshore wind "poor to poor-fair".

| Factor | What the evidence says | Level | Our draft | Change needed? |
|---|---|---|---|---|
| Swell height and period | Together they form the base of every forecaster's rating. | Industry | 35% + 25% | Consistent |
| Swell period | Periods below about 9–10 s mostly come from local wind and give choppier surf. 11 s and above gives cleaner, more organised sets. | Industry | 5 s → 0, 12 s → 1 | Consistent |
| Wind speed | Onshore wind lowers the rating in proportion to its speed. Very strong wind from any direction gives 0. | Industry | 25% weight | **Yes:** strong wind needs to be a cap, not just a weight. This confirms the proposed Newquay fix (5.8) |
| Wind direction | Can move the rating by about two categories. It is the biggest missing input. | Industry | Not used | Open decision: add a coastline bearing per location |
| Ideal wave height (0.8–2.5 m) | Forecasters rate bigger surf higher, but what is "ideal" depends on skill. No source found for a general-audience band. | Assumption | Trapezoid | Keep; label it "for recreational surfers" |
| Water temperature | Not part of forecasters' ratings. | Assumption | 10% | Keep as a minor comfort factor, or drop |

### 6.4 Indoor sightseeing

There is no weather index for indoor tourism, but there is research on how weather affects museum attendance:

- **Rain increases museum visits, but only modestly.** A 13-year study of Te Papa museum in New Zealand found about **+2.8% admissions on rainy days** (Research).
- **Morning rain matters most.** It raises morning visits significantly. Afternoon rain has less effect, and attendance in the closing hours can even **drop by up to 9%** (Research).
- **Visitors react to the actual weather, not the forecast.** Most decisions are made in the moment (Research). A 7-day indoor forecast is therefore more of a planning aid than a prediction of crowds.
- **On rainy days visitors stay longer** and are more likely to buy tickets for paid special exhibitions: +8–13% revenue (Research).

What this means for our approach (applied in section 3):

- **Indoor is a recommendation, not a condition score.** The research supports the direction (bad weather makes indoor relatively more attractive), but it doesn't give us a magnitude to turn into a score. The recommendation levels are based on the outdoor score, i.e. on what you give up by staying in.
- **Crowding is a text hint only.** The real effect is small (+2.8%), and we have no crowd data. Weekends and public holidays probably affect crowds more than weather does. That is an assumption, not something the research above shows, and a possible later addition.
- **Possible refinement:** base the busy hint on morning rain, which has the strongest effect on attendance.

### 6.5 Summary of recommended changes

| # | Change | Based on |
|---|---|---|
| 1 | Outdoor weights → thermal 40%, precipitation 30%, sky 20%, wind 10%; drop daylight and UV | HCI:Urban, TCI |
| 2 | Outdoor: poor rain or wind caps the score | HCI design principle |
| 3 | Ski snow gate: 0.1 m → **0.3 m** | 100-day rule (OECD) |
| 4 | Ski temperature: use `apparent_temperature` (wind chill); ideal band about −7 to +2 °C | Rutty & Andrey 2014, Berghammer & Schmude 2014, SCI |
| 5 | Ski gate: add freezing rain (codes 66–67) | Rutty & Andrey 2014 |
| 6 | Surf: strong wind caps the score | Surf-Forecast.com rating rules |
| 7 | Surf: plan for wind direction (coastline bearing) | Surf-Forecast.com, Surfline |
| 8 | Indoor: recommendation levels (Recommended / Good alternative / Save for later) instead of a score; crowding as a text hint only. **Applied.** | Te Papa attendance study |

Change 8 is already applied in sections 3–5. Changes 1–7 are not yet applied: those sections still show the original draft values.

## 7. Open decisions

1. **Recommended changes 1–7 (6.5):** adopt all, some or none?
2. **Skiing in towns:** use only the town's elevation, or also estimate conditions at a higher elevation?
3. **Indoor venue availability:** should town size (geocoded `population` / `feature_code`) affect the indoor recommendation? A village of 800 people has far fewer museums than a capital.
4. **Surf wind direction:** skip in v1, or add a coastline bearing per location? The evidence in 6.3 shows it matters a lot.
5. **Where tuning happens:** weights and thresholds should live in one config file so we can tune them without touching the logic.

## Sources

**Open-Meteo**

- [Open-Meteo Forecast API docs](https://open-meteo.com/en/docs)
- [Open-Meteo Marine API docs](https://open-meteo.com/en/docs/marine-weather-api)
- [Open-Meteo Geocoding API docs](https://open-meteo.com/en/docs/geocoding-api)

**Outdoor sightseeing (tourism climate indices)**

- [Mieczkowski (1985): The Tourism Climatic Index, Canadian Geographer](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1541-0064.1985.tb00365.x)
- [Scott et al. (2016): An Inter-Comparison of the Holiday Climate Index (HCI) and the Tourism Climate Index (TCI) in Europe, Atmosphere](https://www.mdpi.com/2073-4433/7/6/80)
- [HCI:Beach vs. TCI across coastal destinations in China (PMC), with TCI and HCI weights and beach-tourist preference data](https://pmc.ncbi.nlm.nih.gov/articles/PMC7406217/)
- [ECMWF / Copernicus: Climate Suitability for Tourism indicators, with the HCI formula `4ET + 2CD + 3PR + WN`](https://confluence.ecmwf.int/plugins/viewsource/viewpagesrc.action?pageId=327675249)

**Skiing**

- [The Ski Climate Index (SCI) (PMC), citing Rutty & Andrey 2014 and Berghammer & Schmude 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC8116266/)
- [OECD (2007): Climate Change in the European Alps: Adapting Winter Tourism (100-day rule)](https://www.oecd.org/content/dam/oecd/en/publications/reports/2007/01/climate-change-in-the-european-alps_g1gh7c4d/9789264031692-en.pdf)
- [Critical revision of snow indicators in ski tourism, Int. J. Biometeorology](https://link.springer.com/article/10.1007/s00484-020-01867-3)
- [At what wind speeds do ski operators close chair lifts? (Codidact, anecdotal)](https://outdoors.codidact.com/posts/53653)
- [UKC Forums: What wind speed normally forces ski lifts to close? (anecdotal)](https://www.ukclimbing.com/forums/skiing/what_wind-speed_normally_forces__ski-lifts_to_close-492929)

**Surfing**

- [Surf-Forecast.com FAQ: how the star rating works](https://www.surf-forecast.com/pages/faq)
- [Surfline: Rating the Surf](https://www.surfline.com/surfline/forecasts4/forecast_blog_entry.cfm?id=13680&sef=true)
- [The Surf Tribe: How to read a surf forecast (swell period guidance)](https://www.thesurftribe.com/surf-blog/how-to-read-a-surf-forecast-and-why-the-star-rating-isnt-enough)
- [Surf forecasting (Wikipedia)](https://en.wikipedia.org/wiki/Surf_forecasting)

**Indoor sightseeing**

- [Rain and museum attendance: Are daily data fine enough? Journal of Cultural Economics](https://link.springer.com/article/10.1007/s10824-017-9298-9)
- [CultureCase: Rainy days at the museum (summary of the Te Papa study)](https://culturecase.org/research/2018/08/rainy-days-museum/)
- [Weather conditions and museum attendance: a case study from Sicily, Climatic Change (not reviewed; paywalled)](https://link.springer.com/article/10.1007/s10584-019-02453-2)
