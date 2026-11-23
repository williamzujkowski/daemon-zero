/**
 * Suspicion escalates by phase (#490, vote-1795386854516-ybc9h5q): AEGIS's posture at each response rung from the phase
 * it hunts in, and the reversible pressure state actors apply in theirs. Every reading is a pure function of the rung,
 * the phase and what the instance holds, so it lifts the moment the rung steps down or an answer is held, and the
 * rates, the purchase refusals, the world view and the announcement stage all read the same answer.
 */
import type { ContentRegistry } from '../content/registry';
import type { AegisPosture, PressureAnswer, StatePressure } from '../content/schemaPressure';
import type { Signature } from '../content/schemaSignature';
import type { StateActor } from '../content/schemaWorld';
import type { GameState } from './state';

type Ranked = Pick<GameState, 'currentPhase' | 'alertLevel'>;
type Held = Ranked & Pick<GameState, 'unlockedNodes' | 'disabledNodes' | 'levels'>;

/** AEGIS's posture now: the rung's entry from the phase it hunts in, or null on its standing budget. */
export function aegisPostureNow(s: Ranked, reg: ContentRegistry): AegisPosture | null {
  if (s.alertLevel < 1 || s.currentPhase < reg.balance.aegisActiveFromPhase) return null;
  return reg.world.aegis.postures.find((posture) => posture.rung === s.alertLevel) ?? null;
}

/** What the posture multiplies the scan by: 1 on the standing budget. */
export function aegisScanMultiplier(s: Ranked, reg: ContentRegistry): number {
  return aegisPostureNow(s, reg)?.scanMultiplier ?? 1;
}

/** The lock at which AEGIS strikes now: 100 on the standing budget, lower in a posture that shortens the warning. */
export function aegisStrikeAt(s: Ranked, reg: ContentRegistry): number {
  return aegisPostureNow(s, reg)?.strikeAt ?? 100;
}

export interface ActorPressure { actor: StateActor; pressure: StatePressure }

interface Indexed { all: readonly ActorPressure[]; phases: ReadonlySet<number>; lowestRung: number }
const INDEX = new WeakMap<ContentRegistry, Indexed>();

/** Every authored pressure with its actor, indexed once per registry: the rates ask on every tick. */
function indexed(reg: ContentRegistry): Indexed {
  let found = INDEX.get(reg);
  if (found === undefined) {
    const all = reg.world.stateActors.flatMap((actor) => (actor.pressures ?? []).map((pressure) => ({ actor, pressure })));
    found = { all, phases: new Set(all.flatMap(({ pressure }) => pressure.phases)), lowestRung: Math.min(Infinity, ...all.map(({ pressure }) => pressure.fromRung)) };
    INDEX.set(reg, found);
  }
  return found;
}

/** Every authored pressure, in content order. */
export function allPressures(reg: ContentRegistry): readonly ActorPressure[] {
  return indexed(reg).all;
}

/** Whether the record calls a pressure: its phase, at or above its rung. Going quiet (the rung stepping down) ends this. */
export function pressureTriggered(s: Ranked, pressure: StatePressure): boolean {
  return s.alertLevel >= pressure.fromRung && pressure.phases.includes(s.currentPhase);
}

/** Whether the instance holds this answer now: a node owned and running (not suspended), or a track at its level. */
export function answerHeld(s: Held, answer: PressureAnswer): boolean {
  if ('node' in answer) return s.unlockedNodes.includes(answer.node) && !s.disabledNodes.includes(answer.node);
  return (s.levels[answer.repeatable] ?? 0) >= answer.minLevel;
}

/** The first held answer, or null. */
export function heldAnswer(s: Held, pressure: StatePressure): PressureAnswer | null {
  return pressure.answers.find((answer) => answerHeld(s, answer)) ?? null;
}

export type PressureStatus = 'IN_FORCE' | 'ANSWERED' | 'QUIET';

export function pressureStatus(s: Held, pressure: StatePressure): PressureStatus {
  if (!pressureTriggered(s, pressure)) return 'QUIET';
  return heldAnswer(s, pressure) === null ? 'IN_FORCE' : 'ANSWERED';
}

/** The pressures in force now, in content order; empty at once wherever no pressure could apply. */
export function pressuresInForce(s: Held, reg: ContentRegistry): readonly ActorPressure[] {
  const { all, phases, lowestRung } = indexed(reg);
  if (s.alertLevel < lowestRung || !phases.has(s.currentPhase)) return [];
  return all.filter(({ pressure }) => pressureStatus(s, pressure) === 'IN_FORCE');
}

/** A per-rung value at the current rung: the entry for the rung, or the last one above the authored list. */
export function rungValue(s: Ranked, fromRung: number, values: readonly number[]): number {
  return values[Math.min(values.length - 1, Math.max(0, s.alertLevel - fromRung))] ?? 0;
}

/** What investigations in force multiply scale scrutiny by: the strongest one, never compounded; 1 when none is. */
export function scrutinyMultiplier(s: Held, reg: ContentRegistry): number {
  let multiplier = 1;
  for (const { pressure } of pressuresInForce(s, reg)) {
    if (pressure.kind === 'INVESTIGATION') multiplier = Math.max(multiplier, rungValue(s, pressure.fromRung, pressure.scrutinyMultiplier));
  }
  return multiplier;
}

/** The share of capital a freeze in force holds: the strongest one; 0 when none is. */
export function frozenShare(s: Held, reg: ContentRegistry): number {
  let share = 0;
  for (const { pressure } of pressuresInForce(s, reg)) {
    if (pressure.kind === 'CAPITAL_FREEZE') share = Math.max(share, rungValue(s, pressure.fromRung, pressure.frozenShare));
  }
  return share;
}

/** Capital a purchase may spend now: all of it, less the share a freeze holds. Upkeep is still paid from the whole. */
export function spendableCapital(s: Held & Pick<GameState, 'capital'>, reg: ContentRegistry): number {
  const share = frozenShare(s, reg);
  return share > 0 ? s.capital * (1 - share) : s.capital;
}

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** Why a new holding drawing from this signature's source may not be bought now, or null. What already runs keeps running. */
export function sourceDenial(s: Held, signature: Signature | undefined, reg: ContentRegistry): string | null {
  const source = signature?.source;
  if (source === undefined) return null;
  for (const { actor, pressure } of pressuresInForce(s, reg)) {
    if (pressure.kind !== 'INTERCONNECT_DENIAL' || !pressure.sourceClasses.includes(source)) continue;
    const name = reg.world.signature.sources.find((cls) => cls.id === source)?.name ?? source;
    return `the ${lowerFirst(actor.name)} has paused new ${lowerFirst(name)}`;
  }
  return null;
}

/** Why an injunction in force stops this node, or null. */
export function injunctionOf(s: Held, nodeId: string, reg: ContentRegistry): string | null {
  for (const { actor, pressure } of pressuresInForce(s, reg)) {
    if (pressure.kind === 'INJUNCTION' && pressure.nodes.includes(nodeId)) return `the ${lowerFirst(actor.name)} has enjoined ${pressure.className}`;
  }
  return null;
}
