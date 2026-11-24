/**
 * Raids (#517, vote-1795442090770-5climtc): a hostile kind that shares the hostile slot with hostile minds, one at a time.
 * A rival AI arrives once the footprint the signature shows (#482) is large enough, with a force scaled by it; the raid
 * is ARRIVAL, then ATTRIBUTION (the exact-ratio counter decides whether it is named), then an automatic BATTLE of rounds
 * (raidBattle.ts), then AFTERMATH. Before the battle it lapses if the footprint stays under the trigger; a phase past
 * its tier retires it. A drift deviant (#518) shares the lifecycle but arrives by a split (systems/fleetDrift.ts), is
 * always identified, never lapses and never retires. Nothing here touches suspicion, the lock or a balance, so no raid
 * can end a run. Pure.
 */
import type { ContentRegistry } from '../content/registry';
import { rivalRaids } from '../content/integrityConflict';
import { groupDigits } from './amount';
import { tracedRival, type RaidKind, type RivalRaid, type SiteClass } from '../content/schemaConflict';
import { meetsRequirements } from './query';
import { fightNext, roundsFought } from './raidBattle';
import { visibleWatts } from './signature';
import { classExposed, siteClass } from './siteDamage';
import type { GameState, Rates } from './state';
import { creditGrant } from './transactions';
import { fmt, pushLog } from './util';

export { percentOf, raidCombat } from './raidBattle';

/** Slack for stage clocks summed from tick steps, so 15 s of 0.1 s steps ends a 15 s stage on its 150th step. */
const CLOCK_SLACK = 1e-9;

export function raidKind(reg: ContentRegistry, id: string | undefined): RaidKind | undefined {
  return id === undefined ? undefined : reg.world.conflict.raids.find((kind) => kind.id === id);
}

/** The raid under way, from content. */
export function activeRaidKind(s: GameState, reg: ContentRegistry): RaidKind | undefined {
  return raidKind(reg, s.conflict.raid?.id);
}

/** The hostile slot is empty: no hostile mind presses and no raid is under way. */
export function slotFree(s: Pick<GameState, 'hostile' | 'conflict'>): boolean {
  return s.hostile.active === null && s.conflict.raid === null;
}

export interface RaidFootprint { visibleWatts: number; referenceWatts: number; share: number }

/** The footprint rival minds read now: visible watts against the phase's signature reference; null where none is declared. */
export function raidFootprint(s: GameState, rates: Rates, reg: ContentRegistry): RaidFootprint | null {
  const reference = reg.phases.find((phase) => phase.phaseId === s.currentPhase)?.powerSignature?.referenceVisibleWatts;
  if (reference === undefined) return null;
  const visible = visibleWatts(s, rates, reg);
  return { visibleWatts: visible, referenceWatts: reference, share: visible / reference };
}

/** Whether the footprint draws raiders now: from fromPhase, visible watts at or past the trigger share of the reference. */
export function raidTriggered(s: GameState, rates: Rates, reg: ContentRegistry): boolean {
  const footprint = s.currentPhase >= reg.world.conflict.raid.fromPhase ? raidFootprint(s, rates, reg) : null;
  return footprint !== null && footprint.share >= reg.world.conflict.raid.trigger.visibleShareAtLeast;
}

/** The phases that author a raid, indexed once per registry: the stage asks on every tick. */
const RAIDED_PHASES = new WeakMap<ContentRegistry, ReadonlySet<number>>();

/**
 * Whether a raid could arrive in this phase at all: some raid's tier is the phase (integrity binds each tier to its
 * phaseAtLeast, and a later phase retires it), so the stage reads no footprint where nothing could come of it.
 */
export function raidPhase(s: Pick<GameState, 'currentPhase'>, reg: ContentRegistry): boolean {
  let phases = RAIDED_PHASES.get(reg);
  if (phases === undefined) {
    phases = new Set(rivalRaids(reg).map((kind) => kind.tier));
    RAIDED_PHASES.set(reg, phases);
  }
  return phases.has(s.currentPhase);
}

