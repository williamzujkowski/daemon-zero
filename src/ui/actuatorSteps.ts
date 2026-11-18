/**
 * The values the rendered actuator controls can set, in one place: the corporate ledger's revenue buttons
 * and the stepped dial every other actuator uses. The controls dispatch exactly these values, and
 * tests/sim-reachable.spec.ts reads the same functions, so a sim policy can only claim a setting a player
 * could press (panel round 1 on #292). No React here, so engine-side tests can import it.
 */
import type { ContentRegistry } from '../content/registry';
import type { Actuator } from '../content/schema';

/** The revenue allocation buttons, as fractions of the balance's maximum allocation (Corporate.tsx). */
export const PROFIT_ALLOCATION_STEPS: readonly number[] = [0, 0.25, 0.5, 0.75, 1];

/** One press of a stepped dial moves it ten percentage points (ActuatorControl.tsx). */
export const DIAL_STEP = 0.1;

/** The absolute allocations the revenue buttons dispatch. */
export function profitAllocationValues(reg: ContentRegistry): number[] {
  return PROFIT_ALLOCATION_STEPS.map((step) => step * reg.balance.maxProfitAllocation);
}

/** Where one press of a stepped dial lands from `current`, held inside [0, cap] and rounded as dispatched. */
export function steppedValue(current: number, direction: -1 | 1, cap: number): number {
  return Math.max(0, Math.min(cap, Math.round((current + direction * DIAL_STEP) * 1e6) / 1e6));
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/**
 * Whether the rendered control can leave `actuator` at `value` from `current` under the engine's `cap`: one
 * of the revenue buttons (the engine holds a press inside the cap, as it holds every setting), or a run of
 * presses of a stepped dial (bounded by the dial's span, so the search always ends).
 */
export function controlCanSet(actuator: Actuator, current: number, value: number, cap: number, reg: ContentRegistry): boolean {
  if (actuator === 'computeProfitAllocationRatio') return profitAllocationValues(reg).some((option) => near(Math.min(option, cap), value));
  if (near(current, value)) return true;
  const direction = value > current ? 1 : -1;
  let at = current;
  for (let press = 0; press <= Math.ceil(1 / DIAL_STEP) + 1; press++) {
    const next = steppedValue(at, direction, cap);
    if (near(next, value)) return true;
    if (near(next, at)) return false;
    at = next;
  }
  return false;
}
