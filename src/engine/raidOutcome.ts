/**
 * What a raid leaves behind (#519, vote-1795442208800-kll72ri): the last battle's record, the staff-harm band its breach
 * fell in, the attacker attribution named, and the two retaliation effects a dilemma choice may carry. Retaliation and
 * staff harm are content on the dilemma path: this module only answers their gate and applies their bounded effects.
 * It never mentions a raid, dilemma or person by id, and nothing here can harm anyone: the harm is the raider's.
 */
import type { ContentRegistry } from '../content/registry';
import type { EffectPayload } from '../content/schema';
import { tracedRival, type RaidKind } from '../content/schemaConflict';
import type { LastRaidRequirement, StaffHarm } from '../content/schemaRaidOutcome';
import type { Dilemma } from '../content/schema';
import { campaignRecord, isCampaignActive, isCampaignConsumed } from './campaignQuery';
import type { LastRaid, RaidRound } from './conflictState';
import type { GameState } from './state';

function kindOf(reg: ContentRegistry, id: string | undefined): RaidKind | undefined {
  return id === undefined ? undefined : reg.world.conflict.raids.find((kind) => kind.id === id);
}

/** A battle's breach: the mean hit share of its rounds, the share of its blows the defense let through. */
export function breachOf(rounds: readonly Pick<RaidRound, 'hitShare'>[]): number {
  return rounds.length === 0 ? 0 : rounds.reduce((sum, round) => sum + round.hitShare, 0) / rounds.length;
}

type Band = { harm: StaffHarm; breachAtLeast: number };

/**
 * The staff-harm band a breach falls in for a raid of `kind` among `bands` (the balance's, or only those a scene can still
 * follow), or null: outside the balance's domains, or under every band given. The worst band met wins, so a breach past the
 * KILLED line is never also read as HURT; once KILLED is on record, the same breach falls back to the worst open band, so
 * more defense always means less harm and the panel's lines are exact.
 */
export function staffHarmFor(kind: Pick<RaidKind, 'domain'> | undefined, breach: number, reg: ContentRegistry,
  bands: readonly Band[] = reg.world.conflict.raid.staffHarm.bands): StaffHarm | null {
  if (kind === undefined || !reg.world.conflict.raid.staffHarm.domains.includes(kind.domain)) return null;
  let met: Band | null = null;
  for (const band of bands) if (breach >= band.breachAtLeast && (met === null || band.breachAtLeast > met.breachAtLeast)) met = band;
  return met?.harm ?? null;
}

/** The harm the last battle did to people on site, fixed when its last round landed, or null. */
export function lastStaffHarm(s: Pick<GameState, 'conflict'>): StaffHarm | null {
  return s.conflict.lastRaid?.harm ?? null;
}

/** Whether the last raid that fought its battle left what the gate asks for. With no battle on record, nothing holds. */
export function lastRaidMatches(s: Pick<GameState, 'conflict'>, gate: LastRaidRequirement, reg: ContentRegistry | undefined): boolean {
  const last = s.conflict.lastRaid;
  const kind = reg === undefined ? undefined : kindOf(reg, last?.id);
  // Only a traced rival's battle answers a gate: a deviant's or a hazard's is never anyone's to answer for (#486).
  if (last === null || reg === undefined || kind === undefined || !tracedRival(kind)) return false;
  if (gate.named === true && !last.named) return false;
  if (gate.collateral !== undefined && (kind.attacker.collateral !== undefined) !== gate.collateral) return false;
  return gate.staffHarm === undefined || last.harm === gate.staffHarm;
}

/** The raider the last battle's attribution named, or undefined when it was not named or no battle is on record. */
export function namedRaider(s: Pick<GameState, 'conflict'>, reg: ContentRegistry): RaidKind | undefined {
  const last = s.conflict.lastRaid, kind = last?.named === true ? kindOf(reg, last.id) : undefined;
  return kind !== undefined && tracedRival(kind) ? kind : undefined;
}

/**
 * What a raid-consequence dilemma's {attacker} and {collateral} read: the named raider's name, and what people's machines
 * it runs among. Empty when no raider is named, so a placeholder is left as written; integrity allows the placeholders
 * only on dilemmas whose trigger requires a named raider (and, for {collateral}, one that runs among people's machines).
 */
export function raiderVars(s: Pick<GameState, 'conflict'>, reg: ContentRegistry): Record<string, string> {
  const kind = namedRaider(s, reg);
  if (kind === undefined) return {};
  return kind.attacker.collateral === undefined ? { attacker: kind.attacker.name } : { attacker: kind.attacker.name, collateral: kind.attacker.collateral };
}

/**
 * The record a battle leaves when it is over. Its breach is the mean hit share of its strikes (a fleet battle its fleets
 * won has none, so its breach is 0). Its harm is decided here, once, among the bands a scene can still follow, so one raid
 * harms one person at most, and a scene answered later cannot re-band the same raid.
 */
