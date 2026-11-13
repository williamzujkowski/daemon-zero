/**
 * Holds engine state in a vanilla Zustand store and applies only engine results.
 * The public read API omits setState; loading receives codec-validated state.
 */
import { createStore } from 'zustand/vanilla';
import { CONTENT } from '../content';
import type { ContentRegistry } from '../content/registry';
import { advance, createInitialState, type ActionResult, type GameState } from '../engine';

export interface AppState {
  game: GameState;
  ready: boolean;
  /** Presentation-only load identity; never serialized into a game save. */
  restoreRevision: number;
  notice: string | null;
}

export type GameAction = (game: GameState) => ActionResult;

export function createGameStore(content: ContentRegistry = CONTENT) {
  const state = createStore<AppState>(() => ({
    game: createInitialState(content), ready: false, restoreRevision: 0, notice: null,
  }));
  const store = {
    getState: state.getState, getInitialState: state.getInitialState, subscribe: state.subscribe,
  };
  return {
    store,
    initialize(game: GameState, elapsedSec: number, notice: string | null) {
      state.setState(({ restoreRevision }) => ({ game: advance(game, elapsedSec, content), ready: true, notice, restoreRevision: restoreRevision + 1 }));
    },
    dispatch(action: GameAction, restoring = false): ActionResult {
      const { game, ready } = state.getState();
      if (!ready) return { ok: false, state: game, reason: 'The save is still loading.' };
      const result = action(game);
      if (result.ok) state.setState(({ restoreRevision }) => ({ game: result.state, restoreRevision: restoreRevision + Number(restoring) }));
      return result;
    },
    step(elapsedSec: number) {
      if (!state.getState().ready) return;
      state.setState(({ game }) => ({ game: advance(game, elapsedSec, content) }));
    },
    notify(notice: string | null) { state.setState({ notice }); },
  };
}

export type GameStore = ReturnType<typeof createGameStore>;
