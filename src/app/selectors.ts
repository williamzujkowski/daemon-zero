/**
 * Exposes primitive or quantized subscriptions rather than the full game object.
 * Components only render when the values they display actually change.
 */
import { useStore } from 'zustand';
import { gameStore } from './session';
import type { AppState } from './store';

export const selectCycles = (state: AppState) => Math.floor(state.game.cycles);
export const selectSeconds = (state: AppState) => Math.floor(state.game.simTimeSec);
export const selectBootLine = (state: AppState) => state.game.logs.at(-1)?.text ?? '';
export const selectLatestLog = (state: AppState) => state.game.logs[0]?.text ?? '';
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
