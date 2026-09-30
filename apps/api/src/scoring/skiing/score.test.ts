import { describe, expect, it } from 'vitest';
import {
  atHour,
  buildForecast,
  NOW,
  terrain,
  type DayValues,
  type HourSlot,
  type HourValues,
} from '../testing/fixtures.js';
import type { ExplanationKey } from '../types.js';
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
  hour?: (slot: HourSlot) => Partial<HourValues>;
  day?: (day: number) => Partial<DayValues>;
  terrain?: Terrain | null;
  now?: Date;
}

function ski(options: SkiOptions = {}) {
  const forecast = buildForecast({
    hour: (slot) => ({ ...SKI_HOUR, ...options.hour?.(slot) }),
    day: options.day,
  });
  return scoreSkiing({
    forecast,
    now: options.now ?? NOW,
    terrain: options.terrain === undefined ? terrain() : options.terrain,
  });
}

const today = (options: SkiOptions = {}) => ski(options).days[0]!;
const factor = ({
  options,
  key,
}: {
  options: SkiOptions;
  key: ExplanationKey;
}) => today(options).factors.find((f) => f.key === key);

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
      const last = ski({
        hour: ({ day }) => (day === 6 ? { snowDepth: 0.29 } : {}),
      }).days[6]!;
      expect(last.score).toBe(0);
      expect(last.gates[0]?.key).toBe('NO_SNOW_BASE_GATE');
    });

    it('uses the snow depth at 09:00 on the curve', () => {
      const snowBase = factor({
        options: { hour: () => ({ snowDepth: 0.65 }) },
        key: 'SNOW_BASE',
      });
      expect(snowBase?.subScore).toBeCloseTo(0.65);
    });
  });

  describe('fresh snow (72 h before 09:00)', () => {
    const fresh = ({ day, hour, target = 0 }: HourSlot & { target?: number }) =>
      ski({ hour: atHour({ day, hour, values: { snowfall: 5 } }) }).days[
        target
      ]!.factors.find((f) => f.key === 'FRESH_SNOW')?.value;

    it('includes the snowfall stamped 09:00 on the same day', () => {
      expect(fresh({ day: 0, hour: 9 })).toBe(5);
    });

    it('counts the snowfall after 09:00 for the next day', () => {
      expect(fresh({ day: 0, hour: 10 })).toBe(0);
      expect(fresh({ day: 0, hour: 10, target: 1 })).toBe(5);
    });

    it('starts after 09:00, 3 days before', () => {
      expect(fresh({ day: -3, hour: 10 })).toBe(5);
      expect(fresh({ day: -3, hour: 9 })).toBe(0);
    });

    it('uses the fresh snow curve', () => {
      const withSnowfall = (snowfall: number) =>
        factor({
          options: {
            hour: atHour({ day: -1, hour: 12, values: { snowfall } }),
          },
          key: 'FRESH_SNOW',
        })?.subScore;
      expect(withSnowfall(5)).toBe(1);
      expect(withSnowfall(40)).toBeCloseTo(0.3);
    });
  });

  describe('snow depth check', () => {
    const depths = (hour: (slot: HourSlot) => Partial<HourValues>) => {
      const forecast = buildForecast({ hour });
      return checkedSnowDepths({
        forecast,
        dates: forecast.daily.date.slice(3),
      });
    };

    it('limits a jump in the snow depth to the snowfall since 09:00 on the day before', () => {
      const result = depths(({ day }) => ({ snowDepth: day >= 2 ? 1.2 : 0.5 }));
      expect(result[2]).toEqual({ forecast: 1.2, used: 0.5 });
      expect(result[3]).toEqual({ forecast: 1.2, used: 0.5 });
    });

    it('allows the increase when there was enough snowfall (cm ÷ 100)', () => {
      const result = depths(({ day, hour }) => ({
        snowDepth: day >= 2 ? 1.2 : 0.5,
        snowfall: day === 1 && hour === 12 ? 70 : 0,
      }));
      expect(result[2]?.used).toBeCloseTo(1.2);
    });

    it('uses the depth at 09:00 on day −1 for day 1', () => {
      const result = depths(({ day }) => ({ snowDepth: day >= 0 ? 1 : 0 }));
      expect(result[0]).toEqual({ forecast: 1, used: 0 });
    });

    it('allows the snow depth to decrease', () => {
      const result = depths(({ day }) => ({ snowDepth: 1 - day * 0.1 }));
      expect(result[1]?.used).toBeCloseTo(0.9);
    });

    it('adds a note when it corrects the depth', () => {
      const day = today({
        hour: ({ day }) => ({ snowDepth: day >= 0 ? 1.2 : 0.5 }),
      });
      expect(day.notes).toContainEqual({
        key: 'SNOW_DEPTH_CORRECTED',
        params: { forecastDepthM: 1.2, usedDepthM: 0.5 },
      });
    });
  });

  describe('other factors', () => {
    it('temperature uses the mean "feels like" temperature in the lift hours', () => {
      const temperature = factor({
        options: {
          hour: ({ day }) => (day === 0 ? { apparentTemperature: -14.5 } : {}),
        },
        key: 'SKI_TEMPERATURE',
      });
      expect(temperature?.subScore).toBeCloseTo(0.5);
      // The UI shows the hours, because outdoor uses different hours.
      expect(temperature?.params).toEqual({ startHour: 9, endHour: 16 });
    });

    it('wind uses the maximum hourly gusts in the lift hours', () => {
      // 16:00 is the last gust stamp of the lift hours (09:00–16:00).
      const gusts = ({ day, hour }: HourSlot) => {
        if (day !== 0) return {};
        if (hour === 16) return { windGusts: 45 };
        if (hour === 17 || hour === 23) return { windGusts: 90 };
        return {};
      };
      const wind = factor({ options: { hour: gusts }, key: 'SKI_WIND' });
      expect(wind?.value).toBe(45);
      expect(wind?.subScore).toBeCloseTo(0.5);
      expect(wind?.params).toEqual({ startHour: 9, endHour: 16 });
    });

    it('sky is 0.6 × visibility + 0.4 × sunshine', () => {
      const sky = factor({
        options: {
          hour: () => ({ visibility: 3000 }),
          day: () => ({ sunshineDuration: 0 }),
        },
        key: 'SKI_SKY',
      });
      expect(sky?.subScore).toBeCloseTo(0.3);
      expect(sky?.params).toEqual({ visibilityKm: 3, sunshineRatio: 0 });
    });
  });

  describe('gates', () => {
    const gateKeys = (options: SkiOptions) =>
      today(options).gates.map((g) => g.key);
    const code = ({
      hour,
      weatherCode,
    }: {
      hour: number;
      weatherCode: number;
    }) => ({
      hour: atHour({ day: 0, hour, values: { weatherCode } }),
    });

    it('freezing rain in the lift hours: maximum 20', () => {
      expect(today(code({ hour: 12, weatherCode: 66 })).score).toBe(20);
      expect(gateKeys(code({ hour: 12, weatherCode: 67 }))).toEqual([
        'FREEZING_RAIN_GATE',
      ]);
      expect(gateKeys(code({ hour: 16, weatherCode: 66 }))).toEqual([]);
    });

    it('rain on snow (more than 2 mm and more than 0 °C): maximum 30', () => {
      // The rain is in 2 hours of the lift hours. The rain at night has no effect.
      const rainOnSnow = ({
        rainMm,
        temperature,
      }: {
        rainMm: number;
        temperature: number;
      }) => ({
        hour: ({ day, hour }: HourSlot) => ({
          temperature,
          ...(day === 0 && (hour === 10 || hour === 16)
            ? { rain: rainMm / 2 }
            : {}),
          ...(day === 0 && hour === 22 ? { rain: 10 } : {}),
        }),
      });
      expect(gateKeys(rainOnSnow({ rainMm: 2, temperature: 1 }))).toEqual([]);
      expect(gateKeys(rainOnSnow({ rainMm: 2.1, temperature: 1 }))).toEqual([
        'RAIN_ON_SNOW_GATE',
      ]);
      expect(today(rainOnSnow({ rainMm: 2.1, temperature: 1 })).score).toBe(30);
      expect(gateKeys(rainOnSnow({ rainMm: 5, temperature: 0 }))).toEqual([]);
    });
  });

  describe('mountain town note', () => {
    /** 39 points at the town and 10 points at `high`: the 90th percentile is `high`. */
    const mountain = (high: number) =>
      terrain({
        center: 1000,
        grid: [
          ...Array<number>(39).fill(1000),
          ...Array<number>(10).fill(high),
        ],
      });
    const conditions = (options: SkiOptions) =>
      today(options).notes.find((n) => n.key === 'MOUNTAIN_CONDITIONS')?.params;

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
      expect(conditions({ terrain: mountain(1300) })).toEqual({
        terrainTemperature: -5,
        snowAltitude: null,
      });
    });

    it('gives the snow altitude (300 m below the freezing level) only with precipitation', () => {
      const withRain = conditions({
        terrain: mountain(1300),
        hour: ({ day, hour }) => ({
          freezingLevelHeight: 1400,
          precipitation: day === 0 && hour === 12 ? 1 : 0,
        }),
      });
      expect(withRain?.snowAltitude).toBe(1100);
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
