/**
 * Exposes primitive or quantized subscriptions rather than the full game object.
 * Components only render when the values they display actually change.
 */
import { useStore } from 'zustand';
import { CONTENT } from '../content';
import { isNodeAvailable, logLineText, previewLog, type GameState } from '../engine';
import { gameStore } from './session';
import type { AppState } from './store';

/**
 * True when nothing the player can currently buy would fit in the free memory. That is the
 * state the playtest hit - "I didn't have enough memory to progress" - and it is a fact about
 * pending purchases, not a fixed threshold: a full bar with a free 4 MB node is not blocked,
 * an empty cache with a 4096 MB host waiting is.
 */
export function memoryBlocked(game: GameState): boolean {
  const free = game.memoryCap - game.memoryUsed;
  const costs = [...CONTENT.nodes.values()]
    .filter((node) => node.cost.memory > 0 && isNodeAvailable(game, node, CONTENT))
    .map((node) => node.cost.memory);
  if (costs.length === 0) return false;
  return free < Math.min(...costs);
}

export const selectCycles = (state: AppState) => Math.floor(state.game.cycles);
export const selectSeconds = (state: AppState) => Math.floor(state.game.simTimeSec);
export const selectBootLine = (state: AppState) => state.game.logs.at(-1)?.text ?? '';
/**
 * The KERNEL // LIVE line (#541): the newest story line, which a run of mechanical lines (hires, repeated requests)
 * does not displace; those still read in the history.
 */
export const selectLatestLog = (state: AppState) => {
  const entry = previewLog(state.game, CONTENT);
  return entry === undefined ? '' : logLineText(entry, CONTENT);
};
/** Already true at the very start of a run, and after a wipe or a reboot. */
export const selectOpening = (state: AppState) => state.game.unlockedNodes.length === 0;
/**
 * How many entries the opening block carries. The newest entry is the chrome's
 * KERNEL // LIVE preview (selectLatestLog), so the block starts at the next one and
 * this pair is the single place that division is decided; a panel review flagged the
 * same slice hard-coded in the view as a place the two could drift apart.
 */
export const BOOT_LOG_ENTRIES = 3;
export const selectBootLogText = (state: AppState) =>
  state.game.logs.slice(1, 1 + BOOT_LOG_ENTRIES).map((entry) => entry.text).join('\n');
export const selectReady = (state: AppState) => state.ready;
export const selectNotice = (state: AppState) => state.notice;

export function useGameValue<T extends string | number | boolean | null>(selector: (state: AppState) => T): T {
  return useStore(gameStore.store, selector);
}
