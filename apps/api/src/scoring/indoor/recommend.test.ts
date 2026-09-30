import { describe, expect, it } from 'vitest';
import { scoreOutdoor } from '../outdoor/score.js';
import {
  atHour,
  buildForecast,
  NOW,
  onDay,
  type ForecastOptions,
  type HourSlot,
  type HourValues,
} from '../testing/fixtures.js';
import type { Place } from '../weather.js';
import { levelFor, recommendIndoor, townSize } from './recommend.js';

const place: Place = { population: 50_000, featureCode: 'PPL' };

function indoor({
  options = {},
  now = NOW,
}: { options?: ForecastOptions; now?: Date } = {}) {
  const forecast = buildForecast(options);
  const outdoor = scoreOutdoor({ forecast, now });
  return recommendIndoor({ forecast, outdoor, place });
}

const today = (options: ForecastOptions = {}) => indoor({ options }).days[0]!;
const atNoon = (values: Partial<HourValues>) =>
  atHour({ day: 0, hour: 12, values });
const travel = (options: ForecastOptions) =>
  today(options).hints.find((h) => h.key === 'TRAVEL_HINT')?.params?.conditions;

/** Rain all day: 8 mm, probability 90%. The outdoor score is 25. */
const rainyDay = ({ day, hour }: HourSlot) =>
  day === 0
    ? {
        precipitationProbability: 90,
        precipitation: hour >= 10 && hour <= 17 ? 1 : 0,
      }
    : {};

describe('levelFor', () => {
  it.each([
    [0, 'RECOMMENDED'],
    [39, 'RECOMMENDED'],
    [40, 'GOOD_ALTERNATIVE'],
    [59, 'GOOD_ALTERNATIVE'],
    [60, 'SAVE_FOR_LATER'],
    [100, 'SAVE_FOR_LATER'],
  ])('outdoor score %i gives %s', (outdoorScore, level) => {
    expect(levelFor({ outdoorScore })).toBe(level);
  });
});

describe('recommendIndoor', () => {
  it('recommends indoor sightseeing on a day with heavy rain', () => {
    const day = today({ hour: rainyDay });
    expect(day.outdoorScore).toBe(25);
    expect(day.level).toBe('RECOMMENDED');
    expect(day.mainCause?.key).toBe('HEAVY_RAIN_GATE');
  });

  it('gives the worst outdoor factor as the main cause when no gate has an effect', () => {
    const day = today({
      hour: onDay({ day: 0, values: { apparentTemperature: 0 } }),
      day: () => ({ sunshineDuration: 0 }),
    });
    expect(day.level).toBe('GOOD_ALTERNATIVE');
    expect(day.mainCause?.key).toBe('THERMAL_COMFORT');
  });

  it('gives no main cause on a day that is better for outdoor activities', () => {
    expect(today()).toMatchObject({
      level: 'SAVE_FOR_LATER',
      mainCause: null,
      hints: [],
    });
  });

  describe('busy hint', () => {
    const hasBusy = ({
      probability,
      mm,
    }: {
      probability: number;
      mm: number;
    }) =>
      today({
        hour: ({ day, hour }) =>
          day === 0
            ? {
                precipitationProbability: probability,
                precipitation: hour === 12 ? mm : 0,
              }
            : {},
      }).hints.some((h) => h.key === 'BUSY_HINT');

    it('shows at a probability of 60% or more and 1 mm or more', () => {
      expect(hasBusy({ probability: 60, mm: 1 })).toBe(true);
      expect(hasBusy({ probability: 59, mm: 1 })).toBe(false);
      expect(hasBusy({ probability: 60, mm: 0.9 })).toBe(false);
    });
  });

  describe('travel hint', () => {
    it('shows for a thunderstorm', () => {
      expect(travel({ hour: atNoon({ weatherCode: 95 }) })).toEqual([
        'THUNDERSTORM',
      ]);
    });

    it('shows for freezing rain', () => {
      expect(travel({ hour: atNoon({ weatherCode: 66 }) })).toEqual([
        'FREEZING_RAIN',
      ]);
    });

    it('shows for more than 10 cm of snowfall', () => {
      expect(travel({ hour: atNoon({ snowfall: 10 }) })).toBeUndefined();
      expect(travel({ hour: atNoon({ snowfall: 10.1 }) })).toEqual([
        'SNOWFALL',
      ]);
    });

    it('shows for gusts of more than 75 km/h', () => {
      expect(travel({ hour: atNoon({ windGusts: 75 }) })).toBeUndefined();
      expect(travel({ hour: atNoon({ windGusts: 75.1 }) })).toEqual(['GUSTS']);
    });

    it('shows for an extreme "feels like" temperature', () => {
      expect(travel({ hour: atNoon({ apparentTemperature: 38.1 }) })).toEqual([
        'EXTREME_TEMPERATURE',
      ]);
      expect(travel({ hour: atNoon({ apparentTemperature: -15.1 }) })).toEqual([
        'EXTREME_TEMPERATURE',
      ]);
    });
  });

  describe('week', () => {
    const rainAllWeek = ({ hour }: HourSlot) => rainyDay({ day: 0, hour });

    it('counts the recommended days, without an ended day', () => {
      expect(indoor({ options: { hour: rainAllWeek } }).recommendedDays).toBe(
        7,
      );
      expect(
        indoor({
          options: { hour: rainAllWeek },
          now: new Date('2026-01-12T17:00:00Z'),
        }).recommendedDays,
      ).toBe(6);
    });

    it('lists the recommended and busy days in the summary', () => {
      const summary = indoor({ options: { hour: rainyDay } }).summary;
      expect(summary).toContainEqual({
        key: 'INDOOR_RECOMMENDED_DAYS',
        days: ['2026-01-12'],
      });
      expect(summary).toContainEqual({
        key: 'INDOOR_BUSY_DAYS',
        days: ['2026-01-12'],
      });
    });

    it('tells the user when the outdoor weather is good all week', () => {
      expect(indoor().summary).toEqual([{ key: 'GOOD_OUTDOOR_WEEK' }]);
    });
  });
});

describe('townSize', () => {
  it.each([
    [{ population: 5_000, featureCode: 'PPLC' }, 'TOWN_SIZE_LARGE'],
    [{ population: 1_000_000, featureCode: 'PPL' }, 'TOWN_SIZE_LARGE'],
    [{ population: 999_999, featureCode: 'PPL' }, 'TOWN_SIZE_CITY'],
    [{ population: 100_000, featureCode: 'PPL' }, 'TOWN_SIZE_CITY'],
    [{ population: 99_999, featureCode: 'PPL' }, 'TOWN_SIZE_TOWN'],
    [{ population: 10_000, featureCode: 'PPL' }, 'TOWN_SIZE_TOWN'],
    [{ population: 9_999, featureCode: 'PPL' }, 'TOWN_SIZE_SMALL'],
    [{ population: null, featureCode: 'PPL' }, 'TOWN_SIZE_NO_DATA'],
    [{ population: null, featureCode: null }, 'TOWN_SIZE_NO_DATA'],
  ])('%o gives %s', (p, key) => {
    expect(townSize({ place: p }).key).toBe(key);
  });
});
