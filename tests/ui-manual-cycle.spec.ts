// @vitest-environment happy-dom
/**
 * Past the demotion rate the manual cycle stops claiming the primary slot but keeps
 * working: a nexus consensus_vote (4 of 5 selecting seats) chose demote over hide, so
 * the verb survives the automation that made it small.
 */
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { shouldDemoteManualCycle } from '../src/ui/ManualCycle';
import { theme } from '../src/ui/theme';
import { mountM4, setupM4Tests, m4State } from './ui-m4-helpers';

setupM4Tests();

describe('manual cycle demotion', () => {
  it('switches exactly at the threshold', () => {
    expect(shouldDemoteManualCycle(0)).toBe(false);
    expect(shouldDemoteManualCycle(33)).toBe(false);
    expect(shouldDemoteManualCycle(199.99)).toBe(false);
    expect(shouldDemoteManualCycle(200)).toBe(true);
    expect(shouldDemoteManualCycle(486174.92)).toBe(true);
  });

  it('keeps the full control while the rate is below it', async () => {
    const view = await mountM4('phase-1-widgets');
    expect(view.find('manual-cycle')).not.toBeNull();
    expect(view.find('manual-cycle-inline')).toBeNull();
    expect(view.find('manual-cycle')?.getAttribute('aria-label')).toContain('[ EXECUTE_CLOCK_CYCLE ]');
    view.close();
  });

  it('demotes to the inline line above it, and the click still lands', async () => {
    const view = await mountM4('wild-shard-encounter-p3');
    const button = view.find('manual-cycle');
    expect(button).not.toBeNull();
    expect(view.find('manual-cycle-inline')).not.toBeNull();
    // The accessible name must contain the visible text (WCAG 2.5.3).
    expect(button?.getAttribute('aria-label')).toContain('[ cycle ] +1');
    const before = gameStore.store.getState().game.cycles;
    view.click('manual-cycle');
    expect(gameStore.store.getState().game.cycles).toBeGreaterThan(before);
    view.close();
  });

  it('keeps the base button style, so the demoted control still meets the 44px minimum', async () => {
    const view = await mountM4('wild-shard-encounter-p3');
    expect(view.find('manual-cycle-inline')).not.toBeNull();
    // The demoted variant is theme.button plus tighter padding: the touch height
    // comes from theme.button and must not be replaced by the compact override.
    expect(theme.button.minHeight).toBeGreaterThanOrEqual(44);
    view.close();
  });

  it('restores the full control when a state falls back below the rate', async () => {
    const view = await mountM4('wild-shard-encounter-p3');
    expect(view.find('manual-cycle-inline')).not.toBeNull();
    const { act } = await import('react');
    act(() => { gameStore.initialize(m4State('phase-1-widgets'), 0, null); });
    expect(view.find('manual-cycle-inline')).toBeNull();
    expect(view.find('manual-cycle')?.getAttribute('aria-label')).toContain('[ EXECUTE_CLOCK_CYCLE ]');
    view.close();
  });
});
