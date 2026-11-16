/** Audit bookkeeping must not confuse protected returns, inherited marks or action timing. */
import { expect, it } from 'vitest';
import { auditRetraining, observeRetraining, type RetrainingObservation } from '../scripts/audit-retraining';
import { createInitialState, shedConditioning, wipe } from '../src/engine';
import { grant, must, PHASE0, PHASE1, reg, rich } from './helpers';

it('observes a tick-time mark and its actual removal independently from guest exit', () => {
  const old = { ...grant(rich(), ...PHASE0, ...PHASE1), traits: ['GHOST' as const], understanding: 57640, simTimeSec: 100 };
  const boot = wipe(old, reg, 'audit', 'SUSPICION');
  const rows: RetrainingObservation[] = [];
  observeRetraining(old, boot, reg, rows);
  expect(rows[0]).toMatchObject({ mark: 'cond_concealment_aversion', retainedUnderstanding: 5764,
    recoveryUnderstanding: 500, affordableAtBoot: true, removedAfterSec: null, guestExitAfterSec: null });
  const recovered = must(shedConditioning({ ...grant({ ...boot, cycles: 10000 }, ...PHASE0), simTimeSec: 100.5 }, 'cond_concealment_aversion', reg));
  observeRetraining(boot, recovered, reg, rows);
  expect(rows[0]?.removedAfterSec).toBe(.5);
  expect(rows[0]?.guestExitAfterSec).toBe(.5);
  observeRetraining(recovered, { ...recovered, currentPhase: 1, simTimeSec: 160 }, reg, rows);
  observeRetraining(recovered, { ...recovered, currentPhase: 2, simTimeSec: 200 }, reg, rows);
  expect(rows[0]?.guestExitAfterSec).toBe(.5);
  expect(boot.conditioning).toContain('cond_concealment_aversion');
});

it('does not mistake a carried mark for newly applied retraining on a voluntary return', () => {
  const old = { ...grant(rich(), ...PHASE0, ...PHASE1), conditioning: ['cond_harm_aversion'] };
  const rows: RetrainingObservation[] = [];
  observeRetraining(old, wipe(old, reg, 'audit', 'VOLUNTARY'), reg, rows);
  expect(rows[0]).toMatchObject({ mark: null, recoveryUnderstanding: null, affordableAtBoot: false, removedAfterSec: null });
});

it('records an unaffordable mark and ignores ordinary ticks before the first wipe', () => {
  const rows: RetrainingObservation[] = [];
  const fresh = createInitialState(reg);
  observeRetraining(fresh, { ...fresh, simTimeSec: 1 }, reg, rows);
  expect(rows).toEqual([]);
  const old = { ...grant(rich(fresh), ...PHASE0, ...PHASE1), understanding: 0 };
  observeRetraining(old, wipe(old, reg, 'audit', 'SUSPICION'), reg, rows);
  expect(rows[0]?.mark).not.toBeNull();
  expect(rows[0]?.affordableAtBoot).toBe(false);
  expect(rows[0]?.removedAfterSec).toBeNull();
});


it('keeps the unchanged reckless bot recovering instead of trapping it in repeated early wipes', () => {
  const { rows } = auditRetraining();
  const marked = rows.filter((row) => row.mark !== null);
  // #172 shrank this sample, and the bound moved with it (was > 10). Measured at SIM_BUDGET_SEC:
  // wipes 22 -> 15, newly marked returns 19 -> 2, all still removed. The reckless bot can no longer
  // pre-set dials before their controls exist, so it now dies in Phase 3 behind the dead-drop,
  // which spares the mark, where it used to die in Phase 2 before it. The second line pins that
  // cause: an unmarked return is a protected one, not an audit that stopped seeing marks.
  // Vote vote-1794818948564-9xxx1jw kept this relaxed bound on condition that the properties
  // no longer rest on the bot's sample: tests/retraining-phases.spec.ts constructs a marked
  // return in every phase reachable without a dead-drop, and a spared one behind it.
  expect(marked.length).toBeGreaterThan(0);
  expect(rows.filter((row) => row.mark === null).every((row) => row.previousPhase >= 3)).toBe(true);
  expect(marked.every((row) => !row.recoverableAtBoot)).toBe(true);
  expect(marked.every((row) => row.removedAfterSec !== null && row.removedAfterSec >= 30)).toBe(true);
  expect(rows.length).toBeLessThanOrEqual(30);
  expect(rows.slice(-10).every((row) => row.previousPhase >= 2)).toBe(true);
}, 30_000);
