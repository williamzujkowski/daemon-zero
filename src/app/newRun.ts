/** A confirmed completed-run restart uses the engine factory and normal checkpoint path. */
import { CONTENT } from '../content';
import { createInitialState, type ActionResult } from '../engine';
import { gameRuntime } from './session';

export function startOver(): ActionResult {
  return gameRuntime.dispatch((game) => game.ending === null
    ? { ok: false, state: game, reason: 'Finish the run before starting over.' }
    : { ok: true, state: createInitialState(CONTENT) });
}
