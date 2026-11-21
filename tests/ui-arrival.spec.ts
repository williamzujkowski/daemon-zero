// @vitest-environment happy-dom
/**
 * #373: a note that arrives during play is news and opens; the same note found on load is settled and starts folded.
 * #408 panel: "the load" is each load, re-recorded after a new run, an import or a reboot.
 */
import type { Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: () => null, setItem: () => undefined },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { CONTENT } from '../src/content';
import { createInitialState, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import { loadKey, markLoaded, resetLoaded, useArrivedDuringPlay } from '../src/ui/arrival';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;

// Stands in for "released" or "answered": a condition of the game, read once when the probe mounts.
const present = (game: GameState): boolean => game.cycles >= 5;

function Probe() {
  return createElement('span', { 'data-testid': 'probe' }, useArrivedDuringPlay(present) ? 'arrived' : 'found');
}

function mount(): string | null | undefined {
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  act(() => { createRoot(container).render(createElement(Probe)); });
  return container.querySelector('[data-testid="probe"]')?.textContent;
}

const first = createInitialState(CONTENT);
const holding = { ...first, cycles: 5 };
/** Puts `game` in the store, as a load or a reboot does, and returns its key under the current restore revision. */
function load(game: GameState): string {
  gameStore.initialize(game, 0, null);
  const { restoreRevision } = gameStore.store.getState();
  return loadKey(restoreRevision, game.iteration);
}

afterEach(() => { resetLoaded(); host.document.body.innerHTML = ''; });

describe('arrival during play', () => {
  it('opens a note whose condition did not hold as this load began', () => {
    markLoaded(first, load(first));
    expect(mount()).toBe('arrived');
  });

  it('folds a note whose condition already held as this load began', () => {
    markLoaded(holding, load(holding));
    expect(mount()).toBe('found');
  });

  it('counts a note mounting before this load is recorded as found (it mounts with the load)', () => {
    markLoaded(first, load(first));
    load({ ...first, iteration: 2 });
    expect(mount()).toBe('found');
  });

  it('re-records after a reboot, so a note produced in the new iteration opens', () => {
    markLoaded(holding, load(holding));
    const rebooted = { ...first, iteration: 2 };
    markLoaded(rebooted, load(rebooted));
    expect(mount()).toBe('arrived');
  });

  it('keeps the first record for a key: a later call for the same load does not replace it', () => {
    const key = load(first);
    markLoaded(first, key);
    markLoaded(holding, key);
    expect(mount()).toBe('arrived');
  });

  it('folds a note mounted where no load is recorded at all', () => {
    load(first);
    expect(mount()).toBe('found');
  });
});
