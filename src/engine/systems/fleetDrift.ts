/**
 * The fleet drift stage (#518, architecture law 8): every fleet drifts at its size times its autonomy dial, then the
 * first at the split, with the hostile slot free and due, splits off as a deviant raid. It runs after the raid stage,
 * so a rival due on the same tick takes the slot first. Dormant catch-up freezes drift, as it freezes cohort drift.
 */
import { splitDeviant, stepFleetDrift } from '../deviants';
import type { TickSystem } from './types';

export const integrateFleetDrift: TickSystem = (d, { dt, reg, rates, dormant }) => {
  if (dormant) return undefined;
  stepFleetDrift(d, reg, dt);
  if (d.conflict.raid === null) splitDeviant(d, rates, reg);
  return undefined;
};
