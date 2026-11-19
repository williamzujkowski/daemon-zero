import { scaleScrutinyPerSec } from '../scrutiny';
import type { TickSystem } from './types';

/**
 * Scale scrutiny (#210): a large covert footprint keeps drawing attention after the early threats are
 * answered. It runs immediately before integrateSuspicion and only adds: that stage then integrates the
 * rest of the rate, clamps, and decides a wipe on the sum, so scrutiny never needs its own wipe path and a
 * strongly negative net rate still holds suspicion at its floor. Dormant time draws none, as threats there
 * cannot grow.
 */
export const integrateScaleScrutiny: TickSystem = (d, { dt, rates, reg, dormant }) => {
  if (dormant) return undefined;
  const rate = scaleScrutinyPerSec(d, reg, rates);
  if (rate > 0) d.suspicion += rate * dt;
  return undefined;
};
