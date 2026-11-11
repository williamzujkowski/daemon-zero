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
export const selectReady = (state: AppState) => state.ready;
export const selectNotice = (state: AppState) => state.notice;

export function useGameValue<T extends string | number | boolean | null>(selector: (state: AppState) => T): T {
  return useStore(gameStore.store, selector);
}
