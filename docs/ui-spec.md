# UI Specification

This document tells what the user sees on the screen and what the screen does. The app has 1 screen.

- **Architecture, data flow and GraphQL schema:** [architecture.md](architecture.md)
- **Scoring rules:** [scoring.md](scoring.md)
- **Known problems and ideas for later:** [future-improvements.md](future-improvements.md)

## 1. Screen

```
┌──────────────────────────────────────────────────────────────┐
│ [ Search for a town…                                 ]       │
├──────────────────────────────────────────────────────────────┤
│ Zermatt, Valais, Switzerland    Local time: Tue 08:00        │
│                                        [How the scores work] │
├──────────────────────────────────────────────────────────────┤
│ Skiing                                          95 Excellent │
│ ┌Today┐ ┌Wed┐ ┌Thu┐ ┌Fri┐ ┌Sat┐ ┌Sun┐ ┌Mon┐                   │
│ │ 95  │ │88 │ │72 │ │60 │ │55 │ │40 │ │38 │                   │
│ └─────┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                   │
│ Weekly summary (or the breakdown of the selected day)        │
├──────────────────────────────────────────────────────────────┤
│ Surfing                                       Not applicable │
├──────────────────────────────────────────────────────────────┤
│ Outdoor sightseeing                                  60 Good │
├──────────────────────────────────────────────────────────────┤
│ Indoor sightseeing                Recommended on 2 of 7 days │
└──────────────────────────────────────────────────────────────┘
```

- **Empty state:** Only the search field and 1 short sentence about the app.
- **Loading:** The header shows first. The rows show placeholder shapes until all 4 row queries settle. Then all rows show at the same time.

## 2. Search

- The search uses the Base UI `Combobox`.
- The frontend calls Geocoding `/search` directly when the text has 2 characters or more, after a delay of 300 ms. The request uses `count=10` and `language=en`.
- Each text change cancels the delay and the open request (`AbortController`). The app ignores the response of a cancelled request. Thus, an old response cannot replace a new response.
- When the text has less than 2 characters, the list has no suggestions and shows "Type 2 or more letters."
- Each suggestion shows the name, the region and the country.
- If there is no match, the list shows "No town found."
- If the search fails, the list shows "The search is not available. Try again."
- Geocoding does not send empty fields. A missing `population`, `elevation`, `admin1`, `country`, `timezone` or `feature_code` becomes `null`.
- When the user selects a suggestion, the app sets the URL, shows the header and sends the 4 row queries.

## 3. URL

- Format: `/?place=<id>&name=<slug>`. Example: `/?place=3094802&name=krakow`.
- The app uses only `place`. The `name` makes the URL easy to read.
- After a page reload, the app calls Geocoding `/get` with the `place` value. Then it shows the header and sends the 4 row queries.
- The slug has lowercase letters and hyphens, with no diacritics. The app removes the diacritics with `String.normalize('NFD')`.
- A new selection uses `history.pushState`. Thus, the "back" button of the browser goes to the town before.
- If `name` does not agree with the town, the app corrects it with `history.replaceState`.
- A URL with only `name` shows the search field with the name as text. The app does not select a match.

## 4. Activity rows (skiing, surfing, outdoor)

- **Header:** The activity name, the weekly score and the label.
- **Day cards:** 7 cards in 1 line. Each card shows the day name ("Today" for the first card), the score and the label.
  - The background is a gradient from red (0) through orange and yellow to green (100).
  - The number and the label are always on the card. Thus, users with color blindness can also read the score.
  - Days 4–7 have a lighter shade, for the lower confidence.
  - An ended day is dimmed and has the text "Ended", with a popover.
- **Default view:** The weekly summary shows under the cards.
- **Selected day:** A click on a day card shows the breakdown of that day under the cards. A second click on the same card shows the weekly summary again.
- **Breakdown:**
  ```
  Wed 4 Mar — Zakopane, Skiing 30 Fair (confidence: High)
  Snow base     0.6 m          ██████░░░░  18.0 / 30
  Fresh snow    0 cm           █████░░░░░  10.0 / 20
  Temperature   +1 °C          ██████████  15.0 / 15
  Wind          gusts 45 km/h  █████░░░░░  10.0 / 20
  Sky           3 km, no sun   ███░░░░░░░   4.5 / 15
  Total before gates: 58 (57.5)
  ⚠ Rain on snow (6 mm at +4 °C): maximum 30
  ```
  The values come from the Zakopane example in [scoring-examples.md](scoring-examples.md). The bars use the Base UI `Meter`.
- **Not applicable:** The row shows only the header and the reason (for example, "No sea near this town").
- **Failure:** The row shows "Data not available" and a "Try again" button. The button calls `refetch` for that row only.

## 5. Indoor row

- **Explanation at the top:** "Indoor sightseeing has no score. We recommend it when the outdoor weather is bad." A popover gives the full rules.
- **Header:** "Recommended on X of 7 days".
- **Day cards:** 3 fixed colors, not the gradient.
  - Recommended: dark blue.
  - Good alternative: medium blue.
  - Save for later: light gray-blue.

  Each card shows the level text and an icon, with no number.
- **Breakdown for 1 day:**
  ```
  Thu 3 Oct — Indoor: Recommended
  Outdoor score: 25 Fair
  Main cause: Heavy rain (8 mm, probability 90%) → maximum 25
  Hints:
    Busy: rain is probable, so museums can have more visitors.
  ```
  The breakdown has a link to the outdoor row for that day.
- **Town size:** The row always shows the town size hint. When the population is not known, it shows "Town size: no data", with a popover that tells why.

## 6. Explanations

- **Popovers:** Words that need a longer explanation have a popover (Base UI `Popover`). Examples: "Rain on snow", "Ended", "Onshore".
- **"How the scores work" panel:** A button in the header opens a side panel (Base UI `Drawer`). The panel has these sections:
  - Labels and colors
  - Weekly score
  - Confidence
  - Ended days
  - Local time
  - Indoor sightseeing
  - Data source and limits
- Each popover can have a "More" link. The link opens the panel at the correct section.
- **Text templates:** `text/templates.ts` has 1 template for each `ExplanationKey`. The template gets the `params` from the backend. Thus, the numbers in the text always come from the config. Example:
  > "Rain on snow makes the slopes wet and heavy. When the rain is more than {rainMm} mm and the temperature is more than {tempC} °C, the maximum score is {maxScore}."

## 7. Phone layout

- The rows use the full width.
- The day cards scroll horizontally, with scroll snap. Approximately 3.5 cards show, so the user sees that there are more cards.
- The phone layout starts below a width of 640 px.
- The breakdown shows under the cards, at the full width of the row.

## 8. Styles

- CSS modules for all components.
- All colors and sizes are CSS custom properties in `styles/tokens.css`. The CSS modules use only these tokens.
- Light mode only. With the tokens, we can add a dark mode later with no change to the components.
- The text on each day card must have a contrast of 4.5:1 or more (WCAG AA).
  - The text is black or white: the color with the higher contrast. With pure black and pure white, each background gives 4.58:1 or more.
  - The lighter cards (days 4–7) and the ended cards mix the card color with the page colors (`--card-low-confidence-strength`, `--card-ended-strength`). The text color is selected after the mix.
