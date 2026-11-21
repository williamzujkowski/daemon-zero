// @vitest-environment happy-dom
/** UI fix batch F1a (docs/UI-REVIEW.md): one alert per event and roles that match their politeness (#363), and an
 *  omen that leads the view with a label word at body size (#378). */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('announces a brownout once: the chrome band is the alert and the CORE hint is not (#363)', async () => {
  const view = await mountM4('cycle-deficit-host', { width: 390, height: 844 });
  expect(m4State('cycle-deficit-host').brownout).toBe(true);
  expect(view.find('brownout-warning')?.getAttribute('role')).toBe('alert');
  const hint = view.find('cycle-deficit');
  expect(hint).not.toBeNull();
  expect(hint?.getAttribute('role')).not.toBe('alert');
});

it('keeps the CORE hint as the alert for a deficit before brownout, which no band announces (#363)', async () => {
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  const state = m4State('phase-1-widgets');
  act(() => { gameStore.initialize({ ...state, brownout: false, rates: { ...state.rates, cyclesPerSec: -3 } }, 0, null); });
  expect(view.find('brownout-warning')).toBeNull();
  expect(view.find('cycle-deficit')?.getAttribute('role')).toBe('alert');
});

it('shows the omen with a label word, and speaks its arrival once through the polite announcer (#363, #378, #399)', async () => {
  const view = await mountM4('guest-omen', { width: 390, height: 844 });
  const omen = view.find('omen-notice');
  // The visible notice is not a live region (on the phone it is absent off CORE); the announcer is the one path.
  expect(omen?.getAttribute('role')).toBeNull();
  expect(omen?.textContent.startsWith('OMEN')).toBe(true);
  const announcer = view.find('announcer');
  expect(announcer?.getAttribute('role')).toBe('status');
  expect(announcer?.getAttribute('aria-live')).toBe('polite');
});
