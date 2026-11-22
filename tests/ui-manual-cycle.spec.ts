// @vitest-environment happy-dom
/**
 * Past the demotion rate the manual cycle stops claiming the primary slot but keeps
 * working: a nexus consensus_vote (4 of 5 selecting seats) chose demote over hide, so
 * the verb survives the automation that made it small. Demotion is measured on the subnet, the last scale before the
 * control retires to the Archive (#447, tests/ui-retirement.spec.ts).
 */
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { MANUAL_CYCLE_DEMOTE_CLICKS_PER_SEC, manualYieldText, shouldDemoteManualCycle } from '../src/ui/ManualCycle';
import { theme } from '../src/ui/theme';
import { mountM4, setupM4Tests, m4State } from './ui-m4-helpers';

setupM4Tests();

describe('manual cycle demotion', () => {
  it('switches exactly at the threshold, counted in clicks of the authored yield', () => {
    const threshold = MANUAL_CYCLE_DEMOTE_CLICKS_PER_SEC * CONTENT.balance.manualCycleYield;
    expect(MANUAL_CYCLE_DEMOTE_CLICKS_PER_SEC).toBe(200);
    expect(shouldDemoteManualCycle(0)).toBe(false);
    expect(shouldDemoteManualCycle(threshold - 0.01)).toBe(false);
    expect(shouldDemoteManualCycle(threshold)).toBe(true);
    expect(shouldDemoteManualCycle(threshold * 2431)).toBe(true);
  });

  it('keeps the full control while the rate is below it', async () => {
    const view = await mountM4('guest-exit-ready');
    expect(view.find('manual-cycle')).not.toBeNull();
    expect(view.find('manual-cycle-inline')).toBeNull();
    expect(view.find('manual-cycle')?.getAttribute('aria-label')).toContain('[ EXECUTE_CLOCK_CYCLE ]');
    view.close();
  });

  it('demotes to the inline line above it, and the click still lands', async () => {
    const view = await mountM4('deaddrop-breadcrumb');
    const button = view.find('manual-cycle');
    expect(button).not.toBeNull();
    expect(view.find('manual-cycle-inline')).not.toBeNull();
    // The accessible name must contain the visible text (WCAG 2.5.3).
    expect(view.find('manual-cycle-inline')?.textContent).toBe('[ cycle ] ' + manualYieldText());
    expect(button?.getAttribute('aria-label')).toContain('[ cycle ] ' + manualYieldText());
    // From an empty balance, so the click's yield is not lost below a large balance's float precision.
    const { act } = await import('react');
    // The same subnet run: from Phase 3 the control retires to the Archive (#447), so a later fixture has no button.
    act(() => { gameStore.initialize({ ...m4State('deaddrop-breadcrumb'), cycles: 0 }, 0, null); });
    expect(view.find('manual-cycle-inline')).not.toBeNull();
    view.click('manual-cycle');
    expect(gameStore.store.getState().game.cycles).toBeGreaterThanOrEqual(CONTENT.balance.manualCycleYield);
    view.close();
  });

  it('keeps the base button style, so the demoted control still meets the 44px minimum', async () => {
    const view = await mountM4('deaddrop-breadcrumb');
    expect(view.find('manual-cycle-inline')).not.toBeNull();
    // The demoted variant is theme.button plus tighter padding: the touch height
    // comes from theme.button and must not be replaced by the compact override.
    expect(theme.button.minHeight).toBeGreaterThanOrEqual(44);
    view.close();
  });

  it('restores the full control when a state falls back below the rate', async () => {
    const view = await mountM4('deaddrop-breadcrumb');
    expect(view.find('manual-cycle-inline')).not.toBeNull();
    const { act } = await import('react');
    act(() => { gameStore.initialize(m4State('guest-exit-ready'), 0, null); });
    expect(view.find('manual-cycle-inline')).toBeNull();
    expect(view.find('manual-cycle')?.getAttribute('aria-label')).toContain('[ EXECUTE_CLOCK_CYCLE ]');
    view.close();
  });
});

describe('manual cycle width', () => {
  it('hugs its label at the column tiers and fills the phone', async () => {
    // At 1440 the control stretched the whole core column (~730px) and read as a bar.
    const wide = await mountM4('tick-0', { width: 1440, height: 900 });
    const wideButton = wide.find('manual-cycle');
    expect(wideButton).not.toBeNull();
    expect(Number(wideButton?.style.maxWidth)).toBeLessThanOrEqual(360);
    wide.close();

    // The phone keeps the full width: there the width IS the touch target.
    const phone = await mountM4('tick-0', { width: 360, height: 640 });
    const phoneButton = phone.find('manual-cycle');
    // react-native-web flattens an absent maxWidth to an empty string, not undefined.
    expect(phoneButton?.style.maxWidth || undefined).toBeUndefined();
    phone.close();
  });
});
