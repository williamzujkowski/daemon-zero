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
  /** The player's pause (WCAG 2.2.2, #347): while set no time passes, live or as catch-up. Saved in the envelope. */
  paused: boolean;
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
    game: createInitialState(content), ready: false, restoreRevision: 0, notice: null, paused: false,
  }));
  const store = {
    getState: state.getState, getInitialState: state.getInitialState, subscribe: state.subscribe,
  };
  return {
    store,
    initialize(game: GameState, elapsedSec: number, notice: string | null, paused = false) {
      // A save paused by the player resumes paused, and the time it was away does not count.
      state.setState(({ restoreRevision }) => ({ game: advance(admit(game, content), paused ? 0 : elapsedSec, content),
        ready: true, notice, paused, restoreRevision: restoreRevision + 1 }));
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
      // One guard for every path time takes: the live tick and the catch-up on resume.
      if (!state.getState().ready || state.getState().paused) return;
      state.setState(({ game }) => ({ game: advance(game, elapsedSec, content) }));
    },
    notify(notice: string | null) { state.setState({ notice }); },
    setPaused(paused: boolean) { state.setState({ paused }); },
  };
}

export type GameStore = ReturnType<typeof createGameStore>;
