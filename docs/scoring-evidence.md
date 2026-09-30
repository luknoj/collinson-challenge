# Score Evidence and Tests

This document gives the background for [scoring.md](scoring.md). It tells why we selected each factor and limit. It also gives the results of our tests with the Open-Meteo API on 30 September 2026.

**Evidence levels:**

- **Research:** An index or a survey in a scientific journal.
- **Industry:** A published method from forecasters or operators.
- **Anecdotal:** Examples from operators and forums.
- **Assumption:** We found no source. This is our decision.

## Outdoor sightseeing

Tourism research has 2 standard weather indices for city tourism. Our weights are the same as the weights of the newer index:

| Index | Thermal comfort | Precipitation | Sky | Wind |
|---|---|---|---|---|
| Tourism Climate Index (Mieczkowski 1985) | 60% | 20% | 20% | 10% |
| Holiday Climate Index: Urban (Scott et al. 2016) | 40% | 30% | 20% | 10% |
| **Our method** | **40%** | **30%** | **20%** | **10%** |

- **All indices use the same 4 factors** (Research). No index uses daylight or UV. Thus, our score does not use them.
- **Bad rain or wind is more important than a good temperature** (Research). In the Holiday Climate Index, a high score is not possible when the rain or wind is bad. For this reason, we set maximum scores for heavy rain and strong wind.
- **The daytime conditions are the most important** (Research). For this reason, we use only daytime hours.
- **Our label limits (40, 60 and 80) are the same as the limits of the Tourism Climate Index** (Research). These limits are "acceptable", "good" and "excellent".
- **The ideal "feels like" range (16–24 °C) is an Assumption.** We could not get access to the rating table of the Holiday Climate Index.

## Skiing

| Factor | Evidence | Level | Our method |
|---|---|---|---|
| Snow depth | 30 cm is the standard minimum for natural snow on ski slopes. This is the "100-day rule" of the OECD. | Research | Less than 0.3 m: no skiing |
| Snow as the main factor | The Ski Climate Index uses snow as the most important factor. | Research | 50% of the weight is for snow |
| Rain and wind chill | Skiers say that (freezing) rain and wind chill are the 2 most important weather factors (Rutty & Andrey 2014). | Research | Gates for freezing rain and rain on snow. "Feels like" temperature. |
| Temperature | The best ski day has −5 to +5 °C (Berghammer & Schmude 2014). The Ski Climate Index uses −7 to +2 °C (wet-bulb). | Research | Ideal range −7 to +2 °C ("feels like") |
| Sunshine | The best ski day has 5–6 h of sun or more. | Research | Sunshine ratio 0.6 or more |
| Wind | The Ski Climate Index limit is 40 km/h. Lifts become slower or stop at approximately 50–65 km/h. Gondolas stop at approximately 60–80 km/h. | Research + Anecdotal | Gusts: 30 → 60 km/h |
| Fresh snow | Skiers like fresh snow. We found no numbers. | Assumption | Ideal range 5–25 cm |

### Mountain towns (API tests)

- **The `elevation` parameter changes the temperature, but not the snow depth.** For Zermatt, `elevation=3000` changed the temperature from 18.6 °C to 7.4 °C (approximately 0.8 °C for each 100 m). The snow depth stayed at 0 m. The model gives 1 snow depth value for each grid square.
- **The highest point near the town gives incorrect data.** Near Zermatt, the highest point is a glacier at 4,437 m. It had 1.97 m of snow in September. For this reason, we use the 90th percentile of the terrain.
- **The Elevation API accepts a maximum of 100 coordinates in 1 request.** It uses the Copernicus GLO-90 model (90 m resolution). The 7×7 grid worked in 1 request.
- **Terrain results:**
  - Zermatt: +2,059 m (mountain town)
  - Innsbruck: +1,499 m (mountain town)
  - Zakopane: +870 m (mountain town)
  - Warsaw: +11 m (flat)
