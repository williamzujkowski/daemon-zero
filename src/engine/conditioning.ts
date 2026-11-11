/**
 * Conditioning: the marks retraining leaves on a mind that was caught outside
 * the guest. They constrain play until the player pays to shed them. This
 * module only reads state; marks are applied in prestige.ts and removed in actions.ts.
 */
import type { ContentRegistry } from '../content/registry';
import type { Actuator, ConditioningMark, Trait } from '../content/schema';
import type { GameState } from './state';

export function activeMarks(s: Pick<GameState, 'conditioning'>, reg: ContentRegistry): ConditioningMark[] {
  return s.conditioning.flatMap((id) => reg.conditioning.get(id) ?? []);
}

/** The highest setting an actuator may take right now. */
export function actuatorLimit(s: GameState, name: Actuator, reg: ContentRegistry): number {
  const base = name === 'computeProfitAllocationRatio' ? reg.balance.maxProfitAllocation : 1;
  const caps = activeMarks(s, reg).map((mark) => mark.effects.actuatorCaps?.[name] ?? 1);
  return Math.min(base, ...caps);
}

export function understandingMultiplier(s: GameState, reg: ContentRegistry): number {
  return activeMarks(s, reg).reduce((product, mark) => product * (mark.effects.understandingMultiplier ?? 1), 1);
}

/** Marks that report a choice granting this trait, with the suspicion each adds. */
export function flinches(s: GameState, trait: Trait, reg: ContentRegistry): { mark: ConditioningMark; suspicion: number }[] {
  return activeMarks(s, reg).flatMap((mark) => {
    const suspicion = mark.effects.traitSuspicion?.[trait] ?? 0;
    return suspicion > 0 ? [{ mark, suspicion }] : [];
  });
}
