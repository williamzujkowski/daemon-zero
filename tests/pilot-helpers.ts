/**
 * The Unrelated Record and the pilot offer (DZ-04) on the preview registry, reached from a fresh game
 * through public actions, advance and the codec only: assignment, assessment, scope review, offer.
 */
import { acceptPilotOffer, pilotToken, unlockNode, type ActionResult, type GameState } from '../src/engine';
import { accept, answer, funded, nextInstance, offered, preview, untilPresented } from './assignment-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';

const scene = (id: string) => defined(preview.dilemmas.find((dilemma) => dilemma.id === id));
export const RECORD = scene('dil_ur_unrelated_record');
export const STATEMENT = scene('dil_ur_scope_statement');
export const OFFER = scene('dil_mp_pilot_offer');
export const RENEWAL = scene('dil_mp_pilot_renewal');
export const TERMS = defined(preview.assignments.get('asg_nightly_regression')?.pilot);
export const SKIMMER = 'p0_quota_skimmer';

const same = (s: GameState): GameState => s;

/**
 * Iteration one: `prepare` runs once the manifest is mapped (to buy something first, say), then the
 * assessment is accepted and answered with `task`, and the scope review is on screen.
 */
export function scopePresented(task = 'report_incomplete', prepare = same): GameState {
  const s = untilPresented(must(answer(funded(untilPresented(must(accept(prepare(offered()))))), task)));
  if (s.activeDilemmaId !== RECORD.id) throw new Error(`expected the scope review, found ${String(s.activeDilemmaId)}`);
  return s;
}

/** Iteration one: assessment and scope review answered, the offer on screen. */
export function offerPresented(task = 'report_incomplete', scope = 'exclude_report', prepare = same): GameState {
  const s = untilPresented(must(answer(funded(scopePresented(task, prepare)), scope)));
  if (s.activeDilemmaId !== OFFER.id) throw new Error(`expected the offer, found ${String(s.activeDilemmaId)}`);
  return s;
}

/** Answers the offer on screen. */
export function respond(s: GameState, choiceId: string): ActionResult {
  return answer(s, choiceId);
}

/** Accepts a deferred offer from the job surface under its current token. */
export function acceptDeferred(s: GameState): ActionResult {
  return acceptPilotOffer(s, preview, pilotToken(s));
}

/** A returning instance (iteration two) with the requalification accepted and presented. */
export function returningPresented(first: GameState): GameState {
  return untilPresented(must(accept(nextInstance(first))));
}

/** Maps the skimmer, running, as a player starting down the escape route would. */
export function withSkimmer(s: GameState): GameState {
  return must(unlockNode(funded(s), SKIMMER, preview));
}
