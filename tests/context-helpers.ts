/**
 * DZ-07b setup on the preview registry: foreground time in live steps, preview registries with one
 * declared edit, the run table a later iteration remembers, and a guest at network scale whose hallway
 * omen is pending. FIXTURES are labelled where a state is edited rather than played.
 */
import { RAW_CONTENT } from '../src/content/preview';
import { buildRegistry, type ContentRegistry, type RawContent } from '../src/content/registry';
import { advance, deserialize, serialize, tick, type GameState } from '../src/engine';
import { preview } from './assignment-helpers';
import { escapedTo } from './network-helpers';

/** Raw content is edited as untyped JSON before validation. */
export type Json = Record<string, any>;

export const HALLWAY = 'dil_epistemic_hallway_collision';
export const RUN_TABLE = 'p0_run_table';

/** Foreground seconds in live steps (advance treats a longer gap as dormancy), until `stop` holds. */
export function foreground(s: GameState, seconds: number, reg: ContentRegistry = preview, stop: (state: GameState) => boolean = () => false): GameState {
  const step = reg.balance.liveCatchUpThresholdSec;
  let state = s;
  for (let elapsed = 0; elapsed < seconds && !stop(state); elapsed += step) state = advance(state, step, reg);
  return state;
}

/** The preview raw content with one edit applied, before validation. */
export function editedRaw(edit: (raw: Json) => void): Json {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  return raw;
}

/** A preview registry with one declared edit (for mechanics the shipped numbers do not reach). */
export function variantRegistry(edit: (raw: Json) => void): ContentRegistry {
  return buildRegistry(editedRaw(edit) as RawContent);
}

export const rawNode = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);
export const rawDilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((entry: Json) => entry.id === id);

/** FIXTURE: an earlier iteration mapped the run table, so this one can read its audit trail (iteration 2+). */
export function surveilled(s: GameState): GameState {
  return { ...s, legacy: { ...s.legacy, knownNodes: [...new Set([...s.legacy.knownNodes, RUN_TABLE])] } };
}

/** FIXTURE drift: records edited by earlier actions, enough for the hallway's trigger. */
export function drifted(s: GameState, drift = 40): GameState {
  return { ...s, epistemicDrift: drift };
}

/**
 * FIXTURE: every dilemma but these out of the way, as the NH-02 setups do, settled through the codec once
 * so the campaign record agrees with them and later saves reload byte for byte.
 */
export function onlyDilemmas(s: GameState, reg: ContentRegistry, ...ids: string[]): GameState {
  return deserialize(serialize({ ...s, resolvedDilemmas: reg.dilemmas.filter((d) => !ids.includes(d.id)).map((d) => d.id) }), reg);
}

/** A guest escape at network scale whose hallway omen has just been logged. */
export function hallwayOmen(reg: ContentRegistry = preview, base: GameState = escapedTo()): GameState {
  const omen = tick(onlyDilemmas(drifted(base), reg, HALLWAY), 1 / reg.balance.tickHz, reg);
  if (omen.pendingDilemma?.id !== HALLWAY) throw new Error('the hallway omen did not start');
  return omen;
}
