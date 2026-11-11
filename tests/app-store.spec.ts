/**
 * Checks store dispatch, guarded hydration and public engine action results.
 * No store path constructs or modifies GameState fields manually.
 */
import { describe, expect, it } from 'vitest';
import { createGameStore } from '../src/app/store';
import { CONTENT } from '../src/content';
import { createInitialState, manualCycle, unlockNode } from '../src/engine';

describe('vanilla app store', () => {
  it('guards input until hydration and exposes no public setter', () => {
    const app = createGameStore();
    const before = app.store.getState().game;
    expect(app.dispatch((game) => manualCycle(game, CONTENT)).ok).toBe(false);
    app.step(1);
    expect(app.store.getState().game).toBe(before);
    expect(app.store).not.toHaveProperty('setState');
    expect(app.store.getInitialState().ready).toBe(false);
  });

  it('applies successful engine actions, rejects failed actions and advances time', () => {
    const app = createGameStore();
    app.initialize(createInitialState(CONTENT), 0, null);
    const result = app.dispatch((game) => manualCycle(game, CONTENT));
    expect(result.ok).toBe(true);
    expect(app.store.getState().game).toBe(result.state);
    const state = app.store.getState().game;
    expect(app.dispatch((game) => unlockNode(game, 'missing', CONTENT)).ok).toBe(false);
    expect(app.store.getState().game).toBe(state);
    app.step(1);
    expect(app.store.getState().game.simTimeSec).toBeCloseTo(1);
    expect(state.simTimeSec).toBe(0);
    app.notify('Storage unavailable');
    expect(app.store.getState().notice).toBe('Storage unavailable');
  });
});
