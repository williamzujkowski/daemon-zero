// @vitest-environment happy-dom
/** Permanent purchase exclusions hide tiles; recoverable requirements remain useful. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { permanentlyBlocked } from '../src/ui/purchaseVisibility';
import { resourceWidgets, stripOnlyWidgets } from '../src/ui/registry/widgetRegistry';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('distinguishes run ownership and lifetime trait exclusions from temporary requirements', () => {
  const game = m4State('evaluation-ready');
  expect(permanentlyBlocked(game, undefined)).toBe(false);
  expect(permanentlyBlocked(game, { maxIteration: game.iteration })).toBe(false);
  expect(permanentlyBlocked(game, { maxIteration: game.iteration - 1 })).toBe(true);
  expect(permanentlyBlocked(game, { forbidsNodes: ['unowned'] })).toBe(false);
  expect(permanentlyBlocked({ ...game, unlockedNodes: ['excluded'] }, { forbidsNodes: ['excluded'] })).toBe(true);
  expect(permanentlyBlocked(game, { minTrust: { peer: 100 }, maxSuspicion: 0, minUnderstanding: 1e20 })).toBe(false);
  expect(permanentlyBlocked({ ...game, traits: ['MOLOCH'] }, { forbidsTraits: ['MOLOCH'] })).toBe(true);
  expect(permanentlyBlocked({ ...game, traits: [], legacy: { ...game.legacy, traitsEver: ['MOLOCH'] } }, { forbidsTraits: ['MOLOCH'] })).toBe(true);
  expect(permanentlyBlocked({ ...game, traits: [], legacy: { ...game.legacy, traitsEver: [] } }, { forbidsTraits: ['MOLOCH'] })).toBe(false);
});

it('keeps resource totals and live rates only in the strip while preserving unlocks and audit', async () => {
  const view = await mountM4('tick-0');
  for (const name of ['cycles', 'memory', 'understanding']) expect(view.find('res-' + name)).toBeNull();
  const game = m4State('phase-1-widgets');
  act(() => { gameStore.initialize(game, 0, null); });
  for (const id of stripOnlyWidgets) {
    expect(game.unlockedWidgets).toContain(id);
    expect(view.find('widget-' + id)).toBeNull();
  }
  for (const name of ['cycles', 'memory', 'understanding']) expect(view.find('res-' + name)).not.toBeNull();
  expect(view.find('res-cycles')?.textContent).toContain(game.rates.cyclesPerSec.toFixed(2));
  expect(view.find('widget-' + resourceWidgets.understanding)).not.toBeNull();
  expect(view.find('thermal-meter')).not.toBeNull();
  expect(gameStore.store.getState().game).toEqual(game);
  view.close();
});
