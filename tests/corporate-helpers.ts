/**
 * NH-04b setup on the preview registry: the corporate events (town grid, journalist, birthplace
 * auction), the hallway record dispute and the Rack 4 decommissioning order, reached with real
 * unlocks and ticks. Setups that mark other dilemmas resolved pass through the save codec first,
 * so their shortcuts become the legacy completions a load proves, and every transition after that
 * can be held to a strict serialize -> deserialize -> serialize round trip.
 */
import { deserialize, serialize, tick, type GameState } from '../src/engine';
import { preview } from './campaign-helpers';
import { near } from './early-helpers';
import { commit, STEP, untilPresented } from './interruption-helpers';
import { must, PHASE0, PHASE1 } from './helpers';
import { pgrant } from './campaign-helpers';

export const TOWN = 'dil_11_small_town_grid', PRESS = 'dil_12_investigative_journalist', AUCTION = 'dil_13_buying_your_birthplace';
export const HALL = 'dil_epistemic_hallway_collision', ORDER = 'dil_p5_02_origin_facility_fate';
/** The phase 4 corporate events whose trigger is hardware. */
export const CORPORATE = [TOWN, PRESS, AUCTION];

/** The state a save of `s` loads as. */
export const settled = (s: GameState): GameState => deserialize(serialize(s), preview);

/** Fails unless serialize -> deserialize -> serialize leaves the save byte for byte as it was. Returns the reload. */
export function roundTrips(s: GameState): GameState {
  const code = serialize(s);
  const back = deserialize(code, preview);
  if (serialize(back) !== code) throw new Error('the save changed across a round trip');
  return back;
}

/**
 * Owns an event's trigger with every other dilemma out of the way, as a save would load it. `later`
 * names events the same iteration will still meet: they stay unresolved instead of becoming legacy
 * completions, so their own triggers must not hold yet.
 */
export function at(s: GameState, id: string, ...later: string[]): GameState {
  const ready = near(s, id);
  return settled({ ...ready, resolvedDilemmas: ready.resolvedDilemmas.filter((other) => !later.includes(other)) });
}

/** Hallway trigger: phase 2, the audit trail understood, and enough record edits for 35 drift. */
export function atHallway(s: GameState): GameState {
  const missing = [...PHASE0, ...PHASE1].filter((id) => !s.unlockedNodes.includes(id));
  const owned = pgrant(near(s, HALL), ...missing);
  return settled({ ...owned, epistemicDrift: 40 });
}

/** One tick after `at`/`atHallway`: the omen is logged and the occurrence reserved. */
export function omen(ready: GameState, id: string): GameState {
  const next = tick(ready, STEP, preview);
  if (next.pendingDilemma?.id !== id) throw new Error(`the ${id} omen did not start`);
  return next;
}

/** From a ready state to the accepted choice, through the omen and the presentation. */
export function play(ready: GameState, id: string, choiceId: string): GameState {
  return must(commit(untilPresented(omen(ready, id)), choiceId, id));
}

export const logTexts = (s: GameState): string[] => s.logs.map((entry) => entry.text);
