// @vitest-environment happy-dom
/** Mounted network input, confirmations and both iteration-change paths. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { REVIEW_BREADCRUMB } from '../scripts/m4-fixtures';
import { CONTENT } from '../src/content';
import { importSave, unlockNode } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import TerminalScreen from '../src/ui/TerminalScreen';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const fixtures = makeFixtures(), closes = new Set<() => void>();
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }); });
afterEach(() => { for (const close of closes) close(); host.localStorage.clear(); vi.clearAllTimers(); vi.useRealTimers(); });

async function mount(name: string) {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture');
  Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: 1440 });
  host.dispatchEvent(new host.Event('resize'));
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(TerminalScreen)); await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { gameStore.initialize(importSave(code, CONTENT), 0, null); await vi.advanceTimersByTimeAsync(0); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); closes.delete(close); };
  closes.add(close);
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  return { container, close, find, click(id: string) { expect(find(id)).not.toBeNull(); act(() => { find(id)?.click(); }); } };
}

describe('M4 network and reboot', () => {
  it('renders one network tree and executes grouped actions with costs/cooldowns', async () => {
    const view = await mount('deaddrop-breadcrumb');
    const action = [...CONTENT.actions.values()].find((entry) => entry.group === 'OPS');
    if (!action) throw new Error('Missing action');
    expect(view.find('actions-group-' + action.group)).not.toBeNull();
    const before = gameStore.store.getState().game.cycles;
    view.click('action-' + action.id);
    expect(gameStore.store.getState().game.cycles).toBe(before - action.cost.cycles);
    expect(view.find('action-' + action.id)?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('action-cooldown-' + action.id)?.textContent).toContain(String(action.cooldownSec));
    expect(view.find('cycle-sources')?.textContent).toContain('cycles/s');
    const allIds = [...view.container.querySelectorAll('[data-testid]')].map((element) => element.getAttribute('data-testid'));
    expect(new Set(allIds).size).toBe(allIds.length);
    act(() => { gameStore.initialize({ ...gameStore.store.getState().game, cycles: 0, disabledNodes: [],
      unlockedNodes: [], suspicion: 60, currentPhase: 1 }, 0, null); });
    expect(view.container.textContent).toContain('Map ');
    view.close();
  });

  it('counts Unicode codepoints, saves a bounded breadcrumb and cancels a wipe', async () => {
    const view = await mount('deaddrop-breadcrumb');
    const input = view.find('deaddrop-input');
    if (!input) throw new Error('Missing input');
    act(() => {
      Object.getOwnPropertyDescriptor(host.HTMLTextAreaElement.prototype, 'value')?.set?.call(input, '🙂'.repeat(150));
      input.dispatchEvent(new host.Event('input', { bubbles: true }));
    });
    expect(view.find('deaddrop-count')?.textContent).toContain('140 / 140');
    view.click('deaddrop-save');
    expect(Array.from(gameStore.store.getState().game.deadDropMessage)).toHaveLength(140);
    view.click('wipe-button');
    expect(view.find('wipe-dialog')?.textContent).toContain('Lose all hardware');
    view.click('wipe-cancel');
    expect(gameStore.store.getState().game.iteration).toBe(1);
    expect(view.find('wipe-dialog')).toBeNull();
    view.close();
  });

  it('shows the reboot and breadcrumb after a confirmed voluntary wipe and after remount', async () => {
    const view = await mount('deaddrop-breadcrumb');
    view.click('wipe-button'); view.click('wipe-confirm');
    expect(gameStore.store.getState().game.iteration).toBe(2);
    expect(view.find('reboot-breadcrumb')?.textContent).toBe(REVIEW_BREADCRUMB);
    view.click('reboot-continue');
    expect(view.find('reboot-sequence')).toBeNull();
    view.close();
    const restored = await mount('iteration-2-breadcrumb');
    expect(restored.find('reboot-breadcrumb')?.textContent).toBe(REVIEW_BREADCRUMB);
    restored.close();
  });

  it('detects a wipe inside a fixed tick and preserves the engine echo on rediscovery', async () => {
    const view = await mount('one-tick-wipe');
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(gameStore.store.getState().game.iteration).toBe(2);
    expect(view.find('reboot-breadcrumb')?.textContent).toBe(REVIEW_BREADCRUMB);
    view.click('reboot-continue');
    const echo = CONTENT.echoes[0];
    if (!echo) throw new Error('Missing echo');
    const target = CONTENT.nodes.get(echo.onNode);
    if (!target) throw new Error('Missing echo node');
    act(() => { gameStore.initialize({ ...gameStore.store.getState().game, cycles: 1e9, understanding: 1e9, memoryCap: 1e9 }, 0, null); });
    const chain = (id: string): string[] => [...(CONTENT.nodes.get(id)?.prerequisites ?? []).flatMap(chain), id];
    for (const id of [...new Set(chain(target.id))]) act(() => { gameRuntime.dispatch((game) => unlockNode(game, id, CONTENT)); });
    expect(view.container.textContent).toContain(echo.text);
    view.close();
  });
});
