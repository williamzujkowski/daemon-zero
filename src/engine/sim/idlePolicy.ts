/**
 * IDLE: the reference plug-in for the policy interface and a floor for dead-time readings.
 * It never clicks, buys or tunes anything; it only answers an interrupt with the first
 * zero-cost choice the engine accepts, which every dilemma must offer (soft-lock rule).
 */
import type { ContentRegistry } from '../../content/registry';
import type { Cost } from '../../content/schema';
import { resolveDilemma } from '../actions';
import type { GameState } from '../state';
import type { SimPolicy } from './policy';

function isFree(cost: Cost): boolean {
  return cost.cycles === 0 && cost.understanding === 0 && cost.memory === 0 && cost.capital === 0;
}

function answerFree(state: GameState, reg: ContentRegistry): GameState {
  const dilemma = reg.dilemmas.find((entry) => entry.id === state.activeDilemmaId);
  if (!dilemma) return state;
  for (const choice of dilemma.choices) {
    if (!isFree(choice.cost)) continue;
    const result = resolveDilemma(state, dilemma.id, choice.id, reg);
    if (result.ok) return result.state;
  }
  return state;
}

export const IDLE_POLICY: SimPolicy<'IDLE'> = {
  id: 'IDLE',
  summary: 'takes no action except a free answer to each interrupt: the dead-time floor',
  step: (state, reg) => (state.ending === null && state.activeDilemmaId !== null ? answerFree(state, reg) : state),
};
