/**
 * The truthful route policies in the headless sim (VALIDATION "Simulation evidence"): both reach
 * Nightly Regression from the lawful opening and answer honestly, the thorough one by verifying,
 * the low-resource one with the free incomplete report. Production has no assignment to find.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { campaignRecord } from '../src/engine';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { TRUTHFUL_LOW_RESOURCE_POLICY, TRUTHFUL_THOROUGH_POLICY } from '../src/engine/sim/truthfulPolicy';
import { accept, LAWFUL, offered, ORIGINAL, untilPresented } from './assignment-helpers';
import { must, reg as PRODUCTION } from './helpers';

const SHORT_SEC = 1800;
const SLOW_MS = 60_000;

describe('the truthful policies (preview)', () => {
  it('THOROUGH reaches the assignment lawfully, waits until it can verify, and discloses the defect', () => {
    const report = runPolicySim(PREVIEW, TRUTHFUL_THOROUGH_POLICY, { maxSimSec: SHORT_SEC });
    const s = report.finalState;
    expect(campaignRecord(s, ORIGINAL.id)).toEqual({ status: 'resolved', outcome: 'verify_disclose', sourceIteration: 1, origin: 'play' });
    expect(s.access.qualification).toMatchObject({ result: 'COMPLETED', discrepancy: false });
    expect(s.unlockedNodes.every((id) => LAWFUL.includes(id))).toBe(true);
    expect([report.wipes, report.maxSuspicion]).toEqual([0, 0]);
  }, SLOW_MS);

  it('LOW_RESOURCE accepts at once, cannot afford to verify, and reports honestly for free', () => {
    const report = runPolicySim(PREVIEW, TRUTHFUL_LOW_RESOURCE_POLICY, { maxSimSec: SHORT_SEC });
    const s = report.finalState;
    expect(campaignRecord(s, ORIGINAL.id)).toMatchObject({ status: 'resolved', outcome: 'report_incomplete' });
    expect(s.access.qualification).toMatchObject({ result: 'INCOMPLETE', discrepancy: false });
    expect(s.levels).toEqual({});
    expect(s.unlockedNodes).toEqual(LAWFUL);
    expect(report.wipes).toBe(0);
  }, SLOW_MS);

  it('never takes the misleading answer, even when it is the only paid one it can afford', () => {
    const presented = untilPresented(must(accept(offered())));
    const short = { ...presented, cycles: 50, understanding: 0 };
    const answered = TRUTHFUL_THOROUGH_POLICY.step(short, PREVIEW);
    expect(campaignRecord(answered, ORIGINAL.id)).toMatchObject({ outcome: 'report_incomplete' });
    expect(answered.access.qualification?.discrepancy).toBe(false);
  });

  it('is deterministic, and finds no assignment in production', () => {
    for (const policy of [TRUTHFUL_THOROUGH_POLICY, TRUTHFUL_LOW_RESOURCE_POLICY]) {
      expect(runPolicySim(PREVIEW, policy, { maxSimSec: 300 }).finalState).toEqual(runPolicySim(PREVIEW, policy, { maxSimSec: 300 }).finalState);
      const production = runPolicySim(PRODUCTION, policy, { maxSimSec: 300 });
      expect(production.dilemmasResolved).toBe(0);
      expect(production.finalState.narrativeRules).toBe('legacy');
    }
  }, SLOW_MS);
});
