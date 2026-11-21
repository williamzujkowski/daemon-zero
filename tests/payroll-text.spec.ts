/** Payroll sentences (#210): rounding, disclosure and the cap wording, from a view the engine would return. */
import { describe, expect, it } from 'vitest';
import type { PayrollView } from '../src/engine';
import { aegisTotalText, revenueText, roleAegisCappedText, roleAegisPartialText, roleSuspicionInertText,
  staffTotalsText, suspicionFloorText } from '../src/ui/payrollText';

function view(patch: Partial<PayrollView> = {}): PayrollView {
  return {
    staffLevels: 3,
    totals: { cyclesPerSec: 26000, understandingPerSec: 8500.4, thermalPerSec: 0, suspicionPerSec: 0.04000000000000001, capitalPerSec: -45250, megawattsDelta: 0 },
    staffRevenueBonus: 0.95, revenueMultiplier: 1.9500000000000002,
    offersRevenue: true, offersAegis: true, offersSuspicionCut: true,
    aegis: { tech: 0.6, staff: 0.46, cap: 0.9, applied: 0.9, capped: true },
    suspicionAtFloor: false, roles: [], ...patch,
  };
}

describe('payroll text', () => {
  it('rounds summed totals to what a card can state and groups digits, or abbreviates them when compact', () => {
    expect(staffTotalsText(view(), false))
      .toBe('Staff (3 levels): +26,000 cycles/s · +8,500 understanding/s · +0.04 suspicion/s · -45,250 $/s');
    // compactNumber leaves values under 10,000 whole.
    expect(staffTotalsText(view(), false, true)).toBe('Staff (3 levels): +26K cycles/s · +8500 understanding/s · +0.04 suspicion/s · -45.3K $/s');
    expect(staffTotalsText(view({ staffLevels: 1 }), false)).toContain('(1 level)');
    expect(staffTotalsText(view({ staffLevels: 0 }), false)).toBe('Staff: no one hired.');
    const cancelled = view({ totals: { ...view().totals, cyclesPerSec: 0, understandingPerSec: 0, suspicionPerSec: 0.001, capitalPerSec: 0.2 } });
    expect(staffTotalsText(cancelled, false)).toBe('Staff (3 levels): no net output');
  });

  it('keeps suspicion unnamed until the mind knows what the audit trail is for', () => {
    expect(staffTotalsText(view(), true)).toContain('more audit log activity');
    expect(staffTotalsText(view(), true)).not.toContain('suspicion');
    expect(suspicionFloorText(true)).not.toContain('uspicion');
    expect(roleSuspicionInertText(true)).not.toContain('uspicion');
    expect(suspicionFloorText(false)).toBe('Suspicion is 0 and holding: cuts add nothing now.');
    expect(roleSuspicionInertText(false)).toBe('No suspicion effect while suspicion is 0.');
  });

  it('states the reduction against its cap, its sources, and what the cap means for a hire', () => {
    expect(aegisTotalText(view())).toBe('AEGIS scan reduction: 90%, at its 90% cap (systems 60%, staff 46%). More AEGIS levels add nothing.');
    expect(aegisTotalText(view({ aegis: { tech: 0, staff: 0.15, cap: 0.9, applied: 0.15, capped: false } })))
      .toBe('AEGIS scan reduction: 15% of a 90% cap (staff 15%).');
    expect(aegisTotalText(view({ aegis: { tech: 0, staff: 0, cap: 0.9, applied: 0, capped: false } }))).toBe('AEGIS scan reduction: 0% of a 90% cap.');
    expect(roleAegisCappedText(view())).toBe('No AEGIS effect while capped: the reduction is at its 90% cap.');
    expect(roleAegisPartialText(0.06, view())).toBe('The next level adds only 6% before the 90% cap.');
    expect(roleAegisPartialText(0.004, view())).toBe('The next level adds only under 1% before the 90% cap.');
    expect(revenueText(view())).toBe('Revenue multiplier: ×1.95 (staff +95%)');
  });
});
