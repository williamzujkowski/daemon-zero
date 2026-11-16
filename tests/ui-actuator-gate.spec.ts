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
const CASES: [Actuator, ComponentType, string, string][] = [
  ['quotaSkimRatio', QuotaSkim, 'skim-setting', 'skim-decrease'],
  ['fanSpeedRatio', FanControl, 'fan-setting', 'fan-decrease'],
  ['computeProfitAllocationRatio', Finance, 'allocation-value', 'allocation-0'],
];

it.each(CASES)('%s: the control is drawn exactly when the engine would accept it', async (actuator, Panel, readout, button) => {
  const open = m4State('victory-ready');
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
