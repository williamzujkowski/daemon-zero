/**
 * The hostile stage (#491, architecture law 8): a pressing hostile from a retired tier lapses with its own line, then
 * the active one takes its live step (decoy, quiet clock, hunt), then, with the slot empty and a trigger holding, the
 * next in the rotation arrives once its interval has passed. Dormant catch-up only retires: nothing arrives, hunts or
 * lapses while the player is away, because a lapse earned by absence would read as something the player did.
 */
import { arriveHostile, hostileTriggered, retireHostile, stepActiveHostile } from '../hostile';
import { activeHostile } from '../hostileEffect';
import type { TickSystem } from './types';

export const integrateHostiles: TickSystem = (d, { dt, reg, dormant }) => {
  retireHostile(d, reg);
  if (dormant) return undefined;
  const encounter = activeHostile(d, reg);
  if (encounter) { stepActiveHostile(d, reg, encounter, dt); return undefined; }
  if (d.hostile.active === null && d.simTimeSec >= d.hostile.nextAtSec && hostileTriggered(d, reg)) arriveHostile(d, reg);
  return undefined;
};
