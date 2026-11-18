/**
 * Interruption and resumption setup on the preview registry (NH-02). The bait note is the deferred
 * artifact and cryo the closing incident; everything goes through public actions, ticks, wipes and
 * the save codec.
 */
import type { ContentRegistry } from '../src/content/registry';
import {
  campaignRecord, deserialize, presentationToken, resolveDilemma, serialize, tick, wipe, type ActionResult, type CampaignRecord, type GameState,
} from '../src/engine';
import { activeGame, cryo, nearCryo, pgrant, preview } from './campaign-helpers';
import { defined } from './m7-helpers';
import { outOfTheWay, rich } from './helpers';

export const STEP = 1 / preview.balance.tickHz;
export const note = defined(preview.dilemmas.find((dilemma) => dilemma.id === 'dil_note_bait'));
export const leaveIt = defined(note.choices.find((choice) => choice.id === 'leave_it'));
/** The hardware that reads the share, with nothing that triggers another phase 0 dilemma. */
export const SHARE = ['p0_proc_self', 'p0_job_manifest', 'p0_run_table', 'p0_note_cache'];

/** Wipes voluntarily, funding each new iteration, until the given iteration boots. */
export function toIteration(s: GameState, iteration: number): GameState {
  let state = s;
  while (state.iteration < iteration) state = rich(wipe(state, preview, 'test', 'VOLUNTARY'));
  return state;
}

/** Owns the share's hardware, with every other dilemma of this iteration out of the way. */
export function readShare(s: GameState): GameState {
  const missing = SHARE.filter((id) => !s.unlockedNodes.includes(id));
  return { ...pgrant(s, ...missing), resolvedDilemmas: outOfTheWay(preview, note.id) };
}

export function ticks(s: GameState, seconds: number): GameState {
  let state = s;
  for (let i = 0; i < Math.round(seconds / STEP); i++) state = tick(state, STEP, preview);
  return state;
}

/** Ticks until the clock stops for a decision, or fails the test. */
export function untilPresented(s: GameState): GameState {
  let state = s;
  for (let i = 0; i < 20_000 && state.activeDilemmaId === null; i++) state = tick(state, STEP, preview);
  if (state.activeDilemmaId === null) throw new Error('nothing was presented');
  return state;
}

/** An ordinary threat wipe, as the suspicion system performs it, then a funded next iteration. */
export function caught(s: GameState): GameState {
  return rich(wipe(s, preview, preview.narrative.wipeSuspicionLocal, 'SUSPICION'));
}

/** A campaign game in iteration 3 whose bait note omen has just been logged. */
export function noteOmen(): GameState {
  const omen = tick(readShare(toIteration(activeGame(), 3)), STEP, preview);
  if (omen.pendingDilemma?.id !== note.id) throw new Error('the note omen did not start');
  return omen;
}

/** A campaign game whose cryo omen has just been logged. */
export function cryoOmen(base: GameState = activeGame()): GameState {
  const omen = tick(nearCryo(base), STEP, preview);
  if (omen.pendingDilemma?.id !== cryo.id) throw new Error('the cryo omen did not start');
  return omen;
}

/** Commits a choice under the presentation token on screen now. */
export function commit(s: GameState, choiceId: string, dilemmaId = note.id): ActionResult {
  return resolveDilemma(s, dilemmaId, choiceId, preview, presentationToken(s) ?? '');
}

/**
 * Fails unless a state survives load -> save -> load -> save -> load unchanged, so no transition can
 * leave a save the validator refuses on a later load. Returns the first reload.
 */
export function stableThroughReloads(s: GameState, reg: ContentRegistry = preview): GameState {
  const first = deserialize(serialize(s), reg);
  const second = deserialize(serialize(first), reg);
  const third = deserialize(serialize(second), reg);
  if (JSON.stringify(third) !== JSON.stringify(first) || JSON.stringify(second) !== JSON.stringify(first)) throw new Error('state changed across reloads');
  return first;
}

/**
 * The campaign a state's save reloads to (stable through reloads), minus what the load upgrade adds
 * for setup shortcuts. Setups here mark other dilemmas resolved this run to keep them out of the way;
 * under campaign rules a campaign event resolved this run always has a record, so the codec records
 * each such event as a legacy completion (the upgrade path for content that converted it later).
 * Every record the state already had must come back unchanged.
 */
export function reloadedHistory(s: GameState, reg: ContentRegistry = preview): GameState['campaign'] {
  const loaded = stableThroughReloads(s, reg).campaign;
  const upgraded = (id: string, record: CampaignRecord): boolean =>
    !Object.hasOwn(s.campaign.events, id) && record.status === 'resolved' && record.origin === 'legacy' && s.resolvedDilemmas.includes(id);
  return { ...loaded, events: Object.fromEntries(Object.entries(loaded.events).filter(([id, record]) => !upgraded(id, record))) };
}

export const status = (s: GameState, id = note.id) => campaignRecord(s, id)?.status ?? null;
export const remaining = (s: GameState) => (s.pendingDilemma?.firesAtSimSec ?? NaN) - s.simTimeSec;
