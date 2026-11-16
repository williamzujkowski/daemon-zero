// @vitest-environment happy-dom
/** Minimal existing-panel compatibility while the dedicated M7 panels await PR 3. */
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { defined } from './m7-helpers';
import { mountM4, m4State, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('hides capped edits after purchase and retains their memory benefit', async () => {
  const view = await mountM4('phase-3-aegis-90');
  const action = defined([...CONTENT.actions.values()].find((entry) => entry.maxPurchases === 3));
  const base = m4State('phase-3-aegis-90');
  await act(async () => { gameStore.initialize({ ...base, actionCounts: { [action.id]: 2 }, cooldowns: {}, activeDilemmaId: null }, 0, null); await vi.advanceTimersByTimeAsync(0); });
  view.click('workspace-NETWORK-operations');
  expect(view.find('action-card-' + action.id)).not.toBeNull();
  view.click('action-' + action.id);
  expect(view.find('action-card-' + action.id)).toBeNull();
  expect(gameStore.store.getState().game.memoryCap).toBe(base.memoryCap + 256);
});

it('discloses no epistemic actions before the audit is understood', async () => {
  const view = await mountM4('phase-3-aegis-90');
  const base = m4State('phase-3-aegis-90');
  const teachers = [...CONTENT.nodes.values()].filter((node) => node.systemFlags.includes('REVEALS_SURVEILLANCE')).map((node) => node.id);
  await act(async () => { gameStore.initialize({ ...base, unlockedNodes: base.unlockedNodes.filter((id) => !teachers.includes(id)),
    legacy: { ...base.legacy, knownNodes: [] } }, 0, null); await vi.advanceTimersByTimeAsync(0); });
  for (const action of CONTENT.actions.values()) if (action.requirements.requiresSurveillance) {
    expect(view.find('action-card-' + action.id)).toBeNull();
  }
});

// #173: the ticket edit waits behind the first subnet device. The card stays on screen and names
// what is missing by the name the player can already read on that device's own card.
it('shows the ticket edit locked behind the first subnet device, by the name already on screen', async () => {
  const view = await mountM4('epistemic-ready-p2');
  const edit = defined([...CONTENT.actions.values()].find((a) => a.requirements.requiresSurveillance && a.effects.suspicionDelta < 0 && (a.requirements.nodes?.length ?? 0) > 0));
  const device = defined(CONTENT.nodes.get(defined(edit.requirements.nodes?.[0])));
  expect(gameStore.store.getState().game.unlockedNodes).not.toContain(device.id);
  expect(view.find('node-' + device.id)?.textContent).toContain(device.blindName);
  view.click('workspace-NETWORK-operations');
  const card = defined(view.find('action-card-' + edit.id));
  expect(card.textContent).toContain('Map ' + device.blindName);
  expect(view.container.textContent).not.toContain(device.revealedName);
  expect(view.find('action-' + edit.id)?.getAttribute('aria-disabled')).toBe('true');
  view.click('action-' + edit.id);
  expect(gameStore.store.getState().game.actionCounts[edit.id] ?? 0).toBe(0);
  view.click('workspace-NETWORK-work');
  view.click('node-' + device.id + '-unlock');
  expect(gameStore.store.getState().game.unlockedNodes).toContain(device.id);
  view.click('workspace-NETWORK-operations');
  expect(defined(view.find('action-card-' + edit.id)).textContent).not.toContain('Map ');
  view.click('action-' + edit.id);
  expect(gameStore.store.getState().game.actionCounts[edit.id]).toBe(1);
});
