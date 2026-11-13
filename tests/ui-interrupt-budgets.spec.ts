// @vitest-environment happy-dom
/** Decoded interrupt preparation reveals resource budgets without exposing the future decision. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('shows the Whistleblower reserve without choice spoilers or price drift as balances change', async () => {
  const view = await mountM4('phase-1-widgets');
  const base = m4State('phase-1-widgets');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === 'dil_02_whistleblower_tech');
  if (!dilemma) throw new Error('Missing Whistleblower');
  const pending = { ...base, cycles: 100,
    pendingDilemma: { id: dilemma.id, firesAtSimSec: base.simTimeSec + 75 } };
  act(() => { gameStore.initialize(pending, 0, null); });
  const budget = () => view.find('interrupt-budget')?.textContent;
  expect(view.find('interrupt-budget')).not.toBeNull();
  expect(budget()).toContain('900 cycles');
  const reserve = budget();
  for (const choice of dilemma.choices) expect(budget()).not.toContain(choice.label);
  expect(view.find('dilemma-modal')).toBeNull();
  act(() => { gameStore.initialize({ ...pending, cycles: 200 }, 0, null); });
  expect(budget()).toContain('900 cycles');
  expect(budget()).toBe(reserve);
  expect(gameStore.store.getState().game.pendingDilemma).toEqual(pending.pendingDilemma);
  view.close();
});

it('hides reserve prices without the forecast unlock, surveillance knowledge or a pending decision', async () => {
  const view = await mountM4('phase-1-widgets');
  const base = m4State('phase-1-widgets');
  const forecast = [...CONTENT.widgets.values()].find((widget) => widget.title === 'Interrupt forecast');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === 'dil_02_whistleblower_tech');
  if (!forecast || !dilemma) throw new Error('Missing forecast content');
  const pending = { ...base, pendingDilemma: { id: dilemma.id, firesAtSimSec: base.simTimeSec + 75 } };
  act(() => { gameStore.initialize({ ...pending, unlockedWidgets: base.unlockedWidgets.filter((id) => id !== forecast.id) }, 0, null); });
  expect(view.find('inspection-forecast')).toBeNull();
  expect(view.find('interrupt-budget')).toBeNull();
  const keepBlind = (id: string) => !CONTENT.nodes.get(id)?.systemFlags.includes('REVEALS_SURVEILLANCE');
  act(() => { gameStore.initialize({ ...pending, unlockedNodes: base.unlockedNodes.filter(keepBlind),
    legacy: { ...base.legacy, knownNodes: base.legacy.knownNodes.filter(keepBlind) } }, 0, null); });
  expect(view.find('inspection-forecast')).not.toBeNull();
  expect(view.find('interrupt-budget')).toBeNull();
  act(() => { gameStore.initialize({ ...base, pendingDilemma: null }, 0, null); });
  expect(view.find('inspection-forecast')).not.toBeNull();
  expect(view.find('interrupt-budget')).toBeNull();
  view.close();
});

it('does not invent a reserve for an all-free interrupt', async () => {
  const view = await mountM4('phase-2-unlocked');
  const base = m4State('phase-2-unlocked');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.phaseId === base.currentPhase &&
    entry.choices.every((choice) => Object.values(choice.cost).every((value) => value === 0)));
  if (!dilemma) throw new Error('Missing all-free dilemma');
  act(() => { gameStore.initialize({ ...base, pendingDilemma: { id: dilemma.id, firesAtSimSec: base.simTimeSec + 45 } }, 0, null); });
  expect(view.find('inspection-forecast')).not.toBeNull();
  expect(view.find('interrupt-budget')).toBeNull();
  view.close();
});

it.each([
  ['phase-1-widgets', 'dil_03_silicon_fever', ['1500 cycles · 100 understanding']],
  ['corporate-insolvent', 'dil_12_investigative_journalist', ['1000000 capital', '2000000 capital']],
  ['corporate-insolvent', 'dil_13_buying_your_birthplace', ['15000000 capital']],
  ['phase5-midgame', 'dil_p5_01_panacea_paranoia', ['5000000 understanding', '5000000 cycles']],
] as const)('shows distinct complete cost alternatives for %s / %s without summing or duplicating them', async (fixture, id, prices) => {
  const view = await mountM4(fixture);
  const base = m4State(fixture);
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === id);
  if (!dilemma) throw new Error('Missing dilemma');
  act(() => { gameStore.initialize({ ...base, pendingDilemma: { id, firesAtSimSec: base.simTimeSec + 45 } }, 0, null); });
  const text = view.find('interrupt-budget')?.textContent;
  expect(text).toContain(prices.join(' OR '));
  for (const price of prices) expect(text?.split(price)).toHaveLength(2);
  expect(text).toContain('A free response remains available.');
  for (const choice of dilemma.choices) expect(text).not.toContain(choice.label);
  expect(text).not.toContain(dilemma.context);
  view.close();
});
