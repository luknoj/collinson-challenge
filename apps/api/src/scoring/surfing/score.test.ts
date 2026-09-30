import { describe, expect, it } from 'vitest';
import {
  atHour,
  buildForecast,
  buildMarine,
  NO_MARINE,
  NOW,
  ring,
  terrain,
  WEST_COAST,
  type HourSlot,
  type HourValues,
  type MarineValues,
} from '../testing/fixtures.js';
import type { ExplanationKey } from '../types.js';
import type { MarineHourly, Terrain } from '../weather.js';
import { estimateCoastDirection, windType } from './coast.js';
import { scoreSurfing } from './score.js';

interface SurfOptions {
  hour?: (slot: HourSlot) => Partial<HourValues>;
  sea?: (slot: HourSlot) => Partial<MarineValues>;
  marine?: MarineHourly | null;
  terrain?: Terrain | null;
  now?: Date;
}

/** Default: 1.5 m at 12 s, clean waves, water 18 °C, wind 10 km/h. Score 100. */
function surf(options: SurfOptions = {}) {
  return scoreSurfing({
    forecast: buildForecast({ hour: options.hour }),
    now: options.now ?? NOW,
    marine:
      options.marine === undefined ? buildMarine(options.sea) : options.marine,
    terrain:
      options.terrain === undefined
        ? terrain({ ring: WEST_COAST })
        : options.terrain,
  });
}

const today = (options: SurfOptions = {}) => surf(options).days[0]!;
const factor = ({
  options,
  key,
}: {
  options: SurfOptions;
  key: ExplanationKey;
}) => today(options).factors.find((f) => f.key === key);
const gateKeys = (options: SurfOptions) =>
  today(options).gates.map((g) => g.key);
const wind = ({ speed, from }: { speed: number; from: number }) => ({
  hour: () => ({ windSpeed: speed, windDirection: from }),
});

