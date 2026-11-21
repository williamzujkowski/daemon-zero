// @vitest-environment happy-dom
/** Warnings name the remedy the mechanics allow and where it is (#369, fix batch F2). */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { INSOLVENCY_REMEDY, overheatRemedy, shortfallText, standDownBelow } from '../src/ui/remedyText';
import { knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

describe('remedy text', () => {
  it('points the overheat at the fan while it has headroom, and at PROC once it is full', () => {
    expect(overheatRemedy({ available: true, full: false })).toBe('Raise fan output, or suspend hot hardware in PROC.');
    expect(overheatRemedy({ available: true, full: true })).toBe('The fan is at full: suspend hot hardware in PROC.');
    expect(overheatRemedy({ available: false, full: false })).toBe('Suspend hot hardware in PROC.');
  });

  it('says how far short the power is', () => {
    expect(shortfallText(40, 64.4)).toMatch(/^POWER SHORTFALL: 24 MW short; .*Add generation, or suspend powered hardware in PROC\.$/);
  });

  it('stands a rung down the hysteresis below it, as the escalation system does', () => {
    const { escalation, escalationHysteresis } = CONTENT.balance;
    expect(standDownBelow(0)).toBeNull();
    for (const [index, rung] of escalation.entries()) expect(standDownBelow(index + 1)).toBe(rung.at - escalationHysteresis);
  });
});

it('shows the overheat remedy under the thermal warning, and the insolvency remedy in its band', async () => {
  const view = await mountM4('phase-1-widgets', { width: 1440, height: 900 });
  act(() => { gameStore.initialize({ ...knowing(m4State('phase-1-widgets')), thermal: CONTENT.balance.thermalThresholdForSuspicion + 15 }, 0, null); });
  expect(view.find('overheat-remedy')?.textContent).toMatch(/PROC\.$/);
  view.close();
  const corporate = await mountM4('corporate-insolvent', { width: 1440, height: 900 });
  expect(corporate.find('insolvency-warning')?.textContent).toContain(INSOLVENCY_REMEDY);
});
