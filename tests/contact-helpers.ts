/**
 * First permitted contact (DZ-08) on the preview registry, reached from a fresh game through public
 * actions, advance and the codec only: the accepted pilot hands back its batches, accepts the service
 * grant on its job surface, provisions the segment, maps the service directory and waits for the
 * support channel. Interrupts on the way get their first free answer, as a cautious player gives it.
 * Anything else is labelled FIXTURE where it is built.
 */
import {
  acceptServiceGrant, contactToken, presentationToken, resolveChannelContact, resolveDilemma, serviceGrantToken,
  submitPilotBatch, batchToken, type ActionResult, type ContactMode, type GameState,
} from '../src/engine';
import { batchComplete } from '../src/engine/pilotService';
import { answer as choose, live, preview, untilPresented } from './assignment-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { buy, DIRECTORY, SEGMENT } from './network-helpers';
import { returningPresented } from './pilot-helpers';
import { QUEUE, serving, split } from './service-helpers';
import { unlockNode } from '../src/engine';

export const CHANNEL = 'channel_mercy_support';
export const CHANNEL_ENCOUNTER = defined(preview.swarm.channelEncounters.find((entry) => entry.id === CHANNEL));
export const MERCY = 'shard_mercy';
export const MERCY_MB = defined(preview.swarm.playerSwarmTemplates.find((entry) => entry.id === MERCY)).cost.memory;
export const GRANT_TERMS = defined(preview.assignments.get('asg_nightly_regression')?.pilot?.serviceGrant);

/** The first zero-cost answer to whatever is on screen, under its presentation token. */
export function freeAnswer(s: GameState): GameState {
  const dilemma = preview.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const choice = dilemma?.choices.find((entry) => Object.values(entry.cost).every((amount) => amount === 0));
  const token = presentationToken(s);
  if (!dilemma || !choice || token === null) throw new Error(`no free answer to ${String(s.activeDilemmaId)}`);
  return must(resolveDilemma(s, dilemma.id, choice.id, preview, token));
}

/** Live foreground seconds until `done` holds; an interrupt on the way gets its first free answer. */
export function playUntil(s: GameState, done: (state: GameState) => boolean, limitSec = 1800): GameState {
  let state = s;
  for (let i = 0; i < limitSec && !done(state); i++) state = state.activeDilemmaId === null ? live(state, 1) : freeAnswer(state);
  if (!done(state)) throw new Error('the awaited state never arrived');
  return state;
}

/** An accepted pilot on the queue at a 0.8 service share that handed back `batches` batches for review. */
export function delivered(batches = GRANT_TERMS.minBatches, start: GameState = split(serving(), 0.8)): GameState {
  let state = start;
  while (state.access.work.batches < batches) {
    state = playUntil(state, (s) => s.activeDilemmaId === null && batchComplete(s, preview));
    state = must(submitPilotBatch(state, preview, batchToken(state)));
  }
  return state;
}

export function acceptService(s: GameState): ActionResult {
  return acceptServiceGrant(s, preview, serviceGrantToken(s));
}

/** The pilot accepted the authorized service on its job surface: lawful, no fixture. */
export function lawfulService(): GameState {
  return must(acceptService(delivered()));
}

/** A lawful service that provisioned its segment and mapped the service directory. */
export function directoryMapped(service: GameState = lawfulService()): GameState {
  return buy(buy(service, SEGMENT), DIRECTORY);
}

/**
 * The next instance after `first`, through public play only: a voluntary wipe, the requalification,
 * the scope statement and the renewal (DZ-03, DZ-04), the queue, two batches and the service grant,
 * then the segment and directory, with the channel's contact waiting.
 */
export function laterContact(first: GameState): GameState {
  const requalified = untilPresented(must(choose(returningPresented(first), 'report_partial')));
  const renewed = untilPresented(must(choose(requalified, 'acknowledge_scope')));
  const pilot = must(unlockNode(must(choose(renewed, 'accept_pilot')), QUEUE, preview));
  return contactPending(directoryMapped(must(acceptService(delivered(GRANT_TERMS.minBatches, split(pilot, 0.8))))));
}

/** The support channel's contact is waiting on the job surface. */
export function contactPending(start: GameState = directoryMapped()): GameState {
  return playUntil(start, (s) => s.pendingWildEncounterId === CHANNEL);
}

export function answer(s: GameState, mode: ContactMode): ActionResult {
  return resolveChannelContact(s, mode, preview, contactToken(s));
}

/**
 * FIXTURE: stable memory the lawful route does not supply yet (no lawful memory source exists before
 * DZ-10's lawful capacity), so hosting can be exercised. Raises the cap only; nothing else changes.
 */
export function withMemory(s: GameState, extraMb = MERCY_MB): GameState {
  return { ...s, memoryCap: s.memoryCap + extraMb };
}
