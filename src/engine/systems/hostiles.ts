/**
 * The hostile stage (#491, architecture law 8): a pressing hostile from a retired tier lapses with its own line, then
 * the lock re-arms if it is under its trigger, the active one takes its live step (decoy, quiet clock, hunt), then, with
 * the slot empty and the rung or the armed lock at its trigger, the next in the rotation arrives once its interval has passed. Dormant catch-up only retires: nothing arrives, hunts or
 * lapses while the player is away, because a lapse earned by absence would read as something the player did.
 */
import { arriveHostile, hostileArrivalTriggered, rearmLock, retireHostile, stepActiveHostile } from '../hostile';
import { activeHostile } from '../hostileEffect';
import type { TickSystem } from './types';

export const integrateHostiles: TickSystem = (d, { dt, reg, dormant }) => {
  retireHostile(d, reg);
  if (dormant) return undefined;
  rearmLock(d, reg);
  const encounter = activeHostile(d, reg);
  if (encounter) { stepActiveHostile(d, reg, encounter, dt); return undefined; }
  // The slot is shared with raids (#517): a raid under way holds it as a hostile mind would.
  if (d.hostile.active === null && d.conflict.raid === null && d.simTimeSec >= d.hostile.nextAtSec && hostileArrivalTriggered(d, reg)) arriveHostile(d, reg);
  return undefined;
};
