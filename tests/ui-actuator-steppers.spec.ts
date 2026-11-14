// @vitest-environment happy-dom
/** Steppers preserve live values, exact caps and discovery boundaries in compact tiles. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();
const game = () => gameStore.store.getState().game;

it('steps the fan from 35%, supports batched clicks and reaches exact zero and maximum', async () => {
  const view = await mountM4('phase-1-widgets');
  act(() => { gameStore.initialize({ ...game(), actuators: { ...game().actuators, fanSpeedRatio: .35 } }, 0, null); });
  const increase = view.find('fan-increase');
  act(() => { increase?.click(); increase?.click(); });
  expect(game().actuators.fanSpeedRatio).toBe(.55);
  view.click('fan-decrease');
  expect(game().actuators.fanSpeedRatio).toBe(.45);
  for (let i = 0; i < 10; i++) view.click('fan-increase');
  expect(game().actuators.fanSpeedRatio).toBe(1);
  expect(view.find('fan-increase')?.getAttribute('aria-disabled')).toBe('true');
  for (let i = 0; i < 10; i++) view.click('fan-decrease');
  expect(game().actuators.fanSpeedRatio).toBe(0);
  expect(view.find('fan-decrease')?.getAttribute('aria-disabled')).toBe('true');
  expect(view.find('fan-increase')?.getAttribute('aria-label')).toContain('Increase fan output');
});

it('reads a newly applied cap during dispatch and clamps the final partial step exactly', async () => {
  const view = await mountM4('guest-skimmer');
  const mark = [...CONTENT.conditioning.values()].find((entry) => entry.effects.actuatorCaps?.quotaSkimRatio === .5);
  if (!mark) throw new Error('Missing quota cap');
  act(() => { gameStore.initialize({ ...game(), actuators: { ...game().actuators, quotaSkimRatio: .45 } }, 0, null); });
  const increase = view.find('skim-increase');
  act(() => {
    gameStore.dispatch((state) => ({ ok: true, state: { ...state, conditioning: [mark.id] } }));
    increase?.click();
  });
  expect(game().actuators.quotaSkimRatio).toBe(.5);
  expect(view.find('skim-increase')?.getAttribute('aria-disabled')).toBe('true');
  expect(view.find('conditioning-impact-quotaSkimRatio')?.textContent).toContain(mark.name);
  view.click('skim-decrease');
  expect(game().actuators.quotaSkimRatio).toBe(.4);
  expect(view.find('skim-increase')?.getAttribute('aria-disabled')).not.toBe('true');
});

it('combines thermal context and unlocked fan controls without a second tile', async () => {
  const view = await mountM4('thermal-unlocked');
  expect(view.find('fan-setting')).toBeNull();
  expect(view.find('widget-THERMAL_AND_SUSPICION_BARS')?.textContent).toContain('Overheat threshold');
  act(() => { gameStore.initialize(m4State('phase-1-widgets'), 0, null); });
  expect(view.find('fan-setting')?.closest('[data-testid="widget-THERMAL_AND_SUSPICION_BARS"]')).not.toBeNull();
  expect(view.find('widget-FAN_RPM_SLIDER')).toBeNull();
  expect(view.find('fan-25')).toBeNull();
});

it('places one forecast and its budget above every workspace only after unlocking', async () => {
  const view = await mountM4('guest-skimmer');
  expect(view.find('forecast-notice')).toBeNull();
  act(() => { gameStore.initialize(m4State('phase-1-widgets'), 0, null); });
  const forecast = view.find('forecast-notice'), columns = view.find('terminal-columns');
  expect(forecast && columns && (forecast.compareDocumentPosition(columns) & 4)).toBe(4);
  expect(view.find('inspection-forecast')?.closest('[data-testid="forecast-notice"]')).toBe(forecast);
  expect(view.find('widget-INSPECTION_COUNTDOWN_TIMER')).toBeNull();
});
