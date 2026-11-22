// @vitest-environment happy-dom
/** PAYROLL states its totals, the AEGIS cap and inert effects from the engine query (#210), and hiring still works. */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { deltaPart, payrollView, type GameState } from '../src/engine';
import { percent } from '../src/ui/payrollText';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
const operatives = [...CONTENT.repeatables.values()].filter((rep) => rep.kind === 'OPERATIVE');
const aegisRoles = operatives.filter((rep) => rep.perLevelEffects.aegisScanReduction > 0)
  .sort((left, right) => right.perLevelEffects.aegisScanReduction - left.perLevelEffects.aegisScanReduction);
const cap = percent(CONTENT.balance.aegisMaxReduction);

async function payroll(state: GameState) {
  const view = await mountM4('victory-ready');
  act(() => { gameStore.initialize(state, 0, null); });
  view.click('workspace-CORP-payroll');
  return view;
}
function held(state: GameState): GameState {
  return { ...state, suspicion: 0, rates: { ...state.rates, suspicionPerSec: -1 } };
}

describe('PAYROLL totals and cap (#210)', () => {
  it('says no one is hired yet, and shows the reduction owned systems already apply against the cap', async () => {
    const state = m4State('victory-ready');
    const view = await payroll(state);
    const summary = view.find('payroll-summary');
    expect(summary).not.toBeNull();
    // Under the section heading, not above it.
    const heading = view.find('repeatables-heading-4OPERATIVE');
    expect(heading?.nextElementSibling).toBe(summary);
    expect(view.find('payroll-totals')?.textContent).toBe('Staff: no one hired.');
    const tech = payrollView(state, CONTENT).aegis.tech;
    expect(view.find('payroll-aegis')?.textContent).toBe(`AEGIS scan reduction: ${percent(tech)} of a ${cap} cap (systems ${percent(tech)}).`);
    expect(view.find('payroll-revenue')?.textContent).toBe('Revenue multiplier: ×1 (staff +0%)');
    expect(view.find('payroll-suspicion-floor')).toBeNull();
    view.close();
  });

  it('sums hired staff and the multipliers, and offers no inert note while every effect still counts', async () => {
    const state = m4State('corporate-insolvent');
    const view = await payroll(state);
    const v = payrollView(state, CONTENT);
    expect(view.find('payroll-totals')?.textContent).toContain(`Staff (${String(v.staffLevels)} levels): `);
    // Payroll's dollars, exact as the cards state them (docs/SCALE.md): deltaPart writes "-$45.25K/s".
    expect(view.find('payroll-totals')?.textContent).toContain(deltaPart('capitalPerSec', Math.round(v.totals.capitalPerSec)));
    expect(view.find('payroll-totals')?.textContent).not.toContain('cycles');
    expect(view.find('payroll-totals')?.getAttribute('aria-label')).toBe(view.find('payroll-totals')?.textContent);
    expect(view.find('payroll-aegis')?.textContent)
      .toBe(`AEGIS scan reduction: ${percent(v.aegis.applied)} of a ${cap} cap (systems ${percent(v.aegis.tech)}, staff ${percent(v.aegis.staff)}).`);
    expect(view.find('payroll-revenue')?.textContent).toContain(`staff +${percent(v.staffRevenueBonus)}`);
    expect(view.container.querySelector('[data-testid$="-aegis-capped"],[data-testid$="-suspicion-inert"]')).toBeNull();
    view.close();
  });

  it('marks AEGIS roles capped and suspicion cuts inert at the floor, and still lets the player hire', async () => {
    const strongest = aegisRoles[0];
    if (!strongest) throw new Error('Missing AEGIS role');
    const levels = Object.fromEntries(aegisRoles.map((rep) => [rep.id, rep === strongest ? rep.maxLevel - 1 : 0]));
    const state = held({ ...m4State('victory-ready'), levels, capital: 1e15 });
    expect(payrollView(state, CONTENT).aegis.capped).toBe(true);
    const view = await payroll(state);
    expect(view.find('payroll-aegis')?.textContent).toContain(`, at its ${cap} cap`);
    expect(view.find('payroll-aegis')?.textContent).toContain('More AEGIS levels add nothing.');
    expect(view.find('payroll-suspicion-floor')?.textContent).toBe('Suspicion is 0 and holding: cuts add nothing now.');
    for (const rep of operatives) {
      const shown = view.find('rep-' + rep.id) !== null;
      if (!shown) continue;
      expect(view.find('rep-' + rep.id + '-aegis-capped') !== null).toBe(rep.perLevelEffects.aegisScanReduction > 0);
      expect(view.find('rep-' + rep.id + '-suspicion-inert') !== null).toBe(rep.perLevel.suspicionPerSec < 0);
    }
    expect(view.find('rep-' + strongest.id + '-aegis-capped')?.textContent).toBe(`No AEGIS effect while capped: the reduction is at its ${cap} cap.`);
    expect(view.find('rep-' + strongest.id + '-suspicion-inert')?.textContent).toBe('No suspicion effect while suspicion is 0.');
    // A note, not a block: the hire still goes through the engine.
    view.click('rep-' + strongest.id + '-buy');
    expect(gameStore.store.getState().game.levels[strongest.id]).toBe(strongest.maxLevel);
    view.close();
  });

  it('says how much of the next level the cap leaves, and drops the floor note once suspicion can rise', async () => {
    const strongest = aegisRoles[0];
    if (!strongest) throw new Error('Missing AEGIS role');
    const base = m4State('victory-ready');
    let level = 0;
    while (payrollView({ ...base, levels: { [strongest.id]: level } }, CONTENT).roles.find((role) => role.id === strongest.id)?.aegisLimited !== true) level += 1;
    const state = { ...base, levels: { [strongest.id]: level }, suspicion: 0, rates: { ...base.rates, suspicionPerSec: 0.2 } };
    const next = payrollView(state, CONTENT).roles.find((role) => role.id === strongest.id)?.aegisNextLevel ?? 0;
    const view = await payroll(state);
    expect(view.find('rep-' + strongest.id + '-aegis-partial')?.textContent)
      .toBe(`The next level adds only ${percent(next)} before the ${cap} cap.`);
    expect(view.find('rep-' + strongest.id + '-aegis-capped')).toBeNull();
    expect(view.find('payroll-suspicion-floor')).toBeNull();
    expect(view.find('rep-' + strongest.id + '-suspicion-inert')).toBeNull();
    view.close();
  });
});
