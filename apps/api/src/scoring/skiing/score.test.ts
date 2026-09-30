import { describe, expect, it } from 'vitest';
import {
  buildForecast,
  context,
  terrain,
  type DayValues,
  type HourValues,
} from '../testing/fixtures.js';
import type { Terrain } from '../weather.js';
import { checkedSnowDepths, scoreSkiing } from './score.js';

/**
 * Good ski weather: 1.0 m of snow, "feels like" −5 °C, gusts 20 km/h,
 * visibility 20 km, sunshine ratio 0.83, no fresh snow (sub-score 0.5).
 * The score is 90.
 */
const SKI_HOUR: Partial<HourValues> = {
  snowDepth: 1,
  apparentTemperature: -5,
  temperature: -3,
};

interface SkiOptions {
  hour?: (day: number, hour: number) => Partial<HourValues>;
  day?: (day: number) => Partial<DayValues>;
  terrain?: Terrain | null;
  now?: Date;
}

function ski(options: SkiOptions = {}) {
  const forecast = buildForecast({
    hour: (d, h) => ({ ...SKI_HOUR, ...options.hour?.(d, h) }),
    day: (d) => ({ windGustsMax: 20, ...options.day?.(d) }),
  });
  return scoreSkiing(
    context(forecast, options.now),
    options.terrain === undefined ? terrain() : options.terrain,
  );
}

const today = (options: SkiOptions = {}) => ski(options).days[0]!;
const factor = (options: SkiOptions, key: string) =>
  today(options).factors.find((f) => f.key === key);
const at =
  (day: number, hour: number, values: Partial<HourValues>) =>
  (d: number, h: number) => (d === day && h === hour ? values : {});

