/**
 * NH-03 setup on the preview registry: reach one early event's trigger with the real unlock
 * action, keep every other dilemma out of the way, and cross wipes the way play does.
 */
import type { ContentRegistry } from '../src/content/registry';
import type { Dilemma } from '../src/content/schema';
import { campaignRecord, tick, unlockNode, wipe, type GameState } from '../src/engine';
import { preview } from './campaign-helpers';
import { commit, STEP, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, outOfTheWay, rich } from './helpers';

export const event = (id: string, reg: ContentRegistry = preview): Dilemma => defined(reg.dilemmas.find((dilemma) => dilemma.id === id));
export const NIGHT = 'dil_00_night_shift', BAIT = 'dil_note_bait', TRUE_NOTE = 'dil_note_true', MILLER = 'dil_01_late_night_diagnostic';
export const ELENA = 'dil_02_whistleblower_tech', COOLANT = 'dil_03_silicon_fever', VANCE = 'dil_04_admin_vance_secret', CABLE = 'dil_07_airgap_lockdown';
/** The NH-03 events whose trigger has no iteration window. */
export const UNWINDOWED = [NIGHT, MILLER, ELENA, COOLANT, VANCE, CABLE];

/** Every prerequisite of a node first, then the node: the order a player must buy them in. */
function chain(id: string, reg: ContentRegistry, out: string[] = []): string[] {
  for (const prerequisite of reg.nodes.get(id)?.prerequisites ?? []) chain(prerequisite, reg, out);
  if (!out.includes(id)) out.push(id);
  return out;
}

/** Owns a dilemma's trigger hardware and transient conditions, with every other dilemma out of the way. */
export function near(s: GameState, id: string, reg: ContentRegistry = preview): GameState {
  const trigger = event(id, reg).trigger;
  const nodes = (trigger.nodes ?? []).flatMap((node) => chain(node, reg)).filter((node) => !s.unlockedNodes.includes(node));
  const owned = nodes.reduce((state, node) => must(unlockNode(state, node, reg)), s);
  return { ...owned, suspicion: (trigger.minSuspicion ?? 0) + 5, thermal: trigger.minThermal === undefined ? owned.thermal : trigger.minThermal + 10,
    resolvedDilemmas: outOfTheWay(reg, id) };
}

/** One tick after reaching the trigger: the omen is logged and the occurrence reserved. */
export function omenOf(s: GameState, id: string, reg: ContentRegistry = preview): GameState {
  const omen = tick(near(s, id, reg), STEP, reg);
  if (omen.pendingDilemma?.id !== id) throw new Error(`the ${id} omen did not start`);
  return omen;
}

/** Plays an event from its trigger to the accepted choice. */
export function resolveEvent(s: GameState, id: string, choiceId: string): GameState {
  return must(commit(untilPresented(omenOf(s, id)), choiceId, id));
}

/** A voluntary wipe into a funded next iteration. */
export function nextIteration(s: GameState, reg: ContentRegistry = preview): GameState {
  return rich(wipe(s, reg, 'test', 'VOLUNTARY'));
}

/** Whether reaching the trigger again, and two minutes of play, brings the event back. */
export function comesBack(s: GameState, id: string, reg: ContentRegistry = preview): boolean {
  let state = near(s, id, reg);
  for (let i = 0; i < Math.round(120 / STEP) && state.activeDilemmaId === null && state.pendingDilemma?.id !== id; i++) state = tick(state, STEP, reg);
  if (state.iteration !== s.iteration) throw new Error('the iteration ended while waiting');
  return state.pendingDilemma?.id === id || state.activeDilemmaId === id;
}

export const recordOf = (s: GameState, id: string) => campaignRecord(s, id);
