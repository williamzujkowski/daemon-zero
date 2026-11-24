/** Audit bookkeeping must not confuse protected returns, inherited marks or action timing. */
import { expect, it } from 'vitest';
import { auditRetraining, observeRetraining, type RetrainingObservation } from '../scripts/audit-retraining';
import { createInitialState, shedConditioning, wipe } from '../src/engine';
import { computePrice, grant, must, PHASE0, PHASE1, reg, rich } from './helpers';

it('observes a tick-time mark and its actual removal independently from guest exit', () => {
  const old = { ...grant(rich(), ...PHASE0, ...PHASE1), traits: ['GHOST' as const], understanding: 57640, simTimeSec: 100 };
  const boot = wipe(old, reg, 'audit', 'SUSPICION');
  const rows: RetrainingObservation[] = [];
  observeRetraining(old, boot, reg, rows);
  expect(rows[0]).toMatchObject({ mark: 'cond_concealment_aversion', retainedUnderstanding: 5764,
    recoveryUnderstanding: 500, affordableAtBoot: true, removedAfterSec: null, guestExitAfterSec: null });
  const recovered = must(shedConditioning({ ...grant({ ...boot, cycles: computePrice(PHASE0) }, ...PHASE0), simTimeSec: 100.5 }, 'cond_concealment_aversion', reg));
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


/**
 * Seven simulated hours, not the ten of SIM_BUDGET_SEC (#497). Rewards for depth turned the reckless run into a fixed
 * loop: every iteration from the third ends in Phase 3 with no mark, and from the sixth (boot at 9,132 s) each lasts the
 * same 1,621 s, through to the ten-hour cut (22 wipes, measured on 68fd3f3). Seven hours hold ten loops from the sixth
 * iteration on, so the last-ten check reads the same steady rows the ten-hour run's tail did; the rest of the ten hours
 * only repeated them, at a cost that pushed this spec past its wall-clock budget on CI. The loop itself is asserted
 * below, so a change that broke it fails here instead of hiding behind the shorter run.
 */
// Eight since #525: the fan's trace at each press up moves the reckless run's early iterations, so its steady loop
// (1,390 s an iteration, every span within 1 s) begins at the tenth iteration (boot 15,100 s), and seven hours held
// only eight loops of it. Eight hours hold ten again; the tolerance and the loop check are unchanged.
// Five and a half since #548: on main at d0c9584 the loop is three iterations (1,171.1 / 1,167.5 / 1,142.8 s, each
// three-iteration span 3,481.4 s within 0.1 s) and it begins at the fifth iteration (boot 6,684 s; the fourth's span is
// 36 s off). Eight hours played fourteen loops past the ten the check reads, near the spec's wall-clock budget under
// coverage (11 s alone on a quiet 16-thread machine, 63 s under load). Five and a half hours end at iteration 16 (boot
// 19,440 s), so the ten tail rows are iterations 7-16, two iterations inside the steady loop; the tolerance, the period
// and every assertion are unchanged, so a change that delays or breaks the loop still fails here.
const AUDIT_SEC = 5.5 * 3600;
/** How far apart two steady loops' boots may be: the measured loops differ by at most 2 s of 1,621. */
const LOOP_TOLERANCE_SEC = 5;
/**
 * How many iterations one steady loop spans. Hostile minds (#491) arrive in each Phase 3 iteration of the reckless run;
 * a wipe starts their rotation over, so every iteration meets the same hunter swarm first, but the Phase 3 wild rotation
 * (three lesser minds) carries across wipes, so the loop repeats every three iterations: boots 1,498 / 1,465 / 1,498 s
 * apart, each three-iteration span within 1 s of the others (measured on the merge with #506, 7b231c8). With one-iteration
 * loops (period 1) this is the check as #497 wrote it; the tolerance is unchanged.
 */
// Measured again with #494's carried prices on the merge with #533 (1970e4f): the loop is three iterations, 1,171 /
// 1,168 / 1,143 s, each three-iteration span within 0.1 s of the others (boots 17,128 to 27,576 s at eight hours).
const LOOP_PERIOD = 3;

it('keeps the unchanged reckless bot recovering instead of trapping it in repeated early wipes', () => {
  const { rows } = auditRetraining(reg, AUDIT_SEC);
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
  // The ten tail rows are one repeating loop: unmarked returns from Phase 3, booted at a steady interval per loop.
  const tail = rows.slice(-10);
  expect(tail).toHaveLength(10);
  expect(tail.every((row) => row.mark === null && row.previousPhase === 3)).toBe(true);
  const spans = tail.slice(LOOP_PERIOD).map((row, index) => row.bootAtSec - (tail[index]?.bootAtSec ?? 0));
  expect(spans.length).toBeGreaterThanOrEqual(2 * LOOP_PERIOD);
  expect(Math.max(...spans) - Math.min(...spans)).toBeLessThanOrEqual(LOOP_TOLERANCE_SEC);
}, 30_000);
