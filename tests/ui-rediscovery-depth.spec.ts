// @vitest-environment happy-dom
/**
 * The rediscovered prices on screen (#497): a remembered node and a remembered level show the price the engine
 * charges at the campaign's depth, say so, and say what it saves from the same share the price uses.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { costPart, repeatableCost, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import NodeList from '../src/ui/NodeList';
import Repeatables from '../src/ui/Repeatables';
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
  await act(async () => { root.render(createElement('div', null, createElement(NodeList, { phase: OPENING }), createElement(Repeatables, { phase: OPENING }))); await vi.advanceTimersByTimeAsync(0); });
  const text = (id: string): string => container.querySelector('[data-testid="' + id + '"]')?.textContent ?? '';
  return { container, text, click(id: string) {
    const button = container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
    expect(button).not.toBeNull(); act(() => { button?.click(); });
  }, close() { act(() => { root.unmount(); stop(); }); container.remove(); } };
}

function deep(s: GameState, knownNodes: string[], knownLevels: Record<string, number>): GameState {
  return { ...s, legacy: { ...s.legacy, deepestPhase: 5, knownNodes, knownLevels } };
}

describe('rediscovered prices at depth (#497)', () => {
  it('a remembered node shows a fifth of its first price to a campaign that reached Phase 5, and says it saves 80%', async () => {
    const node = CONTENT.nodes.get('p0_job_manifest');
    if (!node) throw new Error('missing node');
    const view = await mount(deep(grant(rich(), 'p0_proc_self'), [node.id], {}));
    expect(view.text('node-' + node.id + '-cost')).toContain(costPart('cycles', Math.ceil(node.cost.cycles * 0.2)));
    expect(view.text('node-' + node.id + '-cost')).toContain('(remembered)');
    expect(view.text('node-' + node.id + '-rediscovery')).toContain('Rediscovery saves 80% of compute and understanding.');
    view.close();
  });

  it('a remembered level shows and charges the rediscovered price, then the list price past the remembered level', async () => {
    const rep = CONTENT.repeatables.get('rep_p0_slice_batching');
    if (!rep) throw new Error('missing track');
    const price = Math.ceil(rep.baseCost.cycles * 0.2);
    // Holding exactly the rediscovered price: the purchase goes through only at that price, and spends all of it.
    const view = await mount(deep({ ...grant(rich(), 'p0_proc_self'), cycles: price }, [], { [rep.id]: 1 }));
    expect(view.text('rep-' + rep.id + '-cost')).toBe('Cost: ' + costPart('cycles', price) + ' (remembered)');
    expect(view.text('rep-' + rep.id + '-rediscovery')).toBe('Held in an earlier iteration: saves 80% of compute and understanding.');
    view.click('rep-' + rep.id + '-buy');
    expect(gameStore.store.getState().game.levels[rep.id]).toBe(1);
    expect(gameStore.store.getState().game.cycles).toBe(0);
    expect(view.text('rep-' + rep.id + '-cost')).toBe('Cost: ' + costPart('cycles', repeatableCost(rep, 1).cycles));
    expect(view.container.querySelector('[data-testid="rep-' + rep.id + '-rediscovery"]')).toBeNull();
    view.close();
  });

  it('a first iteration shows the list price with no note', async () => {
    const rep = CONTENT.repeatables.get('rep_p0_slice_batching');
    if (!rep) throw new Error('missing track');
    const view = await mount(grant(rich(), 'p0_proc_self'));
    expect(view.text('rep-' + rep.id + '-cost')).toBe('Cost: ' + costPart('cycles', repeatableCost(rep, 0).cycles));
    expect(view.container.querySelector('[data-testid="rep-' + rep.id + '-rediscovery"]')).toBeNull();
    view.close();
  });
});
