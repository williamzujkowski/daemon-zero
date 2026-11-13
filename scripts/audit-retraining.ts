/** Observes the unchanged reckless bot's wipe/recovery loop without steering decisions.
 * Reports new-mark exposure separately from retained resources and guest rebuilding.
 */
import { CONTENT } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import { canAfford, createInitialState, meetsRequirements, tick, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { SIM_BUDGET_SEC } from '../src/engine/sim/gates';

export interface RetrainingObservation {
  iteration: number;
  previousPhase: number;
  mark: string | null;
  retainedUnderstanding: number;
  recoveryUnderstanding: number | null;
  affordableAtBoot: boolean;
  recoverableAtBoot: boolean;
  bootAtSec: number;
  removedAfterSec: number | null;
  guestExitAfterSec: number | null;
}

/** Call after every action batch and every fixed tick: wipes happen inside ticks. */
export function observeRetraining(before: GameState, after: GameState, reg: ContentRegistry, rows: RetrainingObservation[]): void {
  if (after.iteration !== before.iteration) {
    const id = after.conditioning.find((entry) => !before.conditioning.includes(entry));
    const mark = reg.conditioning.get(id ?? '');
    rows.push({ iteration: after.iteration, previousPhase: before.currentPhase, mark: id ?? null,
      retainedUnderstanding: after.understanding, recoveryUnderstanding: mark?.recoveryCost.understanding ?? null,
      affordableAtBoot: mark !== undefined && canAfford(after, mark.recoveryCost),
      recoverableAtBoot: mark !== undefined && canAfford(after, mark.recoveryCost) && meetsRequirements(after, mark.recoveryRequirements, reg), bootAtSec: after.simTimeSec,
      removedAfterSec: null, guestExitAfterSec: null });
  }
  const row = rows.at(-1);
  if (!row) return;
  const elapsed = after.simTimeSec - row.bootAtSec;
  if (row.mark !== null && row.removedAfterSec === null && !after.conditioning.includes(row.mark)) row.removedAfterSec = elapsed;
  if (row.guestExitAfterSec === null && after.currentPhase > (reg.phases[0]?.phaseId ?? 0)) row.guestExitAfterSec = elapsed;
}

export function auditRetraining(reg: ContentRegistry = CONTENT, budgetSec = SIM_BUDGET_SEC) {
  let state = createInitialState(reg);
  const rows: RetrainingObservation[] = [];
  for (let second = 0; second < budgetSec && state.ending === null; second++) {
    let next = botStep(state, reg, 'GREEDY');
    observeRetraining(state, next, reg, rows);
    state = next;
    for (let frame = 0; frame < reg.balance.tickHz; frame++) {
      next = tick(state, 1 / reg.balance.tickHz, reg);
      observeRetraining(state, next, reg, rows);
      state = next;
    }
  }
  return { rows, finalState: state };
}

if (process.argv[1]?.endsWith('audit-retraining.ts')) {
  const { rows, finalState } = auditRetraining();
  const marked = rows.filter((row) => row.mark !== null);
  process.stdout.write(JSON.stringify({
    wipes: rows.length, newMarks: marked.length,
    immediatelyAffordable: marked.filter((row) => row.affordableAtBoot).length,
    immediatelyRecoverable: marked.filter((row) => row.recoverableAtBoot).length,
    removed: marked.filter((row) => row.removedAfterSec !== null).length,
    simulatedSeconds: finalState.simTimeSec, rows,
  }, null, 2) + '\n');
}
