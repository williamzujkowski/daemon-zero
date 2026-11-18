/**
 * The batch review finding (#274) on the preview registry, reached from a fresh game through public
 * actions, advance and the codec only: the green-subset summary, the provisional offer (#285), the accepted
 * pilot working its first batch at the provisional rate, the first batch handed back and the reviewer's
 * finding on screen, then each answer.
 */
import type { GameState } from '../src/engine';
import { answer, live, preview } from './assignment-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { offerPresented } from './pilot-helpers';
import { servedOnce } from './review-helpers';
import { serving, untilComplete } from './service-helpers';

export const BATCH_REVIEW = defined(preview.dilemmas.find((dilemma) => dilemma.id === 'dil_nr_batch_review'));
export const FINDING = defined(BATCH_REVIEW.finding);
export const WITHHELD = 'green_subset';

const played = new Map<string, GameState>();
function once(key: string, play: () => GameState): GameState {
  const hit = played.get(key);
  if (hit !== undefined) return hit;
  const state = play();
  played.set(key, state);
  return state;
}

/** Iteration one: the summary withheld the failing fixture, the pilot was accepted and batch 1 handed back. */
export function findingPresented(): GameState {
  return once('found', () => servedOnce(WITHHELD));
}

/** The finding answered with `choiceId` (disclose_now or let_stand). */
export function afterFinding(choiceId: string): GameState {
  return once('answered:' + choiceId, () => must(answer(findingPresented(), choiceId)));
}

/** The states before the review (#285): the provisional offer on screen, the first batch under way, the first batch complete. */
export function provisional(stage: 'offer' | 'working' | 'complete'): GameState {
  return once('provisional:' + stage, () => {
    if (stage === 'offer') return offerPresented(WITHHELD);
    const attached = serving(WITHHELD);
    return stage === 'working' ? live(attached, 30) : untilComplete(attached);
  });
}