describe('scoreSkiing', () => {
  it('gives 90 for good ski weather with no fresh snow', () => {
    const result = ski();
    expect(result.status).toBe('OK');
    expect(result.days).toHaveLength(7);
    expect(result.days[0]?.score).toBe(90);
  });

  describe('snow base', () => {
    it('is not applicable when the snow depth is less than 0.3 m all the week', () => {
      const result = ski({ hour: () => ({ snowDepth: 0.29 }) });
      expect(result.status).toBe('NOT_APPLICABLE');
      expect(result.notApplicableReason?.key).toBe('NO_SNOW');
    });

    it('is applicable at exactly 0.3 m', () => {
      expect(ski({ hour: () => ({ snowDepth: 0.3 }) }).status).toBe('OK');
    });

    it('gives 0 to a day with less than 0.3 m', () => {
      const last = ski({ hour: (d) => (d === 6 ? { snowDepth: 0.29 } : {}) })
        .days[6]!;
      expect(last.score).toBe(0);
      expect(last.gates[0]?.key).toBe('NO_SNOW_BASE_GATE');
    });

    it('uses the snow depth at 09:00 on the curve', () => {
      expect(
        factor({ hour: () => ({ snowDepth: 0.65 }) }, 'SNOW_BASE')?.subScore,
      ).toBeCloseTo(0.65);
    });
  });

  describe('fresh snow (72 h before 09:00)', () => {
    const fresh = (hour: SkiOptions['hour'], day = 0) =>
      ski({ hour }).days[day]!.factors.find((f) => f.key === 'FRESH_SNOW')
        ?.value;

    it('includes the snowfall stamped 09:00 on the same day', () => {
      expect(fresh(at(0, 9, { snowfall: 5 }))).toBe(5);
    });

    it('counts the snowfall after 09:00 for the next day', () => {
      expect(fresh(at(0, 10, { snowfall: 5 }))).toBe(0);
      expect(fresh(at(0, 10, { snowfall: 5 }), 1)).toBe(5);
    });

    it('starts after 09:00, 3 days before', () => {
      expect(fresh(at(-3, 10, { snowfall: 5 }))).toBe(5);
      expect(fresh(at(-3, 9, { snowfall: 5 }))).toBe(0);
    });

    it('uses the fresh snow curve', () => {
      expect(
        factor({ hour: at(-1, 12, { snowfall: 5 }) }, 'FRESH_SNOW')?.subScore,
      ).toBe(1);
      expect(
        factor({ hour: at(-1, 12, { snowfall: 40 }) }, 'FRESH_SNOW')?.subScore,
      ).toBeCloseTo(0.3);
    });
  });

  describe('snow depth check', () => {
    const depths = (hour: (d: number, h: number) => Partial<HourValues>) => {
      const forecast = buildForecast({ hour });
      return checkedSnowDepths(forecast, forecast.daily.date.slice(3));
    };

    it('limits a jump in the snow depth to the snowfall since 09:00 on the day before', () => {
      const result = depths((d) => ({ snowDepth: d >= 2 ? 1.2 : 0.5 }));
      expect(result[2]).toEqual({ forecast: 1.2, used: 0.5 });
      expect(result[3]).toEqual({ forecast: 1.2, used: 0.5 });
    });

    it('allows the increase when there was enough snowfall (cm ÷ 100)', () => {
      const result = depths((d, h) => ({
        snowDepth: d >= 2 ? 1.2 : 0.5,
        snowfall: d === 1 && h === 12 ? 70 : 0,
      }));
      expect(result[2]?.used).toBeCloseTo(1.2);
    });

    it('uses the depth at 09:00 on day −1 for day 1', () => {
      const result = depths((d) => ({ snowDepth: d >= 0 ? 1 : 0 }));
      expect(result[0]).toEqual({ forecast: 1, used: 0 });
    });

    it('allows the snow depth to decrease', () => {
      const result = depths((d) => ({ snowDepth: 1 - d * 0.1 }));
      expect(result[1]?.used).toBeCloseTo(0.9);
    });

    it('adds a note when it corrects the depth', () => {
      const day = ski({ hour: (d) => ({ snowDepth: d >= 0 ? 1.2 : 0.5 }) })
        .days[0]!;
      expect(day.notes).toContainEqual({
        key: 'SNOW_DEPTH_CORRECTED',
        params: { forecastDepthM: 1.2, usedDepthM: 0.5 },
      });
    });
  });

  describe('other factors', () => {
    it('temperature uses the mean "feels like" temperature in the lift hours', () => {
      expect(
        factor(
          { hour: (d) => (d === 0 ? { apparentTemperature: -14.5 } : {}) },
          'SKI_TEMPERATURE',
        )?.subScore,
      ).toBeCloseTo(0.5);
    });

    it('wind uses wind_gusts_10m_max', () => {
      expect(
        factor({ day: () => ({ windGustsMax: 45 }) }, 'SKI_WIND')?.subScore,
      ).toBeCloseTo(0.5);
    });

    it('sky is 0.6 × visibility + 0.4 × sunshine', () => {
      const sky = factor(
        {
          hour: () => ({ visibility: 3000 }),
          day: () => ({ sunshineDuration: 0 }),
        },
        'SKI_SKY',
      );
      expect(sky?.subScore).toBeCloseTo(0.3);
      expect(sky?.params).toEqual({ visibilityKm: 3, sunshineRatio: 0 });
    });
  });

  describe('gates', () => {
    const gateKeys = (options: SkiOptions) =>
      today(options).gates.map((g) => g.key);

    it('freezing rain in the lift hours: maximum 20', () => {
      expect(today({ hour: at(0, 12, { weatherCode: 66 }) }).score).toBe(20);
      expect(gateKeys({ hour: at(0, 12, { weatherCode: 67 }) })).toEqual([
        'FREEZING_RAIN_GATE',
      ]);
      expect(gateKeys({ hour: at(0, 16, { weatherCode: 66 }) })).toEqual([]);
    });

    it('rain on snow (more than 2 mm and more than 0 °C): maximum 30', () => {
      const warm = { hour: () => ({ temperature: 1 }) };
      expect(gateKeys({ ...warm, day: () => ({ rainSum: 2 }) })).toEqual([]);
      expect(gateKeys({ ...warm, day: () => ({ rainSum: 2.1 }) })).toEqual([
        'RAIN_ON_SNOW_GATE',
      ]);
      expect(today({ ...warm, day: () => ({ rainSum: 2.1 }) }).score).toBe(30);
      expect(
        gateKeys({
          hour: () => ({ temperature: 0 }),
          day: () => ({ rainSum: 5 }),
        }),
      ).toEqual([]);
    });
  });

  describe('mountain town note', () => {
    /** 39 points at the town and 10 points at `high`: the 90th percentile is `high`. */
    const mountain = (high: number) =>
      terrain({
        center: 1000,
        grid: [...Array(39).fill(1000), ...Array(10).fill(high)],
      });

    it('shows when the terrain is 300 m or more above the town', () => {
      expect(ski({ terrain: mountain(1290) }).notes).toEqual([]);
      expect(ski({ terrain: mountain(1300) }).notes).toEqual([
        {
          key: 'MOUNTAIN_NOTE',
          params: {
            terrainElevation: 1300,
            heightDifference: 300,
            temperatureDifference: 2,
          },
        },
      ]);
    });

    it('gives the temperature on the high terrain for each day', () => {
      const conditions = today({ terrain: mountain(1300) }).notes.find(
        (n) => n.key === 'MOUNTAIN_CONDITIONS',
      );
      expect(conditions?.params).toEqual({
        terrainTemperature: -5,
        snowAltitude: null,
      });
    });

    it('gives the snow altitude (300 m below the freezing level) only with precipitation', () => {
      const conditions = today({
        terrain: mountain(1300),
        hour: (d, h) => ({
          freezingLevelHeight: 1400,
          precipitation: d === 0 && h === 12 ? 1 : 0,
        }),
      }).notes.find((n) => n.key === 'MOUNTAIN_CONDITIONS');
      expect(conditions?.params?.snowAltitude).toBe(1100);
    });

    it('does not change the score', () => {
      expect(today({ terrain: mountain(3000) }).score).toBe(90);
    });

    it('tells the user when the terrain data is not available', () => {
      expect(ski({ terrain: null }).notes).toEqual([
        { key: 'TERRAIN_UNAVAILABLE', params: { feature: 'MOUNTAIN_NOTE' } },
      ]);
    });
  });

  it('today has ended at 16:00 local time', () => {
    expect(today({ now: new Date('2026-01-12T14:59:00Z') }).ended).toBe(false);
    expect(today({ now: new Date('2026-01-12T15:00:00Z') }).ended).toBe(true);
  });
});
