/**
 * One round of a raid's battle (#517, #518). An attrition raid fights every round by expected-value attrition
 * (raidForecast.ts). A fleet battle (a rival fleet or a drift deviant) fights its first round as an engagement with the
 * player's fleets in its domain by the Lanchester square law (lanchester.ts): a force they destroy ends the battle there,
 * and only a force that breaks them strikes in the rounds after, by attrition against what is not a fleet. Damage goes
 * through siteDamage.ts and losses through fleets.ts, so neither passes its cap. Pure.
 */
import type { ContentRegistry } from '../content/registry';
import type { RaidKind } from '../content/schemaConflict';
import type { ActiveRaid, Engagement } from './conflictState';
import { conflictStats, defenseAgainst, offenseIn } from './conflictStats';
import { applyFleetLosses, domainFleet } from './fleets';
import { engagementText } from './fleetText';
import { engage } from './lanchester';
import { resolveRound } from './raidForecast';
import { lastRaidOf, recordOwedHarm } from './raidOutcome';
import { addDamage, classDamage, siteClass } from './siteDamage';
import type { GameState } from './state';
import { fmt, pushLog } from './util';

/** A share as a percentage to three figures: 0.0625 reads 6.25. */
export const percentOf = (share: number): string => String(Number((share * 100).toPrecision(3)));

/** Whether a raid kind fights as a fleet: a rival declared LANCHESTER, or any drift deviant. */
export function isFleetBattle(kind: RaidKind): boolean {
  return kind.source === 'DEVIANT' || kind.resolution === 'LANCHESTER';
}

/** A fleet battle's lethality: its effectiveness per unit of strength against one of the player's. */
export function lethalityOf(kind: RaidKind): number {
  return kind.source === 'DEVIANT' ? kind.lethality : kind.lethality ?? 1;
}

/** Rounds fought so far: the engagement, if fought, and each strike. */
export function roundsFought(raid: ActiveRaid): number {
  return raid.rounds.length + (raid.engagement === null ? 0 : 1);
}

/** The force the next strike comes with: what the last strike left, or what came through the engagement. */
export function strikeForce(raid: ActiveRaid): number {
  return raid.rounds.at(-1)?.forceAfter ?? raid.engagement?.forceAfter ?? raid.force;
}

/**
 * The defense that meets this raid's vector and the offense its domain strikes back with, from what runs now. A fleet
 * battle's strikes come only after its engagement broke the fleets, so they meet what is not a fleet.
 */
export function raidCombat(s: GameState, reg: ContentRegistry, kind: RaidKind): { defense: number; offense: number } {
  const stats = conflictStats(s, reg, isFleetBattle(kind));
  return { defense: defenseAgainst(stats, kind.vector), offense: offenseIn(stats, kind.domain) };
}

/** The engagement this raid would fight now, against the fleets the player holds now. */
export function engagementNow(s: GameState, reg: ContentRegistry, kind: RaidKind, force: number): Engagement {
  const fleet = domainFleet(s, reg, kind.domain);
  const { attackerWins, forceAfter, fleetAfter, lethality } = engage({ force, lethality: lethalityOf(kind), fleet: fleet.strength, floor: fleet.floor });
  return { force, lethality, fleet: fleet.strength, floor: fleet.floor, attackerWins, forceAfter, fleetAfter };
}

/**
 * The battle is over. Its record is written for the scenes that answer it (#519): once, here, after a harm the last record
 * still owes a scene is put on record, so a battle never overwrites a harm nobody answered.
 */
function closeBattle(d: GameState, reg: ContentRegistry, kind: RaidKind, raid: ActiveRaid): void {
  const target = siteClass(reg, raid.target)?.name ?? raid.target;
  recordOwedHarm(d, reg);
  d.conflict = { ...d.conflict, raid: { ...raid, stage: 'AFTERMATH', stageSec: 0 }, lastRaid: lastRaidOf(d, reg, kind, raid.attributed, raid.rounds) };
  pushLog(d, reg, fmt(reg.world.conflict.raid.logs.aftermath, { name: kind.name, target, damage: percentOf(classDamage(d, raid.target)) }), 'LORE');
}

/** The engagement, fought: the fleets' losses are taken, and a destroyed force ends the battle. */
function fightEngagement(d: GameState, reg: ContentRegistry, kind: RaidKind, raid: ActiveRaid): void {
  const engagement = engagementNow(d, reg, kind, raid.force);
  applyFleetLosses(d, reg, kind.domain, engagement.fleet - engagement.fleetAfter);
  const fought = { ...raid, engagement };
  d.conflict = { ...d.conflict, raid: fought };
  pushLog(d, reg, fmt(reg.world.conflict.fleets.logs.engagement, { name: kind.name, outcome: engagementText(engagement) }), 'WARN');
  if (!engagement.attackerWins || roundsFought(fought) >= reg.world.conflict.raid.rounds) closeBattle(d, reg, kind, fought);
}

/** One strike on the target, by attrition, at what the player holds now. */
function fightStrike(d: GameState, reg: ContentRegistry, kind: RaidKind, raid: ActiveRaid): void {
  const balance = reg.world.conflict.raid, combat = raidCombat(d, reg, kind);
  const outcome = resolveRound({ force: strikeForce(raid), ...combat, blow: kind.blow, damage: classDamage(d, raid.target) }, balance);
  addDamage(d, reg, raid.target, outcome.damage);
  const fought = { ...raid, rounds: [...raid.rounds, outcome] };
  d.conflict = { ...d.conflict, raid: fought };
  const target = siteClass(reg, raid.target)?.name ?? raid.target;
  pushLog(d, reg, fmt(balance.logs.round, { name: kind.name, round: roundsFought(fought), hit: percentOf(outcome.hitShare), target,
    points: percentOf(outcome.damage), damage: percentOf(outcome.damageAfter) }), 'WARN');
  if (roundsFought(fought) >= balance.rounds) closeBattle(d, reg, kind, fought);
}

/** The battle's next round: a fleet battle's engagement first, then strikes. */
export function fightNext(d: GameState, reg: ContentRegistry, kind: RaidKind): void {
  const raid = d.conflict.raid;
  if (raid === null) return;
  if (isFleetBattle(kind) && raid.engagement === null) fightEngagement(d, reg, kind, raid);
  else fightStrike(d, reg, kind, raid);
}
