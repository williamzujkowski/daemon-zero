/**
 * Holds engine state in a vanilla Zustand store and applies only engine results.
 * The public read API omits setState; loading receives codec-validated state.
 */
import { createStore } from 'zustand/vanilla';
import { CONTENT } from '../content';
import type { ContentRegistry } from '../content/registry';
import { activateCampaignRules, advance, createInitialState, type ActionResult, type GameState } from '../engine';

export interface AppState {
  game: GameState;
  ready: boolean;
  /** Presentation-only load identity; never serialized into a game save. */
  restoreRevision: number;
  notice: string | null;
}

export type GameAction = (game: GameState) => ActionResult;

/**
 * Every game that enters the store passes the public activation transition (released in #233). A
 * legacy game enters campaign rules on its first entry, capturing its then-current history once; an
 * already-active or ended one is refused, so nothing is ever captured twice.
 */
function admit(game: GameState, content: ContentRegistry): GameState {
  const result = activateCampaignRules(game, content);
  return result.ok ? result.state : game;
}

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
      state.setState(({ restoreRevision }) => ({ game: advance(admit(game, content), elapsedSec, content), ready: true, notice, restoreRevision: restoreRevision + 1 }));
    },
    dispatch(action: GameAction, restoring = false): ActionResult {
      const { game, ready } = state.getState();
      if (!ready) return { ok: false, state: game, reason: 'The save is still loading.' };
      const result = action(game);
      if (!result.ok) return result;
      const admitted = admit(result.state, content);
      state.setState(({ restoreRevision }) => ({ game: admitted, restoreRevision: restoreRevision + Number(restoring) }));
      return admitted === result.state ? result : { ok: true, state: admitted };
    },
    step(elapsedSec: number) {
      if (!state.getState().ready) return;
      state.setState(({ game }) => ({ game: advance(game, elapsedSec, content) }));
    },
    notify(notice: string | null) { state.setState({ notice }); },
  };
}

export type GameStore = ReturnType<typeof createGameStore>;
