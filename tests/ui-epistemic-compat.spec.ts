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
