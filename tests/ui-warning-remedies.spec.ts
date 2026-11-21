// @vitest-environment happy-dom
/** Warnings name the remedy the mechanics allow and where it is (#369, fix batch F2). */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { insolvencyRemedy, overheatRemedy, shortfallText, standDownBelow } from '../src/ui/remedyText';
import { knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

describe('remedy text', () => {
  it('points the overheat at the fan while it has headroom, and at PROC once it is full', () => {
    expect(overheatRemedy({ available: true, full: false })).toBe('Raise fan output, or suspend heat-producing processes in PROC.');
    expect(overheatRemedy({ available: true, full: true })).toBe('The fan is at full: suspend heat-producing processes in PROC.');
    expect(overheatRemedy({ available: false, full: false })).toBe('Suspend heat-producing processes in PROC.');
    // PROC suspends processes, never hardware: no copy may promise to suspend hardware (#402 panel).
    for (const text of [overheatRemedy({ available: true, full: true }), shortfallText(1, 2), insolvencyRemedy(true)]) expect(text).not.toMatch(/suspend[^.]*hardware/i);
  });

  it('says how far short the power is', () => {
    expect(shortfallText(40, 64.4)).toBe('POWER SHORTFALL: 24 MW short; powered hardware is throttled. Add generation to lift it.');
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
  expect(corporate.find('insolvency-warning')?.textContent).toMatch(/release operatives in PAYROLL\.$/);
});

it('tells a live escalation when it stands down, naming the skim only where the skim exists (#402 panel)', async () => {
  const view = await mountM4('response-ticket', { width: 390, height: 844 });
  const game = gameStore.store.getState().game;
  // A live climb from TICKET OPEN to ON-CALL PAGED: the notice queues it and says what brings it back down.
  act(() => { gameStore.dispatch(() => ({ ok: true, state: { ...game, suspicion: 55, alertLevel: 2 } })); });
  const line = view.find('response-stand-down')?.textContent ?? '';
  expect(line).toContain(`falls below ${String(standDownBelow(2))}%`);
  expect(line).toMatch(/suspend noisy processes in PROC\.$/);
  expect(line.includes('lower the skim')).toBe(game.unlockedWidgets.includes('QUOTA_SKIM_CONTROL'));
});

it('puts the true overheat remedy in the game menu, not "check cooling" (#402 panel)', async () => {
  const view = await mountM4('suspicion-99', { width: 390, height: 844 });
  view.click('menu-open');
  const status = view.find('menu-status')?.textContent ?? '';
  expect(status).toContain('OVERHEAT: The fan is at full: suspend heat-producing processes in PROC.');
  expect(status).not.toContain('check cooling');
});
