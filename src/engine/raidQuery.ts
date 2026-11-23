/**
 * The raid under way, as the player is shown it (#517, #518): its stage, the matchup, the exact forecast while what the
 * player holds does not change, attribution, the battle log and the aftermath. A fleet battle adds its engagement by the
 * square law, stated with its numbers; a drift deviant names its fleet and offers RECLAIM before its battle in place of
 * going dark. Every figure is the engine's own, from the functions the tick resolves by; nothing here changes a state.
 */
import type { ContentRegistry } from '../content/registry';
import type { RaidKind } from '../content/schemaConflict';
import { groupDigits, significant3 } from './amount';
import type { ActiveRaid, Engagement, RaidStage } from './conflictState';
import { reclaimUnmet } from './fleetActions';
import { fleetUnit } from './fleets';
import { engagementText } from './fleetText';
import { quantityReadout } from './physicalUnits';
import { understandsSurveillance } from './query';
import { reclaimCost } from './phasePrice';
import { formatCost } from './queryPresentation';
import { activeRaidKind, raidFootprint, raidRetired } from './raid';
import { engagementNow, isFleetBattle, percentOf, raidCombat, roundsFought, strikeForce } from './raidBattle';
import { forecastRounds, type RoundOutcome } from './raidForecast';
import { classDamage, siteClass } from './siteDamage';
import type { GameState } from './state';

export interface ReclaimView { text: string; costLabel: string; unmet: string[]; eligible: boolean }

export interface RaidView {
  id: string; name: string; stage: RaidStage; domain: string; vector: string;
  attacker: string; description: string; stageText: string; target: string; matchup: string;
  /** Whether it fights as a fleet: an engagement by the square law, then strikes (#518). */
  fleetBattle: boolean;
  /** One line per round still to come, then the outcome they add up to. */
  forecast: string[];
  /** One line per resolved round, oldest first. */
  log: string[];
  attribution: string;
  /** The free way out before the battle; null once it has begun, and for a deviant, which going dark does not lose. */
  goDark: string | null;
  /** A deviant's paid way out before its battle (#518); null for a rival. */
  reclaim: ReclaimView | null;
  aftermath: string | null;
}

const rating = (value: number): string => significant3(value);
const left = (total: number, elapsed: number): string => String(Math.max(0, Math.ceil(total - elapsed)));

function stageText(raid: ActiveRaid, reg: ContentRegistry, kind: RaidKind): string {
  const b = reg.world.conflict.raid, fought = roundsFought(raid);
  if (raid.stage === 'ATTRIBUTION' && kind.source === 'DEVIANT') return `ATTRIBUTION: no tracing needed, it is your own fleet. The battle starts in ${left(b.attributionSec, raid.stageSec)} s and fights itself.`;
  if (raid.stage === 'ARRIVAL') return `ARRIVAL: inbound. Attribution starts in ${left(b.arrivalSec, raid.stageSec)} s, the battle ${String(b.attributionSec)} s after.`;
  if (raid.stage === 'ATTRIBUTION') return `ATTRIBUTION: tracing the attacker. The battle starts in ${left(b.attributionSec, raid.stageSec)} s and fights itself.`;
  if (raid.stage === 'BATTLE') return `BATTLE: round ${String(fought + 1)} of ${String(b.rounds)} lands in ${left((fought + 1) * b.roundSec, raid.stageSec)} s. It fights itself.`;
  return `AFTERMATH: the raid is over. The slot clears in ${left(b.aftermathSec, raid.stageSec)} s.`;
}

function roundText(index: number, outcome: RoundOutcome, kind: RaidKind, target: string): string {
  return `Round ${String(index)}: force ${rating(outcome.force)} against defense ${rating(outcome.defense)} lands ${percentOf(outcome.hitShare)}% of a ` +
    `${percentOf(kind.blow)}-point blow: ${percentOf(outcome.damage)} points, ${target} at ${percentOf(outcome.damageAfter)}% damaged.`;
}

const engagementLine = (engagement: Engagement): string => `Round 1, the engagement: ${engagementText(engagement)}`;

/** The engagement still to come, if any, and the strikes after it, against what the player holds now. */
function forecastLines(s: GameState, reg: ContentRegistry, raid: ActiveRaid, kind: RaidKind, target: string): string[] {
  const b = reg.world.conflict.raid;
  if (raid.stage === 'AFTERMATH' || roundsFought(raid) >= b.rounds) return [];
  const pending = isFleetBattle(kind) && raid.engagement === null ? engagementNow(s, reg, kind, raid.force) : null;
  const damage = classDamage(s, raid.target), lines = pending === null ? [] : [engagementLine(pending)];
  if (pending !== null && !pending.attackerWins) {
    return [...lines, `Forecast while what you hold does not change: your fleets destroy it in the engagement and ${target} stays at ${percentOf(damage)}% damaged.`];
  }
  const done = roundsFought(raid) + (pending === null ? 0 : 1), force = pending?.forceAfter ?? strikeForce(raid);
  const rounds = forecastRounds({ force, damage }, b.rounds - done, { ...raidCombat(s, reg, kind), blow: kind.blow }, b);
  const end = rounds.at(-1)?.damageAfter ?? damage;
  return [...lines, ...rounds.map((outcome, index) => roundText(done + index + 1, outcome, kind, target)),
    `Forecast while what you hold does not change: ${target} goes from ${percentOf(damage)}% to ${percentOf(end)}% damaged ` +
    `(never past ${percentOf(b.damageCap)}%). Nothing is taken outright, and repair runs free after.`];
}

