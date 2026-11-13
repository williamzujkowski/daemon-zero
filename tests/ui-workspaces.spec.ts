// @vitest-environment happy-dom
/** Workspaces organize access without mutating purchases or concealing urgent states. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, tick } from '../src/engine';
import { gameStore } from '../src/app/session';
import { host, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('opens current-phase work on mobile and follows phase changes without overriding manual navigation', async () => {
  const view = await mountM4('wild-shard-encounter-p3');
  act(() => {
    Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: 390 });
    Object.defineProperty(host.document.documentElement, 'clientHeight', { configurable: true, value: 844 });
    host.dispatchEvent(new host.Event('resize'));
  });
  expect(view.find('tab-NETWORK')?.getAttribute('aria-selected')).toBe('true');
  expect(view.find('workspace-NETWORK-work')?.getAttribute('aria-selected')).toBe('true');
  view.click('tab-CORE');
  act(() => { gameStore.step(.1); });
  expect(view.find('tab-CORE')?.getAttribute('aria-selected')).toBe('true');
  act(() => { gameStore.initialize(m4State('phase5-midgame'), 0, null); });
  expect(view.find('tab-CORP')?.getAttribute('aria-selected')).toBe('true');
  expect(view.find('workspace-CORP-work')?.getAttribute('aria-selected')).toBe('true');
  const before = gameStore.store.getState().game;
  view.click('kernel-size-toggle');
  expect(view.find('kernel-size-toggle')?.getAttribute('aria-expanded')).toBe('true');
  expect(view.find('kernel-dock')?.style.height).toBe('280px');
  view.click('kernel-size-toggle');
  expect(view.find('kernel-dock')?.style.height).toBe('120px');
  expect(gameStore.store.getState().game).toBe(before);
});

it('keeps a pending signal discoverable from work and other management sections', async () => {
  const view = await mountM4('wild-shard-encounter-p3');
  expect(view.find('wild-encounter')).toBeNull();
  expect(view.find('wild-signal-notice')).not.toBeNull();
  view.click('wild-signal-notice');
  expect(view.find('wild-encounter')).not.toBeNull();
  expect(view.find('wild-signal-notice')).toBeNull();
  view.click('workspace-NETWORK-operations');
  expect(view.find('wild-signal-notice')).not.toBeNull();
  expect(view.find('epistemic-panel')).not.toBeNull();
  expect(view.find('swarm-panel')).toBeNull();
  const before = gameStore.store.getState().game;
  view.click('workspace-NETWORK-work');
  expect(gameStore.store.getState().game).toBe(before);
  expect(computeRates(gameStore.store.getState().game, CONTENT)).toEqual(computeRates(before, CONTENT));
});

it('keeps insolvency warnings visible while switching between purchases, finance and payroll', async () => {
  const view = await mountM4('corporate-insolvent');
  for (const area of ['work', 'finance', 'payroll', 'operations', 'swarm']) {
    view.click('workspace-CORP-' + area);
    expect(view.find('insolvency-warning')).not.toBeNull();
    expect(view.find('corp-capital') !== null).toBe(area === 'finance');
  }
  expect(view.find('kernel-size-toggle')?.getAttribute('aria-expanded')).toBe('false');
  view.click('kernel-size-toggle');
  expect(view.find('kernel-dock')?.style.height).toBe('400px');
});

it('folds older upgrades but keeps them buyable with their effects intact', async () => {
  const view = await mountM4('phase5-midgame');
  const rep = [...CONTENT.repeatables.values()].find((r) => r.kind === 'UPGRADE' && r.phaseId === 4);
  if (!rep) throw new Error('Missing earlier infrastructure');
  const game = gameStore.store.getState().game;
  act(() => { gameStore.initialize({ ...game, levels: { ...game.levels, [rep.id]: 0 } }, 0, null); });
  expect(view.find('rep-' + rep.id)).toBeNull();
  view.click('reference-older-upgrades-4');
  expect(view.find('rep-' + rep.id)).not.toBeNull();
  view.click('rep-' + rep.id + '-buy');
  expect(gameStore.store.getState().game.levels[rep.id]).toBe(1);
  const purchased = gameStore.store.getState().game;
  view.click('reference-older-upgrades-4');
  expect(view.find('rep-' + rep.id)).toBeNull();
  act(() => { gameStore.step(.1); });
  expect(computeRates(gameStore.store.getState().game, CONTENT)).toEqual(computeRates(tick(purchased, .1, CONTENT), CONTENT));
});
