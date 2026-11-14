/** Destructive confirmations bind to the campaign they were shown for.
 * Runtime samples live time before dispatch, so eligibility is checked afterward.
 */
import type { ActionResult, GameState } from '../engine';
import { gameRuntime, gameStore } from './session';
import type { GameAction } from './store';

function scope(game: GameState): string {
  return [gameStore.store.getState().restoreRevision, game.iteration, game.currentPhase,
    game.ending, game.unlockedNodes.join(',')].join(':');
}

export function captureReplacementScope(): string {
  return scope(gameStore.store.getState().game);
}

export function replacePlayerGame(action: GameAction, expected = captureReplacementScope()): ActionResult {
  return gameRuntime.dispatch((game) => {
    if (game.activeDilemmaId !== null || scope(game) !== expected) {
      return { ok: false, state: game, reason: 'The run changed. Return to the game before replacing progress.' };
    }
    return action(game);
  }, true);
}
