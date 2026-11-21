// @vitest-environment happy-dom
/** #373: a note that arrives during play is news and opens; the same note found on load is settled and starts folded. */
import type { Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../src/engine';
import { CONTENT } from '../src/content';
import { markLoaded, resetLoaded, useArrivedDuringPlay } from '../src/ui/arrival';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;

// The probe's condition: a later iteration than the first, standing in for "released" or "answered".
const later = (game: GameState): boolean => game.iteration > 1;

function Probe() {
  return createElement('span', { 'data-testid': 'probe' }, useArrivedDuringPlay(later) ? 'arrived' : 'found');
}

function mount(): () => string | null | undefined {
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(createElement(Probe)); });
  return () => container.querySelector('[data-testid="probe"]')?.textContent;
}

afterEach(() => { resetLoaded(); host.document.body.innerHTML = ''; });

describe('arrival during play', () => {
  const first = createInitialState(CONTENT);

  it('opens a note whose condition did not hold when the game loaded', () => {
    markLoaded(first);
    expect(mount()()).toBe('arrived');
  });

  it('folds a note whose condition already held at load, however late it mounts', () => {
    markLoaded({ ...first, iteration: 3 });
    expect(mount()()).toBe('found');
  });

  it('keeps the first load: a later call does not replace it', () => {
    markLoaded({ ...first, iteration: 3 });
    markLoaded(first);
    expect(mount()()).toBe('found');
  });

  it('folds a note mounted outside the terminal, where no load is on record', () => {
    expect(mount()()).toBe('found');
  });
});
