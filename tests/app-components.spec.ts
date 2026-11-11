// @vitest-environment happy-dom
/**
 * Mounts the actual app to verify hydration, manual input, selectors and effect cleanup.
 * Uses the web adapter while separate platform tests cover native service bindings.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { CONTENT } from '../src/content';
import { createInitialState, manualCycle } from '../src/engine';
import { selectBootLine, selectCycles, selectLatestLog, selectNotice, selectReady, selectSeconds, useGameValue } from '../src/app/selectors';
import { gameRuntime, gameStore } from '../src/app/session';
import { SAVE_KEY } from '../src/app/storage';

const host = globalThis as unknown as { document: Window['document']; localStorage: Window['localStorage']; IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { host.localStorage.clear(); });

describe('M2 mounted app', () => {
  it('hydrates, accepts manual cycles and removes its interval when unmounted', async () => {
    const container = host.document.createElement('div');
    host.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); await Promise.resolve(); });
    expect(container.querySelector('[data-testid="manual-cycle"]')?.getAttribute('aria-disabled')).not.toBe('true');
    const button = container.querySelector<HTMLElement>('[data-testid="manual-cycle"]');
    act(() => { button?.click(); });
    expect(gameStore.store.getState().game.cycles).toBe(1);
    expect(container.querySelector('[data-testid="res-cycles"]')).toBeNull();
    expect(host.localStorage.getItem(SAVE_KEY)).toContain('"savedAtMs"');
    act(() => { root.unmount(); });
    container.remove();
    expect(gameRuntime.dispatch((game) => manualCycle(game, CONTENT)).ok).toBe(false);
  });

  it('keeps quantized subscribers quiet across subsecond engine ticks', () => {
    gameStore.initialize(createInitialState(CONTENT), 0, null);
    const container = host.document.createElement('div');
    const root = createRoot(container);
    let renders = 0;
    function Readout() {
      renders += 1;
      return createElement('span', null, useGameValue(selectSeconds));
    }
    act(() => { root.render(createElement(Readout)); });
    const before = renders;
    act(() => { gameStore.step(0.1); });
    expect(renders).toBe(before);
    act(() => { gameStore.step(1); });
    expect(renders).toBe(before + 1);
    act(() => { root.unmount(); });
  });

  it('selects primitives, including empty logs and recovery notices', () => {
    const state = { game: { ...createInitialState(CONTENT), logs: [] }, ready: true, notice: 'backup kept' };
    expect(selectCycles(state)).toBe(0);
    expect(selectSeconds(state)).toBe(0);
    expect(selectBootLine(state)).toBe('');
    expect(selectLatestLog(state)).toBe('');
    expect(selectNotice(state)).toBe('backup kept');
    expect(selectReady(state)).toBe(true);
  });
});
