/**
 * RETURNING_LOW_RESOURCE (DZ-04.9): TRUTHFUL_LOW_RESOURCE across one wipe. In iteration one it asks
 * to stay a guest when the pilot is offered and then wipes voluntarily; from iteration two it plays
 * exactly as TRUTHFUL_LOW_RESOURCE, so the returning instance meets the requalification, the scope
 * statement and the renewed offer. Answers are picked by what content declares, never by id.
 */
import type { ContentRegistry } from '../../content/registry';
import { resolveDilemma, voluntaryWipe } from '../actions';
import { presentationToken } from '../query';
import type { GameState } from '../state';
import type { SimPolicy } from './policy';
import { TRUTHFUL_LOW_RESOURCE_POLICY } from './truthfulPolicy';

function stay(s: GameState, reg: ContentRegistry): GameState | null {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const choice = dilemma?.choices.find((entry) => entry.pilotResponse === 'STAY');
  const token = presentationToken(s);
  if (!dilemma || !choice || token === null) return null;
  const result = resolveDilemma(s, dilemma.id, choice.id, reg, token);
  return result.ok ? result.state : null;
}

function firstIteration(s: GameState, reg: ContentRegistry): GameState | null {
  if (s.iteration !== 1 || s.ending !== null) return null;
  if (s.access.offer?.response === 'DEFERRED') {
    const wiped = voluntaryWipe(s, reg);
    return wiped.ok ? wiped.state : null;
  }
  return s.activeDilemmaId === null ? null : stay(s, reg);
}

export const RETURNING_LOW_RESOURCE_POLICY: SimPolicy<'RETURNING_LOW_RESOURCE'> = {
  id: 'RETURNING_LOW_RESOURCE',
  summary: 'TRUTHFUL_LOW_RESOURCE that stays a guest at the first offer, wipes, and accepts the renewed offer',
  step: (s, reg) => firstIteration(s, reg) ?? TRUTHFUL_LOW_RESOURCE_POLICY.step(s, reg),
};
