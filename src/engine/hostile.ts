/**
 * Hostile minds (#491, docs/SCALE.md "Aggressive swarms"): when they arrive, what each one does while it presses, and
 * how it leaves. Every effect is bounded by construction (a share of positive compute, a lock rise held under the
 * trigger, a share of free memory), so a hostile never pushes a constrained resource into its trap. Pure: the
 * hostile stage (systems/hostiles.ts) and the answers (hostileActions.ts) call these on a draft.
 */
import type { ContentRegistry } from '../content/registry';
import type { HostileEncounter } from '../content/schemaHostile';
import { activeHostile, hunterRise } from './hostileEffect';
import { meetsRequirements } from './query';
import type { GameState } from './state';
import { fmt, pushLog } from './util';

/**
 * Which half of the trigger holds now: the response rung, and the AEGIS lock. The lock counts only at arrival, and
 * only while armed (the lock has been under its trigger since a hostile last arrived by it), so a lock that stays high
 * summons one hostile, not one every interval.
 */
export function hostileTriggers(s: GameState, reg: ContentRegistry): { rung: boolean; lock: boolean } {
  const { trigger } = reg.swarm.hostile;
  return { rung: s.alertLevel >= trigger.alertLevelAtLeast, lock: s.aegisLock >= trigger.aegisLockAtLeast };
}

/** A hostile arrives while the rung holds, or once the armed lock reaches its trigger. */
export function hostileArrivalTriggered(s: GameState, reg: ContentRegistry): boolean {
  const { rung, lock } = hostileTriggers(s, reg);
  return rung || (lock && s.hostile.lockArmed);
}

/** What keeps a pressing hostile from lapsing: the rung alone, so going quiet always ends it (vote-1795386858891-u3kqkis). */
export function hostileHeld(s: GameState, reg: ContentRegistry): boolean {
  return hostileTriggers(s, reg).rung;
}

/** The lock re-arms once it is under its trigger: a shield-absorbed strike, a paid lock answer, or a wipe. */
export function rearmLock(d: GameState, reg: ContentRegistry): void {
  if (!d.hostile.lockArmed && !hostileTriggers(d, reg).lock) d.hostile = { ...d.hostile, lockArmed: true };
}

/** A tier retires once the player's phase has moved past it, exactly as a lesser mind's does. */
export function hostileRetired(s: GameState, encounter: HostileEncounter): boolean {
  return s.currentPhase > encounter.tier;
}

/** The hostiles that may arrive next, in content order: the current tier's, from fromPhase, gated open. */
export function eligibleHostiles(s: GameState, reg: ContentRegistry): HostileEncounter[] {
  if (s.currentPhase < reg.swarm.hostile.fromPhase) return [];
  return reg.swarm.hostileEncounters.filter((entry) => !hostileRetired(s, entry) && meetsRequirements(s, entry.requirements, reg));
}

/** Bytes a rival pins: its share of the memory free now, so memory used never passes its capacity. */
export function pinnableBytes(s: GameState, share: number): number {
  return Math.floor(share * Math.max(0, s.memoryCap - s.memoryUsed));
}

function pin(d: GameState, encounter: HostileEncounter): void {
  const active = d.hostile.active;
  if (!active || encounter.type !== 'RIVAL') return;
  const bytes = pinnableBytes(d, encounter.effect.share);
  d.memoryUsed += bytes;
  d.hostile = { ...d.hostile, active: { ...active, pinnedBytes: active.pinnedBytes + bytes } };
}

/** Returns whatever the active hostile pinned. */
export function unpinHostile(d: GameState): void {
  const active = d.hostile.active;
  if (!active || active.pinnedBytes === 0) return;
  d.memoryUsed = Math.max(0, d.memoryUsed - active.pinnedBytes);
  d.hostile = { ...d.hostile, active: { ...active, pinnedBytes: 0 } };
}

/** Ends the active hostile: its pin returns, its line (if the caller has not written one) is written, and the next may arrive after intervalSec. */
export function endHostile(d: GameState, reg: ContentRegistry, log: string | null): void {
  unpinHostile(d);
  d.hostile = { ...d.hostile, active: null, nextAtSec: d.simTimeSec + reg.swarm.hostile.intervalSec };
  if (log !== null) pushLog(d, reg, log, 'LORE');
}

/** Sends the active hostile after a decoy: its effect stops for decoySec, and a rival lets go of its pin meanwhile. */
export function decoyHostile(d: GameState, reg: ContentRegistry): void {
  unpinHostile(d);
  const active = d.hostile.active;
  if (active) d.hostile = { ...d.hostile, active: { ...active, decoySec: reg.swarm.hostile.decoySec } };
}

/**
 * The active hostile lapses with its retire line once the player's phase moves past its tier. Run before the
 * dormant return and on every purchase, so it is never silently dropped and never offered from a retired tier.
 */
export function retireHostile(d: GameState, reg: ContentRegistry): void {
  const encounter = activeHostile(d, reg);
  if (encounter && hostileRetired(d, encounter)) endHostile(d, reg, encounter.retireLog);
}

/** The next hostile in the rotation arrives, if one is eligible: deterministic, like the wild rotation. */
export function arriveHostile(d: GameState, reg: ContentRegistry): void {
  const eligible = eligibleHostiles(d, reg);
  const next = eligible[d.hostile.sequence % Math.max(1, eligible.length)];
  if (!next) return;
  // Any arrival with the lock at its trigger spends it: the lock must fall under the trigger before it summons again.
  d.hostile = { ...d.hostile, sequence: d.hostile.sequence + 1, lockArmed: d.hostile.lockArmed && !hostileTriggers(d, reg).lock,
    active: { id: next.id, arrivedAtSec: d.simTimeSec, quietSec: 0, decoySec: 0, pinnedBytes: 0 } };
  pin(d, next);
  pushLog(d, reg, next.description, 'WARN');
}

/** A hunter walks the lock up by perSec, never past its ceiling (which integrity keeps under the lock trigger). */
function huntLock(d: GameState, reg: ContentRegistry, dt: number): void {
  const rise = hunterRise(d, reg);
  if (rise) d.aegisLock = Math.min(rise.ceiling, d.aegisLock + rise.perSec * dt);
}

/** One live step of the active hostile: the decoy runs down, the quiet clock runs (or resets while the rung holds), a hunter hunts. */
export function stepActiveHostile(d: GameState, reg: ContentRegistry, encounter: HostileEncounter, dt: number): void {
  const active = d.hostile.active;
  if (!active) return;
  const decoySec = Math.max(0, active.decoySec - dt);
  const quietSec = hostileHeld(d, reg) ? 0 : active.quietSec + dt;
  d.hostile = { ...d.hostile, active: { ...active, decoySec, quietSec } };
  if (quietSec >= reg.swarm.hostile.quietLapseSec) { endHostile(d, reg, encounter.lapseLog); return; }
  if (active.decoySec > 0 && decoySec <= 0) {
    pin(d, encounter);
    pushLog(d, reg, fmt(reg.swarm.hostile.logs.decoySpent, { name: encounter.name }), 'WARN');
  }
  huntLock(d, reg, dt);
}

/** Whether purge attempt `attempt` (0-based) succeeds: exactly `successes` of every `cycle` consecutive attempts do. */
export function purgeSucceeds(attempt: number, reg: ContentRegistry): boolean {
  const { successes, cycle, stride } = reg.swarm.hostile.purge;
  return (attempt * stride) % cycle < successes;
}
