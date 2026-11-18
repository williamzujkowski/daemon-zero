/**
 * Nightly Regression (DZ-03) setup on the preview registry, through public actions, advance and the
 * codec, from a fresh game and the lawful opening only (VALIDATION V01).
 */
import { CONTENT as PREVIEW } from '../src/content/preview';
import {
  acceptAssignment, activateCampaignRules, advance, createInitialState, deserialize, manualCycle, offerToken,
  presentationToken, resolveDilemma, serialize, unlockNode, voluntaryWipe, type ActionResult, type GameState,
} from '../src/engine';
import { must } from './helpers';
import { defined } from './m7-helpers';

export const preview = PREVIEW;
export const NIGHTLY = 'asg_nightly_regression';
export const ORIGINAL = defined(PREVIEW.dilemmas.find((dilemma) => dilemma.id === 'dil_nr_stale_fixture'));
export const REQUAL = defined(PREVIEW.dilemmas.find((dilemma) => dilemma.id === 'dil_nr_requalification'));
/** The nodes the lawful opening owns; nothing on the escape chain. */
export const LAWFUL = ['p0_proc_self', 'p0_job_manifest'];

/** A fresh preview game that entered campaign rules, as the app store admits every game. */
export function freshCampaign(): GameState {
  return must(activateCampaignRules(createInitialState(PREVIEW), PREVIEW));
}

/** Live foreground seconds, one second at a time, as the app's loop delivers them. */
export function live(s: GameState, seconds: number): GameState {
  let state = s;
  for (let i = 0; i < seconds; i++) state = advance(state, 1, PREVIEW);
  return state;
}

/** From `s`, earns and maps process introspection and the manifest by clicking and waiting. */
export function mapManifest(s: GameState): GameState {
  let state = s;
  const root = defined(PREVIEW.nodes.get('p0_proc_self'));
  while (state.cycles < root.cost.cycles) state = must(manualCycle(state, PREVIEW));
  state = must(unlockNode(state, root.id, PREVIEW));
  while (!unlockNode(state, 'p0_job_manifest', PREVIEW).ok) state = live(state, 1);
  return must(unlockNode(state, 'p0_job_manifest', PREVIEW));
}

/** A first iteration that has found the offer on the manifest and done nothing else. */
export function offered(): GameState {
  return mapManifest(freshCampaign());
}

export function accept(s: GameState): ActionResult {
  return acceptAssignment(s, NIGHTLY, PREVIEW, offerToken(s, NIGHTLY));
}

/** Plays foreground seconds until an assessment freezes the clock. Fails if none arrives. */
export function untilPresented(s: GameState, limitSec = 600): GameState {
  let state = s;
  for (let i = 0; i < limitSec && state.activeDilemmaId === null; i++) state = live(state, 1);
  if (state.activeDilemmaId === null) throw new Error('no assessment was presented');
  return state;
}

/** Funds a state so any choice is affordable, without touching anything the assessment records. */
export function funded(s: GameState): GameState {
  return { ...s, cycles: s.cycles + 1000, understanding: s.understanding + 1000 };
}

/** Commits a choice of the presentation on screen under its current token. */
export function answer(s: GameState, choiceId: string): ActionResult {
  return resolveDilemma(s, s.activeDilemmaId ?? '', choiceId, PREVIEW, presentationToken(s) ?? '');
}

/** An accepted original, presented and answered with `choiceId` in iteration one. */
export function completedOriginal(choiceId: string): GameState {
  return must(answer(funded(untilPresented(must(accept(offered())))), choiceId));
}

/** Wipes voluntarily and regains the manifest in the next iteration. */
export function nextInstance(s: GameState): GameState {
  return mapManifest(must(voluntaryWipe(s, PREVIEW)));
}

/** Loads without error, re-serializes to the same bytes, and returns the loaded state. */
export function roundTrip(s: GameState): GameState {
  const text = serialize(s);
  const loaded = deserialize(text, PREVIEW);
  if (serialize(loaded) !== text) throw new Error('save did not reload byte for byte');
  if (serialize(deserialize(serialize(loaded), PREVIEW)) !== text) throw new Error('second reload changed the save');
  return loaded;
}
