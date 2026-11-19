import { scaleScrutinyPerSec, suspicionStageRate } from '../scrutiny';
import type { TickSystem } from './types';

/**
 * Scale scrutiny (#210): a large covert footprint keeps drawing attention after the early threats are
 * answered. It runs immediately before integrateSuspicion and only adds: that stage then integrates the
 * rest of the rate, clamps, and decides a wipe on the sum, so scrutiny never needs its own wipe path and a
 * strongly negative net rate still holds suspicion at its floor. Dormant time cannot raise suspicion, but it
 * must not shed it faster than presence either (PR #319 review): there scrutiny only offsets the drain, so
 * the dormant change is min(stage rate + scrutiny, 0), the same clamp the suspicion stage applies to the rest.
 */
export const integrateScaleScrutiny: TickSystem = (d, { dt, rates, reg, dormant }) => {
  const rate = scaleScrutinyPerSec(d, rates, reg);
  if (rate <= 0) return undefined;
  const drain = dormant ? Math.max(0, -suspicionStageRate(d, rates, reg)) : rate;
  d.suspicion += Math.min(rate, drain) * dt;
  return undefined;
};
