/**
 * The repair stage (#517, architecture law 8): every damaged site class is repaired at the free rate plus what running
 * repairers add, except the class a raid is inbound on or fighting. It runs while the player is away too, because
 * repair only ever helps.
 */
import { repairDamage, repairHeld, repairPerSec } from '../siteDamage';
import type { TickSystem } from './types';

export const integrateRepair: TickSystem = (d, { dt, reg }) => {
  const damaged = Object.keys(d.conflict.damage);
  if (damaged.length === 0) return undefined;
  const points = repairPerSec(d, reg) * dt;
  for (const id of damaged) if (!repairHeld(d, id)) repairDamage(d, id, points);
  return undefined;
};
