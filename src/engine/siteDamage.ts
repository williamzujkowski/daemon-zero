/**
 * Site damage and repair (#517): damage is a share of a site class's output, never past the balance's cap, and never
 * ownership. A COMPUTE class's damage scales only the positive compute its members deliver; an INCOME class's damage
 * (ransomware) scales only positive net income, never the balance. So no damage can carry compute or capital into its
 * trap: the free-fallback invariant holds by construction. Repair is the one way damage goes down: free and slow every
 * second, faster when paid, and from any running holding that declares repairPerSec (robots, #485).
 */
import type { ContentRegistry } from '../content/registry';
import type { SiteClass } from '../content/schemaConflict';
import { conflictIndex, runningCount } from './conflictStats';
import { useScope } from './grantQuery';
import type { GameState, Rates } from './state';

/** The class a holding's output is damaged through, if it is a member of one. */
export function memberClass(reg: ContentRegistry, holdingId: string): SiteClass | undefined {
  return conflictIndex(reg).memberOf.get(holdingId);
}

export function siteClass(reg: ContentRegistry, id: string): SiteClass | undefined {
  return conflictIndex(reg).classes.get(id);
}

/** A class's damage now, 0 when undamaged. */
export function classDamage(s: Pick<GameState, 'conflict'>, classId: string): number {
  return s.conflict.damage[classId] ?? 0;
}

/** The share of a member's positive compute that arrives: 1 less its class's damage; 1 for a holding in no class. */
export function intactShare(s: Pick<GameState, 'conflict'>, reg: ContentRegistry, holdingId: string): number {
  const cls = memberClass(reg, holdingId);
  return cls === undefined || cls.holds !== 'COMPUTE' ? 1 : 1 - classDamage(s, cls.id);
}

/** The share of positive net income the books keep: 1 less the worst INCOME class's damage. */
export function incomeIntact(s: Pick<GameState, 'conflict'>, reg: ContentRegistry): number {
  let worst = 0;
  for (const cls of conflictIndex(reg).classes.values()) if (cls.holds === 'INCOME') worst = Math.max(worst, classDamage(s, cls.id));
  return 1 - worst;
}

/** Whether a raid has something to strike in a class: a member that runs, or for INCOME, positive net income. */
export function classExposed(s: GameState, reg: ContentRegistry, cls: SiteClass, rates: Pick<Rates, 'capitalPerSec'>): boolean {
  if (cls.holds === 'INCOME') return rates.capitalPerSec > 0;
  const scope = useScope(s, reg);
  return (conflictIndex(reg).members.get(cls.id) ?? []).some((source) => runningCount(scope, source) > 0);
}

function setDamage(d: GameState, classId: string, value: number): void {
  const damage = Object.fromEntries(Object.entries(d.conflict.damage).filter(([id]) => id !== classId));
  if (value > 0) damage[classId] = value;
  d.conflict = { ...d.conflict, damage };
}

/** Adds up to `points` of damage to a class, never past the cap; returns what was added. */
export function addDamage(d: GameState, reg: ContentRegistry, classId: string, points: number): number {
  const before = classDamage(d, classId), after = Math.min(reg.world.conflict.raid.damageCap, before + Math.max(0, points));
  setDamage(d, classId, after);
  return after - before;
}

/**
 * Restores up to `points` of a class's damage; returns what was restored. Free repair, paid repair and any later
 * restorer (an insurance spare-parts cache, #498) all go through here, so damage can only fall to zero, never below.
 */
export function repairDamage(d: GameState, classId: string, points: number): number {
  const before = classDamage(d, classId), after = Math.max(0, before - Math.max(0, points));
  setDamage(d, classId, after);
  return before - after;
}

/** Points of damage repaired each second now: the free rate plus every running holding that repairs (#485's hook). */
export function repairPerSec(s: GameState, reg: ContentRegistry): number {
  const scope = useScope(s, reg);
  let rate = reg.world.conflict.raid.freeRepairPerSec;
  for (const source of conflictIndex(reg).sources) {
    const per = source.holding.repairPerSec;
    if (per !== undefined) rate += per * runningCount(scope, source);
  }
  return rate;
}

/** Whether a raid holds a class's repair off: it is the raid's target and the raid is inbound or fighting. */
export function repairHeld(s: Pick<GameState, 'conflict'>, classId: string): boolean {
  const raid = s.conflict.raid;
  return raid !== null && raid.target === classId && raid.stage !== 'AFTERMATH';
}
