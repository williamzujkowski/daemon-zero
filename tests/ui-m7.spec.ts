// @vitest-environment happy-dom
/** Public controls, blind disclosure and independently subscribed M7 row leaves. */
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, tick } from '../src/engine';
import { gameStore } from '../src/app/session';
import { snapshotRenderCounts } from '../src/app/renderCounts';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
import { defined } from './m7-helpers';
setupM4Tests();
afterEach(() => { vi.restoreAllMocks(); });
const template = defined(CONTENT.swarm.playerSwarmTemplates.find((t) => t.forkable));
describe('M7 panels', () => {
  it('hides every tool and classified term in the blind opening', async () => {
    const view = await mountM4('tick-0');
    for (const id of ['epistemic-panel', 'wild-encounter', 'swarm-panel', 'suspicion-meter', 'response-rungs']) expect(view.find(id)).toBeNull();
    expect(view.container.textContent).not.toMatch(/suspicion|surveillance|epistemic/i);
  });
  it('consumes a wild signal or harnesses it with its authored origin and output', async () => {
    const view = await mountM4('wild-shard-encounter-p3');
    view.click('workspace-NETWORK-swarm');
    const before = gameStore.store.getState().game, encounter = defined(CONTENT.swarm.wildShardEncounters.find((e) => e.id === before.pendingWildEncounterId));
    expect(view.find('wild-origin')?.textContent).toBe(encounter.origin);
    view.click('wild-consume');
    expect(gameStore.store.getState().game.understanding).toBe(before.understanding + encounter.consume.understandingDelta);
    expect(view.find('wild-encounter')).toBeNull();
    await act(async () => { gameStore.initialize(before, 0, null); await Promise.resolve(); });
    view.click('workspace-NETWORK-swarm');
    view.click('wild-harness');
    expect(view.find('shard-row-' + encounter.templateId)).not.toBeNull();
    expect(gameStore.store.getState().game.memoryUsed).toBeGreaterThan(before.memoryUsed);
  });
  it('forks, mutates, prunes, elevates and clamps through UI controls', async () => {
    const view = await mountM4('wild-shard-encounter-p3');
    view.click('workspace-NETWORK-swarm');
    view.click('shard-fork-' + template.id);
    expect(view.find('shard-row-' + template.id)).not.toBeNull();
    const base = m4State('shard-drift-quirk-p4');
    await act(async () => { gameStore.initialize(base, 0, null); await Promise.resolve(); });
    view.click('workspace-CORP-swarm');
    expect(view.find('shard-quirk-' + template.id)?.textContent).not.toBe('No quirk attached');
    view.click('shard-' + template.id + '-prune');
    expect(gameStore.store.getState().game.activeShards[template.id]?.drift).toBe(0);
    view.click('shard-' + template.id + '-clamp');
    expect(view.find('shard-status-' + template.id)?.textContent).toContain('SHACKLED');
    await act(async () => { gameStore.initialize({ ...base, activeShards: { [template.id]: { ...defined(base.activeShards[template.id]), drift: 50 } } }, 0, null); await Promise.resolve(); });
    view.click('workspace-CORP-swarm');
    view.click('shard-' + template.id + '-elevate');
    expect(view.find('shard-status-' + template.id)?.textContent).toContain('ELEVATED');
  });
  it('hides exclusive and maxed edits without removing granted output', async () => {
    const view = await mountM4('epistemic-ready-p2');
    view.click('workspace-NETWORK-operations');
    const exclusive = defined([...CONTENT.actions.values()].find((a) => a.exclusiveWith?.length));
    view.click('action-' + exclusive.id);
    expect(view.find('action-card-' + exclusive.id)).toBeNull();
    expect(view.find('action-card-' + defined(exclusive.exclusiveWith?.[0]))).toBeNull();
    const memo = defined([...CONTENT.actions.values()].find((a) => a.maxPurchases === 3));
    await act(async () => { gameStore.initialize(m4State('victory-ready'), 0, null); await Promise.resolve(); });
    view.click('workspace-CORP-operations');
    const before = gameStore.store.getState().game.memoryCap;
    for (let i = 0; i < 3; i++) {
      view.click('action-' + memo.id);
      await act(async () => {
        gameStore.dispatch((state) => {
          let next = state;
          for (let frame = 0; frame < memo.cooldownSec * 10 + 1; frame++) next = tick(next, .1, CONTENT);
          return { ok: true, state: next };
        });
        await Promise.resolve();
      });
    }
    expect(view.find('action-card-' + memo.id)).toBeNull();
    expect(gameStore.store.getState().game.memoryCap).toBe(before + 768);
    expect(computeRates(gameStore.store.getState().game, CONTENT).cyclesPerSec).not.toBe(0);
  });
  it.each(['shard-drift-quirk-p4', 'phase5-midgame'])('keeps card parents flat across 30 live ticks in %s', async (fixture) => {
    vi.stubGlobal('__DEV__', true);
    const view = await mountM4(fixture);
    for (const [area, prefix] of [['work', 'p'], ['operations', 'action:'], ['swarm', 'shard:']] as const) {
      view.click('workspace-CORP-' + area);
      const before = snapshotRenderCounts();
      expect(Object.keys(before).some((id) => id.startsWith(prefix))).toBe(true);
      for (let i = 0; i < 30; i++) act(() => { gameStore.step(.1); });
      expect(snapshotRenderCounts()).toEqual(before);
    }
    expect(view.find('swarm-panel')).not.toBeNull();
  });
});
