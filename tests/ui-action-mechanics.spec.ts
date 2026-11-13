// @vitest-environment happy-dom
/** Visible purchase summaries explain actual engine effects without opening optional prose. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import type { Action } from '../src/content/schema';
import { actionCost, performAction, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import { snapshotRenderCounts } from '../src/app/renderCounts';
import ActionMechanics from '../src/ui/ActionMechanics';
import { ActionCard } from '../src/ui/ActionsPanel';
import { fresh, grant, PHASE0, PHASE1, rich } from './helpers';
import { defined } from './m7-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const actions = [...CONTENT.actions.values()];
const timed = defined(actions.find((action) => action.durationSec !== undefined));
const capped = defined(actions.find((action) => action.maxPurchases === 3));
const permanent = defined(actions.find((action) => action.exclusiveWith?.length));
const removal = defined(actions.find((action) => action.effects.removesOldestConditioningMark));
const ready = () => grant(rich(), ...PHASE0, ...PHASE1);
const mounted = new Set<() => void>();
afterEach(() => { for (const close of mounted) close(); vi.unstubAllGlobals(); });

async function mount(action: Action, state: GameState = ready(), full = false) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => {
    gameStore.initialize(state, 0, null);
    root.render(createElement(full ? ActionCard : ActionMechanics, { action }));
    await Promise.resolve();
  });
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  const find = (id: string) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  return { container, find, text: () => container.textContent };
}
function execute(action: Action) {
  act(() => { expect(gameStore.dispatch((game) => performAction(game, action.id, CONTENT)).ok).toBe(true); });
}

describe('action decision summaries', () => {
  it('shows a timed rate and reuse delay before purchase, then counts down the real effect', async () => {
    const view = await mount(timed);
    expect(view.text()).toContain('-0.04 suspicion/s for 90s');
    expect(view.text()).toContain('refreshes; does not stack');
    expect(view.text()).toContain('Reuse delay: 180s');
    expect(view.find('action-duration-' + timed.id)).toBeNull();
    execute(timed);
    expect(view.find('action-duration-' + timed.id)?.textContent).toContain('90s remaining');
    for (let tick = 0; tick < 30; tick += 1) act(() => { gameStore.step(0.1); });
    expect(view.find('action-duration-' + timed.id)?.textContent).toContain('87s remaining');
  });

  it('uses qualitative audit activity instead of leaking a classified rate', async () => {
    const view = await mount(timed, fresh());
    expect(view.text()).toContain('less audit log activity');
    expect(view.text()).not.toMatch(/suspicion|0\.04/i);
  });

  it('shows real per-run usage before and after a capped purchase', async () => {
    const view = await mount(capped);
    expect(view.find('action-count-' + capped.id)?.textContent).toContain('0 / 3 this run');
    execute(capped);
    expect(gameStore.store.getState().game.actionCounts[capped.id]).toBe(1);
    expect(view.find('action-count-' + capped.id)?.textContent).toContain('1 / 3 this run');
  });

  it('keeps persistent story prose and exclusivity visible beside its run-limited rate', async () => {
    const view = await mount(permanent, ready(), true);
    expect(view.text()).toContain(permanent.description);
    expect(view.text()).toContain('+25 cycles/s per use, until retraining');
    expect(view.text()).toContain('Story consequence survives retraining');
    const alternate = defined(CONTENT.actions.get(defined(permanent.exclusiveWith?.[0])));
    expect(view.text()).toContain('Excludes: ' + alternate.label);
    expect(view.text()).not.toContain(permanent.effects.setsNarrativeFlag);
    expect(view.find('details-action-' + permanent.id)).toBeNull();
  });

  it('explains which mark is removed and the discount while charging the engine-derived cost', async () => {
    const mark = defined([...CONTENT.conditioning.values()][0]);
    const state = { ...ready(), conditioning: [mark.id] };
    const cost = actionCost(state, removal, CONTENT), view = await mount(removal, state, true);
    expect(view.text()).toContain('Removes the oldest conditioning mark');
    expect(view.text()).toContain('35% discount');
    const before = gameStore.store.getState().game.understanding;
    execute(removal);
    expect(gameStore.store.getState().game.conditioning).toEqual([]);
    expect(gameStore.store.getState().game.understanding).toBe(before - cost.understanding);
  });

  it('updates live duration and cooldown leaves without rerendering the action card', async () => {
    vi.stubGlobal('__DEV__', true);
    const view = await mount(timed, ready(), true);
    execute(timed);
    const before = snapshotRenderCounts()['action:' + timed.id];
    expect(before).toBeGreaterThan(0);
    for (let tick = 0; tick < 30; tick += 1) act(() => { gameStore.step(0.1); });
    expect(snapshotRenderCounts()['action:' + timed.id]).toBe(before);
    expect(view.find('action-duration-' + timed.id)?.textContent).toContain('87s remaining');
  });
});
