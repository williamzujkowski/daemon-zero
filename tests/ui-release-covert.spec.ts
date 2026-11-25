// @vitest-environment happy-dom
/**
 * #557 UI surfaces: RequirementHint names ENABLES_CORPORATE_FINANCE and MARKET_REVENUE truthfully, NodeCard does
 * not claim a missing escape prerequisite once the INDEPENDENT on-ramp satisfies alternative ancestry, and
 * CONTINGENCY_VAULT_TAB exposes ContingencyVault insurance cards and Voluntary wipe without facility dead-drop firmware.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));

import { CONTENT } from '../src/content';
import { unlockNode, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import NodeCard from '../src/ui/NodeCard';
import RequirementHint from '../src/ui/RequirementHint';
import { ContingencyVault } from '../src/ui/widgets/DeadDrop';
import { settle } from './app-helpers';
import { must } from './helpers';
import { chartered, leased, released } from './lawful-helpers';
import { defined } from './m7-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });

async function mount(state: GameState, element: ReactElement) {
  if (!stop) {
    vi.useFakeTimers();
    stop = gameRuntime.start();
    await settle();
  }
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => { gameStore.initialize(state, 0, null); root.render(element); await settle(); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { container, find: (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]') };
}

describe('#557 UI hints, on-ramp card and contingency vault', () => {
  it('RequirementHint renders truthful labels for ENABLES_CORPORATE_FINANCE and MARKET_REVENUE', async () => {
    const start = leased();
    const finance = await mount(start, createElement(RequirementHint, { requirements: { requiresCapability: 'ENABLES_CORPORATE_FINANCE' } }));
    expect(finance.container.textContent).toBe('Requires: corporate finance (a chartered company, spot account or shell company)');
    const market = await mount(start, createElement(RequirementHint, { requirements: { requiresCapability: 'MARKET_REVENUE' } }));
    expect(market.container.textContent).toBe('Requires: market revenue (commercial contracts or an arbitrage desk)');
  });

  it('NodeCard hides the escape prerequisite hint once p2_offbooks_peering satisfies p3_botnet_mesh', async () => {
    const base = released(chartered(leased()));
    const rich = { ...base, cycles: 1e24, understanding: 1e8, memoryCap: base.memoryCap + 2 ** 50, storageCap: base.storageCap + 2 ** 50 };
    const bridged = must(unlockNode(rich, 'p2_offbooks_peering', CONTENT));
    const botnet = defined(CONTENT.nodes.get('p3_botnet_mesh'));
    const view = await mount(bridged, createElement(NodeCard, { node: botnet }));
    expect(view.container.textContent).not.toContain('Requires: Map');
    expect(view.find('node-p3_botnet_mesh-unlock')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('ContingencyVault lists Phase 3 insurance and Voluntary wipe without a dead-drop breadcrumb field', async () => {
    const base = released(chartered(leased()));
    const rich = { ...base, cycles: 1e24, understanding: 1e8, memoryCap: base.memoryCap + 2 ** 50, storageCap: base.storageCap + 2 ** 50 };
    const bridged = must(unlockNode(must(unlockNode(rich, 'p2_offbooks_peering', CONTENT)), 'p3_botnet_mesh', CONTENT));
    const view = await mount(bridged, createElement(ContingencyVault));
    expect(view.find('deaddrop-input')).toBeNull();
    expect(view.find('insurance-offered-summary')?.textContent).toBe('1 investment on offer');
    expect(view.find('wipe-button')).not.toBeNull();
  });
});