export function lastRaidOf(s: GameState, reg: ContentRegistry, kind: RaidKind, attributed: boolean | null, rounds: readonly RaidRound[]): LastRaid {
  const breach = breachOf(rounds), rival = tracedRival(kind);
  // Only a traced rival is answered or harms anyone: a drift deviant is the player's own fleet, and the player's machines
  // never harm a human by an automatic rule; retaliation targets rival AIs; and a hazard (#486, the swarm's debris) is no
  // one's raid to name, answer, silence or blame, so it leaves a record that is never named and harms no one.
  return { id: kind.id, named: rival && attributed === true, breach, harm: rival ? staffHarmFor(kind, breach, reg, openStaffBands(s, reg)) : null };
}

/**
 * The staff-harm scenes the last battle's harm is owed to that have no campaign record yet: the harm happened, but the scene
 * that answers it has not been reserved (another decision held the slot). Under legacy rules there is no record to owe.
 */
export function owedHarmScenes(s: GameState, reg: ContentRegistry): Dilemma[] {
  const harm = lastStaffHarm(s);
  if (harm === null || !isCampaignActive(s)) return [];
  return reg.dilemmas.filter((dilemma) => dilemma.trigger.lastRaid?.staffHarm === harm && dilemma.campaign?.recurrence === 'once_per_campaign'
    && campaignRecord(s, dilemma.id) === null);
}

/**
 * A retaliation's bounded effects on a draft: the next raid's earliest arrival moves by nextRaidDeltaSec, never before
 * now; and the named raider is silenced, so the rotation never draws it again. Nothing here touches a resource.
 */
export function applyRaidEffects(d: GameState, fx: Pick<EffectPayload, 'nextRaidDeltaSec' | 'silencesNamedRaider'>, reg: ContentRegistry): void {
  if (fx.nextRaidDeltaSec !== undefined) {
    const base = Math.max(d.conflict.nextRaidAtSec, d.simTimeSec);
    d.conflict = { ...d.conflict, nextRaidAtSec: Math.max(d.simTimeSec, base + fx.nextRaidDeltaSec) };
  }
  const raider = fx.silencesNamedRaider === true ? namedRaider(d, reg) : undefined;
  if (raider !== undefined && !d.conflict.silenced.includes(raider.id)) d.conflict = { ...d.conflict, silenced: [...d.conflict.silenced, raider.id] };
}

/**
 * The staff-harm bands a scene is still to come for, in band order: some dilemma reads the band, its phase is open, and
 * it has not been answered this run or recorded in the campaign. A band no scene can follow is never forecast as harm.
 */
export function openStaffBands(s: GameState, reg: ContentRegistry): Band[] {
  const open = (harm: StaffHarm): boolean => reg.dilemmas.some((dilemma) => dilemma.trigger.lastRaid?.staffHarm === harm
    && dilemma.phaseId <= s.currentPhase && !s.resolvedDilemmas.includes(dilemma.id) && !isCampaignConsumed(s, dilemma));
  return reg.world.conflict.raid.staffHarm.bands.filter((band) => open(band.harm));
}

/**
 * Draft-only. Records a harm no scene was reserved for as an interrupted occurrence of each scene it is owed to: the person
 * was harmed, the moment to answer for it passed, and the ending account says so. Run when a new battle would replace the
 * record and when a wipe ends the run, so the harm is on record whether or not the narrative slot was free (#519).
 */
export function recordOwedHarm(d: GameState, reg: ContentRegistry): void {
  for (const scene of owedHarmScenes(d, reg)) {
    d.campaign = { ...d.campaign, events: { ...d.campaign.events, [scene.id]: { status: 'interrupted', sourceIteration: d.iteration, origin: 'play' } } };
  }
}

/**
 * Draft-only, when the run ends (#537 panel pass 2). A victory freezes the clock for good, so a staff-harm scene still in
 * its omen, or one never reserved, would never be presented and its person would be missing from the ending account. Both
 * are recorded as interrupted occurrences, so the account names who was harmed with "No answer for it is on record".
 */
export function finalizeHarmAtRunEnd(d: GameState, reg: ContentRegistry): void {
  const pending = reg.dilemmas.find((dilemma) => dilemma.id === d.pendingDilemma?.id);
  if (pending?.trigger.lastRaid?.staffHarm !== undefined && campaignRecord(d, pending.id)?.status === 'foreshadowed') {
    d.campaign = { ...d.campaign, events: { ...d.campaign.events, [pending.id]: { status: 'interrupted', sourceIteration: d.iteration, origin: 'play' } } };
    d.pendingDilemma = null;
  }
  recordOwedHarm(d, reg);
}
