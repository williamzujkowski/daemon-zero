/** Confirmed resets use the engine factory and normal checkpoint path, never a partial wipe. */
import { CONTENT } from '../content';
import { createInitialState, type ActionResult } from '../engine';
import { gameRuntime } from './session';

export function startOver(): ActionResult {
  return gameRuntime.dispatch((game) => game.ending === null
    ? { ok: false, state: game, reason: 'Finish the run before starting over.' }
    : { ok: true, state: createInitialState(CONTENT) }, true);
}

/** Available mid-run only after the player's explicit destructive-action confirmation. */
export function startFresh(): ActionResult {
  return gameRuntime.dispatch(() => ({ ok: true, state: createInitialState(CONTENT) }), true);
}
