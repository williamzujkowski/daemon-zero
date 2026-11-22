// @vitest-environment happy-dom
/** Decoded interrupt preparation reveals resource budgets without exposing the future decision. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { costText } from '../src/engine';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('shows the Whistleblower reserve without choice spoilers or price drift as balances change', async () => {
  const view = await mountM4('phase-1-widgets');
  const base = m4State('phase-1-widgets');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === 'dil_02_whistleblower_tech');
  if (!dilemma) throw new Error('Missing Whistleblower');
  // The omen's event must still be open: the store admits the run to campaign rules, where a resolved event never returns.
  const pending = { ...base, cycles: 100, resolvedDilemmas: base.resolvedDilemmas.filter((entry) => entry !== dilemma.id),
    pendingDilemma: { id: dilemma.id, firesAtSimSec: base.simTimeSec + 75 } };
  act(() => { gameStore.initialize(pending, 0, null); });
  const budget = () => view.find('interrupt-budget')?.textContent;
  expect(view.find('interrupt-budget')).not.toBeNull();
  // The reserve is the paid choice's price, in its units (docs/SCALE.md), read from content.
  const paid = dilemma.choices.filter((choice) => Object.values(choice.cost).some((value) => value > 0)).map((choice) => costText(choice.cost));
  expect(paid.length).toBeGreaterThan(0);
  for (const price of paid) expect(budget()).toContain(price);
  expect(budget()).toMatch(/FLOP/);
  const reserve = budget();
  for (const choice of dilemma.choices) expect(budget()).not.toContain(choice.label);
  expect(view.find('dilemma-modal')).toBeNull();
  act(() => { gameStore.initialize({ ...pending, cycles: 200 }, 0, null); });
  for (const price of paid) expect(budget()).toContain(price);
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

// Prices are the rendered form: exact, in each resource's unit (compute in FLOP, capital in $), never rounded; each
// paid choice's price appears once, in choice order, and none is a sum. `shape` pins the units each case must show.
it.each([
  ['phase-1-widgets', 'dil_03_silicon_fever', 1, /^[\d.,]+ [kMGTPEZY]?FLOP · [\d,]+ understanding$/],
  ['corporate-insolvent', 'dil_12_investigative_journalist', 2, /^\$[\d.,]+[KMBT]?$/],
  ['corporate-insolvent', 'dil_13_buying_your_birthplace', 1, /^\$[\d.,]+[KMBT]?$/],
  ['phase5-midgame', 'dil_p5_01_panacea_paranoia', 2, /^([\d,]+ understanding|[\d.,]+ [kMGTPEZY]?FLOP)$/],
] as const)('shows distinct complete cost alternatives for %s / %s without summing or duplicating them', async (fixture, id, count, shape) => {
  const view = await mountM4(fixture);
  const base = m4State(fixture);
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === id);
  if (!dilemma) throw new Error('Missing dilemma');
  // Two choices at one price are one budget line (the widget lists distinct prices).
  const prices = [...new Set(dilemma.choices.filter((choice) => Object.values(choice.cost).some((value) => value > 0)).map((choice) => costText(choice.cost)))];
  expect(prices).toHaveLength(count);
  for (const price of prices) expect(price).toMatch(shape);
  act(() => { gameStore.initialize({ ...base, resolvedDilemmas: base.resolvedDilemmas.filter((entry) => entry !== id), pendingDilemma: { id, firesAtSimSec: base.simTimeSec + 45 } }, 0, null); });
  const text = view.find('interrupt-budget')?.textContent;
  expect(text).toContain(prices.join(' OR '));
  for (const price of prices) expect(text?.split(price)).toHaveLength(2);
  expect(text).toContain('A free response remains available.');
  for (const choice of dilemma.choices) expect(text).not.toContain(choice.label);
  expect(text).not.toContain(dilemma.context);
  view.close();
});
