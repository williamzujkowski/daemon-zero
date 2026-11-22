// @vitest-environment happy-dom
/** Warnings name the remedy the mechanics allow and where it is (#369, fix batch F2). */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { insolvencyRemedy, overheatRemedy, shortfallText } from '../src/ui/remedyText';
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
    // Without a fan it never claims one (#402 panel pass 4).
    const noFan = { ...fanAt(0, heat), unlockedWidgets: host.unlockedWidgets.filter((id) => id !== 'FAN_RPM_SLIDER') };
    expect(overheatRemedy(noFan)).toBe('No running process can be suspended to cool it.');
    // PROC suspends processes, never hardware: no copy may promise to suspend hardware (#402 panel).
    for (const text of [overheatRemedy(fanAt(1)), shortfallText(1, 2), insolvencyRemedy(m4State('corporate-insolvent'))]) expect(text).not.toMatch(/suspend[^.]*hardware/i);
  });


  it('says how far short the power is', () => {
    expect(shortfallText(40e6, 64e6)).toBe('POWER SHORTFALL: 24 MW short; powered hardware is throttled. Add generation to lift it.');
    // A small shortfall never reads "0 MW short" (#402 panel): the unit steps down to what it is.
    expect(shortfallText(40e6, 40.3e6)).toMatch(/^POWER SHORTFALL: 300 kW short;/);
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
    // With no positive gross cycles the dial diverts nothing, so it is not named (#402 panel).
    const noCycles = { ...insolvent, actuators: { ...insolvent.actuators, computeProfitAllocationRatio: 0 }, rates: { ...insolvent.rates, cyclesPerSec: -5 } };
    expect(insolvencyRemedy(noCycles)).toBe('Release operatives in PAYROLL.');
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


it('puts the true overheat remedy in the game menu, not "check cooling" (#402 panel)', async () => {
  const view = await mountM4('suspicion-99', { width: 390, height: 844 });
  view.click('menu-open');
  const status = view.find('menu-status')?.textContent ?? '';
  expect(status).toContain('OVERHEAT: The fan is at full: suspend heat-producing processes in PROC.');
  expect(status).not.toContain('check cooling');
});

it('keeps Dismiss in PAYROLL for a hired role whose requirement no longer holds (#402 panel)', async () => {
  const insolvent = m4State('corporate-insolvent');
  const gateOf = (rep: { requirements: { nodes?: readonly string[] | undefined } }): string | undefined => (rep.requirements.nodes ?? [])[0];
  const role = [...CONTENT.repeatables.values()].find((rep) => rep.dismissable && (insolvent.levels[rep.id] ?? 0) > 0 && gateOf(rep) !== undefined);
  const gate = role ? gateOf(role) : undefined;
  if (!role || gate === undefined) throw new Error('no hired role with a node requirement');
  const view = await mountM4('corporate-insolvent', { width: 1440, height: 900 });
  act(() => { gameStore.initialize({ ...insolvent, unlockedNodes: insolvent.unlockedNodes.filter((id) => id !== gate) }, 0, null); });
  view.click('workspace-CORP-payroll');
  expect(view.find('rep-' + role.id + '-dismiss')).not.toBeNull();
});
