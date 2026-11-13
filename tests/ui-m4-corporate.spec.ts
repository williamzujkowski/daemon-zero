// @vitest-environment happy-dom
/** Corporate controls change the real engine and expose solvency/power explicitly. */
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
describe('M4 corporate', () => {
  it('defaults desktop to the new corporate pane, with explicit insolvency and free dismissal', async () => {
    const view = await mountM4('corporate-insolvent');
    expect(view.find('tab-CORP')?.getAttribute('aria-selected')).toBe('true');
    expect(view.find('insolvency-warning')?.textContent).toContain('INSOLVENT');
    view.click('workspace-CORP-payroll');
    const operatives = [...CONTENT.repeatables.values()].filter((rep) => rep.kind === 'OPERATIVE');
    for (const rep of operatives) {
      expect(view.find('rep-' + rep.id + '-buy')?.getAttribute('aria-disabled')).toBe('true');
      view.click('rep-' + rep.id + '-dismiss');
      expect(gameStore.store.getState().game.levels[rep.id]).toBe(0);
    }
    view.click('workspace-CORP-finance');
    expect(view.find('corp-capital')?.textContent).toContain('$0');
    view.click('tab-NETWORK');
    expect(view.find('corp-capital')).toBeNull();
    view.click('tab-CORP');
    view.click('workspace-CORP-finance');
    expect(view.find('corp-capital')).not.toBeNull();
    view.close();
  });

  it('hires and dismisses data-driven roles and changes allocation through all available steps', async () => {
    const view = await mountM4('victory-ready');
    view.click('workspace-CORP-payroll');
    const rep = [...CONTENT.repeatables.values()].find((entry) => entry.kind === 'OPERATIVE');
    if (!rep) throw new Error('Missing operative');
    const before = gameStore.store.getState().game.capital;
    view.click('rep-' + rep.id + '-buy');
    expect(gameStore.store.getState().game.levels[rep.id]).toBe(1);
    expect(gameStore.store.getState().game.capital).toBe(before - rep.baseCost.capital);
    view.click('rep-' + rep.id + '-dismiss');
    expect(gameStore.store.getState().game.levels[rep.id]).toBe(0);
    expect(view.container.textContent).toContain('Revenue multiplier:');
    expect(view.container.textContent).toContain('AEGIS scan reduction:');
    view.click('workspace-CORP-finance');
    for (const step of [0, 0.25, 0.5, 0.75, 1]) {
      const ratio = step * CONTENT.balance.maxProfitAllocation, percent = Math.round(ratio * 100);
      view.click('allocation-' + String(percent));
      expect(gameStore.store.getState().game.actuators.computeProfitAllocationRatio).toBe(ratio);
      expect(view.find('allocation-' + String(percent))?.getAttribute('aria-pressed')).toBe('true');
    }
    view.close();
  });

  it('shows exact megawatts/efficiency and a textual power shortfall warning', async () => {
    const view = await mountM4('megawatt-shortfall');
    view.click('workspace-CORP-finance');
    expect(view.find('power-ledger')?.textContent).toContain('0 MW generated');
    expect(view.find('power-warning')?.textContent).toContain('POWER SHORTFALL');
    act(() => { gameStore.initialize({ ...m4State('victory-ready'), brownout: true }, 0, null); });
    expect(view.find('power-warning')).toBeNull();
    expect(view.find('brownout-warning')?.textContent).toContain('BROWNOUT');
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(view.find('brownout-warning')).toBeNull();
    view.close();
  });
});
