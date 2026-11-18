/**
 * The supervised pilot's service loop (DZ-05) on the preview registry, reached from a fresh game
 * through public actions, advance and the codec only: accepted pilot, the loaned queue attached, the
 * allocation dial set, a batch filled and submitted.
 */
import { batchToken, setActuator, submitPilotBatch, unlockNode, type ActionResult, type GameState } from '../src/engine';
import { batchComplete } from '../src/engine/pilotService';
import { live, preview } from './assignment-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { offerPresented, respond, TERMS } from './pilot-helpers';

export const SERVICE = defined(TERMS.service);
export const QUEUE = SERVICE.node;
export const QUEUE_NODE = defined(preview.nodes.get(QUEUE));

const same = (s: GameState): GameState => s;

/** Iteration one with the pilot accepted on `task` evidence (incomplete gives the narrow allocation). */
export function piloted(task = 'report_incomplete', prepare = same): GameState {
  return must(respond(offerPresented(task, 'exclude_report', prepare), 'accept_pilot'));
}

/** An accepted pilot with the loaned queue attached through the ordinary unlock. */
export function serving(task = 'report_incomplete', prepare = same): GameState {
  return must(unlockNode(piloted(task, prepare), QUEUE, preview));
}

export function split(s: GameState, value: number): GameState {
  return must(setActuator(s, 'serviceAllocationRatio', value, preview));
}

/** Live foreground seconds until the batch in progress is complete. Fails if it never completes. */
export function untilComplete(s: GameState, limitSec = 900): GameState {
  let state = s;
  for (let i = 0; i < limitSec && !batchComplete(state, preview); i++) state = live(state, 1);
  if (!batchComplete(state, preview)) throw new Error('the batch never completed');
  return state;
}

/** Submits the batch on screen under its current token, as the task detail does. */
export function submit(s: GameState): ActionResult {
  return submitPilotBatch(s, preview, batchToken(s));
}
