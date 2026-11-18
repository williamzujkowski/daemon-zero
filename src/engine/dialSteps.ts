/**
 * Where one press of a stepped actuator dial lands. The rendered control (src/ui/widgets/ActuatorControl.tsx)
 * dispatches exactly this value, and the sim bot presses the same function, so a balance run can only hold a
 * dial at a setting a player could press (#293). Lives in the engine so the bot can use it without importing UI.
 */

/** One press of a stepped dial moves it ten percentage points. */
export const DIAL_STEP = 0.1;

/** Where one press of a stepped dial lands from `current`, held inside [0, cap] and rounded as dispatched. */
export function steppedValue(current: number, direction: -1 | 1, cap: number): number {
  return Math.max(0, Math.min(cap, Math.round((current + direction * DIAL_STEP) * 1e6) / 1e6));
}
