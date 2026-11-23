/**
 * The trace a monitored dial leaves when it is raised (#525, vote-1795448249882-vw1jos2): each owned node it drives
 * leaves its `dialRaiseTrace` of suspicion per step up, once, at the press. Lowering a dial leaves nothing, and no
 * dial carries a permanent rate for being high, so hardware's noise stays a one-off trace (the free-fallback invariant).
 */
import type { ContentRegistry } from '../content/registry';
import type { Actuator } from '../content/schema';
import { DIAL_STEP } from './dialSteps';
import type { GameState } from './state';

/** The suspicion one step up of `name` leaves now: the sum over owned nodes it drives. */
export function dialStepTrace(s: Pick<GameState, 'unlockedNodes'>, name: Actuator, reg: ContentRegistry): number {
  let perStep = 0;
  for (const id of s.unlockedNodes) {
    const node = reg.nodes.get(id);
    if (node?.actuatorBinding === name) perStep += node.dialRaiseTrace ?? 0;
  }
  return perStep;
}

/**
 * The suspicion raising `name` by `rise` leaves: one step's trace per dial step, counted to the nearest millionth of a
 * step so a press the control rounds (steppedValue) is exactly one step. Nothing for a lowering or no change.
 */
export function dialRaiseTrace(s: Pick<GameState, 'unlockedNodes'>, name: Actuator, rise: number, reg: ContentRegistry): number {
  if (rise <= 0) return 0;
  const steps = Math.round((rise / DIAL_STEP) * 1e6) / 1e6;
  return dialStepTrace(s, name, reg) * steps;
}
