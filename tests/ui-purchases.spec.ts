// @vitest-environment happy-dom
/** Exercises actual input, card isolation and level prices using the public engine. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { createInitialState, manualCycle, repeatableCost, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { installDevTools } from '../src/app/devTools';
import type { DevHost } from '../src/app/devTools';
import NodeList from '../src/ui/NodeList';
import Repeatables from '../src/ui/Repeatables';
import DaemonProcesses from '../src/ui/DaemonProcesses';
import { costText, deltaText } from '../src/ui/format';
import { CostSchema, TickDeltaSchema } from '../src/content/schema';
import { grant, rich } from './helpers';

const OPENING = CONTENT.phases[0]?.phaseId ?? 0;
const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { host.localStorage.clear(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function mount(game: GameState) {
  const stop = gameRuntime.start();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  act(() => { gameStore.initialize(game, 0, null); });
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement('div', null, createElement(NodeList, { phase: OPENING }), createElement(Repeatables, { phase: OPENING }), createElement(DaemonProcesses, { phase: OPENING }))); await vi.advanceTimersByTimeAsync(0); });
  return { container, click(id: string) {
    const button = container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
    expect(button).not.toBeNull(); act(() => { button?.click(); });
  }, close() { act(() => { root.unmount(); stop(); }); container.remove(); } };
}

describe('M3 purchases', () => {
  it('starts empty, discovers blind hardware after a manual probe, then removes its purchase tile on purchase', async () => {
    const node = CONTENT.phases[0]?.nodes[0];
    if (!node) throw new Error('Missing initial node');
    const view = await mount(createInitialState(CONTENT));
    expect(view.container.textContent).toBe('');
    act(() => { gameRuntime.dispatch((s) => manualCycle(s, CONTENT)); });
    expect(view.container.textContent).toContain(node.blindName);
    expect(view.container.textContent).not.toContain(node.revealedName);
    expect(view.container.querySelector('[data-testid="node-' + node.id + '-unlock"]')?.getAttribute('aria-disabled')).toBe('true');
    act(() => { gameStore.initialize(rich(), 0, null); });
    view.click('node-' + node.id + '-unlock');
    expect(view.container.querySelector('[data-testid="node-' + node.id + '"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="daemon-row-' + node.id + '"]')).toBeNull();
    expect(gameStore.store.getState().game.unlockedNodes).toContain(node.id);
    expect(gameStore.store.getState().game.disabledNodes).not.toContain(node.id);
    view.close();
  });

  it('buys a requirement-filtered upgrade, updates geometric prices, and removes the capped tile', async () => {
    const node = CONTENT.phases[0]?.nodes[0];
    const rep = [...CONTENT.repeatables.values()][0];
    if (!node || !rep) throw new Error('Missing initial content');
    const view = await mount(grant(rich(), node.id));
    expect(view.container.textContent).toContain(rep.name);
    view.click('rep-' + rep.id + '-buy');
    expect(gameStore.store.getState().game.levels[rep.id]).toBe(1);
    expect(view.container.querySelector('[data-testid="rep-' + rep.id + '-cost"]')?.textContent).toContain(String(repeatableCost(rep, 1).cycles) + ' cycles');
    act(() => { gameStore.initialize({ ...grant(rich(), node.id), levels: { [rep.id]: rep.maxLevel } }, 0, null); });
    expect(view.container.querySelector('[data-testid="rep-' + rep.id + '-buy"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="rep-' + rep.id + '"]')).toBeNull();
    view.close();
  });

  it('records committed node renders, with none for live ticks including an affordability crossing', async () => {
    vi.stubGlobal('__DEV__', true);
    const dev: DevHost = {};
    const clean = installDevTools(gameRuntime, dev);
    const first = CONTENT.phases[0]?.nodes[0];
    if (!first) throw new Error('Missing node');
    const game = grant(rich(), first.id);
    const view = await mount({ ...game, cycles: 39.5 });
    await act(async () => { await Promise.resolve(); });
    const before = dev.__daemon?.renderCounts();
    expect(Object.keys(before ?? {}).length).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(gameStore.store.getState().game.cycles).toBeGreaterThan(40);
    expect(dev.__daemon?.renderCounts()).toEqual(before);
    view.close(); clean();
  });

  it('labels free prices and negative deltas without pretending heat load is degrees per second', () => {
    expect(costText(CostSchema.parse({}))).toBe('Free');
    expect(costText(CostSchema.parse({ memory: 4, capital: 3 }))).toContain('4 MB');
    expect(deltaText(TickDeltaSchema.parse({ thermalPerSec: -2 }))).toBe('-2 heat load');
  });
});
