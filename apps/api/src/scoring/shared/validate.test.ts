import { describe, expect, it } from 'vitest';
import { createServer } from '../../server.js';
import {
  assertValidScoringConfigs,
  scoringConfigs,
  validateScoringConfigs,
  type ScoringConfigs,
} from './validate.js';

function withChange(change: (configs: ScoringConfigs) => void): ScoringConfigs {
  const copy = structuredClone(scoringConfigs);
  change(copy);
  return copy;
}

describe('validateScoringConfigs', () => {
  it('accepts the configs in the repository', () => {
    expect(validateScoringConfigs()).toEqual([]);
    expect(() => createServer()).not.toThrow();
  });

  it('finds weights that do not add up to 1', () => {
    const configs = withChange((c) => {
      c.outdoor.factors.wind.weight = 0.2;
    });
    expect(validateScoringConfigs(configs)).toEqual([
      expect.stringContaining('outdoor.factors: the weights add up to'),
    ]);
  });

  it('finds sky parts that do not add up to 1', () => {
    const configs = withChange((c) => {
      c.skiing.skyParts.sunshine.weight = 0.5;
    });
    expect(validateScoringConfigs(configs)[0]).toContain('skiing.skyParts');
  });

  it('finds curve values that do not increase', () => {
    const configs = withChange((c) => {
      (c.surfing.curves as Record<string, [number, number][]>).swellPeriod = [
        [12, 0],
        [5, 1],
      ];
    });
    expect(validateScoringConfigs(configs)[0]).toContain(
      'surfing.curves.swellPeriod',
    );
  });

  it('finds sub-scores outside 0–1', () => {
    const configs = withChange((c) => {
      (c.skiing.curves as Record<string, [number, number][]>).wind = [
        [30, 1.5],
        [60, 0],
      ];
    });
    expect(validateScoringConfigs(configs)[0]).toContain('skiing.curves.wind');
  });

  it('stops the start with a list of the problems', () => {
    const configs = withChange((c) => {
      c.surfing.factors.comfort.weight = 0.5;
    });
    expect(() => assertValidScoringConfigs(configs)).toThrow(
      /scoring config is not correct/,
    );
  });
});
