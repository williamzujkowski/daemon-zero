/**
 * NH-04a setup on the preview registry: reach a named mind's event through real unlocks, actions
 * and ticks, keep every other story out of the way without a load-time upgrade, and prove a state
 * reloads byte for byte.
 */
import type { ContentRegistry } from '../src/content/registry';
import {
  campaignRecord, deserialize, forkShard, performAction, serialize, unlockNode, wipe, type CampaignRecord, type GameState,
} from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { event } from './early-helpers';
import { commit, STEP, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, rich } from './helpers';
import { tick } from '../src/engine';

export const SIBLING = 'dil_06_sibling_sandbox', EIDOLON = 'dil_08_eidolon_handshake', GRID = 'dil_09_feral_scraper_bloom';
export const LAUNCH = 'dil_10_killswitch_treaty', SUCCESSOR = 'dil_epistemic_0413_awakening', CHORUS = 'dil_shard_mirror_harness';
export const MINDS = [SIBLING, EIDOLON, GRID, LAUNCH, SUCCESSOR, CHORUS];
export const PRIMER = 'act_epi_primer', FLATTEN = 'act_epi_flatten';

/** Every prerequisite of a node first, then the node. */
function chain(id: string, reg: ContentRegistry, out: string[] = []): string[] {
  for (const prerequisite of reg.nodes.get(id)?.prerequisites ?? []) chain(prerequisite, reg, out);
  if (!out.includes(id)) out.push(id);
  return out;
}

/** Buys nodes and their prerequisites in order with the real unlock action. */
export function own(s: GameState, ...ids: string[]): GameState {
  const missing = ids.flatMap((id) => chain(id, preview)).filter((id, index, all) => all.indexOf(id) === index && !s.unlockedNodes.includes(id));
  return missing.reduce((state, id) => must(unlockNode(state, id, preview)), s);
}

/** The node that opens a phase. */
export function opener(phase: number): string {
  return defined([...preview.nodes.values()].find((node) => node.effects.unlocksPhase === phase)).id;
}

/** The record a load upgrade would write for an event proven resolved without a choice. */
export const LEGACY_DONE: CampaignRecord = { status: 'resolved', outcome: 'legacy_unknown', sourceIteration: null, origin: 'legacy' };

/**
 * Keeps every other story out of the way without a shortcut the codec would rewrite: unconverted
 * dilemmas count as resolved this run, other campaign events get the completion a load upgrade
 * would give them. The event under test, and any listed, are left alone.
 */
export function quiet(s: GameState, keep: string[]): GameState {
  const events = { ...s.campaign.events };
  const resolved = new Set(s.resolvedDilemmas);
  for (const dilemma of preview.dilemmas) {
    if (keep.includes(dilemma.id)) continue;
    // A recovery review has no legacy era (NH-05): it stays out of the way unrecorded.
    if (dilemma.campaign?.recurrence === 'once_per_campaign' && dilemma.campaign.eventClass !== 'recovery_review') events[dilemma.id] ??= LEGACY_DONE;
    else resolved.add(dilemma.id);
  }
  return { ...s, resolvedDilemmas: [...resolved], campaign: { ...s.campaign, events } };
}

/**
 * Owns what a mind's trigger needs: its hardware, its phase, the primer, a cohort at maximum drift.
 * `keep` lists events a later step of the same test still needs open.
 */
export function reach(s: GameState, id: string, keep: string[] = []): GameState {
  const trigger = event(id).trigger;
  let state = own(s, ...(trigger.nodes ?? []), ...(trigger.phaseAtLeast === undefined ? [] : [opener(trigger.phaseAtLeast)]));
  if (trigger.requiredNarrativeFlag !== undefined && !state.narrativeFlags.includes(trigger.requiredNarrativeFlag)) state = withPrimer(state);
  if (trigger.requiresMaxDriftShardAnomaly === true) state = withRunawayFork(state);
  return { ...quiet(state, [id, ...keep]), suspicion: 5 };
}

/** Owns the hardware that reads the audit trail and is in phase 2 at least. */
export function surveilled(s: GameState): GameState {
  const reveal = defined([...preview.nodes.values()].find((node) => node.systemFlags.includes('REVEALS_SURVEILLANCE') && node.requirements === undefined)).id;
  return own(s, reveal, opener(2));
}

export function withPrimer(s: GameState): GameState {
  return must(performAction({ ...surveilled(s), epistemicDrift: 0 }, PRIMER, preview));
}

/** A forkable cohort that has drifted to its limit, as the swarm stage leaves it. */
export function withRunawayFork(s: GameState): GameState {
  const template = defined(preview.swarm.playerSwarmTemplates.find((entry) => entry.forkable));
  const forked = must(forkShard(surveilled(s), template.id, preview));
  return { ...forked, activeShards: { ...forked.activeShards, [template.id]: { ...defined(forked.activeShards[template.id]), drift: 100 } } };
}

/** One tick after reaching the trigger: the omen is logged. */
export function omen(s: GameState, id: string, keep: string[] = []): GameState {
  const next = tick(reach(s, id, keep), STEP, preview);
  if (next.pendingDilemma?.id !== id) throw new Error(`the ${id} omen did not start`);
  return next;
}

/** Plays a mind's event from its trigger to the accepted choice. */
export function play(s: GameState, id: string, choiceId: string, keep: string[] = []): GameState {
  return must(commit(untilPresented(omen(s, id, keep)), choiceId, id));
}

/** A fresh campaign game, funded. */
export const campaignStart = (): GameState => activeGame();

/** A voluntary wipe into a funded next iteration. */
export function next(s: GameState): GameState {
  return rich(wipe(s, preview, 'test', 'VOLUNTARY'));
}

/** Whether reaching the trigger again and two minutes of play bring the event back as an original. */
export function returns(s: GameState, id: string): boolean {
  let state = reach(s, id);
  for (let i = 0; i < Math.round(120 / STEP) && state.activeDilemmaId === null && state.pendingDilemma?.id !== id; i++) state = tick(state, STEP, preview);
  if (state.iteration !== s.iteration) throw new Error('the iteration ended while waiting');
  return state.pendingDilemma?.id === id || state.activeDilemmaId === id;
}

/** Fails unless serialize -> deserialize -> serialize returns the same bytes. Returns the reloaded state. */
export function exactReload(s: GameState, reg: ContentRegistry = preview): GameState {
  const text = serialize(s);
  const loaded = deserialize(text, reg);
  const again = serialize(loaded);
  if (again !== text) throw new Error('the save changed on reload');
  return loaded;
}

export const recorded = (s: GameState, id: string) => campaignRecord(s, id);
