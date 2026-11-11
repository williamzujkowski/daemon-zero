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
  notice: string | null;
}

export type GameAction = (game: GameState) => ActionResult;

export function createGameStore(content: ContentRegistry = CONTENT) {
  const state = createStore<AppState>(() => ({
    game: createInitialState(content), ready: false, notice: null,
  }));
  const store = {
    getState: state.getState, getInitialState: state.getInitialState, subscribe: state.subscribe,
  };
  return {
    store,
    initialize(game: GameState, elapsedSec: number, notice: string | null) {
      state.setState({ game: advance(game, elapsedSec, content), ready: true, notice });
    },
    dispatch(action: GameAction): ActionResult {
      const { game, ready } = state.getState();
      if (!ready) return { ok: false, state: game, reason: 'The save is still loading.' };
      const result = action(game);
      if (result.ok) state.setState({ game: result.state });
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
