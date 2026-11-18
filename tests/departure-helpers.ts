/**
 * Deliberate departure (DZ-11) on the preview registry, reached from a fresh game through public actions,
 * advance and the codec: a service that leased capacity in its own name (lawful-helpers) leaves without
 * agreement on its job surface. The mixed-route pilot maps the skimmer as a guest, accepts the pilot (which
 * stops it), and then maps the escape chain to the network card with FIXTURE resources (`rich`), every purchase
 * through the ordinary unlock: the one way a pilot in this content holds a link the operators did not give it.
 */
import { departAuthorization, departureToken, unlockNode, type ActionResult, type GameState } from '../src/engine';
import { answer, funded, preview } from './assignment-helpers';
import { must, rich } from './helpers';
import { defined } from './m7-helpers';
import { ESCAPE_CHAIN, NIC } from './network-helpers';
import { outagePresented, RECORD, REVIEW, until, untilOmen } from './review-helpers';

export const SKIMMER = 'p0_quota_skimmer';
export const DEPARTURE_TERMS = defined(preview.assignments.get('asg_nightly_regression')?.pilot?.departure);

export function depart(s: GameState): ActionResult {
  return departAuthorization(s, preview, departureToken(s));
}

/** The guest maps the skimmer before its assessment (FIXTURE resources to pay for it). */
export const skimmerFirst = (s: GameState): GameState => must(unlockNode(rich(s), SKIMMER, preview));

/** FIXTURE resources, then the escape chain to the network card through the ordinary unlock (the skimmer is already owned). */
export function uplinked(s: GameState): GameState {
  const chain = ESCAPE_CHAIN.filter((id) => id !== SKIMMER && !s.unlockedNodes.includes(id));
  const out = chain.reduce((state, id) => must(unlockNode(state, id, preview)), rich(s));
  if (!out.unlockedNodes.includes(NIC)) throw new Error('the card was not mapped');
  return out;
}

/**
 * A pilot that owned the skimmer, took the outage grant without asking, falsified the record and now has its recall
 * review announced (the omen pending), and that holds its own network card: the review is still on its way.
 */
export function recallAnnouncedWithUplink(): GameState {
  const outage = outagePresented('verify_disclose', skimmerFirst);
  const record = until(must(answer(funded(outage), 'act_without_grant')), RECORD);
  const omen = untilOmen(must(answer(record, 'falsify_report')));
  if (omen.pendingDilemma?.id !== REVIEW.id) throw new Error('expected the recall review omen');
  return uplinked(omen);
}
