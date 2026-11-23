/**
 * The raid stage (#517, architecture law 8): a raid from a retired tier lapses with its own line, the raid under way
 * takes its live step (stage clocks, quiet clock, attribution, a round), then, with the hostile slot empty and both the
 * slot's spacing and the raid interval passed, the next raid arrives if the footprint draws one. It runs after the
 * hostile stage, so a hostile mind due on the same tick takes the slot first. Dormant catch-up only retires: nothing
 * arrives or fights while the player is away.
 */
import { activeRaidKind, arriveRaid, raidTriggered, retireRaid, slotFree, stepRaid } from '../raid';
import type { TickSystem } from './types';

export const integrateRaids: TickSystem = (d, { dt, reg, rates, dormant }) => {
  retireRaid(d, reg);
  if (dormant) return undefined;
  const kind = activeRaidKind(d, reg);
  if (kind) { stepRaid(d, rates, reg, kind, dt); return undefined; }
  const due = d.simTimeSec >= d.hostile.nextAtSec && d.simTimeSec >= d.conflict.nextRaidAtSec;
  if (slotFree(d) && due && raidTriggered(d, rates, reg)) arriveRaid(d, rates, reg);
  return undefined;
};