- **Temperature and height:** The standard atmosphere decreases by 0.65 °C for each 100 m. In winter, cold air can stay in valleys. Then the slopes can be warmer than the town.
- **Snow altitude:** Snow usually falls to approximately 300 m below the freezing level. In heavy precipitation, snow falls lower. This is a general rule from weather forecasters.
- **The `past_days` parameter works.** With `past_days=2`, the API gave 9 days of data (28 September to 6 October). Without this parameter, the fresh snow factor on day 1 does not see the snow of the 2 days before. In the Zermatt example, the score then decreases from 95 to 85.
- **The snow depth can increase without snowfall.** At Zermatt, the snow depth changed from 0 m to 0.45 m on 5–6 October with 0 cm of snowfall. Possibly, the API changed to a less detailed model for the later days. This is our interpretation. The documentation does not give this information. For this reason, we use a check: the snow depth at 09:00 cannot increase more than the snowfall since 09:00 on the day before.

## Surfing

There is no scientific index for surfing. Thus, we use the methods of surf forecasters:

- **Surf-Forecast.com:** The rating uses the swell size and the swell period. When the wind is onshore, the rating "drops in proportion to the wind speed". "Very strong winds in any direction" give a rating of 0.
- **Surfline:** The same waves (3–4 ft) get "fair-good" with offshore wind, and "poor" with onshore wind.

| Factor | Evidence | Level | Our method |
|---|---|---|---|
| Swell height and period | All forecasters use these 2 factors as the base of the rating. | Industry | 60% of the weight |
| Swell period | Less than approximately 9–10 s: local wind swell, rough waves. 11 s or more: clean waves. | Industry | Curve from 5 s to 12 s |
| Wind speed | Strong wind from all directions makes the surf bad. | Industry | Maximum score 35 when the wind is more than 30 km/h |
| Wind direction | Offshore or onshore wind can change the rating by approximately 2 levels. 85.7% of surfers look at the wind direction. | Industry + Research | Small adjustment (refer to the next section) |
| Ideal wave height | The ideal height changes with the skill of the surfer. We found no source for all surfers. | Assumption | 0.8–2.5 m |
| Water temperature | Forecasters do not use it in their ratings. | Assumption | 10%, never a gate |

### Wind direction (API tests)

The correct method compares the wind with the **fixed direction of the beach**. For example, a beach that faces west has clean waves with an east wind. When the wind is less than approximately 15 km/h, the direction has almost no effect.

**The swell direction does not give a good estimate of the coast direction.** We compared the swell direction with the real coast direction of 6 surf towns:

| Town | Coast direction (terrain estimate) | Real direction | Mean swell direction (7 days) | Difference |
|---|---|---|---|---|
| Ericeira | 270° | West | 319° | 49° |
| Newquay | 320° | Northwest | 273° | 47° |
| Biarritz | 309° | West-northwest | 309° | 0° |
| Malibu | 164° | South | 187° | 23° |
| Tarifa | 202° | South-southwest | 288° | 86° |
| Bondi | 92° | East | 75° | 17° |

- **For 3 of the 6 towns, the difference was approximately 45° or more.** This difference can put the wind in the incorrect type. Thus, we do not use the swell direction.
- **The terrain method gave the correct direction for all 6 towns.** The Elevation API gives exactly 0 m for points in the sea. Thus, the sea points in a ring around the town show the coast direction.
- **The effect on the score is small, for these reasons:**
  - The method gives the direction of the coast near the town. It does not give the direction of a specific beach.
  - Low land at 0 m (for example, tidal flats) can look like sea.
  - We tested the method on only 6 towns.
- **Level:** Assumption, with tests.

### Coast check (API test)

- For points near the coast, the API uses the nearest sea grid square and gives wave data. This occurred for Ericeira, Newquay and Sintra (approximately 10 km from the coast).
- For points far from the coast, the API gives only null values. This occurred for Madrid, Kraków, Bordeaux (approximately 50 km from the coast) and Florence.
- Thus, the rule "all values are null → Not applicable" is sufficient.

## Indoor sightseeing

A study of the Te Papa museum (New Zealand) used the data of 13 years. It found these results:

- **Rain increases museum visits by a small quantity:** approximately +2.8% on days with rain.
- **Rain in the morning has the largest effect.** Rain in the afternoon can decrease the number of visitors at the end of the day by a maximum of 9%.
- **Visitors look at the real weather, not at the forecast.**

