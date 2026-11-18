// @vitest-environment happy-dom
/**
 * #262 on the preview composition: the node card shows a returning instance under campaign rules the
 * price it is charged for the rediscovered log spoofer, and says what that saves. The preview store
 * admits every game to campaign rules, so the legacy line is pinned by the production UI specs
 * (tests/ui-second-pass-followup.spec.ts); here a first mapping keeps the full price and no line.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/content', async () => await import('../src/content/preview'));
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { activateCampaignRules, createInitialState, unlockNode, wipe, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import NodeCard from '../src/ui/NodeCard';
import { preview } from './campaign-helpers';
import { must, PHASE0, PHASE1, rich } from './helpers';
import { defined } from './m7-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });

const spoofer = defined(preview.nodes.get('p2_log_spoofer'));

function returning(campaign: boolean): GameState {
  const start = rich(createInitialState(preview));
  const first = campaign ? must(activateCampaignRules(start, preview)) : start;
  const mapped = [...PHASE0, ...PHASE1, 'p2_arp_discovery', spoofer.id].reduce((s, id) => must(unlockNode(s, id, preview)), first);
  return wipe(mapped, preview, 'test', 'VOLUNTARY');
}

async function mount(state: GameState) {
  if (!stop) {
    vi.useFakeTimers();
    stop = gameRuntime.start();
    await settle();
  }
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => { gameStore.initialize(state, 0, null); root.render(createElement(NodeCard, { node: spoofer })); await settle(); });
  const text = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="node-' + spoofer.id + id + '"]')?.textContent ?? '';
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { text, close };
}

describe('the rediscovered log spoofer card', () => {
  it('shows a campaign return the discounted price and what it saves', async () => {
    const view = await mount(returning(true));
    // A narrow test viewport prints compact numbers; either form names the same price.
    expect(view.text('-cost')).toMatch(/^Cost: 6,?250 cycles · 2(,000|K) understanding · 64 MB \(remembered\)$/);
    expect(view.text('-rediscovery')).toMatch(/^First mapping: 25(,000|K) cycles/);
    expect(view.text('-rediscovery')).toContain('Rediscovery saves 75% of cycles and 50% of understanding.');
  });

  it('keeps the full price and no rediscovery line for a first mapping', async () => {
    const first = [...PHASE0, ...PHASE1, 'p2_arp_discovery'].reduce((s, id) => must(unlockNode(s, id, preview)), must(activateCampaignRules(rich(createInitialState(preview)), preview)));
    const view = await mount(first);
    expect(view.text('-cost')).toMatch(/^Cost: 25(,000|K) cycles/);
    expect(view.text('-rediscovery')).toBe('');
  });
});
