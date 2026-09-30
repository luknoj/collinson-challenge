# Activity Scoring: Research Notes

How we score a place for **skiing**, **surfing** and **outdoor sightseeing**, and recommend days for **indoor sightseeing**, over the next 7 days, using Open-Meteo weather data.

**Constraint:** all data comes from Open-Meteo (Geocoding, Elevation, Forecast and Marine APIs). No other data sources are used.

## 1. Data sources

| API | Used for | Key variables |
|---|---|---|
| **Geocoding** (`geocoding-api.open-meteo.com/v1/search`) | Turning a city name into coordinates | `latitude`, `longitude`, `elevation`, `timezone`, `population`, `feature_code` |
| **Elevation** (`api.open-meteo.com/v1/elevation`) | Detecting mountain towns (skiing note) and estimating which way the coast faces (surfing), both in one call (see 3) | `elevation` for up to 100 coordinates per call |
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

- No skiable snow (`snow_depth` below 0.3 m, the standard minimum for natural snow, see 6.2) means Not applicable if it's below that all week, otherwise 0 for that day.
- Freezing rain (`weather_code` 66–67) during lift hours caps the score at 20.
- Rain on snow (`rain_sum` above 2 mm while temperatures are above 0) caps the score at 30.

**Factors:**

| Factor | Data | Ideal → poor | Weight |
|---|---|---|---|
| Snow base | hourly `snow_depth` | ≥ 1.0 m ideal · 0.3 m is the minimum (below that the gate applies) | 30% |
| Fresh snow | `snowfall_sum` for the day plus the previous 1–2 days | 5–25 cm ideal ("powder day") · 0 is neutral · > 40 cm is a storm (closures, avalanche risk) | 20% |
| Temperature | `apparent_temperature` over lift hours (includes wind chill) | −7 to +2 °C ideal · above +7 °C slush · below −22 °C harsh | 15% |
| Wind | `wind_gusts_10m_max`, `wind_speed_10m` | Gusts < 30 km/h ideal · > 60 km/h lifts usually close (this should also be a gate) | 20% |
| Visibility / sky | `visibility`, `cloud_cover`, `sunshine_duration` | Visibility > 5 km and sunny · < 1 km means "whiteout" | 15% |

#### Mountain towns: a note about the surroundings

Skiing is scored on the forecast for the place the user asked about. We don't fetch forecasts for other points or try to guess where the slopes are. Someone checking a mountain town for skiing already knows the slopes are above the town. Our job is to show what the data says about that difference.

The weather system around a town is mostly the same as in the town itself. What changes with height is mainly **temperature**, and with it **whether precipitation falls as rain or snow**. So for mountain towns, skiing gets an extra **surroundings note**. The note never changes the score.

**Detecting a mountain town:**

- One Elevation API call for a 7×7 grid: 49 points about 3 km apart, covering roughly 10 km around the town.
- This is confirmed to work in one request. The Elevation API accepts up to 100 coordinates per call and uses the Copernicus GLO-90 terrain model (90 m resolution). We tested it with 49 points.
- The "high terrain around" is the 90th percentile of the sampled heights. The single highest point is often an isolated summit or glacier.
- If that height is **300 m or more above the town**, it's a mountain town and the note is shown.

**What the note says.** Everything comes from data we already have:

| Note | How it's calculated | Example wording |
|---|---|---|
| Height difference | 90th-percentile terrain height minus town elevation | "The terrain around rises to about 3,670 m, 2,060 m above the town." |
| Temperature up there | Town temperature − 0.65 °C per 100 m (standard atmosphere lapse rate). Open-Meteo's own elevation adjustment gave about 0.8 °C per 100 m in our Zermatt test, so this is in the right range. | "Expect it to be around 13 °C colder up there." |
| Rain or snow up there | Forecast `freezing_level_height` for the town. Snow usually reaches about **300 m below the freezing level**, and further down in heavy precipitation (forecasting rule of thumb). Shown when precipitation is forecast and this snow line is below the high terrain. | "Rain in town is likely falling as snow above about 1,100 m." |
| Snow depth | Always shown for mountain towns | "Snow depth is for the town's area. Higher slopes usually have more." |

**Caveat:** in winter, cold air can pool in valleys (temperature inversions), so the slopes can occasionally be *warmer* than the town. The temperature line is an estimate, and the note says "around".

**Tested terrain values (30 Sep 2026):**

