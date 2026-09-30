# Score Examples

This document gives worked examples for [scoring.md](scoring.md). All the numbers are **examples only**. They are not real forecasts. The curves and weights are in scoring.md. Each contribution is `sub-score × weight × 100`.

| City | Day | Skiing | Surfing | Outdoor | Indoor |
|---|---|---|---|---|---|
| [Zermatt](#zermatt-switzerland-january) | Sunny and cold, after snowfall | 95 | N/A | 60 | Save for later |
| [Ericeira](#ericeira-portugal-october) | Good surf | N/A | 99 | 100 | Save for later |
| [Newquay](#newquay-uk-october) | Wind and showers | N/A | 35 | 59 | Good alternative |
| [Kraków](#kraków-poland-october) | Rain in autumn | N/A | N/A | 25 | Recommended |
| [Zakopane](#zakopane-poland-march) | Warm rain on thin snow | 30 | N/A | 17 | Recommended |

Other sections: [1 full week of surfing in Ericeira](#1-full-week-surfing-in-ericeira) and [Lessons](#lessons).

## Zermatt, Switzerland (January)

A sunny and cold day after fresh snow.

**Data from the API**

| Data | Value |
|---|---|
| Snow depth | 1.2 m |
| Snowfall, 72 h before 09:00 | 18 cm (no snow during the day) |
| Temperature, daytime mean | −6 °C |
| "Feels like", daytime mean | −9 °C |
| Maximum wind / maximum gusts | 20 km/h / 35 km/h |
| Visibility | 20 km |
| Sunshine / daylight | 6.3 h of 9.0 h (ratio 0.7) |
| Precipitation | probability 10%, 0 mm |
| Maximum UV index | 3 |
| Marine data | none (not near the coast) |

**Skiing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Snow base | 1.2 m | 1.00 | 30% | 30.0 |
| Fresh snow | 18 cm | 1.00 | 20% | 20.0 |
| Temperature | "feels like" −9 °C | 0.87 | 15% | 13.0 |
| Wind | gusts 35 km/h | 0.83 | 20% | 16.7 |
| Sky | visibility 20 km, sunshine ratio 0.7 | 1.00 | 15% | 15.0 |
| **Score** | | | | **95** |

**Mountain town note:** The terrain around Zermatt is approximately 2,060 m above the town. The note is: *"The terrain around the town goes up to approximately 3,670 m. This is 2,060 m above the town. The temperature there is approximately 13 °C lower (approximately −19 °C). The snow depth is for the area of the town. Higher areas usually have more snow."* The note does not give a snow altitude, because the forecast has no precipitation.

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 10%, 0 mm | 1.00 | 30% | 30.0 |
| Thermal comfort | "feels like" −9 °C | 0.00 | 40% | 0.0 |
| Sunshine | ratio 0.7 | 1.00 | 20% | 20.0 |
| Wind | 20 km/h | 1.00 | 10% | 10.0 |
| **Score** | | | | **60** |

**Indoor sightseeing:** The outdoor score is 60. Thus, the level is **Save for later**. There is no travel hint, because no snow falls today. There is no busy hint, because it is dry. There is no town size hint, because the app does not recommend indoor activities today.

**Result**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | 95 | Excellent | Fresh snow on a deep base, sunny |
| Surfing | – | Not applicable | Not near the coast |
| Outdoor sightseeing | 60 | Good | Dry, sunny, no wind, but very cold |
| Indoor sightseeing | – | Save for later | Dry and sunny, better for outdoor activities |

## Ericeira, Portugal (October)

A day with good surf.

**Data from the API**

| Data | Value |
|---|---|
| Swell height / period | 1.6 m / 13 s |
| Wind wave height | 0.3 m |
| Sea surface temperature | 17 °C |
| Wind, daytime mean / maximum | 8 km/h / 15 km/h |
| Wind direction, daytime mean | from 320° (northwest) |
| Coast direction (estimate from the Elevation API) | 270° (west) |
| "Feels like", daytime mean | 19 °C |
| Sunshine / daylight | 7.3 h of 11.3 h (ratio 0.65) |
| Precipitation | probability 15%, 0 mm |
| Maximum UV index | 5 |
| Snow depth (all the week) | 0 m |

**Surfing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Swell height | 1.6 m | 1.00 | 35% | 35.0 |
| Swell period | 13 s | 1.00 | 25% | 25.0 |
| Wind | 8 km/h | 1.00 | 25% | 25.0 |
| Wave quality | 0.3 / 1.6 = 0.19 | 1.00 | 5% | 5.0 |
| Comfort | water 17 °C | 0.94 | 10% | 9.4 |
| **Score** | | | | **99** |

**Wind direction:** The angle between the wind (320°) and the coast (270°) is 50°. Thus, the wind is cross-shore. The wind is less than 15 km/h, so there is no adjustment. The note is: *"The wind is light. The wind direction has almost no effect."*

**Outdoor sightseeing:** All factors are in their ideal range (dry, "feels like" 19 °C, sunny, light wind). Thus, the score is **100**.

**Indoor sightseeing:** The outdoor score is 100. Thus, the level is **Save for later**. There are no hints. The town size hint shows only when the app recommends indoor activities.

**Result**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow for all the week |
| Surfing | 99 | Excellent | Clean 1.6 m swell at 13 s, light wind |
| Outdoor sightseeing | 100 | Excellent | Dry, sunny, 19 °C |
| Indoor sightseeing | – | Save for later | Today is better for outdoor activities |

## Newquay, UK (October)

A day with strong wind and showers.

**Data from the API**

| Data | Value |
|---|---|
| Swell height / period | 1.2 m / 7 s |
| Wind wave height | 0.9 m |
| Sea surface temperature | 14 °C |
| Wind, daytime mean / maximum | 32 km/h / 38 km/h |
| Wind direction, daytime mean | from 300° (west-northwest) |
| Coast direction (estimate from the Elevation API) | 320° (northwest) |
| "Feels like", daytime mean | 11 °C |
| Sunshine / daylight | 3.2 h of 10.8 h (ratio 0.3) |
| Precipitation | probability 60%, 2 mm |
| Maximum UV index | 2 |
| Snow depth (all the week) | 0 m |

**Surfing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Swell height | 1.2 m | 1.00 | 35% | 35.0 |
| Swell period | 7 s | 0.29 | 25% | 7.1 |
| Wind | 32 km/h | 0.13 | 25% | 3.3 |
| Wave quality | 0.9 / 1.2 = 0.75 | 0.36 | 5% | 1.8 |
| Comfort | water 14 °C | 0.75 | 10% | 7.5 |
| **Weighted sum** | | | | **55** |
| **Wind direction** | The angle between 300° and 320° is 20°. The wind is onshore at 32 km/h: −10. | | | **45** |
| **Gate** | The mean wind (32 km/h) is more than 30 km/h. The maximum score is 35. | | | **35** |

The note is: *"The wind is onshore. The waves can be rough. The coast direction is an estimate. Each beach can have a different direction."*

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 60% (0.33), 2 mm (0.67) | 0.50 | 30% | 15.0 |
| Thermal comfort | "feels like" 11 °C | 0.69 | 40% | 27.5 |
| Sunshine | ratio 0.3 | 0.70 | 20% | 14.0 |
| Wind | 38 km/h | 0.28 | 10% | 2.8 |
| **Score** | | | | **59** |

**Indoor sightseeing:** The outdoor score is 59. Thus, the level is **Good alternative**. The busy hint shows, because the rain probability is 60% and the rain is 2 mm. The town has approximately 20,000 people. Thus, the town size hint is: *"This town has a small number of indoor attractions. Make sure that they are open before you make a plan for a full day."*

**Result**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow for all the week |
| Surfing | 35 | Fair | Strong wind (32 km/h), short swell period (7 s) |
| Outdoor sightseeing | 59 | Moderate | Showers and strong wind |
| Indoor sightseeing | – | Good alternative | Mixed weather, small number of indoor attractions |

Without the wind gate, the surf score is 55 (Moderate). This score is too high for a day with strong wind. Refer to [Lessons](#lessons).

## Kraków, Poland (October)

A day with rain in autumn.

**Data from the API**

| Data | Value |
|---|---|
| "Feels like", daytime mean | 9 °C |
| Maximum wind | 35 km/h |
| Sunshine / daylight | 0.5 h of 11.0 h (ratio 0.05) |
| Precipitation | probability 90%, 8 mm in daytime |
| Maximum UV index | 2 |
| Snow depth (all the week) | 0 m |
| Marine data | none (not near the coast) |

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 90%, 8 mm | 0.00 | 30% | 0.0 |
| Thermal comfort | "feels like" 9 °C | 0.56 | 40% | 22.5 |
| Sunshine | ratio 0.05 | 0.45 | 20% | 9.0 |
| Wind | 35 km/h | 0.40 | 10% | 4.0 |
| **Weighted sum** | | | | **36** |
| **Gate** | The rain is 8 mm and the probability is 90%. The maximum score is 25. | | | **25** |

**Indoor sightseeing:** The outdoor score is 25. Thus, the level is **Recommended**. The busy hint shows, because the rain probability is 90% and the rain is 8 mm. The city has approximately 800,000 people. Thus, the town size hint is: *"This city usually has a good number of indoor attractions."*

**Result**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | – | Not applicable | No snow for all the week |
| Surfing | – | Not applicable | Not near the coast |
| Outdoor sightseeing | 25 | Fair | Rain all day (8 mm) |
| Indoor sightseeing | – | Recommended | Rain, popular places can have more people |

## Zakopane, Poland (March)

A day with warm rain on thin snow.

**Data from the API**

| Data | Value |
|---|---|
| Snow depth | 0.6 m |
| Snowfall, 72 h before 09:00 | 0 cm |
| Temperature, daytime mean | +4 °C |
| "Feels like", daytime mean | +1 °C |
| Maximum wind / maximum gusts | 30 km/h / 45 km/h |
| Visibility | 3 km |
| Sunshine / daylight | 0 h of 11.5 h |
| Precipitation | probability 85%, 6 mm of rain |
| Freezing level | 1,400 m |
| Maximum UV index | 2 |
| Marine data | none (not near the coast) |

**Skiing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Snow base | 0.6 m | 0.60 | 30% | 18.0 |
| Fresh snow | 0 cm | 0.50 | 20% | 10.0 |
| Temperature | "feels like" +1 °C | 1.00 | 15% | 15.0 |
| Wind | gusts 45 km/h | 0.50 | 20% | 10.0 |
| Sky | visibility 3 km (0.5), no sun (0) | 0.30 | 15% | 4.5 |
| **Weighted sum** | | | | **58** |
| **Gate** | Rain on snow: 6 mm at more than 0 °C. The maximum score is 30. | | | **30** |

The "feels like" temperature (+1 °C) is in the ideal range. Thus, the temperature factor is perfect. The rain on snow gate gives the correct score for this day.

**Mountain town note:** The terrain around Zakopane is approximately 870 m above the town. The note is: *"The terrain around the town goes up to approximately 1,680 m. This is 870 m above the town. The temperature there is approximately 6 °C lower (approximately −2 °C). Above approximately 1,100 m, the precipitation can be snow. The snow depth is for the area of the town. Higher areas usually have more snow."*

On this type of day, the note is very important. The score (30) is correct for the town. The note tells the user that the conditions on the high slopes can be very different.

**Outdoor sightseeing**

| Factor | Value | Sub-score | Weight | Contribution |
|---|---|---|---|---|
| Precipitation | 85%, 6 mm | 0.00 | 30% | 0.0 |
| Thermal comfort | "feels like" +1 °C | 0.06 | 40% | 2.5 |
| Sunshine | ratio 0 | 0.40 | 20% | 8.0 |
| Wind | 30 km/h | 0.60 | 10% | 6.0 |
| **Score** | | | | **17** |

The rain gate (maximum 25) has no effect here, because the weighted sum is already lower.

**Indoor sightseeing:** The outdoor score is 17. Thus, the level is **Recommended**. The busy hint shows, because the rain probability is 85% and the rain is 6 mm. There is no travel hint, because there is no freezing rain and the gusts are less than 75 km/h. The town has approximately 27,000 people. Thus, the town size hint is: *"This town has a small number of indoor attractions. Make sure that they are open before you make a plan for a full day."*

Zakopane is a tourist town. It usually has more attractions than its size shows. This example shows the limit of the town size hint.

**Result**

| Activity | Score | Label | Main reason |
|---|---|---|---|
| Skiing | 30 | Fair | Rain on snow at +4 °C (snow can fall higher up, refer to the note) |
| Surfing | – | Not applicable | Not near the coast |
| Outdoor sightseeing | 17 | Poor | Cold rain all day |
| Indoor sightseeing | – | Recommended | Cold rain all day, small number of indoor attractions |

## 1 full week: surfing in Ericeira

Monday is the day with good surf from the Ericeira example.

| Day | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| Score | 99 | 88 | 57 | 35 | 40 | 72 | 81 |
| Confidence | High | High | High | Medium | Medium | Low | Low |

- Best day: 99 (Monday).
- Mean of the best 3 days: (99 + 88 + 81) / 3 = 89.3.
- **Weekly score = 0.5 × 99 + 0.5 × 89.3 = 94 (Excellent).**
- A usual mean gives 67 (Good). This value does not show the 3 very good days.

**Result for the user:** *"This is an excellent week for surfing. Monday and Tuesday are the best days. Sunday is also good, but the forecast for Sunday is less accurate."*

## Lessons

The calculations showed 2 errors. In these 2 cases, the weighted sum alone gave a score that was too high. New gates correct these errors:

1. **Surfing in Newquay:** The weighted sum is 55, because the swell height has a large weight. The new gate sets a maximum score of 35 when the mean wind is more than 30 km/h. The score is now 35 (Fair). Surfers give a similar rating to this type of day.
2. **Outdoor sightseeing in Kraków:** The first version of the method gave 37, because daylight and UV added points during rain. We removed these 2 factors. The new gate sets a maximum score of 25 when the rain is more than 5 mm and the probability is more than 70%. The score is now 25 (Fair).

For this reason, 1 configuration file contains all weights, curves and gates. These examples are the unit tests.
