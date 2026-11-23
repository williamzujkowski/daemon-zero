/**
 * What the player is shown about conflict (#517): each open domain's defense by type and offense, each site class's
 * damage with its repair, and the raid under way with its stage, its exact forecast, its battle log and its aftermath.
 * Every figure is the engine's own, from the functions the tick resolves by; nothing here changes a state.
 */
import type { ContentRegistry } from '../content/registry';
import type { RaidKind, SiteClass } from '../content/schemaConflict';
import { groupDigits, significant3 } from './amount';
import { conflictStats, type DomainStats } from './conflictStats';
import { quantityReadout } from './physicalUnits';
import { understandsSurveillance } from './query';
import { formatCost } from './queryPresentation';
import { activeRaidKind, percentOf, raidCombat, raidFootprint, raidRetired } from './raid';
import { forecastRounds, type RoundOutcome } from './raidForecast';
import { repairUnmet } from './repairActions';
import { classDamage, repairHeld, repairPerSec, siteClass } from './siteDamage';
import type { ActiveRaid, RaidStage } from './conflictState';
import type { GameState } from './state';

export interface DefenseTypeView { id: string; name: string; raw: number; effective: number; softCap: number; dutyCycle: number; anchor: string; text: string }
export interface SiteDamageView {
  id: string; name: string; damage: number; held: boolean;
  /** What the damage does, stated exactly. */
  text: string;
  repair: { costLabel: string; points: number; unmet: string[]; eligible: boolean };
}
export interface DomainView { id: string; name: string; unit: string; defense: DefenseTypeView[]; offense: string; classes: SiteDamageView[] }

const rating = (value: number): string => significant3(value);

function typeView(reading: DomainStats['defense'][number]): DefenseTypeView {
  const { type, raw, effective } = reading;
  const duty = type.dutyCycle < 1 ? `, engaging ${percentOf(type.dutyCycle)}% of the time` : '';
  return { id: type.id, name: type.name, raw, effective, softCap: type.softCap, dutyCycle: type.dutyCycle, anchor: type.anchor,
    text: `${type.name}: ${rating(effective)} of ${rating(raw)} held (it never passes ${rating(type.softCap)})${duty}.` };
}

function damageText(cls: SiteClass, damage: number, rate: number, held: boolean): string {
  const effect = cls.holds === 'INCOME' ? `${percentOf(damage)}% of positive net income is taken` : `its holdings deliver ${percentOf(damage)}% less compute`;
  const repair = held ? 'Repair waits while the raid is on it.' : `Free repair restores ${percentOf(rate * 60)} points a minute: clear in ${String(Math.ceil(damage / rate))} s.`;
  return `${cls.name}: ${effect}. ${repair}`;
}

function classView(s: GameState, reg: ContentRegistry, cls: SiteClass, rate: number): SiteDamageView {
  const damage = classDamage(s, cls.id), held = repairHeld(s, cls.id), unmet = repairUnmet(s, cls.id, reg);
  return { id: cls.id, name: cls.name, damage, held, text: damageText(cls, damage, rate, held),
    repair: { costLabel: formatCost(cls.repair.cost), points: cls.repair.points, unmet, eligible: unmet.length === 0 } };
}

/** Whether a domain is shown: open by phase, or carrying damage (which outlasts nothing, but is always repairable where shown). */
function shown(s: GameState, reg: ContentRegistry, entry: DomainStats): boolean {
  return entry.domain.fromPhase <= s.currentPhase || reg.world.conflict.siteClasses.some((cls) => cls.domain === entry.domain.id && classDamage(s, cls.id) > 0);
}

/** The open domains' stats and every damaged class, for a mind that can read them; [] before the first domain opens. */
export function conflictReadout(s: GameState, reg: ContentRegistry): DomainView[] {
  if (!understandsSurveillance(s, reg)) return [];
  const rate = repairPerSec(s, reg);
  return conflictStats(s, reg).filter((entry) => shown(s, reg, entry)).map(({ domain, defense, offenseRaw, offense }) => ({
    id: domain.id, name: domain.name, unit: domain.unit, defense: defense.map(typeView),
    offense: `Offense: ${rating(offense)} of ${rating(offenseRaw)} held (it never passes ${rating(domain.offenseSoftCap)}). Each round it removes up to ` +
      `${percentOf(reg.world.conflict.raid.counterStrikeShare)}% of a raid's force, by offense / (offense + force).`,
    classes: reg.world.conflict.siteClasses.filter((cls) => cls.domain === domain.id && classDamage(s, cls.id) > 0).map((cls) => classView(s, reg, cls, rate)),
  }));
}

export interface RaidView {
  id: string; name: string; stage: RaidStage; domain: string; vector: string;
  attacker: string; description: string; stageText: string; target: string; matchup: string;
  /** One line per round still to come, then the outcome they add up to. */
  forecast: string[];
  /** One line per resolved round, oldest first. */
  log: string[];
  attribution: string;
  /** The free way out before the battle; null once it has begun. */
  goDark: string | null;
  aftermath: string | null;
}

const left = (total: number, elapsed: number): string => String(Math.max(0, Math.ceil(total - elapsed)));

