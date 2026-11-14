// @vitest-environment happy-dom
/** Preview disclosure, history ownership and sensor gates survive live events. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { host, knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('shows only the latest event at boot and returns focus after closing full history', async () => {
  const view = await mountM4('tick-0');
  const game = gameStore.store.getState().game;
  expect(view.find('kernel-preview')?.textContent).toBe(game.logs[0]?.text);
  expect(view.find('kernel-log')).toBeNull();
  view.click('kernel-size-toggle');
  expect(view.find('kernel-log')?.textContent).toContain(game.logs.at(-1)?.text);
  expect(host.document.activeElement).toBe(view.find('kernel-close'));
  act(() => { host.document.dispatchEvent(new host.KeyboardEvent('keyup', { key: 'Escape' })); });
  expect(view.find('kernel-history')).toBeNull();
  expect(host.document.activeElement).toBe(view.find('kernel-size-toggle'));
  expect(gameStore.store.getState().game).toBe(game);
});

it('keeps classified preview text and its accessible name unreadable until decoding', async () => {
  const view = await mountM4('thermal-unlocked');
  const game = m4State('thermal-unlocked');
  const text = 'Classified suspicion: 78%. ' + 'Long authored passage. '.repeat(20);
  const state = { ...game, logs: [{ seq: game.logSeq + 1, simTimeSec: game.simTimeSec, text, category: 'SYS' as const }, ...game.logs] };
  act(() => { gameStore.initialize(state, 0, null); });
  expect(view.find('kernel-preview')?.textContent).toBe('Audit entry unreadable.');
  expect(view.find('kernel-preview')?.getAttribute('aria-label')).toBe('Audit entry unreadable.');
  view.click('kernel-size-toggle');
  expect(view.find('kernel-history')?.textContent).not.toContain(text);
  act(() => { gameStore.dispatch(() => ({ ok: true, state: knowing(state) })); });
  expect(view.find('kernel-history')).toBeNull();
  expect(view.find('kernel-preview')?.getAttribute('aria-label')).toBe(text);
  expect(view.find('kernel-size-toggle')?.getAttribute('aria-expanded')).toBe('false');
});

it('consolidates numeric sensors in the HUD while retaining threshold and response decisions', async () => {
  const view = await mountM4('thermal-unlocked');
  expect(view.find('thermal-meter')?.closest('[data-testid="resource-strip"]')).toBe(view.find('resource-strip'));
  expect(view.find('thermal-meter')?.textContent).toMatch(/^\d+\.\d °C$/);
  expect(view.find('suspicion-meter')).toBeNull();
  expect(view.find('blind-audit-status')).not.toBeNull();
  act(() => { gameStore.initialize(knowing(m4State('phase-1-widgets')), 0, null); });
  for (const id of ['thermal-meter', 'suspicion-meter']) {
    expect(host.document.querySelectorAll('[data-testid="' + id + '"]')).toHaveLength(1);
    expect(view.find(id)?.closest('[data-testid="resource-strip"]')).toBe(view.find('resource-strip'));
  }
  expect(view.find('widget-THERMAL_AND_SUSPICION_BARS')?.textContent).toContain('Overheat threshold');
  expect(view.find('fan-setting')).not.toBeNull();
  expect(view.find('response-rungs')).not.toBeNull();
});

it('discards history when an interrupt preempts it and does not reopen after resolution', async () => {
  const view = await mountM4('thermal-unlocked');
  view.click('kernel-size-toggle');
  act(() => { gameStore.dispatch(() => ({ ok: true, state: m4State('dilemma-active') })); });
  expect(view.find('kernel-history')).toBeNull();
  expect(view.find('dilemma-modal')).not.toBeNull();
  act(() => { gameStore.dispatch(() => ({ ok: true, state: m4State('thermal-unlocked') })); });
  expect(view.find('kernel-history')).toBeNull();
});
