import { describe, expect, it } from 'vitest';
import {
  atHour,
  buildForecast,
  NOW,
  onDay,
  TODAY,
  type ForecastOptions,
  type HourValues,
} from '../testing/fixtures.js';
import { scoreOutdoor } from './score.js';

/** The result for today. */
function today({
  options = {},
  now = NOW,
}: { options?: ForecastOptions; now?: Date } = {}) {
  return scoreOutdoor({ forecast: buildForecast(options), now }).days[0]!;
}

/** Values at 1 hour of today. */
const todayAt = ({
  hour,
  values,
}: {
  hour: number;
  values: Partial<HourValues>;
}) => atHour({ day: 0, hour, values });

const gateKeys = (options: ForecastOptions) =>
  today({ options }).gates.map((g) => g.key);

describe('scoreOutdoor', () => {
  it('gives 100 for a dry, sunny, mild day with light wind', () => {
    const result = scoreOutdoor({ forecast: buildForecast(), now: NOW });
    expect(result.status).toBe('OK');
    expect(result.days).toHaveLength(7);
    expect(result.days[0]).toMatchObject({
      date: TODAY,
      score: 100,
      label: 'EXCELLENT',
    });
    expect(result.weeklyScore).toBe(100);
  });

  describe('factors', () => {
    it('thermal comfort uses the mean "feels like" temperature in the window', () => {
      const day = today({
        options: {
          hour: onDay({ day: 0, values: { apparentTemperature: 8 } }),
        },
      });
      expect(
        day.factors.find((f) => f.key === 'THERMAL_COMFORT'),
      ).toMatchObject({
        value: 8,
        subScore: 0.5,
      });
      expect(day.score).toBe(80);
    });

    it('precipitation is the mean of the probability and the amount sub-scores', () => {
      const day = today({
        options: {
          hour: ({ day, hour }) =>
            day === 0
              ? {
                  precipitationProbability: 50,
                  precipitation: hour === 12 ? 2.75 : 0,
                }
              : {},
        },
      });
      const factor = day.factors.find((f) => f.key === 'PRECIPITATION');
      expect(factor?.subScore).toBeCloseTo(0.5);
      expect(factor?.params).toEqual({ probability: 50, amountMm: 2.75 });
      expect(day.score).toBe(85);
    });

    it('sky uses sunshine ÷ daylight', () => {
      const day = today({ options: { day: () => ({ sunshineDuration: 0 }) } });
      expect(
        day.factors.find((f) => f.key === 'OUTDOOR_SKY')?.subScore,
      ).toBeCloseTo(0.4);
      expect(day.score).toBe(88);
    });

    it('wind uses wind_speed_10m_max', () => {
      const day = today({ options: { day: () => ({ windSpeedMax: 32.5 }) } });
      expect(
        day.factors.find((f) => f.key === 'OUTDOOR_WIND')?.subScore,
      ).toBeCloseTo(0.5);
      expect(day.score).toBe(95);
    });
  });

  describe('daytime window (09:00–18:00)', () => {
    it('ignores rain at 03:00', () => {
      const rain = todayAt({
        hour: 3,
        values: { precipitation: 20, precipitationProbability: 100 },
      });
      expect(today({ options: { hour: rain } }).score).toBe(100);
    });

    it('ignores the amount stamped 09:00 (the hour before the window)', () => {
      expect(
        today({
          options: {
            hour: todayAt({ hour: 9, values: { precipitation: 20 } }),
          },
        }).score,
      ).toBe(100);
    });

    it('uses the amount stamped 18:00 (the last hour of the window)', () => {
      expect(
        today({
          options: {
            hour: todayAt({ hour: 18, values: { precipitation: 20 } }),
          },
        }).score,
      ).toBeLessThan(100);
    });
  });

  describe('gates', () => {
    it('thunderstorm: maximum 20', () => {
      expect(
        today({
          options: { hour: todayAt({ hour: 12, values: { weatherCode: 95 } }) },
        }).score,
      ).toBe(20);
      expect(
        gateKeys({ hour: todayAt({ hour: 12, values: { weatherCode: 99 } }) }),
      ).toEqual(['THUNDERSTORM_GATE']);
      expect(
        gateKeys({ hour: todayAt({ hour: 12, values: { weatherCode: 94 } }) }),
      ).toEqual([]);
    });

    it('extreme "feels like" temperature: more than 38 °C or less than −15 °C', () => {
      const feelsLike = (apparentTemperature: number) => ({
        hour: todayAt({ hour: 12, values: { apparentTemperature } }),
      });
      expect(gateKeys(feelsLike(38))).toEqual([]);
      expect(gateKeys(feelsLike(38.1))).toEqual(['EXTREME_TEMPERATURE_GATE']);
      expect(today({ options: feelsLike(38.1) }).score).toBe(20);
      expect(gateKeys(feelsLike(-15))).toEqual([]);
      expect(gateKeys(feelsLike(-15.1))).toEqual(['EXTREME_TEMPERATURE_GATE']);
    });

    it('gusts more than 75 km/h: maximum 20', () => {
      const gusts = (windGusts: number) => ({
        hour: todayAt({ hour: 12, values: { windGusts } }),
      });
      expect(gateKeys(gusts(75))).toEqual([]);
      expect(gateKeys(gusts(75.1))).toEqual(['STRONG_GUSTS_GATE']);
      expect(today({ options: gusts(75.1) }).score).toBe(20);
    });

    it('rain more than 5 mm with a probability of more than 70%: maximum 25', () => {
      const rain = ({
        mm,
        probability,
      }: {
        mm: number;
        probability: number;
      }) => ({
        hour: ({ day, hour }: { day: number; hour: number }) =>
          day === 0
            ? {
                precipitationProbability: probability,
                precipitation: hour === 12 ? mm : 0,
              }
            : {},
        day: () => ({ sunshineDuration: 12 * 3600 }),
      });
      expect(gateKeys(rain({ mm: 5, probability: 71 }))).toEqual([]);
      expect(gateKeys(rain({ mm: 5.1, probability: 70 }))).toEqual([]);
      expect(gateKeys(rain({ mm: 5.1, probability: 71 }))).toEqual([
        'HEAVY_RAIN_GATE',
      ]);
    });

    it('wind_speed_10m_max more than 40 km/h: maximum 40', () => {
      const wind = (windSpeedMax: number) => ({
        day: () => ({ windSpeedMax }),
      });
      expect(gateKeys(wind(40))).toEqual([]);
      expect(gateKeys(wind(40.1))).toEqual(['HIGH_WIND_GATE']);
      expect(today({ options: wind(40.1) }).score).toBe(40);
    });
  });

  describe('other rules', () => {
    it('fog in 3 or more daytime hours decreases the score by 5', () => {
      const fog = (hours: number) => ({
        hour: ({ day, hour }: { day: number; hour: number }) =>
          day === 0 && hour >= 9 && hour < 9 + hours ? { weatherCode: 45 } : {},
      });
      expect(today({ options: fog(2) }).adjustments).toEqual([]);
      const day = today({ options: fog(3) });
      expect(day.adjustments).toEqual([
        { key: 'FOG', points: -5, params: { hours: 3 } },
      ]);
      expect(day.score).toBe(95);
    });

    it('shows the UV note at 9 or more, with no change to the score', () => {
      const uv = (uvIndexMax: number) => ({ day: () => ({ uvIndexMax }) });
      expect(today({ options: uv(8.9) }).notes).toEqual([]);
      const day = today({ options: uv(9) });
      expect(day.notes).toEqual([
        { key: 'UV_VERY_HIGH', params: { uvIndex: 9 } },
      ]);
      expect(day.score).toBe(100);
    });

    it('today has ended at 18:00 local time', () => {
      expect(today({ now: new Date('2026-01-12T16:59:00Z') }).ended).toBe(
        false,
      );
      expect(today({ now: new Date('2026-01-12T17:00:00Z') }).ended).toBe(true);
    });
  });
});