For these reasons, indoor sightseeing is a recommendation from the outdoor score, not a score. Crowds are only a hint.

We think that weekends and holidays have a larger effect on crowds than the weather (Assumption). Open-Meteo does not give holiday data.

The town size levels (population ranges) are an Assumption. Open-Meteo does not give data about museums or other indoor attractions.

## Sources

**Open-Meteo**

- [Forecast API](https://open-meteo.com/en/docs)
- [Marine API](https://open-meteo.com/en/docs/marine-weather-api)
- [Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Elevation API](https://open-meteo.com/en/docs/elevation-api)

**Outdoor sightseeing**

- [Mieczkowski (1985): The Tourism Climatic Index](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1541-0064.1985.tb00365.x)
- [Scott et al. (2016): HCI vs. TCI in Europe](https://www.mdpi.com/2073-4433/7/6/80)
- [HCI:Beach vs. TCI in China (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7406217/)
- [ECMWF / Copernicus: Climate Suitability for Tourism indicators](https://confluence.ecmwf.int/plugins/viewsource/viewpagesrc.action?pageId=327675249)

**Skiing**

- [The Ski Climate Index (PMC), with Rutty & Andrey 2014 and Berghammer & Schmude 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC8116266/)
- [OECD (2007): Adapting Winter Tourism (100-day rule)](https://www.oecd.org/content/dam/oecd/en/publications/reports/2007/01/climate-change-in-the-european-alps_g1gh7c4d/9789264031692-en.pdf)
- [Snow indicators in ski tourism, Int. J. Biometeorology](https://link.springer.com/article/10.1007/s00484-020-01867-3)
- [Codidact: wind speed and lift stops (anecdotal)](https://outdoors.codidact.com/posts/53653)
- [UKC Forums: wind speed and lift stops (anecdotal)](https://www.ukclimbing.com/forums/skiing/what_wind-speed_normally_forces__ski-lifts_to_close-492929)
- [UBC: The freezing level and rain vs. snow](https://www.eoas.ubc.ca/courses/atsc113/snow/met_concepts/07-met_concepts/07a-rain-vs-snow/)
- [REI: Freezing level vs. snow level](https://www.rei.com/learn/expert-advice/freezing-level-vs-snow-level.html)
- [MyNorthwest: Freezing level vs. snow level](https://mynorthwest.com/pacific-northwest-weather/mountain-forecasts-vital-difference-freezing-level-snow-level/3939285)

**Surfing**

- [Surf-Forecast.com FAQ: star rating](https://www.surf-forecast.com/pages/faq)
- [Surfline: Rating the Surf](https://www.surfline.com/surfline/forecasts4/forecast_blog_entry.cfm?id=13680&sef=true)
- [Survey of surfers, Atmosphere 2021](https://www.mdpi.com/2073-4433/12/3/293)
- [Surfer: How to read a surf forecast](https://www.surfer.com/how-to/how-to-read-a-surf-forecast)
- [Carve: How to read a surf forecast](https://www.carvemag.com/2026/09/how-to-read-a-surf-forecast/)
- [Windy.app: How to read a surf forecast](https://windy.app/blog/how-to-read-a-surf-forecast.html)
- [The Surf Tribe: swell period](https://www.thesurftribe.com/surf-blog/how-to-read-a-surf-forecast-and-why-the-star-rating-isnt-enough)
- [Surf forecasting (Wikipedia)](https://en.wikipedia.org/wiki/Surf_forecasting)
- [Espejo et al. (2014): Surfing wave climate variability (paywall, not read)](https://www.sciencedirect.com/science/article/abs/pii/S0921818114001192)

**Indoor sightseeing**

- [Rain and museum attendance, Journal of Cultural Economics](https://link.springer.com/article/10.1007/s10824-017-9298-9)
- [CultureCase: Rainy days at the museum](https://culturecase.org/research/2018/08/rainy-days-museum/)
- [Weather and museum attendance in Sicily, Climatic Change (paywall, not read)](https://link.springer.com/article/10.1007/s10584-019-02453-2)
