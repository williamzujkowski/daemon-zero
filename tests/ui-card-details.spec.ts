// @vitest-environment happy-dom
/** Optional prose never changes a run or leaks a prior run's expanded content. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { wipe, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import CardDetails from '../src/ui/CardDetails';
import { fresh, grant, PHASE0, PHASE1, rich } from './helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const initial = { id: 'sample', title: 'Mapped interface', description: 'A recoverable, optional facility record.' };
const mounted = new Set<() => void>();
afterEach(() => { for (const close of mounted) close(); });
const decoded = () => grant(rich(), ...PHASE0, ...PHASE1);

async function mount(state: GameState = fresh(), props = initial) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  let commits = 0;
  const render = (next: typeof initial) => { root.render(createElement(Profiler,
    { id: 'details', onRender: () => { commits += 1; } }, createElement(CardDetails, next))); };
  await act(async () => { gameStore.initialize(state, 0, null); render(props); await Promise.resolve(); });
  const find = (id: string) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { container, find, commits: () => commits,
    update: (next: typeof initial) => { act(() => { render(next); }); },
    toggle: (id = props.id) => { act(() => { find('details-' + id)?.click(); }); } };
}

describe('compact card details', () => {
  it('keeps optional prose out of the collapsed DOM and exposes an associated, named disclosure', async () => {
    const view = await mount(), toggle = view.find('details-sample');
    expect(view.container.textContent).toContain(initial.title);
    expect(view.container.textContent).not.toContain(initial.description);
    expect(view.find('details-body-sample')).toBeNull();
    expect(toggle?.getAttribute('role')).toBe('button');
    expect(toggle?.getAttribute('aria-label')).toContain(initial.title);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    const before = gameStore.store.getState().game;
    toggle?.focus(); view.toggle();
    expect(host.document.activeElement).toBe(toggle);
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(view.find('details-body-sample')?.textContent).toBe(initial.description);
    view.toggle();
    expect(view.find('details-body-sample')).toBeNull();
    expect(gameStore.store.getState().game).toBe(before);
  });

  it('omits empty and classified-only controls without exposing hidden text', async () => {
    const view = await mount(fresh(), { ...initial, description: '   ' });
    expect(view.find('details-sample')).toBeNull();
    view.update({ ...initial, description: 'Suspicion is 99 here.' });
    expect(view.find('details-sample')).toBeNull();
    expect(view.container.textContent).not.toMatch(/suspicion|99/i);
    act(() => { gameStore.initialize(decoded(), 0, null); });
    expect(view.find('details-sample')).not.toBeNull();
    view.toggle();
    expect(view.find('details-body-sample')?.textContent).toBe('Suspicion is 99 here.');
    act(() => { gameStore.initialize(fresh(), 0, null); });
    expect(view.find('details-body-sample')).toBeNull();
    expect(view.container.textContent).not.toMatch(/suspicion|99/i);
  });

  it.each(['id', 'title', 'description'] as const)('collapses when its %s changes', async (field) => {
    const view = await mount(); view.toggle();
    const next = { ...initial, [field]: 'Replacement' };
    view.update(next);
    expect(view.find('details-' + next.id)?.getAttribute('aria-expanded')).toBe('false');
    expect(view.find('details-body-' + next.id)).toBeNull();
  });

  it('collapses on same-iteration restore, real wipe and Start Fresh without saving expansion', async () => {
    const state = decoded(), view = await mount(state);
    view.toggle();
    act(() => { gameStore.initialize(state, 0, null); });
    expect(view.find('details-sample')?.getAttribute('aria-expanded')).toBe('false');
    view.toggle();
    act(() => { gameStore.dispatch((game) => ({ ok: true, state: wipe(game, CONTENT, 'Manual purge', 'VOLUNTARY') })); });
    expect(gameStore.store.getState().game.iteration).toBe(state.iteration + 1);
    expect(view.find('details-sample')?.getAttribute('aria-expanded')).toBe('false');
    view.toggle();
    act(() => { gameStore.initialize(fresh(), 0, null); });
    expect(view.find('details-sample')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not rerender its static content across 30 live ticks, collapsed or expanded', async () => {
    const view = await mount(decoded());
    for (const expanded of [false, true]) {
      if (expanded) view.toggle();
      const before = view.commits();
      for (let tick = 0; tick < 30; tick += 1) act(() => { gameStore.step(0.1); });
      expect(view.commits()).toBe(before);
    }
  });
});
