/**
 * Lifts a patched review save to a state play can reach (#382). A fixture built by actions or patched fields never
 * ticks, so what the tick derives can trail it: the response rung (raised only by the escalation system) and the
 * stored rates the HUD reads. One tick would set both; this sets them without advancing time.
 */
import { CONTENT } from '../src/content';
import { computeRates, responseRungFor, type GameState } from '../src/engine';

export function reachable(state: GameState): GameState {
  const lifted = { ...state, alertLevel: Math.max(state.alertLevel, responseRungFor(state.suspicion, CONTENT)) };
  return { ...lifted, rates: computeRates(lifted, CONTENT) };
}
