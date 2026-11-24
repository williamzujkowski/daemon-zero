/**
 * Paid repair (#517): spend a site class's declared price to restore its declared points of damage at once. Repair is
 * free but slow without it (systems/repair.ts), so this is never relief the run depends on. One gate, shared by the
 * action and the view, so no caller can take a repair a player could not reach. The spend goes through transactions.ts
 * (law 4), and a state actor's capital freeze (#490) limits it as it limits any purchase.
 */
import type { ContentRegistry } from '../content/registry';
import type { ActionResult } from './actions';
import { repairCost } from './phasePrice';
import { canAfford } from './query';
import { formatCost, pausedReason } from './queryPresentation';
import { percentOf } from './raid';
import { classDamage, repairDamage, repairHeld, siteClass } from './siteDamage';
import type { GameState } from './state';
import { payCost } from './transactions';
import { fmt, pushLog } from './util';

const NO_CLASS = 'No such site class.';

/** Every reason paid repair of this class is not offered now, in order, or none. */
export function repairUnmet(s: GameState, classId: string, reg: ContentRegistry): string[] {
  const unmet = pausedReason(s), cls = siteClass(reg, classId);
  if (cls === undefined) return [...unmet, NO_CLASS];
  if (classDamage(s, classId) <= 0) unmet.push(`Nothing in ${cls.name.toLowerCase()} is damaged.`);
  else if (repairHeld(s, classId)) unmet.push(`A raid is still on ${cls.name.toLowerCase()}: repair waits for its aftermath.`);
  const cost = repairCost(s, cls, reg);
  if (!canAfford(s, cost, reg)) unmet.push('Insufficient resources: ' + formatCost(cost));
  return unmet;
}

/** Pays to repair a damaged site class now. */
export function repairSite(s: GameState, classId: string, reg: ContentRegistry): ActionResult {
  const [reason] = repairUnmet(s, classId, reg), cls = siteClass(reg, classId);
  if (reason !== undefined || cls === undefined) return { ok: false, state: s, reason: reason ?? NO_CLASS };
  const d: GameState = { ...s };
  payCost(d, repairCost(s, cls, reg));
  const restored = repairDamage(d, classId, cls.repair.points);
  pushLog(d, reg, fmt(reg.world.conflict.raid.logs.repaired, { target: cls.name, points: percentOf(restored), damage: percentOf(classDamage(d, classId)) }), 'LORE');
  return { ok: true, state: d };
}
