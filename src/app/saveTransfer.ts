/** Player save-code transfer uses only the validated public codec and runtime. */
import { CONTENT } from '../content';
import { exportSave, importSave, SaveChannelError, type ActionResult } from '../engine';
import { gameStore } from './session';
import { replacePlayerGame } from './replacePlayerGame';

export function exportPlayerSave(): string {
  return exportSave(gameStore.store.getState().game);
}

/** A channel refusal names its cause; any other bad code gets the generic reason. */
function refusalReason(error: unknown): string {
  if (error instanceof SaveChannelError) return `This save comes from a ${error.saveChannel} build and cannot be loaded here.`;
  return 'Save code is invalid or unsupported.';
}

export function importPlayerSave(code: string, expectedScope?: string): ActionResult {
  return replacePlayerGame((game) => {
    try { return { ok: true, state: importSave(code, CONTENT) }; }
    catch (error) { return { ok: false, state: game, reason: refusalReason(error) }; }
  }, expectedScope);
}
