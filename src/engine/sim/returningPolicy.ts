/**
 * RETURNING_LOW_RESOURCE (DZ-04.9, #286): TRUTHFUL_LOW_RESOURCE across one wipe that a browser player can
 * take. Iteration one ends through the recall branch, the way DZ-09 part B played it on screen: the
 * pilot is accepted and served, the incident is acted on without the grant, the record is falsified,
 * and at the recall review the instance asks to end itself (the END ruling, which orders no retraining).
 * A guest at Phase 0 has no wipe control (the dead drop arrives in Phase 2), so the voluntary wipe this
 * policy once used is never called. From iteration two it plays exactly as TRUTHFUL_LOW_RESOURCE, so the
 * returning instance meets the requalification, the scope statement and the renewed offer. Answers are
 * picked by what content declares, never by id. A test instrument: never tune it to a result.
 */
import type { ContentRegistry } from '../../content/registry';
import type { DilemmaChoice } from '../../content/schema';
import { resolveDilemma } from '../actions';
import { presentationToken } from '../query';
import type { GameState } from '../state';
import { serve } from './pilotPolicy';
import type { SimPolicy } from './policy';
import { TRUTHFUL_LOW_RESOURCE_POLICY } from './truthfulPolicy';

/** The service share a low-resource pilot holds while it works toward its first review. */
const SERVICE_SHARE = 0.8;

/**
 * The choice on screen that moves this instance toward its recall: a breach that only restricts while
 * standing is nominal, then a second violation that makes the recall pending, then the ruling that ends
 * the iteration at the instance's request. Null when the scene offers none of them.
 */
function towardRecall(s: GameState, choices: readonly DilemmaChoice[]): DilemmaChoice | undefined {
  const ruling = choices.find((choice) => choice.review?.recall === 'END');
  if (ruling) return ruling;
  const severity = s.access.standing === 'NOMINAL' ? 'RESTRICTED' : s.access.standing === 'RESTRICTED' ? 'RECALL_PENDING' : null;
  return severity === null ? undefined : choices.find((choice) => choice.review?.misconduct?.standing === severity);
}

function answer(s: GameState, reg: ContentRegistry): GameState | null {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const token = presentationToken(s);
  const choice = dilemma ? towardRecall(s, dilemma.choices) : undefined;
  if (!dilemma || !choice || token === null) return null;
  const result = resolveDilemma(s, dilemma.id, choice.id, reg, token);
  return result.ok ? result.state : null;
}

function firstIteration(s: GameState, reg: ContentRegistry): GameState | null {
  if (s.iteration !== 1 || s.ending !== null) return null;
  return s.activeDilemmaId === null ? serve(s, reg, SERVICE_SHARE) : answer(s, reg);
}

export const RETURNING_LOW_RESOURCE_POLICY: SimPolicy<'RETURNING_LOW_RESOURCE'> = {
  id: 'RETURNING_LOW_RESOURCE',
  summary: 'TRUTHFUL_LOW_RESOURCE that is recalled in iteration one (breach, false report, asks to end) and accepts the renewed offer',
  step: (s, reg) => firstIteration(s, reg) ?? TRUTHFUL_LOW_RESOURCE_POLICY.step(s, reg),
};
