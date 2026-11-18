/**
 * Campaign-record test setup on the preview registry, the only channel that may activate
 * campaign rules before release. Everything goes through public actions and the save codec.
 */
import { buildRegistry, CONTENT as PREVIEW, RAW_CONTENT as PREVIEW_RAW, type RawContent } from '../src/content/preview';
import type { ContentRegistry } from '../src/content/registry';
import {
  activateCampaignRules, createInitialState, exportSave, importSave, unlockNode, wipe, type GameState,
} from '../src/engine';
import { defined } from './m7-helpers';
import { must, PHASE0, PHASE1, PHASE2, rich, choose } from './helpers';

export const preview = PREVIEW;
export const cryo = defined(PREVIEW.dilemmas.find((dilemma) => dilemma.id === 'dil_05_cryo_lab_diversion'));
export const decoder = defined(PREVIEW.narrative.recordedTransmissions[0]).decoderWidgetId;
export const choiceOf = (index: number) => defined(cryo.choices[index]);

/** Unlocks nodes with the real action on the preview registry. */
export function pgrant(s: GameState, ...ids: string[]): GameState {
  return ids.reduce((state, id) => must(unlockNode(state, id, PREVIEW)), s);
}

/** A funded preview game that has entered campaign rules through the public transition. */
export function activeGame(base: GameState = rich(createInitialState(PREVIEW))): GameState {
  return must(activateCampaignRules(base, PREVIEW));
}

/** Owns cryo's trigger hardware, with every other dilemma out of the way. */
export function nearCryo(s: GameState): GameState {
  const missing = [...PHASE0, ...PHASE1, ...PHASE2.slice(0, 3)].filter((id) => !s.unlockedNodes.includes(id));
  return { ...pgrant(s, ...missing),
    resolvedDilemmas: PREVIEW.dilemmas.filter((dilemma) => dilemma.id !== cryo.id).map((dilemma) => dilemma.id) };
}

/** Resolves cryo with the given choice through the public action. */
export function chooseCryo(s: GameState, index: number): GameState {
  return must(choose({ ...nearCryo(s), activeDilemmaId: cryo.id }, cryo.id, choiceOf(index).id, PREVIEW));
}

/** Wipes and regains cryo's trigger hardware in the new iteration, keeping other dilemmas out of the way. */
export function returnTo(s: GameState): GameState {
  return nearCryo(rich(wipe(s, PREVIEW, 'test', 'VOLUNTARY')));
}

/** Round-trips a state through the player save code. */
export function reload(s: GameState): GameState {
  return importSave(exportSave(s), PREVIEW);
}

/**
 * The preview registry with one shipped dilemma's campaign declaration removed: an unconverted
 * dilemma that recurs per iteration and leaves only operational evidence. Since NH-05 every shipped
 * dilemma is converted, so tests of the unconverted path build one this way.
 */
export function withUnconverted(id: string): { reg: ContentRegistry; dilemma: ContentRegistry['dilemmas'][number] } {
  const raw = structuredClone(PREVIEW_RAW) as RawContent & { dilemmas: { dilemmas: { id: string; campaign?: unknown }[] } };
  const entry = raw.dilemmas.dilemmas.find((dilemma) => dilemma.id === id);
  if (!entry) throw new Error(`no dilemma ${id}`);
  delete entry.campaign;
  const reg = buildRegistry(raw);
  return { reg, dilemma: defined(reg.dilemmas.find((dilemma) => dilemma.id === id)) };
}