/** What the footprint multiplies a raid's force by: its share of the reference, held within the balance's bounds. */
export function footprintScale(share: number, reg: ContentRegistry): number {
  const { floor, ceiling } = reg.world.conflict.raid.footprint;
  return Math.min(ceiling, Math.max(floor, share));
}

/** A rival raid's tier retires once the player's phase has moved past it, as a hostile mind's does; a deviant never does. */
export function raidRetired(s: Pick<GameState, 'currentPhase'>, kind: RaidKind): boolean {
  return kind.source === 'RIVAL' && s.currentPhase > kind.tier;
}

/** The class a raid would strike now: the first of its targets the player has exposed. */
export function raidTarget(s: GameState, rates: Rates, reg: ContentRegistry, kind: RaidKind): SiteClass | undefined {
  for (const id of kind.targets) {
    const cls = siteClass(reg, id);
    if (cls !== undefined && classExposed(s, reg, cls, rates)) return cls;
  }
  return undefined;
}

/**
 * The rival raids that may arrive next, in content order: from fromPhase, not retired, not silenced by a retaliation
 * (#519), gated open, with something to strike. A deviant is never dealt: only its fleet's split brings it.
 */
export function eligibleRaids(s: GameState, rates: Rates, reg: ContentRegistry): RivalRaid[] {
  if (s.currentPhase < reg.world.conflict.raid.fromPhase) return [];
  return rivalRaids(reg).filter((kind) => !raidRetired(s, kind) && !s.conflict.silenced.includes(kind.id) && meetsRequirements(s, kind.requirements, reg)
    && raidTarget(s, rates, reg, kind) !== undefined);
}

/** The next raid in the rotation arrives, if one is eligible: deterministic, like the hostile rotation. */
export function arriveRaid(d: GameState, rates: Rates, reg: ContentRegistry): void {
  const eligible = eligibleRaids(d, rates, reg);
  const kind = eligible[d.conflict.raids % Math.max(1, eligible.length)];
  const target = kind === undefined ? undefined : raidTarget(d, rates, reg, kind);
  const footprint = raidFootprint(d, rates, reg);
  if (kind === undefined || target === undefined || footprint === null) return;
  d.conflict = { ...d.conflict, raids: d.conflict.raids + 1, raid: { id: kind.id, stage: 'ARRIVAL', stageSec: 0, arrivedAtSec: d.simTimeSec,
    target: target.id, force: kind.force * footprintScale(footprint.share, reg), quietSec: 0, attributed: null, rounds: [], engagement: null, splitShare: 0 } };
  pushLog(d, reg, kind.description, 'WARN');
}

/** Ends the raid: its line (if any) is written, and the slot's spacing and the raid interval both start again. */
export function endRaid(d: GameState, reg: ContentRegistry, log: string | null): void {
  const { raid } = reg.world.conflict;
  d.conflict = { ...d.conflict, raid: null, nextRaidAtSec: d.simTimeSec + raid.intervalSec };
  // The slot is shared: neither a hostile mind nor another raid arrives until the hostile interval has passed too.
  d.hostile = { ...d.hostile, nextAtSec: Math.max(d.hostile.nextAtSec, d.simTimeSec + reg.swarm.hostile.intervalSec) };
  if (log !== null) pushLog(d, reg, log, 'LORE');
}

/** The raid lapses with its retire line once the player's phase has moved past its tier; run on every tick, dormant too. */
export function retireRaid(d: GameState, reg: ContentRegistry): void {
  const kind = activeRaidKind(d, reg);
  if (d.conflict.raid !== null && (kind === undefined || raidRetired(d, kind))) endRaid(d, reg, kind?.source === 'RIVAL' ? kind.retireLog : null);
}

// The one predicate for what is traced, answered and blamed (schemaConflict.ts); re-exported for the raid's readers.
export { tracedRival };

