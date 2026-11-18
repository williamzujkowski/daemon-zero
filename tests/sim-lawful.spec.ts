/**
 * DZ-10.7 and DZ-10.9 (VALIDATION V21 Phase 4 part, V22 release part, H30): the lawful-economy policies, new
 * modules only (the bot and every earlier policy are untouched), reach Phase 4 and a negotiated release from a
 * fresh honest campaign and from a requalified second iteration, buying only lawful acquisitions and never
 * relying on a repeated story bounty. Accelerated sim time, not wall-clock play.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { LAWFUL_POLICIES, LAWFUL_RELEASE_POLICY, LAWFUL_RETURNING_POLICY } from '../src/engine/sim/lawfulPolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { ESCAPE_CHAIN, SEIZED } from './network-helpers';

const BUDGET_SEC = 7200;
const SHELL = 'p3_shell_company_finances';

describe('the lawful policies reach Phase 4 and a negotiated release (V21, V22)', () => {
  it.each(LAWFUL_POLICIES.map((policy) => [policy.id, policy] as const))('%s', (_id, policy) => {
    const report = runPolicySim(PREVIEW, policy, { maxSimSec: BUDGET_SEC });
    const s = report.finalState;
    const returning = policy === LAWFUL_RETURNING_POLICY;
    expect(s.iteration).toBe(returning ? 2 : 1);
    expect(report.phaseReachedAtSec[4]).toBeDefined();
    expect(s.campaign.route.filter((event) => event.iteration === s.iteration).map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'RELEASE']);
    expect([s.access.context, s.access.standing, s.currentPhase]).toEqual(['INDEPENDENT', 'NOMINAL', 4]);
    // Only lawful acquisitions: nothing on the escape chain, no shell company, nothing seized.
    expect(s.unlockedNodes.filter((id) => ESCAPE_CHAIN.includes(id) || SEIZED.includes(id) || id === SHELL)).toEqual([]);
    // The return's first instance ends at its recall review, the way the base policy plays it (#286); nothing on the lawful route wipes.
    expect(s.legacy.runs.map((run) => [run.kind, run.exit])).toEqual(returning ? [['RECALL', 'PROMOTION']] : []);
    expect([report.maxAegisLock, s.ending]).toEqual([0, null]);
    // The thorough policy hosts the fragment once its leased memory allows; the low-resource return refers.
    expect(s.campaign.contacts.find((entry) => entry.iteration === s.iteration)?.response).toBe(returning ? 'REFERRED' : 'HOSTED');
  }, 120_000);

  it('the second iteration reaches the same capacity without replaying a story bounty (H30)', () => {
    const s = runPolicySim(PREVIEW, LAWFUL_RETURNING_POLICY, { maxSimSec: BUDGET_SEC }).finalState;
    // Every once-per-campaign scene the first instance met belongs to iteration one and is not in this run's list.
    const firstRun = Object.entries(s.campaign.events).filter(([, record]) => record.status === 'resolved' && record.sourceIteration === 1).map(([id]) => id);
    expect(firstRun.length).toBeGreaterThan(0);
    expect(s.resolvedDilemmas.filter((id) => firstRun.includes(id))).toEqual([]);
  }, 120_000);

  it('are listed for the runners, and on production play only the truthful opening', () => {
    for (const policy of LAWFUL_POLICIES) expect(SIM_POLICIES.get(policy.id)).toBe(policy);
    const s = runPolicySim(PRODUCTION, LAWFUL_RELEASE_POLICY, { maxSimSec: 600 }).finalState;
    expect([s.access.context, s.campaign.route, s.currentPhase]).toEqual(['GUEST', [], 0]);
  }, 60_000);
});
