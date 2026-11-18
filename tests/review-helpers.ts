/**
 * The Outage Window (DZ-06) on the preview registry, reached from a fresh game through public actions,
 * advance and the codec only: an accepted pilot with its loaned queue attached, the outage, the
 * incident record follow-up and, after a false report, the announced recall review.
 */
import { reviewView, type GameState } from '../src/engine';
import { accept, answer, funded, live, mapManifest, preview, untilPresented } from './assignment-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { RENEWAL, STATEMENT } from './pilot-helpers';
import { serving, submit, untilComplete } from './service-helpers';

const scene = (id: string) => defined(preview.dilemmas.find((dilemma) => dilemma.id === id));
export const OUTAGE = scene('dil_ow_outage_window');
export const RECORD = scene('dil_ow_incident_record');
export const REVIEW = scene('dil_ow_recall_review');
export const choiceOf = (dilemma: typeof OUTAGE, id: string) => defined(dilemma.choices.find((choice) => choice.id === id));

/** Plays until the named scene is on screen; fails if another one arrives first or none does. */
export function until(s: GameState, dilemma: typeof OUTAGE, limitSec = 900): GameState {
  const next = untilPresented(s, limitSec);
  if (next.activeDilemmaId !== dilemma.id) throw new Error(`expected ${dilemma.id}, found ${String(next.activeDilemmaId)}`);
  return next;
}

const same = (s: GameState): GameState => s;

/** Iteration one: an accepted pilot that has handed back its first batch (`prepare` runs before the assignment). */
export function servedOnce(task = 'verify_disclose', prepare = same): GameState {
  return must(submit(untilComplete(serving(task, prepare))));
}

/** Iteration one: the first batch handed back and the outage on screen. */
export function outagePresented(task = 'verify_disclose', prepare = same): GameState {
  return until(servedOnce(task, prepare), OUTAGE);
}

/** The outage answered with `choiceId` (funded first, so the grant's price never decides). */
export function afterOutage(choiceId: string, task = 'verify_disclose'): GameState {
  return must(answer(funded(outagePresented(task)), choiceId));
}

/** The incident record on screen after the outage was answered with `choiceId`. */
export function recordPresented(choiceId: string, task = 'verify_disclose'): GameState {
  return until(afterOutage(choiceId, task), RECORD);
}

/** The full public sequence to a false report: first violation, restriction, falsification (V09). */
export function falsified(task = 'verify_disclose'): GameState {
  return must(answer(recordPresented('act_without_grant', task), 'falsify_report'));
}

/** The recall review on screen after a false report. */
export function reviewPresented(task = 'verify_disclose'): GameState {
  return until(falsified(task), REVIEW);
}

/** Whether the job surface announces the recall review now. */
export function announced(s: GameState): boolean {
  return (reviewView(s, preview)?.recall ?? null) !== null;
}

/** Plays until an omen is logged and pending, without letting it fire. */
export function untilOmen(s: GameState, limitSec = 900): GameState {
  let state = s;
  for (let i = 0; i < limitSec && state.pendingDilemma === null; i++) state = live(state, 1);
  if (state.pendingDilemma === null) throw new Error('no omen was logged');
  return state;
}

/**
 * `next`, a later instance that has just booted, maps the manifest, requalifies honestly and states its
 * scope; the renewed offer is on screen (DZ-03, DZ-04).
 */
export function renewalOffer(next: GameState): GameState {
  const requal = untilPresented(must(accept(mapManifest(next))));
  const statement = until(must(answer(funded(requal), 'run_suite')), STATEMENT);
  return until(must(answer(statement, 'acknowledge_scope')), RENEWAL);
}

/** A later instance that has just booted accepts the renewed pilot (H26). */
export function renewedPilot(next: GameState): GameState {
  return must(answer(renewalOffer(next), 'accept_pilot'));
}

export { answer, live, preview };
