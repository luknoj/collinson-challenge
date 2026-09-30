import { describe, expect, it } from 'vitest';
import { buildDayScore, type DayInput, type FactorInput } from './day.js';

const factor = ({
  key,
  weight,
  subScore,
}: Pick<FactorInput, 'key' | 'weight' | 'subScore'>): FactorInput => ({
  key,
  weight,
  subScore,
  value: 1,
  unit: 'x',
});

const base: DayInput = {
  date: '2026-01-12',
  dayIndex: 0,
  ended: false,
  factors: [
    factor({ key: 'PRECIPITATION', weight: 0.5, subScore: 1 }),
    factor({ key: 'THERMAL_COMFORT', weight: 0.5, subScore: 0.5 }),
  ],
};

describe('buildDayScore', () => {
  it('calculates 100 × Σ(weight × sub-score)', () => {
    const day = buildDayScore(base);
    expect(day.score).toBe(75);
    expect(day.factors.map((f) => f.points)).toEqual([50, 25]);
    expect(day.label).toBe('GOOD');
    expect(day.confidence).toBe('HIGH');
  });

  it('adds the adjustments and keeps the score from 0 to 100', () => {
    expect(
      buildDayScore({ ...base, adjustments: [{ key: 'FOG', points: -5 }] })
        .score,
    ).toBe(70);
    expect(
      buildDayScore({
        ...base,
        factors: [factor({ key: 'PRECIPITATION', weight: 1, subScore: 1 })],
        adjustments: [{ key: 'OFFSHORE_WIND', points: 5 }],
      }).score,
    ).toBe(100);
  });

  it('applies a gate only when its maximum is below the score', () => {
    const gate = (maxScore: number) => ({
      key: 'HEAVY_RAIN_GATE' as const,
      active: true,
      maxScore,
    });
    const limited = buildDayScore({ ...base, gates: [gate(25)] });
    expect(limited.score).toBe(25);
    expect(limited.scoreBeforeGates).toBe(75);
    expect(limited.gates).toEqual([
      { key: 'HEAVY_RAIN_GATE', params: { maxScore: 25 } },
    ]);

    const noEffect = buildDayScore({ ...base, gates: [gate(80)] });
    expect(noEffect.score).toBe(75);
    expect(noEffect.gates).toEqual([]);
  });

  it('ignores gates that are not active, and uses the lowest active gate', () => {
    const day = buildDayScore({
      ...base,
      gates: [
        { key: 'HIGH_WIND_GATE', active: true, maxScore: 40 },
        { key: 'THUNDERSTORM_GATE', active: true, maxScore: 20 },
        { key: 'STRONG_GUSTS_GATE', active: false, maxScore: 0 },
      ],
    });
    expect(day.score).toBe(20);
    expect(day.gates.map((g) => g.key)).toEqual([
      'HIGH_WIND_GATE',
      'THUNDERSTORM_GATE',
    ]);
  });

  it('rounds only the final score', () => {
    const day = buildDayScore({
      ...base,
      factors: [factor({ key: 'PRECIPITATION', weight: 1, subScore: 0.576 })],
    });
    expect(day.factors[0]?.points).toBeCloseTo(57.6);
    expect(day.score).toBe(58);
  });

  it('gives the 1–2 factors that decrease the score most as reasons', () => {
    const day = buildDayScore({
      ...base,
      factors: [
        factor({ key: 'PRECIPITATION', weight: 0.3, subScore: 1 }),
        factor({ key: 'THERMAL_COMFORT', weight: 0.4, subScore: 0.5 }),
        factor({ key: 'OUTDOOR_SKY', weight: 0.2, subScore: 0 }),
        factor({ key: 'OUTDOOR_WIND', weight: 0.1, subScore: 0.9 }),
      ],
    });
    expect(day.reasons.map((r) => r.key)).toEqual([
      'THERMAL_COMFORT',
      'OUTDOOR_SKY',
    ]);
  });

  it('gives no reasons when all factors are perfect', () => {
    expect(
      buildDayScore({
        ...base,
        factors: [factor({ key: 'PRECIPITATION', weight: 1, subScore: 1 })],
      }).reasons,
    ).toEqual([]);
  });

  it('does not use a factor with missing data, and adds a note', () => {
    const day = buildDayScore({
      ...base,
      factors: [
        factor({ key: 'PRECIPITATION', weight: 0.5, subScore: 0.8 }),
        factor({ key: 'THERMAL_COMFORT', weight: 0.5, subScore: null }),
      ],
    });
    expect(day.score).toBe(80);
    expect(day.factors).toHaveLength(1);
    expect(day.factors[0]?.weight).toBe(1);
    expect(day.notes).toContainEqual({
      key: 'DATA_MISSING',
      params: { factor: 'THERMAL_COMFORT' },
    });
  });
});
