/**
 * The fleet rebuild stage (#518, architecture law 8): every fleet's losses fall at the free rate plus what each running
 * fab adds, except a fleet whose domain a fleet battle is inbound on or fighting. It runs while the player is away too,
 * because rebuilding only ever helps.
 */
import { fleetRebuildPerSec, fleetRecord, fleetUnit, rebuildHeld, setFleet } from '../fleets';
import type { TickSystem } from './types';

export const integrateFleetRebuild: TickSystem = (d, { dt, reg }) => {
  let rate: number | undefined;
  for (const [id, record] of Object.entries(d.conflict.fleets)) {
    const unit = fleetUnit(reg, id);
    if (record.lost <= 0 || unit === undefined || rebuildHeld(d, reg, unit)) continue;
    rate ??= fleetRebuildPerSec(d, reg);
    setFleet(d, id, { lost: Math.max(0, fleetRecord(d, id).lost - rate * dt) });
  }
  return undefined;
};
