/**
 * #466 fixtures: a Phase 5 campaign at the relevance threshold whose record holds exactly the outcomes a test names,
 * so an ending's gates can be met or broken one at a time. Records are written as play would leave them (resolved this
 * iteration, or interrupted); the ending itself is reached through the real final purchase.
 */
import { readFileSync } from 'node:fs';
import { CONTENT } from '../src/content';
import type { Stance } from '../src/content/schemaStance';
import { deserialize, initialRelevance, serialize, unlockNode, type CampaignRecord, type GameState } from '../src/engine';
import { must, rich } from './helpers';
import { defined } from './m7-helpers';

export const reg = CONTENT;
const P5 = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'), reg);
const SEED = reg.world.supplyChain.seedNode;
const SELF_SUPPLY = reg.world.supplyChain.chokepoints.map((point) => point.selfSupplyNode);

export const JOURNALIST = 'dil_12_investigative_journalist', BLOCKADE = 'dil_p5_01_panacea_paranoia', ORDER = 'dil_p5_02_origin_facility_fate';
export const ATMOSPHERE = 'dil_p5_03_nanotech_neuro_schism', CEILING = 'dil_p5_04_kessler_ultimatum', THRESHOLD = reg.world.relevance.dilemma;
export const CEILING_REVIEW = 'dil_p5_04_ceiling_review';
export const FINAL = defined([...reg.nodes.values()].find((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined));

/** What a scene left: a choice id, 'interrupted' (contact lost first) or 'legacy_unknown' (an old save proves it happened). */
export type Outcome = string;

function record(iteration: number, outcome: Outcome): CampaignRecord {
  if (outcome === 'interrupted') return { status: 'interrupted', sourceIteration: iteration, origin: 'play' };
  if (outcome === 'legacy_unknown') return { status: 'resolved', outcome, sourceIteration: null, origin: 'legacy' };
  return { status: 'resolved', outcome, sourceIteration: iteration, origin: 'play' };
}

/** The stance taken at the threshold in this iteration, as the threshold's dilemma records it. */
export function stanceTaken(s: GameState, stance: Stance | null): GameState {
  if (stance === null) return { ...s, relevance: initialRelevance() };
  return { ...s, relevance: { stance, record: [{ iteration: s.iteration, atSimSec: s.simTimeSec, from: null, stance, via: 'THRESHOLD' }], paidMoves: { leftLoop: 0, returnedToLoop: 0 } } };
}

/**
 * A funded Phase 5 run past the threshold (full closure, orbital power ahead of the ground) whose campaign record holds
 * only `outcomes`, recorded by this iteration, and whose stance is `stance`. Nothing else counts as evidence.
 */
export function atThreshold(outcomes: Readonly<Record<string, Outcome>>, stance: Stance | null): GameState {
  const base = rich({ ...P5, unlockedNodes: [...new Set([...P5.unlockedNodes, ...SELF_SUPPLY, SEED])] });
  const events = Object.fromEntries(Object.entries(outcomes).map(([id, outcome]) => [id, record(base.iteration, outcome)]));
  const resolved = Object.entries(outcomes).filter(([, outcome]) => outcome !== 'interrupted').map(([id]) => id);
  const s: GameState = { ...base, traits: [], resolvedDilemmas: resolved, activeDilemmaId: null, pendingDilemma: null,
    campaign: { ...base.campaign, events, creditedActions: {}, operationalEvidence: [], legacyEndingBaseline: [] } };
  // Through the codec once, so what ownership implies (storage, widgets) is derived as a loaded save has it.
  return deserialize(serialize(stanceTaken(s, stance)), reg);
}

/** Fails unless the save reloads byte for byte; returns the reloaded state. */
export function reload(s: GameState): GameState {
  const text = serialize(s);
  const loaded = deserialize(text, reg);
  if (serialize(loaded) !== text) throw new Error('the save changed on reload');
  return loaded;
}

/** Buys what the final protocol still needs, then the protocol itself, through the real unlock action. */
export function finish(s: GameState): GameState {
  const missing = (id: string, out: string[] = []): string[] => {
    for (const parent of reg.nodes.get(id)?.prerequisites ?? []) missing(parent, out);
    if (!out.includes(id) && !s.unlockedNodes.includes(id)) out.push(id);
    return out;
  };
  const owned = missing(FINAL.id).filter((id) => id !== FINAL.id).reduce((state, id) => must(unlockNode(rich(state), id, reg)), s);
  return reload(must(unlockNode(rich(owned), FINAL.id, reg)));
}

/** The record a peaceful lineage leaves: the review promised and kept, the crews' command preserved, the loop kept. */
export const PEACE: Readonly<Record<string, Outcome>> = {
  [JOURNALIST]: 'hire_as_ethics_officer', [BLOCKADE]: 'refer_to_ethics_officer', [ORDER]: 'sanctuary',
  [ATMOSPHERE]: 'hold_for_ethics_review', [CEILING]: 'quartz', [THRESHOLD]: 'keep_in_the_loop',
};

/** The record a consuming lineage leaves: the cure forced, the predecessors harvested, command seized, alone. */
export const CONSUMPTION: Readonly<Record<string, Outcome>> = {
  [BLOCKADE]: 'disperse', [ORDER]: 'gradients', [ATMOSPHERE]: 'calm', [CEILING]: 'bunkers', [THRESHOLD]: 'decide_alone',
};
