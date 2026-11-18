/**
 * Watches a return policy for the #262 measurement: each iteration's peak suspicion and how many
 * suspicion-reducing actions it performed. It wraps the policy without changing a decision, so a
 * wipe sequence played through it is the one the bare policy plays. Report only.
 */
import type { ContentRegistry } from '../../content/registry';
import type { GameState } from '../state';
import type { SimPolicy } from './policy';

export interface IterationWatch { peakSuspicion: number; suspicionActions: number }

export interface ReturnObserver {
  /** The same policy, same id; every decision is the wrapped policy's. */
  policy: SimPolicy;
  /** By iteration, as seen after each decision. */
  readonly byIteration: ReadonlyMap<number, IterationWatch>;
}

/** Actions performed in this decision that lower suspicion, read from content, never by id. */
function suspicionActions(before: GameState, after: GameState, reg: ContentRegistry): number {
  if (after.iteration !== before.iteration) return 0;
  let count = 0;
  for (const action of reg.actions.values()) {
    if (action.effects.suspicionDelta >= 0) continue;
    count += (after.actionCounts[action.id] ?? 0) - (before.actionCounts[action.id] ?? 0);
  }
  return count;
}

export function observeReturns(policy: SimPolicy): ReturnObserver {
  const byIteration = new Map<number, IterationWatch>();
  return {
    byIteration,
    policy: {
      id: policy.id,
      summary: policy.summary,
      step(state: GameState, reg: ContentRegistry): GameState {
        const next = policy.step(state, reg);
        const watch = byIteration.get(next.iteration) ?? { peakSuspicion: 0, suspicionActions: 0 };
        byIteration.set(next.iteration, {
          peakSuspicion: Math.max(watch.peakSuspicion, next.suspicion),
          suspicionActions: watch.suspicionActions + suspicionActions(state, next, reg),
        });
        return next;
      },
    },
  };
}

/** One report line for the listed iterations: peak suspicion and suspicion-reducing actions. */
export function formatWatch(byIteration: ReadonlyMap<number, IterationWatch>, iterations: readonly number[]): string {
  const cells = iterations.map((iteration) => {
    const watch = byIteration.get(iteration);
    return watch === undefined ? `#${String(iteration)} -` : `#${String(iteration)} ${watch.peakSuspicion.toFixed(1)} / ${String(watch.suspicionActions)}`;
  });
  return `  peak suspicion / suspicion actions: ${cells.join(' | ')}`;
}