| Town | Town elevation | High terrain around (90th percentile) | Difference | Estimated temperature drop | Note shown? |
|---|---|---|---|---|---|
| Zermatt | 1,608 m | 3,667 m | 2,059 m | ~13 °C | Yes |
| Innsbruck | 574 m | 2,073 m | 1,499 m | ~10 °C | Yes |
| Zakopane | 812 m | 1,682 m | 870 m | ~6 °C | Yes |
| Warsaw | 100 m | 111 m | 11 m | – | No |

A flat town is not marked Not applicable because of its terrain. If it has no snow, the snow gate already handles it.

**Snow-depth sanity check.** At Zermatt, the default forecast showed snow depth at 0 m for five days, then a jump to 0.45 m on 5–6 Oct with 0 cm of snowfall. The most likely cause is the API switching from a detailed regional model to a coarser global one for later days (our interpretation; the docs don't say so). Snow depth can't grow faster than snow falls, so cap it: `depth[d] ≤ depth[d−1] + snowfall[d]`.

**What the score describes:** weather and snow conditions for skiing at this place. Open-Meteo has no data on resorts, lifts or artificial snow.

### Surfing

**Gates:**

- If the Marine API returns only null wave data for the point, surfing is Not applicable. Tested on 30 Sep 2026:
  - Coordinates near a coast snap to the nearest sea grid cell and return values. This worked for Ericeira, Newquay and even Sintra, about 10 km inland.
  - Places further inland return all-null values: Madrid, Kraków, Bordeaux (about 50 km inland) and Florence.
  - So the null check is enough to tell coastal from inland places.
- Thunderstorm (`weather_code` 95–99) sets the score to 0.
- Swell above about 4 m caps the score (experts only).
- Sustained wind above 30 km/h (daytime mean `wind_speed_10m`) caps the score at 35 ("blown out").

**Factors:**

| Factor | Data | Ideal → poor | Weight |
|---|---|---|---|
| Swell height | `swell_wave_height` | 0.8–2.5 m ideal · < 0.3 m flat · > 3.5 m dangerous for most | 35% |
| Swell period | `swell_wave_period` | ≥ 12 s excellent · 8–10 s decent · < 6 s mushy wind swell | 25% |
| Wind | `wind_speed_10m` | < 12 km/h glassy · 12–25 OK · > 30 km/h blown out | 25% |
| Wave quality | ratio of `wind_wave_height` to `swell_wave_height` | Low ratio is clean groundswell · high ratio is choppy | 5% |
| Comfort | `sea_surface_temperature`, air temperature | > 18 °C ideal · < 10 °C needs a thick wetsuit (minor penalty, never a gate) | 10% |

#### Wind direction: a small adjustment plus a note

Whether the wind blows **offshore** (from the land, good) or **onshore** (from the sea, bad) depends on which way the coast faces. Open-Meteo has no coastline data, so we estimate it from the terrain (see 6.3 for why this method and not the swell direction):

1. **Estimate which way the coast faces.** Add a ring of points to the Elevation API call: 16 directions at 3 km and 6 km from the town (32 points). Points at exactly 0 m are sea. The average bearing of the sea points is the direction the coast faces. Together with the 7×7 grid for skiing that's 81 points, so it still fits in one call (limit 100).
2. **Check the estimate is usable.** There must be at least 4 sea points, and they must point clearly in one direction (mean resultant length ≥ 0.5, a tunable value). A town on a narrow peninsula has sea on several sides and fails this check. Then no adjustment is made, and the note says "Coast direction unclear".
3. **Classify the wind**, using the daytime mean `wind_direction_10m` (the direction the wind comes from):
   - `angle` = smallest difference between the wind direction and the coast-facing direction (0–180°)
   - 0–45° is **onshore**, 45–135° **cross-shore**, 135–180° **offshore**
4. **Adjust the weighted sum a little**, before the gates are applied, and only when the daytime mean wind is **15 km/h or more**. Below that, direction barely matters.

| Wind | Adjustment | Note shown |
|---|---|---|
| Onshore | **−10** | "Wind mostly onshore (from the sea) – expect choppier waves." |
| Cross-shore | 0 | "Cross-shore wind." |
| Offshore | **+5** | "Offshore wind (from the land) – cleaner waves likely." |
| Wind below 15 km/h | 0 | "Light wind – direction has little effect." |

Every direction note ends with: *"Based on the estimated coast direction; individual beaches may face differently."*

**Why the impact is deliberately small:**

- The coast direction is estimated for the town, not for a specific beach.
- Bays and headlands can face quite differently from the town.
- So direction can move the score by at most 10 points, and it can never lift a score past a gate. Wind *speed* keeps its full 25% weight.

**Caveats:**

- Marine models run at roughly 5–25 km resolution and are less accurate near coasts. The score describes "the sea state off this coast", not a specific surf break.
- There's no tide data built in.

### Outdoor sightseeing

**Gates:**

- Thunderstorm during daytime: cap at 20
- `apparent_temperature_max` above 38 °C, or below −15 °C: cap at 20
- Gusts above 75 km/h: cap at 20
- Daytime rain above 5 mm with probability above 70%: cap at 25
- Sustained wind (`wind_speed_10m_max`) above 40 km/h: cap at 40

**Factors:**

| Factor | Data | Ideal → poor | Weight |
|---|---|---|---|
| Precipitation | hourly `precipitation_probability` and `precipitation` over daytime | Probability < 20% and < 0.5 mm ideal · several wet hours or > 5 mm poor | 30% |
| Thermal comfort | `apparent_temperature` over daytime | 16–24 °C ideal · 0 °C or 32 °C score 0 | 40% |
| Sunshine / sky | `sunshine_duration ÷ daylight_duration`, `cloud_cover` | > 60% sunny ideal · heavy overcast lower (mild penalty only) | 20% |
| Wind | `wind_speed_10m_max`, `wind_gusts_10m_max` | < 20 km/h ideal · > 45 km/h poor | 10% |

These weights follow the Holiday Climate Index for cities (see 6.1). Daylight and UV are not scored, because no validated index uses them. A UV index of 9 or more can still be shown as an information note ("Very high UV – use sun protection").

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
- **Town-size hint:** tells the user how likely it is that the place has enough indoor attractions for an indoor day. Shown only when the level is **Recommended** or **Good alternative**, i.e. when the user may actually plan an indoor day. See [Town size](#town-size-how-it-affects-indoor-plans) below.

**Why crowding is only a hint, not part of the rating:**

- The measured effect is small: about +2.8% visitors on rainy days (see 6.4).
- Open-Meteo has no crowd data, so we'd be guessing both the size and the shape of the effect.
- A rating that rises with bad weather and then drops again for crowds would confuse users ("pouring rain → 70, light drizzle → 85").

#### Town size: how it affects indoor plans

The weather tells us *when* an indoor day makes sense, but not *whether there is anything to do indoors*. Open-Meteo can't tell us how many museums, galleries or other venues a place has. What we do get from the geocoding result is:

- `population`: missing for some places, because the geocoding API omits empty fields
- `feature_code`: for example `PPLC` for a national capital, `PPLA` for a regional capital

We use these as a rough guide:

| Town size | How likely it is to affect the decision | Hint shown to the user |
|---|---|---|
| Capital (`PPLC`) or ≥ 1 million people | **Very unlikely.** A wide choice of museums, galleries and other venues is almost certain. | "Large city – plenty of indoor options." |
| 100,000 – 1 million | **Unlikely.** A good choice of indoor attractions is likely. | "Good choice of indoor attractions likely." |
| 10,000 – 100,000 | **Possible.** Usually a few options (local museum, churches, cinema, pools), which may not fill several indoor days. | "Limited indoor options – check what's open before planning a full day." |
| < 10,000 | **Likely.** There may be very few indoor attractions, or none. | "Small town – indoor options may be very limited; consider a larger town nearby." |
| No population data | Unknown | No hint |

**Limitations:**

- The tiers are our own heuristic, not taken from a study.
- **Tourist towns** often have far more to do than their population suggests. A ski resort or seaside town of 5,000 people may have museums, spas and shopping built for visitors. That's why the wording is "may be limited" and not "nothing to do".
- Population only gives a probability. The level (Recommended / Good alternative / Save for later) stays purely weather-based, and the town-size hint only adds context for planning.
- Open-Meteo has no data on venues, so population is the best we can do within the Open-Meteo-only constraint.

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

Example: for skiing temperature, feels like −9 °C scores 0.87, because it is 13/15 of the way from −22 °C (score 0) to −7 °C (score 1). Anything from −7 to +2 °C scores 1.0.

| Activity | Factor | Input | Curve points `(value → score)` |
|---|---|---|---|
| Skiing | Snow base | `snow_depth` (m) | 0.3 → 0.3 · 1.0 → 1 (below 0.3 m the gate applies) |
| Skiing | Fresh snow | `snowfall_sum` over 72 h (cm) | 0 → 0.5 · 5 → 1 · 25 → 1 · 40 → 0.3 |
| Skiing | Temperature | daytime mean `apparent_temperature` (°C) | −22 → 0 · −7 → 1 · +2 → 1 · +7 → 0 |
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
| Temperature | feels like −9 °C | 0.87 | 15% | 13.0 |
| Wind | gusts 35 km/h | 0.83 | 20% | 16.7 |
| Sky | visibility 20 km, sunshine ratio 0.7 | 1.00 | 15% | 15.0 |
| **Score** | | | | **95** |

**Surroundings note** (mountain town: terrain rises about 2,060 m above the town): *"The terrain around rises to about 3,670 m. Expect it to be around 13 °C colder up there (about −19 °C). Snow depth is for the town's area; higher slopes usually have more."* No rain-or-snow line, because no precipitation is forecast.

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 10%, 0 mm | 1.00 | 30% | 30.0 |
| Thermal comfort | feels like −9 °C | 0.00 | 40% | 0.0 |
| Sunshine | ratio 0.7 | 1.00 | 20% | 20.0 |
| Wind | 20 km/h | 1.00 | 10% | 10.0 |
| **Score** | | | | **60** |

**Indoor sightseeing:** outdoor score 60 (≥ 60), so **Save for later**. No travel note: no snow falls today. No busy hint: it's dry. No town-size hint, because indoor isn't suggested today.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | 95 | Excellent | Fresh snow on a deep base, sunny |
| Surfing | – | Not applicable | Not coastal |
| Outdoor sightseeing | 60 | Good | Dry, sunny and calm, but very cold |
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
| Wind direction, daytime mean | from 320° (northwest) |
| Coast faces (Elevation API estimate) | 270° (west) |
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
| **Score** | | | | **99** |

**Wind direction:** the angle between the wind (320°) and the coast (270°) is 50°, which is cross-shore. The wind is below 15 km/h anyway, so there is no adjustment. Note: *"Light wind – direction has little effect."*

**Outdoor sightseeing:** every factor is inside its ideal range (dry, feels like 19 °C, sunny, light wind), so the score is **100**.

**Indoor sightseeing:** outdoor score 100 (≥ 60), so **Save for later**. No hints; the town-size hint only appears when indoor is suggested.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow all week |
| Surfing | 99 | Excellent | Clean 1.6 m swell at 13 s, light wind |
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
| Wind direction, daytime mean | from 300° (west-northwest) |
| Coast faces (Elevation API estimate) | 320° (northwest) |
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
| **Weighted sum** | | | | **55** |
| **Wind direction** | angle 300° vs 320° = 20°, so onshore at 32 km/h: −10 | | | **45** |
| **Gate** | sustained wind 32 km/h is above 30 km/h, so the score is capped at 35 | | | **35** |

Note: *"Wind mostly onshore (from the sea) – expect choppier waves. Based on the estimated coast direction; individual beaches may face differently."*

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 60% (0.33), 2 mm (0.67) | 0.50 | 30% | 15.0 |
| Thermal comfort | feels like 11 °C | 0.69 | 40% | 27.5 |
| Sunshine | ratio 0.3 | 0.70 | 20% | 14.0 |
| Wind | 38 km/h | 0.28 | 10% | 2.8 |
| **Score** | | | | **59** |

**Indoor sightseeing:** outdoor score 59 (40–59), so **Good alternative**. The busy hint applies: rain probability is 60% with 2 mm of rain. Town-size hint: about 20,000 people, so **"Limited indoor options – check what's open before planning a full day."**

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow all week |
| Surfing | 35 | Fair | Blown out: strong wind (32 km/h), short 7 s period |
| Outdoor sightseeing | 59 | Moderate | Showers and strong wind |
| Indoor sightseeing | – | Good alternative | Mixed weather; limited indoor options in a small town |

Without the wind cap this day would score 55 (Moderate), which is far too generous for a blown-out day. See [5.8](#58-lessons-from-the-examples).

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
| Precipitation | 90%, 8 mm | 0.00 | 30% | 0.0 |
| Thermal comfort | feels like 9 °C | 0.56 | 40% | 22.5 |
| Sunshine | ratio 0.05 | 0.45 | 20% | 9.0 |
| Wind | 35 km/h | 0.40 | 10% | 4.0 |
| **Weighted sum** | | | | **36** |
| **Gate** | daytime rain 8 mm at 90% probability, so the score is capped at 25 | | | **25** |

**Indoor sightseeing:** outdoor score 25 (< 40), so **Recommended**. The busy hint applies: rain probability is 90% with 8 mm of rain. Town-size hint: about 800,000 people, so **"Good choice of indoor attractions likely."**

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow all week |
| Surfing | – | Not applicable | Not coastal |
| Outdoor sightseeing | 25 | Fair | Rain all day (8 mm) |
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
| Freezing level | 1,400 m |
| UV index max | 2 |
| Marine data | none (inland) |

**Skiing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Snow base | 0.6 m | 0.60 | 30% | 18.0 |
| Fresh snow | 0 cm | 0.50 | 20% | 10.0 |
| Temperature | feels like +1 °C | 1.00 | 15% | 15.0 |
| Wind | gusts 45 km/h | 0.50 | 20% | 10.0 |
| Sky | visibility 3 km (0.5), no sun (0) | 0.30 | 15% | 4.5 |
| **Weighted sum** | | | | **58** |
| **Gate** | rain on snow: 6 mm above 0 °C, so the score is capped at 30 | | | **30** |

A feels-like temperature of +1 °C is inside the ideal band, so the temperature factor alone looks perfect. It's the rain-on-snow gate that catches this day.

**Surroundings note** (mountain town: terrain rises about 870 m above the town): *"The terrain around rises to about 1,680 m. Expect it to be around 6 °C colder up there (about −2 °C). Rain in town is likely falling as snow above about 1,100 m, so the upper slopes may be getting fresh snow. Snow depth is for the town's area; higher slopes usually have more."*

This is the kind of day where the note matters most. The town score (30) is correct for the town, and the note tells the user the upper slopes may look quite different.

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 85%, 6 mm | 0.00 | 30% | 0.0 |
| Thermal comfort | feels like +1 °C | 0.06 | 40% | 2.5 |
| Sunshine | ratio 0 | 0.40 | 20% | 8.0 |
| Wind | 30 km/h | 0.60 | 10% | 6.0 |
| **Score** | | | | **17** |

The rain cap (25) doesn't change anything here, because the weighted sum is already lower.

**Indoor sightseeing:** outdoor score 17 (< 40), so **Recommended**. The busy hint applies: rain probability is 85% with 6 mm of rain. No travel note: there is no freezing rain, and gusts stay below 75 km/h. Town-size hint: about 27,000 people, so **"Limited indoor options – check what's open before planning a full day."** Zakopane is a tourist town and probably has more than its size suggests. This is exactly the limitation of the heuristic.

**Outcome**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | 30 | Fair | Rain on snow, +4 °C (likely snow higher up, see note) |
| Surfing | – | Not applicable | Not coastal |
| Outdoor sightseeing | 17 | Poor | Cold rain all day |
| Indoor sightseeing | – | Recommended | Cold rain all day; limited indoor options likely |

---

### 5.7 A full week: surfing in Ericeira

Day 1 is the clean surf day from 5.3.

| Day | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| Score | 99 | 88 | 57 | 35 | 40 | 72 | 81 |
| Confidence | High | High | High | Medium | Medium | Low | Low |

- Best day: 99 (Monday)
- Average of the top 3 days: (99 + 88 + 81) / 3 = 89.3
- **Weekly score = 0.5 × 99 + 0.5 × 89.3 = 94 (Excellent)**
- A plain mean would give 67 (Good). That hides the fact that the week has three great surf days.

**Outcome for the user:** "Excellent surf week. Best on Monday and Tuesday. Sunday also looks good, but that far out the forecast is less certain."

---

### 5.8 Lessons from the examples

Working through the numbers exposed two places where the weighted sum alone was too generous. Both are now fixed with gates (changes 2 and 6 in 6.5):

1. **Surfing in Newquay (5.4).** The weighted sum is 55, because swell height outweighs the wind. The new gate (sustained wind above 30 km/h caps the score at 35) brings it down to 35 (Fair), which matches how surfers would rate it.
2. **Outdoor sightseeing in Kraków (5.5).** The original draft gave 37, because daylight and UV added points even in the rain. Those factors are now removed, and the new gate (daytime rain above 5 mm with probability above 70% caps the score at 25) brings it to 25 (Fair).

This is why the weights, curves and gates live in one config file (see section 7), with unit tests built from examples like these.

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
| **Our original draft** | 25% | 35% | 15% | 15% | 10% (daylight + UV) |
| **Our model now** | 40% | 30% | 20% (sunshine) | 10% | – |

What the research tells us:

- **The same four factors appear in every index:** thermal comfort, precipitation, sky and wind (Research). Our factor choice is confirmed.
- **Thermal comfort is the single most important factor** (40–60%). The original draft gave it only 25%. It is now 40%.
- **Bad physical conditions should override good ones** (Research). HCI is designed so that "a high HCI score cannot be achieved when the physical index rating is low". Poor rain or wind should pull the score down no matter how pleasant the temperature is. This directly supports the rain cap proposed in 5.8.
- **Daytime conditions matter most.** The TCI weights daytime comfort highest because tourists are active during the day (Research). This supports our daytime-window aggregation.
- **Daylight and UV are not part of any validated index** (Assumption). They were also the source of the "free points" problem found in the Kraków example (5.5).
- **The score bands match TCI's.** TCI calls 40+ acceptable, 60+ good and 80+ excellent, which lines up with our 40 / 60 / 80 label boundaries (Research).
- **The ideal temperature band is not verified yet.** The HCI builds on a decade of tourist-preference surveys, but I couldn't access the exact rating table (Scott et al. 2016 was blocked). Our 16–24 °C "feels like" band is an **Assumption** until we check the paper.

**Applied:** HCI:Urban weights (thermal comfort 40%, precipitation 30%, sky 20%, wind 10%). Daylight and UV are no longer scored. UV is kept only as an information note, and a short winter day simply shortens the daytime window.

### 6.2 Skiing

| Factor | What the evidence says | Level | Original draft | Change |
|---|---|---|---|---|
| Snow depth | **30 cm is the standard minimum for skiable natural snow**. It is the basis of the "100-day rule": at least 100 days a season with ≥ 30 cm, used by the OECD and widely in the literature. | Research | Gate at 0.1 m, curve 0.2 → 1.0 m | **Applied:** raise the gate to 0.3 m |
| Snow as the dominant factor | The Ski Climate Index (SCI) treats snow reliability as the dominating facet. Comfort factors only refine it. | Research | 30% + 20% fresh snow = 50% | Consistent |
| Rain / freezing rain | A survey of Ontario skiers (Rutty & Andrey 2014) found **(freezing) rain** was one of the two most important weather attributes in ski trip decisions. | Research | Rain-on-snow cap | **Applied:** freezing rain (codes 66–67) caps the score at 20 |
| Wind chill | The same survey named **wind chill temperature** as the other most important attribute. | Research | Air temperature | **Applied:** score `apparent_temperature`, which includes wind chill |
| Temperature range | An "optimal ski day" from stakeholder interviews is **−5 to +5 °C** (Berghammer & Schmude 2014). The SCI comfort range is a wet-bulb temperature of −7 to +2 °C. | Research | Ideal −10 to −2 °C | **Applied:** shift the ideal band to about −7 to +2 °C |
| Sunshine | The optimal day has **≥ 5 h of sunshine** (Berghammer & Schmude). The SCI uses ≥ 6 h. | Research | Sunshine ratio ≥ 0.6 | Roughly consistent; could switch to absolute hours (≥ 5 h) |
| Wind | The SCI uses a daily wind limit of **40 km/h**. Lifts start slowing or stopping at around **50–65 km/h**, and gondolas close at around 60–80 km/h depending on the lift. | Research + Anecdotal | Gusts 30 km/h → 1, 60 km/h → 0 | Consistent. Could add a penalty for sustained wind above 40 km/h |
| Fresh snow ("powder day") | Widely valued by skiers, but I found no study giving numbers. | Assumption | 5–25 cm ideal | Keep; low weight |

### 6.3 Surfing

There is no academic index for surfing. The best evidence is how surf forecasters rate conditions. Surf-Forecast.com documents its star rating:

> "The star rating … is based on swell size and character (bigger the swell and longer the period the higher the rating), however if the wind is onshore the star rating drops in proportion to the wind speed … Flat conditions, blown out waves in onshore winds or very strong winds in any direction will result in 0 star rating."

Surfline gives an example of how much wind direction matters. For the same 3–4 ft of surf, it rates offshore wind "fair to fair-good" but onshore wind "poor to poor-fair".

| Factor | What the evidence says | Level | Original draft | Change |
|---|---|---|---|---|
| Swell height and period | Together they form the base of every forecaster's rating. | Industry | 35% + 25% | Consistent |
| Swell period | Periods below about 9–10 s mostly come from local wind and give choppier surf. 11 s and above gives cleaner, more organised sets. | Industry | 5 s → 0, 12 s → 1 | Consistent |
| Wind speed | Onshore wind lowers the rating in proportion to its speed. Very strong wind from any direction gives 0. | Industry | 25% weight | **Applied:** strong wind needs to be a cap, not just a weight. Wind above 30 km/h now caps the score at 35 (see the Newquay example, 5.4) |
| Wind direction | Can move the rating by about two categories. It is the biggest missing input. | Industry | Not used | **Applied:** coast direction estimated from terrain; small adjustment plus a note (see below) |
| Ideal wave height (0.8–2.5 m) | Forecasters rate bigger surf higher, but what is "ideal" depends on skill. No source found for a general-audience band. | Assumption | Trapezoid | Keep; label it "for recreational surfers" |
| Water temperature | Not part of forecasters' ratings. | Assumption | 10% | Keep as a minor comfort factor, or drop |

#### Wind direction: checking the method (change 7)

**The principle is confirmed.**

- Surf guides agree that what matters is the wind **relative to the beach**: offshore wind (from the land) grooms the waves, and onshore wind (from the sea) makes them choppy. The usual example: a west-facing beach gets clean, offshore conditions with an easterly wind.
- Direction matters most between about 8 and 15 knots (roughly 15–28 km/h). Below that it "barely matters", which is why our adjustment starts at 15 km/h.
- A survey of surfers found **85.7% check wind direction** in forecasts, nearly as many as check wave height (91.9%) or period (89.8%).

**The swell-direction shortcut is not the proper method.** Forecasters compare the wind with the **fixed direction the beach faces**, not with the current swell. We tested our earlier proposal, using the swell direction as a stand-in for the coast direction, against the actual coast direction of six surf towns (30 Sep 2026, 7-day mean swell direction):

| Town | Coast faces (terrain estimate) | Known orientation | 7-day mean swell from | Swell vs. coast |
|---|---|---|---|---|
| Ericeira, PT | 270° | West | 319° | 49° off |
| Newquay, UK | 320° | North-west | 273° | 47° off |
| Biarritz, FR | 309° | West-northwest | 309° | 0° off |
| Malibu, US | 164° | South | 187° | 23° off |
| Tarifa, ES | 202° | South-southwest | 288° | **86° off** |
| Bondi, AU | 92° | East | 75° | 17° off |

The swell arrives up to 86° away from the direction the coast faces. Three of the six towns are off by about 45° or more, which is enough to put the wind in the wrong category (onshore / cross-shore / offshore). **We rejected the swell shortcut.**

**The terrain method matches the proper approach.** The Elevation API gives exactly 0 m for points at sea, so a ring of points around the town shows where the sea is. The average bearing of the sea points is the direction the coast faces. That's a fixed coast direction, the same thing forecasters use. In the test it matched the known orientation of all six towns (the "Coast faces" column above).

**Why it only gets a small, labelled impact:**

- It estimates the coast direction for the town, not for a particular beach. Bays, headlands and river mouths can face differently.
- It treats "exactly 0 m" as sea. Very low coastal land (tidal flats, polders) could be mistaken for sea.
- On peninsulas the sea is on several sides. The confidence check (section 3) skips the adjustment there.
- The method is our own and has been tested on six towns only.

So direction adjusts the score by at most −10 / +5 points, only when the wind is 15 km/h or more, and it always comes with a note saying the direction is estimated (section 3).

**Evidence level:** the offshore/onshore effect is **Industry**. The terrain-based coast direction is an **Assumption**, but one tested against six known coastlines.

### 6.4 Indoor sightseeing

There is no weather index for indoor tourism, but there is research on how weather affects museum attendance:

- **Rain increases museum visits, but only modestly.** A 13-year study of Te Papa museum in New Zealand found about **+2.8% admissions on rainy days** (Research).
- **Morning rain matters most.** It raises morning visits significantly. Afternoon rain has less effect, and attendance in the closing hours can even **drop by up to 9%** (Research).
- **Visitors react to the actual weather, not the forecast.** Most decisions are made in the moment (Research). A 7-day indoor forecast is therefore more of a planning aid than a prediction of crowds.
- **On rainy days visitors stay longer** and are more likely to buy tickets for paid special exhibitions: +8–13% revenue (Research).

What this means for our approach (applied in section 3):

- **Indoor is a recommendation, not a condition score.** The research supports the direction (bad weather makes indoor relatively more attractive), but it doesn't give us a magnitude to turn into a score. The recommendation levels are based on the outdoor score, i.e. on what you give up by staying in.
- **Crowding is a text hint only.** The real effect is small (+2.8%), and we have no crowd data. Weekends and public holidays probably affect crowds more than weather does. That is an assumption, not something the research above shows. The day of the week is known from the date, but public holidays are not in Open-Meteo.
- **Possible refinement:** base the busy hint on morning rain, which has the strongest effect on attendance.

### 6.5 Summary of changes

| # | Change | Based on | Status |
|---|---|---|---|
| 1 | Outdoor weights → thermal 40%, precipitation 30%, sky 20%, wind 10%; drop daylight and UV | HCI:Urban, TCI | Applied |
| 2 | Outdoor: heavy rain caps the score at 25, strong wind (above 40 km/h) caps it at 40 | HCI design principle | Applied |
| 3 | Ski snow gate: 0.1 m → **0.3 m** | 100-day rule (OECD) | Applied |
| 4 | Ski temperature: use `apparent_temperature` (wind chill); ideal band −7 to +2 °C | Rutty & Andrey 2014, Berghammer & Schmude 2014, SCI | Applied |
| 5 | Ski gate: freezing rain (codes 66–67) caps the score at 20 | Rutty & Andrey 2014 | Applied |
| 6 | Surf: sustained wind above 30 km/h caps the score at 35 | Surf-Forecast.com rating rules | Applied |
| 7 | Surf: coast direction estimated from terrain (Elevation API); wind direction adjusts the score by −10 / +5 at most, with a note. The swell-direction shortcut was tested and rejected. | Surf-Forecast.com, Surfline, surf guides, surfer survey; tested on six coasts | Applied |
| 8 | Indoor: recommendation levels instead of a score; crowding and town size as text hints only | Te Papa attendance study | Applied |

Sections 3–5 reflect all changes, and the city examples have been recalculated.

## 7. Open decisions

None at the moment.

### Decided

- **Open-Meteo is the only data source.** Geocoding, Elevation, Forecast and Marine APIs.
- **Skiing in mountain towns: score the town, add a surroundings note** (section 3). The score uses the town's own forecast. When the terrain around rises 300 m or more above the town (one Elevation API call, 7×7 grid), a note explains the height difference, the estimated temperature drop, and where rain likely turns to snow. The note never changes the score.
- **Inland detection for surfing: the null check is enough** (section 3). It was tested on coastal and inland towns.
- **Surf wind direction: a small, labelled adjustment** (sections 3 and 6.3). The coast direction is estimated from terrain, not from the swell direction. Onshore wind costs up to 10 points and offshore wind adds up to 5, only when the wind is 15 km/h or more, and always with a note that the direction is estimated.
- **Tuning lives in a config file.** All weights, curve points, gates, recommendation thresholds and hint rules go in one config file, not in the scoring logic. Tuning a threshold then means editing config only. The worked examples in section 5 become unit tests, so any tuning change shows exactly which example outcomes move.

## Sources

**Open-Meteo**

- [Open-Meteo Forecast API docs](https://open-meteo.com/en/docs)
- [Open-Meteo Marine API docs](https://open-meteo.com/en/docs/marine-weather-api)
- [Open-Meteo Geocoding API docs](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo Elevation API docs](https://open-meteo.com/en/docs/elevation-api)

**Snow level vs. freezing level**

- [UBC ATSC 113: The freezing level and rain vs. snow](https://www.eoas.ubc.ca/courses/atsc113/snow/met_concepts/07-met_concepts/07a-rain-vs-snow/)
- [REI: Freezing level vs. snow level](https://www.rei.com/learn/expert-advice/freezing-level-vs-snow-level.html)
- [MyNorthwest: the difference between freezing level and snow level](https://mynorthwest.com/pacific-northwest-weather/mountain-forecasts-vital-difference-freezing-level-snow-level/3939285)

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
- [Which meteorological and climatological information is requested for better surfing experiences? A survey-based analysis, Atmosphere 2021](https://www.mdpi.com/2073-4433/12/3/293)
- [Surfer: How to read a surf forecast (wind vs. beach orientation)](https://www.surfer.com/how-to/how-to-read-a-surf-forecast)
- [Carve: How to read a surf forecast](https://www.carvemag.com/2026/09/how-to-read-a-surf-forecast/)
- [Windy.app: How to read a surf forecast](https://windy.app/blog/how-to-read-a-surf-forecast.html)
- [Espejo et al. (2014): Surfing wave climate variability, Global and Planetary Change (not reviewed; paywalled)](https://www.sciencedirect.com/science/article/abs/pii/S0921818114001192)
- [Surfline: Rating the Surf](https://www.surfline.com/surfline/forecasts4/forecast_blog_entry.cfm?id=13680&sef=true)
- [The Surf Tribe: How to read a surf forecast (swell period guidance)](https://www.thesurftribe.com/surf-blog/how-to-read-a-surf-forecast-and-why-the-star-rating-isnt-enough)
- [Surf forecasting (Wikipedia)](https://en.wikipedia.org/wiki/Surf_forecasting)

**Indoor sightseeing**

- [Rain and museum attendance: Are daily data fine enough? Journal of Cultural Economics](https://link.springer.com/article/10.1007/s10824-017-9298-9)
- [CultureCase: Rainy days at the museum (summary of the Te Papa study)](https://culturecase.org/research/2018/08/rainy-days-museum/)
- [Weather conditions and museum attendance: a case study from Sicily, Climatic Change (not reviewed; paywalled)](https://link.springer.com/article/10.1007/s10584-019-02453-2)
