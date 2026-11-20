/**
 * Lifts a patched review save to a state play can reach (#382). A fixture built by actions or patched fields never
 * ticks, so what the tick derives can trail it: the response rung (raised only by the escalation system) and the
 * stored rates the HUD reads. One tick would set both; this sets them without advancing time. Builders also hold
 * every quiet dilemma resolved so none interrupts them; a save keeps only those it could have met.
 */
import { CONTENT } from '../src/content';
import { computeRates, isCampaignActive, responseRungFor, type GameState } from '../src/engine';

/** A dilemma this save could have been shown: its phase reached, its trigger nodes owned, inside its iterations. */
export function couldHaveMet(game: GameState, dilemmaId: string): boolean {
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === dilemmaId);
  if (!dilemma) return false;
  const { nodes, minIteration, maxIteration } = dilemma.trigger;
  return dilemma.phaseId <= game.currentPhase && (nodes ?? []).every((id) => game.unlockedNodes.includes(id))
    && game.iteration >= (minIteration ?? 0) && game.iteration <= (maxIteration ?? Number.POSITIVE_INFINITY);
}

export function reachable(state: GameState): GameState {
  // A legacy save's resolved ids become witnessed records when the store admits it into campaign rules
  // (src/app/store.ts), so an unmet one would be offered as a scene this run saw. An active campaign's
  // records are already captured and cross-checked, so its history is left as it is.
  const history = isCampaignActive(state) ? state.resolvedDilemmas : state.resolvedDilemmas.filter((id) => couldHaveMet(state, id));
  const lifted = { ...state, resolvedDilemmas: history, alertLevel: Math.max(state.alertLevel, responseRungFor(state.suspicion, CONTENT)) };
  return { ...lifted, rates: computeRates(lifted, CONTENT) };
}
