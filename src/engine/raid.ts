/**
 * Raids (#517, vote-1795442090770-5climtc): a hostile kind that shares the hostile slot with hostile minds, one at a time.
 * A rival AI arrives once the footprint the signature shows (#482) is large enough, with a force scaled by it; the raid
 * is ARRIVAL, then ATTRIBUTION (the exact-ratio counter decides whether it is named), then an automatic BATTLE of rounds
 * (raidForecast.ts), then AFTERMATH. Before the battle it lapses if the footprint stays under the trigger; a phase past
 * its tier retires it. Nothing here touches suspicion, the lock or a balance, so no raid can end a run. Pure.
 */
import type { ContentRegistry } from '../content/registry';
import { groupDigits } from './amount';
import type { RaidKind, SiteClass } from '../content/schemaConflict';
import { conflictStats, defenseAgainst, offenseIn } from './conflictStats';
import { meetsRequirements } from './query';
import { resolveRound } from './raidForecast';
import { visibleWatts } from './signature';
import { addDamage, classDamage, classExposed, siteClass } from './siteDamage';
import type { GameState, Rates } from './state';
import { creditGrant } from './transactions';
import { fmt, pushLog } from './util';

/** Slack for stage clocks summed from tick steps, so 15 s of 0.1 s steps ends a 15 s stage on its 150th step. */
const CLOCK_SLACK = 1e-9;

/** A share as a percentage to three figures: 0.0625 reads 6.25. */
export const percentOf = (share: number): string => String(Number((share * 100).toPrecision(3)));

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

/** What the footprint multiplies a raid's force by: its share of the reference, held within the balance's bounds. */
export function footprintScale(share: number, reg: ContentRegistry): number {
  const { floor, ceiling } = reg.world.conflict.raid.footprint;
  return Math.min(ceiling, Math.max(floor, share));
}

/** A raid's tier retires once the player's phase has moved past it, as a hostile mind's does. */
export function raidRetired(s: Pick<GameState, 'currentPhase'>, kind: RaidKind): boolean {
  return s.currentPhase > kind.tier;
}

/** The class a raid would strike now: the first of its targets the player has exposed. */
export function raidTarget(s: GameState, rates: Rates, reg: ContentRegistry, kind: RaidKind): SiteClass | undefined {
  for (const id of kind.targets) {
    const cls = siteClass(reg, id);
    if (cls !== undefined && classExposed(s, reg, cls, rates)) return cls;
  }
  return undefined;
}

/** The raids that may arrive next, in content order: from fromPhase, not retired, gated open, with something to strike. */
export function eligibleRaids(s: GameState, rates: Rates, reg: ContentRegistry): RaidKind[] {
  if (s.currentPhase < reg.world.conflict.raid.fromPhase) return [];
  return reg.world.conflict.raids.filter((kind) => !raidRetired(s, kind) && meetsRequirements(s, kind.requirements, reg)
    && raidTarget(s, rates, reg, kind) !== undefined);
}

/** The defense that meets this raid's vector and the offense its domain strikes back with, from what runs now. */
export function raidCombat(s: GameState, reg: ContentRegistry, kind: RaidKind): { defense: number; offense: number } {
  const stats = conflictStats(s, reg);
  return { defense: defenseAgainst(stats, kind.vector), offense: offenseIn(stats, kind.domain) };
}

/** The next raid in the rotation arrives, if one is eligible: deterministic, like the hostile rotation. */
export function arriveRaid(d: GameState, rates: Rates, reg: ContentRegistry): void {
  const eligible = eligibleRaids(d, rates, reg);
  const kind = eligible[d.conflict.raids % Math.max(1, eligible.length)];
  const target = kind === undefined ? undefined : raidTarget(d, rates, reg, kind);
  const footprint = raidFootprint(d, rates, reg);
  if (kind === undefined || target === undefined || footprint === null) return;
  d.conflict = { ...d.conflict, raids: d.conflict.raids + 1, raid: { id: kind.id, stage: 'ARRIVAL', stageSec: 0, arrivedAtSec: d.simTimeSec,
    target: target.id, force: kind.force * footprintScale(footprint.share, reg), quietSec: 0, attributed: null, rounds: [] } };
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
  if (d.conflict.raid !== null && (kind === undefined || raidRetired(d, kind))) endRaid(d, reg, kind?.retireLog ?? null);
}

/** Whether attribution attempt `attempt` (0-based) names the attacker: exactly `successes` of every `cycle` attempts do. */
export function attributionSucceeds(attempt: number, reg: ContentRegistry): boolean {
  const { successes, cycle, stride } = reg.world.conflict.raid.attribution;
  return (attempt * stride) % cycle < successes;
}

function resolveAttribution(d: GameState, reg: ContentRegistry, kind: RaidKind): void {
  const raid = d.conflict.raid;
  if (raid === null) return;
  const named = attributionSucceeds(d.conflict.attributions, reg), { logs } = reg.world.conflict.raid;
  d.conflict = { ...d.conflict, attributions: d.conflict.attributions + 1, raid: { ...raid, attributed: named, stage: 'BATTLE', stageSec: 0 } };
  if (named) creditGrant(d, { cycles: 0, understanding: kind.forensics });
  pushLog(d, reg, fmt(named ? logs.attributed : logs.unattributed, { name: kind.name, attacker: kind.attacker.name, forensics: groupDigits(kind.forensics) }), 'LORE');
}

/** One round of the battle, at what the player holds now; the damage goes through siteDamage.ts, never past the cap. */
function fightRound(d: GameState, reg: ContentRegistry, kind: RaidKind): void {
  const raid = d.conflict.raid;
  if (raid === null) return;
  const balance = reg.world.conflict.raid, combat = raidCombat(d, reg, kind);
  const force = raid.rounds.at(-1)?.forceAfter ?? raid.force;
  const outcome = resolveRound({ force, ...combat, blow: kind.blow, damage: classDamage(d, raid.target) }, balance);
  addDamage(d, reg, raid.target, outcome.damage);
  const rounds = [...raid.rounds, outcome];
  const done = rounds.length >= balance.rounds;
  d.conflict = { ...d.conflict, raid: { ...raid, rounds, ...(done ? { stage: 'AFTERMATH' as const, stageSec: 0 } : {}) } };
  const target = siteClass(reg, raid.target)?.name ?? raid.target;
  pushLog(d, reg, fmt(balance.logs.round, { name: kind.name, round: rounds.length, hit: percentOf(outcome.hitShare), target,
    points: percentOf(outcome.damage), damage: percentOf(outcome.damageAfter) }), 'WARN');
  if (done) pushLog(d, reg, fmt(balance.logs.aftermath, { name: kind.name, target, damage: percentOf(outcome.damageAfter) }), 'LORE');
}

/** Before the battle the quiet clock runs while the footprint is under the trigger; it lapses at quietLapseSec. Returns whether it lapsed. */
function stepQuiet(d: GameState, rates: Rates, reg: ContentRegistry, kind: RaidKind, dt: number): boolean {
  const raid = d.conflict.raid;
  if (raid === null) return false;
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
    if (raid.stageSec >= (raid.rounds.length + 1) * balance.roundSec - CLOCK_SLACK) fightRound(d, reg, kind);
    return;
  }
  if (raid.stageSec >= balance.aftermathSec - CLOCK_SLACK) endRaid(d, reg, null);
}
