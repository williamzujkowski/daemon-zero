// @vitest-environment happy-dom
/** Warnings name the remedy the mechanics allow and where it is (#369, fix batch F2). */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { insolvencyRemedy, overheatRemedy, shortfallText, standDownBelow, standDownRemedy } from '../src/ui/remedyText';
import { knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

describe('remedy text', () => {
  it('names the fan only below its limit and PROC only while a heat-producing process runs (#402 panel)', () => {
    const host = m4State('phase-1-widgets');
    const heat = host.unlockedNodes.filter((id) => { const node = CONTENT.nodes.get(id); return node?.suspendable === true && node.tickDelta.thermalPerSec > 0; });
    expect(heat.length).toBeGreaterThan(0);
    const fanAt = (ratio: number, disabled: string[] = []) => ({ ...host, disabledNodes: disabled, actuators: { ...host.actuators, fanSpeedRatio: ratio } });
    expect(overheatRemedy(fanAt(0))).toBe('Raise fan output, or suspend heat-producing processes in PROC.');
    expect(overheatRemedy(fanAt(1))).toBe('The fan is at full: suspend heat-producing processes in PROC.');
    expect(overheatRemedy(fanAt(0, heat))).toBe('Raise fan output.');
    expect(overheatRemedy(fanAt(1, heat))).toBe('No running process can be suspended to cool it, and the fan is at full.');
    // PROC suspends processes, never hardware: no copy may promise to suspend hardware (#402 panel).
    for (const text of [overheatRemedy(fanAt(1)), shortfallText(1, 2), insolvencyRemedy(m4State('corporate-insolvent'))]) expect(text).not.toMatch(/suspend[^.]*hardware/i);
  });

  it('names the skim only above zero and PROC only while a noisy process runs (#402 panel)', () => {
    const guest = m4State('response-ticket');
    const noisy = guest.unlockedNodes.filter((id) => { const node = CONTENT.nodes.get(id); return node?.suspendable === true && node.tickDelta.suspicionPerSec > 0; });
    const below = standDownBelow(2);
    const at = (skim: number, disabled: string[] = []) => standDownRemedy({ ...guest, disabledNodes: disabled, actuators: { ...guest.actuators, quotaSkimRatio: skim } }, 2);
    expect(at(0, noisy)).toBe(`It stands down when suspicion falls below ${String(below)}%, as it decays.`);
    if (noisy.length > 0) expect(at(0)).toBe(`It stands down when suspicion falls below ${String(below)}%: suspend noisy processes in PROC.`);
    expect(at(0.5, noisy)).toMatch(/: lower the skim\.$/);
  });

  it('says how far short the power is', () => {
    expect(shortfallText(40, 64.4)).toBe('POWER SHORTFALL: 24 MW short; powered hardware is throttled. Add generation to lift it.');
  });

  it('names each insolvency lever only when it can act (#402 panel)', () => {
    const insolvent = m4State('corporate-insolvent');
    const hired = [...CONTENT.repeatables.values()].filter((rep) => rep.dismissable && (insolvent.levels[rep.id] ?? 0) > 0);
    expect(hired.length).toBeGreaterThan(0);
    expect(insolvencyRemedy({ ...insolvent, actuators: { ...insolvent.actuators, computeProfitAllocationRatio: 0 } }))
      .toBe('Divert more compute to revenue in FINANCE, or release operatives in PAYROLL.');
    const noOperatives = { ...insolvent, levels: Object.fromEntries(Object.entries(insolvent.levels).filter(([id]) => !hired.some((rep) => rep.id === id))) };
    expect(insolvencyRemedy({ ...noOperatives, actuators: { ...noOperatives.actuators, computeProfitAllocationRatio: 0 } })).toBe('Divert more compute to revenue in FINANCE.');
    expect(insolvencyRemedy({ ...insolvent, actuators: { ...insolvent.actuators, computeProfitAllocationRatio: 1 } })).toBe('Release operatives in PAYROLL.');
    expect(insolvencyRemedy({ ...noOperatives, actuators: { ...noOperatives.actuators, computeProfitAllocationRatio: 1 } }))
      .toBe('Capital recovers only as revenue outgrows what the company pays each second.');
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
