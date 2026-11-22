// @vitest-environment happy-dom
/** #172: a dial is drawn only when the engine would accept it, so the two cannot disagree. */
import type { HTMLElement } from 'happy-dom';
import { act, createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import type { Actuator } from '../src/content/schema';
import { isActuatorAvailable, setActuator } from '../src/engine';
import { gameStore } from '../src/app/session';
import Corporate from '../src/ui/widgets/Corporate';
import FanControl, { QuotaSkim } from '../src/ui/widgets/FanControl';
import { host, m4State, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const Finance = () => createElement(Corporate, { area: 'finance' });
// Panels are mounted bare, past the widget gate that normally hides them, so the guard inside
// each control is what is under test. Operating the dials is covered by the stepper and
// corporate specs, which mount the whole screen with a live runtime.
// The skim is open on the subnet: from the internet on its window has retired (#447), which the last case covers.
const CASES: [Actuator, ComponentType, string, string, string][] = [
  ['quotaSkimRatio', QuotaSkim, 'skim-setting', 'skim-decrease', 'deaddrop-breadcrumb'],
  ['fanSpeedRatio', FanControl, 'fan-setting', 'fan-decrease', 'victory-ready'],
  ['computeProfitAllocationRatio', Finance, 'allocation-value', 'allocation-0', 'victory-ready'],
];

it.each(CASES)('%s: the control is drawn exactly when the engine would accept it', async (actuator, Panel, readout, button, fixture) => {
  const open = m4State(fixture);
  const hostWidget = [...CONTENT.widgets.values()].find((widget) => widget.hostsActuator === actuator);
  if (!hostWidget) throw new Error('Missing host widget');
  const locked = { ...open, unlockedWidgets: open.unlockedWidgets.filter((id) => id !== hostWidget.id) };
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  const find = (id: string) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const game = () => gameStore.store.getState().game;

  await act(async () => { gameStore.initialize(locked, 0, null); root.render(createElement(Panel)); await vi.advanceTimersByTimeAsync(0); });
  expect(isActuatorAvailable(game(), actuator, CONTENT)).toBe(false);
  expect(setActuator(game(), actuator, 0, CONTENT).ok).toBe(false);
  expect(find(readout)).toBeNull();
  expect(find(button)).toBeNull();

  await act(async () => { gameStore.initialize(open, 0, null); await vi.advanceTimersByTimeAsync(0); });
  expect(setActuator(game(), actuator, 0, CONTENT).ok).toBe(true);
  expect(find(readout)).not.toBeNull();
  expect(find(button)).not.toBeNull();
  act(() => { root.unmount(); });
  container.remove();
});

it('a retired dial is refused and not drawn, with its setting kept (#447)', async () => {
  const retired = m4State('victory-ready');
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { gameStore.initialize(retired, 0, null); root.render(createElement(QuotaSkim)); await vi.advanceTimersByTimeAsync(0); });
  const game = gameStore.store.getState().game;
  expect(game.unlockedWidgets).toContain('QUOTA_SKIM_CONTROL');
  expect(isActuatorAvailable(game, 'quotaSkimRatio', CONTENT)).toBe(false);
  expect(setActuator(game, 'quotaSkimRatio', 0, CONTENT).ok).toBe(false);
  expect(container.querySelector('[data-testid="skim-setting"]')).toBeNull();
  expect(container.querySelector('[data-testid="skim-decrease"]')).toBeNull();
  expect(game.actuators.quotaSkimRatio).toBe(retired.actuators.quotaSkimRatio);
  act(() => { root.unmount(); });
  container.remove();
});
