import { indoorConfig, type IndoorConfig } from '../indoor/config.js';
import { outdoorConfig, type OutdoorConfig } from '../outdoor/config.js';
import { skiingConfig, type SkiingConfig } from '../skiing/config.js';
import { surfingConfig, type SurfingConfig } from '../surfing/config.js';
import { sharedConfig, type Curve, type SharedConfig } from './config.js';

export interface ScoringConfigs {
  shared: SharedConfig;
  skiing: SkiingConfig;
  surfing: SurfingConfig;
  outdoor: OutdoorConfig;
  indoor: IndoorConfig;
}

export const scoringConfigs: ScoringConfigs = {
  shared: sharedConfig,
  skiing: skiingConfig,
  surfing: surfingConfig,
  outdoor: outdoorConfig,
  indoor: indoorConfig,
};

type Weights = Record<string, { weight: number }>;

const EPSILON = 1e-9;

/** Returns a list of problems. An empty list means that the configs are correct. */
export function validateScoringConfigs(
  configs: ScoringConfigs = scoringConfigs,
): string[] {
  const errors: string[] = [];

  const weightGroups: [string, Weights][] = [
    ['skiing.factors', configs.skiing.factors],
    ['skiing.skyParts', configs.skiing.skyParts],
    ['surfing.factors', configs.surfing.factors],
    ['outdoor.factors', configs.outdoor.factors],
  ];
  for (const [name, group] of weightGroups)
    errors.push(...checkWeights({ name, group }));

  const curveGroups: [string, Record<string, Curve>][] = [
    ['skiing.curves', configs.skiing.curves],
    ['surfing.curves', configs.surfing.curves],
    ['outdoor.curves', configs.outdoor.curves],
  ];
  for (const [group, curves] of curveGroups) {
    for (const [name, curve] of Object.entries(curves)) {
      errors.push(...checkCurve({ name: `${group}.${name}`, curve }));
    }
  }

  const limits = configs.shared.labels.map((l) => l.min);
  if (
    limits.some((v, i) => i > 0 && v >= limits[i - 1]!) ||
    limits[limits.length - 1] !== 0
  ) {
    errors.push(
      'shared.labels: the limits must decrease and the last limit must be 0.',
    );
  }
  if (configs.shared.confidence.length !== configs.shared.forecastDays) {
    errors.push(
      'shared.confidence: there must be 1 level for each forecast day.',
    );
  }
  const levels = configs.indoor.levels;
  if (levels.recommendedBelow > levels.goodAlternativeBelow) {
    errors.push(
      'indoor.levels: recommendedBelow must not be more than goodAlternativeBelow.',
    );
  }
  return errors;
}

/** Stops the server start when a config is not correct. */
export function assertValidScoringConfigs(
  configs: ScoringConfigs = scoringConfigs,
): void {
  const errors = validateScoringConfigs(configs);
  if (errors.length > 0) {
    throw new Error(
      `The scoring config is not correct:\n- ${errors.join('\n- ')}`,
    );
  }
}

function checkWeights({
  name,
  group,
}: {
  name: string;
  group: Weights;
}): string[] {
  const weights = Object.values(group).map((f) => f.weight);
  const errors: string[] = [];
  if (weights.some((w) => w < 0 || w > 1))
    errors.push(`${name}: each weight must be from 0 to 1.`);
  const total = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > EPSILON)
    errors.push(`${name}: the weights add up to ${total}, not 1.`);
  return errors;
}

function checkCurve({ name, curve }: { name: string; curve: Curve }): string[] {
  const errors: string[] = [];
  if (curve.length < 2)
    errors.push(`${name}: a curve needs at least 2 points.`);
  curve.forEach(([x, y], i) => {
    if (y < 0 || y > 1)
      errors.push(`${name}: the score ${y} is not from 0 to 1.`);
    const previous = curve[i - 1];
    if (previous && x <= previous[0])
      errors.push(`${name}: the values must increase (${x}).`);
  });
  return errors;
}