describe('scoreSurfing', () => {
  it('gives 100 for clean 1.5 m waves at 12 s with light wind', () => {
    const result = surf();
    expect(result.status).toBe('OK');
    expect(result.days).toHaveLength(7);
    expect(result.days[0]?.score).toBe(100);
  });

  describe('not applicable', () => {
    it('when there is no marine data', () => {
      expect(surf({ marine: null }).notApplicableReason?.key).toBe(
        'NO_SEA_NEARBY',
      );
    });

    it('when all the marine data is null (far from the coast)', () => {
      expect(surf({ marine: NO_MARINE }).status).toBe('NOT_APPLICABLE');
    });
  });

  describe('factors', () => {
    it.each([
      ['SWELL_HEIGHT', { swellWaveHeight: 0.55, windWaveHeight: 0.1 }, 0.5],
      ['SWELL_PERIOD', { swellWavePeriod: 8.5 }, 0.5],
      ['WAVE_QUALITY', { windWaveHeight: 0.975 }, 0.5],
      ['WATER_COMFORT', { seaSurfaceTemperature: 14 }, 0.75],
    ] as const)('%s', (key, values, expected) => {
      expect(
        factor({ options: { sea: () => values }, key })?.subScore,
      ).toBeCloseTo(expected);
    });

    it('SURF_WIND_SPEED uses the mean wind from sunrise to sunset', () => {
      const windSpeed = factor({
        options: { hour: () => ({ windSpeed: 23.5 }) },
        key: 'SURF_WIND_SPEED',
      });
      expect(windSpeed?.subScore).toBeCloseTo(0.5);
    });

    it('ignores marine data outside sunrise to sunset', () => {
      const night = atHour({ day: 0, hour: 3, values: { swellWaveHeight: 6 } });
      expect(today({ sea: night }).score).toBe(100);
    });
  });

  describe('gates', () => {
    const swellAtNoon = (swellWaveHeight: number) => ({
      sea: atHour({ day: 0, hour: 12, values: { swellWaveHeight } }),
    });

    it('thunderstorm: 0', () => {
      const storm = atHour({ day: 0, hour: 12, values: { weatherCode: 95 } });
      expect(today({ hour: storm }).score).toBe(0);
    });

    it('swell more than 4 m: maximum 20', () => {
      expect(gateKeys(swellAtNoon(4))).toEqual([]);
      expect(gateKeys(swellAtNoon(4.1))).toEqual(['LARGE_SWELL_GATE']);
      expect(today(swellAtNoon(4.1)).score).toBe(20);
    });

    it('mean wind more than 30 km/h: maximum 35', () => {
      expect(gateKeys({ hour: () => ({ windSpeed: 30 }) })).toEqual([]);
      expect(gateKeys({ hour: () => ({ windSpeed: 30.1 }) })).toEqual([
        'STRONG_WIND_GATE',
      ]);
    });
  });

  describe('wind direction (coast faces west, 270°)', () => {
    const adjustments = (options: SurfOptions) => today(options).adjustments;
    const windNote = (options: SurfOptions) =>
      today(options).notes.find((n) => n.key === 'WIND_DIRECTION')?.params
        ?.windType;

    it('onshore wind (0–45°): −10', () => {
      expect(adjustments(wind({ speed: 20, from: 270 }))).toMatchObject([
        { key: 'ONSHORE_WIND', points: -10 },
      ]);
      expect(windNote(wind({ speed: 20, from: 315 }))).toBe('ONSHORE');
    });

    it('offshore wind (135–180°): +5', () => {
      expect(adjustments(wind({ speed: 20, from: 90 }))).toMatchObject([
        { key: 'OFFSHORE_WIND', points: 5 },
      ]);
      expect(windNote(wind({ speed: 20, from: 135 }))).toBe('OFFSHORE');
    });

    it('cross-shore wind (45–135°): no adjustment, with a note', () => {
      expect(adjustments(wind({ speed: 20, from: 0 }))).toEqual([]);
      expect(windNote(wind({ speed: 20, from: 0 }))).toBe('CROSS_SHORE');
    });

    it('no adjustment when the wind is less than 15 km/h', () => {
      expect(adjustments(wind({ speed: 14.9, from: 270 }))).toEqual([]);
      expect(windNote(wind({ speed: 14.9, from: 270 }))).toBe('LIGHT');
      expect(adjustments(wind({ speed: 15, from: 270 }))).toHaveLength(1);
    });

    it('no adjustment and a note when the coast direction is not clear', () => {
      const result = surf({
        ...wind({ speed: 20, from: 270 }),
        terrain: terrain({ ring: ring([0, 180]) }),
      });
      expect(result.days[0]?.adjustments).toEqual([]);
      expect(result.notes[0]?.key).toBe('COAST_DIRECTION_UNCLEAR');
    });

    it('no adjustment and a note when the terrain data is not available', () => {
      const result = surf({ ...wind({ speed: 20, from: 270 }), terrain: null });
      expect(result.days[0]?.adjustments).toEqual([]);
      expect(result.notes).toEqual([
        { key: 'TERRAIN_UNAVAILABLE', params: { feature: 'COAST_DIRECTION' } },
      ]);
    });
  });

  it('today has ended at sunset', () => {
    expect(today({ now: new Date('2026-01-12T17:59:00Z') }).ended).toBe(false);
    expect(today({ now: new Date('2026-01-12T18:00:00Z') }).ended).toBe(true);
  });
});

describe('estimateCoastDirection', () => {
  it('gives the mean direction of the sea points', () => {
    const result = estimateCoastDirection({ ring: WEST_COAST });
    expect(result.clear).toBe(true);
    if (result.clear) expect(result.coast.direction).toBeCloseTo(270);
  });

  it('needs 4 or more sea points', () => {
    const four = ring([270, 292.5]);
    const three = four.map((p) =>
      p.bearing === 292.5 && p.distanceKm === 3 ? { ...p, elevation: 50 } : p,
    );
    expect(four.filter((p) => p.elevation === 0)).toHaveLength(4);
    expect(estimateCoastDirection({ ring: four }).clear).toBe(true);
    expect(estimateCoastDirection({ ring: three })).toMatchObject({
      clear: false,
      seaPoints: 3,
    });
  });

  it('needs 1 clear direction', () => {
    expect(estimateCoastDirection({ ring: ring([0, 180]) }).clear).toBe(false);
  });

  it('uses only points with an elevation of exactly 0 m', () => {
    const lowLand = ring([]).map((p) =>
      p.bearing === 270 ? { ...p, elevation: 0.5 } : p,
    );
    expect(estimateCoastDirection({ ring: lowLand }).clear).toBe(false);
  });
});

describe('windType', () => {
  it.each([
    [270, 'ONSHORE'],
    [225, 'ONSHORE'],
    [224, 'CROSS_SHORE'],
    [136, 'CROSS_SHORE'],
    [135, 'OFFSHORE'],
    [90, 'OFFSHORE'],
  ])('wind from %i° on a west coast is %s', (windFrom, type) => {
    expect(windType({ windFrom, coastDirection: 270 }).type).toBe(type);
  });
});
