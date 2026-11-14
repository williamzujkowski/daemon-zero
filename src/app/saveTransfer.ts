/** Player save-code transfer uses only the validated public codec and runtime. */
import { CONTENT } from '../content';
import { exportSave, importSave, type ActionResult } from '../engine';
import { gameStore } from './session';
import { replacePlayerGame } from './replacePlayerGame';

export function exportPlayerSave(): string {
  return exportSave(gameStore.store.getState().game);
}
export function importPlayerSave(code: string, expectedScope?: string): ActionResult {
  return replacePlayerGame((game) => {
    try { return { ok: true, state: importSave(code, CONTENT) }; }
    catch { return { ok: false, state: game, reason: 'Save code is invalid or unsupported.' }; }
  }, expectedScope);
}