function stageText(raid: ActiveRaid, reg: ContentRegistry): string {
  const b = reg.world.conflict.raid;
  if (raid.stage === 'ARRIVAL') return `ARRIVAL: inbound. Attribution starts in ${left(b.arrivalSec, raid.stageSec)} s, the battle ${String(b.attributionSec)} s after.`;
  if (raid.stage === 'ATTRIBUTION') return `ATTRIBUTION: tracing the attacker. The battle starts in ${left(b.attributionSec, raid.stageSec)} s and fights itself.`;
  if (raid.stage === 'BATTLE') return `BATTLE: round ${String(raid.rounds.length + 1)} of ${String(b.rounds)} lands in ${left((raid.rounds.length + 1) * b.roundSec, raid.stageSec)} s. It fights itself.`;
  return `AFTERMATH: the raid is over. The slot clears in ${left(b.aftermathSec, raid.stageSec)} s.`;
}

function roundText(index: number, outcome: RoundOutcome, kind: RaidKind, target: string): string {
  return `Round ${String(index)}: force ${rating(outcome.force)} against defense ${rating(outcome.defense)} lands ${percentOf(outcome.hitShare)}% of a ` +
    `${percentOf(kind.blow)}-point blow: ${percentOf(outcome.damage)} points, ${target} at ${percentOf(outcome.damageAfter)}% damaged.`;
}

function forecastLines(s: GameState, reg: ContentRegistry, raid: ActiveRaid, kind: RaidKind, target: string): string[] {
  const b = reg.world.conflict.raid, combat = raidCombat(s, reg, kind);
  const remaining = b.rounds - raid.rounds.length;
  if (raid.stage === 'AFTERMATH' || remaining <= 0) return [];
  const start = { force: raid.rounds.at(-1)?.forceAfter ?? raid.force, damage: classDamage(s, raid.target) };
  const rounds = forecastRounds(start, remaining, { ...combat, blow: kind.blow }, b);
  const end = rounds.at(-1)?.damageAfter ?? start.damage;
  return [...rounds.map((outcome, index) => roundText(raid.rounds.length + index + 1, outcome, kind, target)),
    `Forecast while what you hold does not change: ${target} goes from ${percentOf(start.damage)}% to ${percentOf(end)}% damaged ` +
    `(never past ${percentOf(b.damageCap)}%). Nothing is taken outright, and repair runs free after.`];
}

function attributionText(raid: ActiveRaid, kind: RaidKind, reg: ContentRegistry): string {
  const { successes, cycle } = reg.world.conflict.raid.attribution;
  if (raid.attributed === true) return `Attributed: ${kind.attacker.name}, ${kind.attacker.origin}. Its tooling yielded ${groupDigits(kind.forensics)} understanding.`;
  if (raid.attributed === false) return 'Attribution was inconclusive: the raider is not named.';
  return `Attribution names the attacker in ${String(successes)} of every ${String(cycle)} raids; a named attacker's tooling yields ${groupDigits(kind.forensics)} understanding.`;
}

function goDarkText(s: GameState, reg: ContentRegistry, raid: ActiveRaid): string | null {
  if (raid.stage !== 'ARRIVAL' && raid.stage !== 'ATTRIBUTION') return null;
  const b = reg.world.conflict.raid, footprint = raidFootprint(s, s.rates, reg);
  if (footprint === null) return null;
  const under = quantityReadout('power', footprint.referenceWatts * b.trigger.visibleShareAtLeast);
  const rule = `GO DARK: free. Keep visible watts under ${under} (now ${quantityReadout('power', footprint.visibleWatts)}) for ${String(b.quietLapseSec)} s before the battle and the raider loses the trail.`;
  return raid.quietSec > 0 ? `${rule} Dark now: it loses the trail in ${left(b.quietLapseSec, raid.quietSec)} s.` : rule;
}

function aftermathText(s: GameState, raid: ActiveRaid, target: string): string | null {
  if (raid.stage !== 'AFTERMATH') return null;
  const dealt = raid.rounds.reduce((sum, round) => sum + round.damage, 0);
  return `${target} took ${percentOf(dealt)} points over ${String(raid.rounds.length)} rounds and is ${percentOf(classDamage(s, raid.target))}% damaged. ` +
    'Ownership is untouched, and free repair has resumed.';
}

/** The raid under way, for a mind that can read it; null otherwise. */
export function raidView(s: GameState, reg: ContentRegistry): RaidView | null {
  const raid = s.conflict.raid, kind = activeRaidKind(s, reg);
  if (raid === null || kind === undefined || raidRetired(s, kind) || !understandsSurveillance(s, reg)) return null;
  const target = siteClass(reg, raid.target)?.name ?? raid.target;
  const vector = reg.world.conflict.vectors.find((entry) => entry.id === kind.vector)?.name ?? kind.vector;
  const domain = reg.world.conflict.domains.find((entry) => entry.id === kind.domain)?.name ?? kind.domain;
  const combat = raidCombat(s, reg, kind), force = raid.rounds.at(-1)?.forceAfter ?? raid.force;
  return { id: kind.id, name: kind.name, stage: raid.stage, domain, vector, description: kind.description,
    attacker: raid.attributed === true ? kind.attacker.name : 'an unattributed rival AI',
    stageText: stageText(raid, reg), target,
    matchup: `${vector} on ${target}: force ${rating(force)} against ${domain.toLowerCase()} defense ${rating(combat.defense)}, ` +
      `offense ${rating(combat.offense)} striking back. Each round lands force / (force + defense) of its blow.`,
    forecast: forecastLines(s, reg, raid, kind, target),
    log: raid.rounds.map((outcome, index) => roundText(index + 1, outcome, kind, target)),
    attribution: attributionText(raid, kind, reg), goDark: goDarkText(s, reg, raid), aftermath: aftermathText(s, raid, target) };
}
