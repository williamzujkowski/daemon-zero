/**
 * The answers to a hostile mind (#491): QUARANTINE (pays, ends it now), DECOY (pays, holds its effect off for decoySec)
 * and PURGE (free, deterministic from state: exactly `successes` of every `cycle` attempts succeed; a failure applies
 * its declared cost and the hostile stays). Going quiet needs no control: the hostile lapses by itself. One gate per
 * answer, shared by the action and the view, so no caller can take an answer a player could not reach.
 */
import type { ContentRegistry } from '../content/registry';
import type { Cost } from '../content/schema';
import type { HostileEncounter } from '../content/schemaHostile';
import type { ActionResult } from './actions';
import { OPERATIONAL_EVIDENCE } from './campaign';
import { decoyHostile, endHostile, hostileRetired, purgeSucceeds } from './hostile';
import { activeHostile } from './hostileEffect';
import { tierCost } from './phasePrice';
import { canAfford, responseRungFor } from './query';
import { aegisStrikeAt } from './statePressure';
import { formatCost, pausedReason } from './queryPresentation';
import type { GameState } from './state';
import { applyEffects, payCost } from './transactions';
import { pushLog } from './util';

export type HostileAnswer = 'QUARANTINE' | 'DECOY' | 'PURGE';
export const HOSTILE_ANSWERS: readonly HostileAnswer[] = ['QUARANTINE', 'DECOY', 'PURGE'];

const NO_HOSTILE = 'No hostile mind is pressing this instance.';
const DECOY_OUT = 'A decoy already holds it off.';
const PURGE_ENDS_RUN = 'A failed purge now would end this run.';

/** The hostile an answer acts on: active and of a tier that has not retired. */
function answerable(s: GameState, reg: ContentRegistry): HostileEncounter | undefined {
  const encounter = activeHostile(s, reg);
  return encounter && !hostileRetired(s, encounter) ? encounter : undefined;
}

/** What an answer costs now: the declared price for QUARANTINE and DECOY carried from its tier's phase (#494); PURGE is free. */
export function hostileAnswerCost(s: Pick<GameState, 'currentPhase'>, encounter: HostileEncounter, answer: HostileAnswer, reg: ContentRegistry): Cost | null {
  if (answer === 'PURGE') return null;
  return tierCost(s, answer === 'QUARANTINE' ? encounter.quarantine.cost : encounter.decoy.cost, encounter.tier, reg);
}

/**
 * Whether a failed purge would carry suspicion to 100, or the lock to where AEGIS strikes at the rung the failure leaves
 * (#490: a higher rung can shorten the warning), where the run ends.
 */
function purgeWouldEndRun(s: GameState, encounter: HostileEncounter, reg: ContentRegistry): boolean {
  const { failure } = encounter.purge;
  const suspicion = s.suspicion + failure.suspicionDelta;
  const strikeAt = aegisStrikeAt({ currentPhase: s.currentPhase, alertLevel: Math.max(s.alertLevel, responseRungFor(suspicion, reg)) }, reg);
  return suspicion >= 100 || s.aegisLock + failure.aegisLockDelta >= strikeAt;
}

/** Every reason this answer is not offered now, in order, or none. */
export function hostileAnswerUnmet(s: GameState, answer: HostileAnswer, reg: ContentRegistry): string[] {
  const unmet = pausedReason(s), encounter = answerable(s, reg);
  if (!encounter) return [...unmet, NO_HOSTILE];
  if (answer === 'DECOY' && (s.hostile.active?.decoySec ?? 0) > 0) unmet.push(DECOY_OUT);
  if (answer === 'PURGE' && purgeWouldEndRun(s, encounter, reg)) unmet.push(PURGE_ENDS_RUN);
  const cost = hostileAnswerCost(s, encounter, answer, reg);
  if (cost && !canAfford(s, cost, reg)) unmet.push('Insufficient resources: ' + formatCost(cost));
  return unmet;
}

function purge(d: GameState, encounter: HostileEncounter, reg: ContentRegistry): void {
  const success = purgeSucceeds(d.hostile.purges, reg);
  d.hostile = { ...d.hostile, purges: d.hostile.purges + 1 };
  // A fight with a population is iteration-local evidence, like a cohort command.
  applyEffects(d, success ? encounter.purge.success : encounter.purge.failure, reg, OPERATIONAL_EVIDENCE);
  if (success) endHostile(d, reg, null);
}

/** Answers the hostile pressing this instance. */
export function answerHostile(s: GameState, answer: HostileAnswer, reg: ContentRegistry): ActionResult {
  const [reason] = hostileAnswerUnmet(s, answer, reg), encounter = answerable(s, reg);
  if (reason !== undefined || !encounter) return { ok: false, state: s, reason: reason ?? NO_HOSTILE };
  const d: GameState = { ...s };
  const cost = hostileAnswerCost(s, encounter, answer, reg);
  if (cost) payCost(d, cost);
  if (answer === 'QUARANTINE') endHostile(d, reg, encounter.quarantine.log);
  else if (answer === 'DECOY') { decoyHostile(d, reg); pushLog(d, reg, encounter.decoy.log, 'LORE'); }
  else purge(d, encounter, reg);
  return { ok: true, state: d };
}
