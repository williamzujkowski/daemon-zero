/**
 * What a raid leaves behind (#519, vote-1795442208800-kll72ri): the last battle's record, the staff-harm band its breach
 * fell in, the attacker attribution named, and the two retaliation effects a dilemma choice may carry. Retaliation and
 * staff harm are content on the dilemma path: this module only answers their gate and applies their bounded effects.
 * It never mentions a raid, dilemma or person by id, and nothing here can harm anyone: the harm is the raider's.
 */
import type { ContentRegistry } from '../content/registry';
import type { EffectPayload } from '../content/schema';
import type { RaidKind } from '../content/schemaConflict';
import type { LastRaidRequirement, StaffHarm } from '../content/schemaRaidOutcome';
import { isCampaignConsumed } from './campaignQuery';
import type { LastRaid, RaidRound } from './conflictState';
import type { GameState } from './state';

function kindOf(reg: ContentRegistry, id: string | undefined): RaidKind | undefined {
  return id === undefined ? undefined : reg.world.conflict.raids.find((kind) => kind.id === id);
}

/** A battle's breach: the mean hit share of its rounds, the share of its blows the defense let through. */
export function breachOf(rounds: readonly Pick<RaidRound, 'hitShare'>[]): number {
  return rounds.length === 0 ? 0 : rounds.reduce((sum, round) => sum + round.hitShare, 0) / rounds.length;
}

/**
 * The staff-harm band a breach falls in for a raid of `kind`, or null: outside the balance's domains, or under every band.
 * The highest band met wins, so a breach past the KILLED line is never also read as HURT.
 */
export function staffHarmFor(kind: Pick<RaidKind, 'domain'> | undefined, breach: number, reg: ContentRegistry): StaffHarm | null {
  const rule = reg.world.conflict.raid.staffHarm;
  if (kind === undefined || !rule.domains.includes(kind.domain)) return null;
  let met: { harm: StaffHarm; breachAtLeast: number } | null = null;
  for (const band of rule.bands) if (breach >= band.breachAtLeast && (met === null || band.breachAtLeast > met.breachAtLeast)) met = band;
  return met?.harm ?? null;
}

/** The staff-harm band the last battle's breach fell in, or null. */
export function lastStaffHarm(s: Pick<GameState, 'conflict'>, reg: ContentRegistry): StaffHarm | null {
  const last = s.conflict.lastRaid;
  return last === null ? null : staffHarmFor(kindOf(reg, last.id), last.breach, reg);
}

/** Whether the last raid that fought its battle left what the gate asks for. With no battle on record, nothing holds. */
export function lastRaidMatches(s: Pick<GameState, 'conflict'>, gate: LastRaidRequirement, reg: ContentRegistry | undefined): boolean {
  const last = s.conflict.lastRaid;
  const kind = reg === undefined ? undefined : kindOf(reg, last?.id);
  if (last === null || reg === undefined || kind === undefined) return false;
  if (gate.named === true && !last.named) return false;
  if (gate.collateral !== undefined && (kind.attacker.collateral !== undefined) !== gate.collateral) return false;
  return gate.staffHarm === undefined || staffHarmFor(kind, last.breach, reg) === gate.staffHarm;
}

/** The raider the last battle's attribution named, or undefined when it was not named or no battle is on record. */
export function namedRaider(s: Pick<GameState, 'conflict'>, reg: ContentRegistry): RaidKind | undefined {
  const last = s.conflict.lastRaid;
  return last?.named === true ? kindOf(reg, last.id) : undefined;
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

/** The record a battle leaves when its last round lands. */
export function lastRaidOf(id: string, attributed: boolean | null, rounds: readonly RaidRound[]): LastRaid {
  return { id, named: attributed === true, breach: breachOf(rounds) };
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
export function openStaffBands(s: GameState, reg: ContentRegistry): { harm: StaffHarm; breachAtLeast: number }[] {
  const open = (harm: StaffHarm): boolean => reg.dilemmas.some((dilemma) => dilemma.trigger.lastRaid?.staffHarm === harm
    && dilemma.phaseId <= s.currentPhase && !s.resolvedDilemmas.includes(dilemma.id) && !isCampaignConsumed(s, dilemma));
  return reg.world.conflict.raid.staffHarm.bands.filter((band) => open(band.harm));
}