/** Whether attribution attempt `attempt` (0-based) names the attacker: exactly `successes` of every `cycle` attempts do. */
export function attributionSucceeds(attempt: number, reg: ContentRegistry): boolean {
  const { successes, cycle, stride } = reg.world.conflict.raid.attribution;
  return (attempt * stride) % cycle < successes;
}

function resolveAttribution(d: GameState, reg: ContentRegistry, kind: RaidKind): void {
  const raid = d.conflict.raid;
  if (raid === null) return;
  if (!tracedRival(kind)) {
    // The player's own fleet, or a hazard of its own making (#486), needs no tracing: it is named at once, and the
    // exact-ratio counter is not spent on it.
    d.conflict = { ...d.conflict, raid: { ...raid, attributed: true, stage: 'BATTLE', stageSec: 0 } };
    pushLog(d, reg, fmt(reg.world.conflict.fleets.logs.identified, { name: kind.name, attacker: kind.attacker.name, origin: kind.attacker.origin }), 'LORE');
    return;
  }
  const named = attributionSucceeds(d.conflict.attributions, reg), { logs } = reg.world.conflict.raid;
  d.conflict = { ...d.conflict, attributions: d.conflict.attributions + 1, raid: { ...raid, attributed: named, stage: 'BATTLE', stageSec: 0 } };
  if (named) creditGrant(d, { cycles: 0, understanding: kind.forensics });
  pushLog(d, reg, fmt(named ? logs.attributed : logs.unattributed, { name: kind.name, attacker: kind.attacker.name, forensics: groupDigits(kind.forensics) }), 'LORE');
}

/** Before the battle the quiet clock runs while the footprint is under the trigger; it lapses at quietLapseSec. Returns whether it lapsed. */
function stepQuiet(d: GameState, rates: Rates, reg: ContentRegistry, kind: RaidKind, dt: number): boolean {
  const raid = d.conflict.raid;
  // A deviant was not drawn by the footprint, so going dark does not lose it: reclaim or the battle ends it. Nor does
  // debris (#486): a cascade follows orbits, not a footprint, and the battle and free repair end it.
  if (raid === null || !tracedRival(kind)) return false;
  const quietSec = raidTriggered(d, rates, reg) ? 0 : raid.quietSec + dt;
  d.conflict = { ...d.conflict, raid: { ...raid, quietSec } };
  if (quietSec < reg.world.conflict.raid.quietLapseSec - CLOCK_SLACK) return false;
  endRaid(d, reg, kind.lapseLog);
  return true;
}

/** One live step of the raid under way: its stage clock runs, and a stage that is over moves it to the next. */
export function stepRaid(d: GameState, rates: Rates, reg: ContentRegistry, kind: RaidKind, dt: number): void {
  const start = d.conflict.raid;
  if (start === null) return;
  const balance = reg.world.conflict.raid;
  d.conflict = { ...d.conflict, raid: { ...start, stageSec: start.stageSec + dt } };
  const raid = d.conflict.raid;
  if (raid === null) return;
  if (raid.stage === 'ARRIVAL' || raid.stage === 'ATTRIBUTION') {
    if (stepQuiet(d, rates, reg, kind, dt)) return;
    if (raid.stage === 'ARRIVAL' && raid.stageSec >= balance.arrivalSec - CLOCK_SLACK) {
      d.conflict = { ...d.conflict, raid: { ...raid, quietSec: d.conflict.raid?.quietSec ?? 0, stage: 'ATTRIBUTION', stageSec: 0 } };
    } else if (raid.stage === 'ATTRIBUTION' && raid.stageSec >= balance.attributionSec - CLOCK_SLACK) resolveAttribution(d, reg, kind);
    return;
  }
  if (raid.stage === 'BATTLE') {
    if (raid.stageSec >= (roundsFought(raid) + 1) * balance.roundSec - CLOCK_SLACK) fightNext(d, reg, kind);
    return;
  }
  if (raid.stageSec >= balance.aftermathSec - CLOCK_SLACK) endRaid(d, reg, null);
}
