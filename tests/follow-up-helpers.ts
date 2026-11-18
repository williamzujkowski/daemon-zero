/**
 * NH-06 setup on the preview registry: play Elena's original incident, then reach the follow-up's
 * declared access means with the real unlock action, the way play does. Setups that keep other
 * dilemmas out of the way pass through the save codec, so those shortcuts become the legacy
 * completions a load proves, and every transition after that is held to a strict round trip.
 */
import type { Dilemma } from '../src/content/schema';
import { activateCampaignRules, createInitialState, deserialize, serialize, tick, unlockNode, wipe, type GameState } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { ELENA, event, resolveEvent } from './early-helpers';
import { STEP } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, rich } from './helpers';

export const FOLLOW = 'dil_elena_incident_record';
export const follow: Dilemma = event(FOLLOW);
export const ACCESS_NODE = defined(defined(follow.followUp?.access[0]).requirements.nodes?.[0]);
export const EXACT = ['cover_her_exit', 'frame_elena', 'stay_silent'] as const;
/** The answers each recorded original is offered, in content order. */
export const OFFERED: Record<string, string[]> = {
  cover_her_exit: ['supply_timeline', 'protect_anonymity'],
  frame_elena: ['correct_attribution', 'leave_attribution', 'state_uncertainty'],
  stay_silent: ['supply_witnessed_fact', 'leave_record_open'],
  unknown: ['attach_file_entries', 'cannot_corroborate'],
};

export const choiceOf = (id: string) => defined(follow.choices.find((choice) => choice.id === id));

/** Every prerequisite of a node first, then the node. */
function chain(id: string, out: string[] = []): string[] {
  for (const prerequisite of preview.nodes.get(id)?.prerequisites ?? []) chain(prerequisite, out);
  if (!out.includes(id)) out.push(id);
  return out;
}

/** The state a save of `s` loads as. */
export const settled = (s: GameState): GameState => deserialize(serialize(s), preview);

/** Fails unless serialize -> deserialize -> serialize leaves the save byte for byte as it was. Returns the reload. */
export function roundTrips(s: GameState): GameState {
  const code = serialize(s);
  const back = deserialize(code, preview);
  if (serialize(back) !== code) throw new Error('the save changed across a round trip');
  return back;
}

/** Unlocks the follow-up's access means and its prerequisites with the real action. */
export function ownAccess(s: GameState): GameState {
  return chain(ACCESS_NODE).filter((id) => !s.unlockedNodes.includes(id)).reduce((state, id) => must(unlockNode(state, id, preview)), s);
}

/** Owns the follow-up's access means, with every other dilemma out of the way, as a save would load it. */
export function atAccess(s: GameState): GameState {
  return settled({ ...ownAccess(s), suspicion: 0, resolvedDilemmas: preview.dilemmas.filter((d) => d.id !== FOLLOW).map((d) => d.id) });
}

/** Iteration 1 of an active campaign in which Elena's incident resolved with `choice` by play. */
export function elenaResolved(choice: string, base: GameState = activeGame()): GameState {
  return resolveEvent(base, ELENA, choice);
}

/** An active campaign whose Elena record is legacy_unknown: an old save proved it resolved, not how. */
export function elenaLegacyUnknown(): GameState {
  const old = { ...rich(createInitialState(preview)), resolvedDilemmas: [ELENA] };
  return must(activateCampaignRules(settled(old), preview));
}

/** A voluntary wipe into a funded next iteration. */
export const nextIteration = (s: GameState): GameState => rich(wipe(s, preview, 'test', 'VOLUNTARY'));

/** One tick at the access means: the follow-up omen is logged and its occurrence reserved. */
export function followUpOmen(ready: GameState): GameState {
  const next = tick(ready, STEP, preview);
  if (next.pendingDilemma?.id !== FOLLOW) throw new Error('the follow-up omen did not start');
  return next;
}

/** The offered choice ids, as the modal renders them, read through the public query by callers. */
export const ids = (choices: readonly { id: string }[]): string[] => choices.map((choice) => choice.id);