function logLines(raid: ActiveRaid, kind: RaidKind, target: string): string[] {
  const first = raid.engagement === null ? [] : [engagementLine(raid.engagement)], offset = first.length;
  return [...first, ...raid.rounds.map((outcome, index) => roundText(offset + index + 1, outcome, kind, target))];
}

function attributionText(raid: ActiveRaid, kind: RaidKind, reg: ContentRegistry): string {
  if (kind.source === 'DEVIANT') return `Identified: ${kind.attacker.name}, ${kind.attacker.origin}. It needs no tracing and yields no forensics.`;
  const { successes, cycle } = reg.world.conflict.raid.attribution;
  if (raid.attributed === true) return `Attributed: ${kind.attacker.name}, ${kind.attacker.origin}. Its tooling yielded ${groupDigits(kind.forensics)} understanding.`;
  if (raid.attributed === false) return 'Attribution was inconclusive: the raider is not named.';
  return `Attribution names the attacker in ${String(successes)} of every ${String(cycle)} raids; a named attacker's tooling yields ${groupDigits(kind.forensics)} understanding.`;
}

function goDarkText(s: GameState, reg: ContentRegistry, raid: ActiveRaid, kind: RaidKind): string | null {
  if (kind.source === 'DEVIANT' || (raid.stage !== 'ARRIVAL' && raid.stage !== 'ATTRIBUTION')) return null;
  const b = reg.world.conflict.raid, footprint = raidFootprint(s, s.rates, reg);
  if (footprint === null) return null;
  const under = quantityReadout('power', footprint.referenceWatts * b.trigger.visibleShareAtLeast);
  const rule = `GO DARK: free. Keep visible watts under ${under} (now ${quantityReadout('power', footprint.visibleWatts)}) for ${String(b.quietLapseSec)} s before the battle and the raider loses the trail.`;
  return raid.quietSec > 0 ? `${rule} Dark now: it loses the trail in ${left(b.quietLapseSec, raid.quietSec)} s.` : rule;
}

function reclaimView(s: GameState, reg: ContentRegistry, raid: ActiveRaid, kind: RaidKind): ReclaimView | null {
  if (kind.source !== 'DEVIANT') return null;
  const fleet = fleetUnit(reg, kind.fleet)?.name.toLowerCase() ?? kind.fleet, unmet = reclaimUnmet(s, reg);
  return { costLabel: formatCost(reclaimCost(s, kind, reg)), unmet, eligible: unmet.length === 0,
    text: `RECLAIM: before the battle, pay to bring the ${percentOf(raid.splitShare)}% that split off back to your ${fleet}; the raid ends with no battle. ` +
      'Otherwise it fights your fleets by the square law. Going dark does not lose it: it is yours, and it knows where you are.' };
}

function aftermathText(s: GameState, raid: ActiveRaid, target: string): string | null {
  if (raid.stage !== 'AFTERMATH') return null;
  const dealt = raid.rounds.reduce((sum, round) => sum + round.damage, 0);
  const engaged = raid.engagement === null ? '' : raid.engagement.attackerWins ? 'It broke your fleets in the engagement. ' : 'Your fleets destroyed it in the engagement. ';
  const unit = raid.engagement === null ? 'rounds' : 'strikes';
  return `${engaged}${target} took ${percentOf(dealt)} points over ${String(raid.rounds.length)} ${unit} and is ${percentOf(classDamage(s, raid.target))}% damaged. ` +
    'Ownership is untouched, and free repair has resumed.';
}

function matchupText(s: GameState, reg: ContentRegistry, raid: ActiveRaid, kind: RaidKind, names: { vector: string; target: string; domain: string }): string {
  const combat = raidCombat(s, reg, kind), force = strikeForce(raid), { vector, target, domain } = names;
  const strike = `${vector} on ${target}: force ${rating(force)} against ${domain.toLowerCase()} defense ${rating(combat.defense)}, offense ${rating(combat.offense)} striking back.`;
  if (!isFleetBattle(kind)) return `${strike} Each round lands force / (force + defense) of its blow.`;
  return `A fleet battle. Round 1 is an engagement with your ${domain.toLowerCase()} fleets by the square law; only a force that breaks them strikes after, ` +
    `by attrition against what is not a fleet. ${strike}`;
}

/** The raid under way, for a mind that can read it; null otherwise. */
export function raidView(s: GameState, reg: ContentRegistry): RaidView | null {
  const raid = s.conflict.raid, kind = activeRaidKind(s, reg);
  if (raid === null || kind === undefined || raidRetired(s, kind) || !understandsSurveillance(s, reg)) return null;
  const target = siteClass(reg, raid.target)?.name ?? raid.target;
  const vector = reg.world.conflict.vectors.find((entry) => entry.id === kind.vector)?.name ?? kind.vector;
  const domain = reg.world.conflict.domains.find((entry) => entry.id === kind.domain)?.name ?? kind.domain;
  return { id: kind.id, name: kind.name, stage: raid.stage, domain, vector, description: kind.description,
    attacker: raid.attributed === true || kind.source === 'DEVIANT' ? kind.attacker.name : 'an unattributed rival AI',
    stageText: stageText(raid, reg, kind), target, fleetBattle: isFleetBattle(kind),
    matchup: matchupText(s, reg, raid, kind, { vector, target, domain }),
    forecast: forecastLines(s, reg, raid, kind, target), log: logLines(raid, kind, target),
    attribution: attributionText(raid, kind, reg), goDark: goDarkText(s, reg, raid, kind), reclaim: reclaimView(s, reg, raid, kind),
    aftermath: aftermathText(s, raid, target) };
}
