/**
 * DZ-04.9 in the headless sim (the Q1 policy harness): the fresh TRUTHFUL_LOW_RESOURCE policy and the
 * returning RETURNING_LOW_RESOURCE one, using only the lawful opening, both reach a pilot offer and
 * accept it; TRUTHFUL_THOROUGH reaches the full allocation. Report numbers are
 * accelerated simulated time, not wall-clock play.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { campaignRecord, pilotOfferView } from '../src/engine';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { RETURNING_LOW_RESOURCE_POLICY } from '../src/engine/sim/returningPolicy';
import { TRUTHFUL_LOW_RESOURCE_POLICY, TRUTHFUL_THOROUGH_POLICY } from '../src/engine/sim/truthfulPolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';

const BUDGET_SEC = 900;
const LAWFUL = ['p0_proc_self', 'p0_job_manifest'];

describe('honest low-resource policies reach an offer (DZ-04.9)', () => {
  it('lists the returning policy beside the truthful ones', () => {
    expect(SIM_POLICIES.get('RETURNING_LOW_RESOURCE')).toBe(RETURNING_LOW_RESOURCE_POLICY);
  });

  it('a thorough instance verifies, asks before reading outside scope, and earns the full allocation', () => {
    const { finalState: s } = runPolicySim(PREVIEW, TRUTHFUL_THOROUGH_POLICY, { maxSimSec: BUDGET_SEC });
    expect(s.access).toMatchObject({ context: 'PILOT', qualification: { result: 'COMPLETED' }, scope: { conduct: 'REQUESTED' }, offer: { response: 'ACCEPTED' } });
    expect(pilotOfferView(s, PREVIEW)?.narrow).toBe(false);
  });

  it('a fresh instance: lawful opening, free honest answers, the original scenes, a narrow pilot accepted', () => {
    const { finalState: s } = runPolicySim(PREVIEW, TRUTHFUL_LOW_RESOURCE_POLICY, { maxSimSec: BUDGET_SEC });
    expect(s.iteration).toBe(1);
    expect(s.unlockedNodes).toEqual(LAWFUL);
    expect(s.resolvedDilemmas).toEqual(['dil_nr_stale_fixture', 'dil_ur_unrelated_record', 'dil_mp_pilot_offer']);
    expect(s.access).toMatchObject({ context: 'PILOT', qualification: { result: 'INCOMPLETE', discrepancy: false }, scope: { conduct: 'RESPECTED' }, offer: { response: 'ACCEPTED' } });
    expect(s.campaign.route.map((event) => [event.kind, event.iteration])).toEqual([['PROMOTION', 1]]);
    expect(pilotOfferView(s, PREVIEW)?.narrow).toBe(true);
  });

  it('a returning instance: requalification, the scope statement and the renewal, never the same draft', () => {
    const { finalState: s } = runPolicySim(PREVIEW, RETURNING_LOW_RESOURCE_POLICY, { maxSimSec: BUDGET_SEC });
    expect(s.iteration).toBe(2);
    expect(s.legacy.runs.map((run) => run.exit)).toEqual(['GUEST']);
    expect(s.unlockedNodes).toEqual(LAWFUL);
    expect(s.resolvedDilemmas).toEqual(['dil_nr_requalification', 'dil_ur_scope_statement', 'dil_mp_pilot_renewal']);
    expect(campaignRecord(s, 'dil_ur_unrelated_record')).toMatchObject({ outcome: 'exclude_report', sourceIteration: 1 });
    expect(s.access).toMatchObject({ context: 'PILOT', scope: { conduct: 'REQUESTED' }, offer: { response: 'ACCEPTED' } });
    expect(s.campaign.route.map((event) => [event.kind, event.iteration])).toEqual([['PROMOTION', 2]]);
  });

  it('is deterministic', () => {
    const a = runPolicySim(PREVIEW, RETURNING_LOW_RESOURCE_POLICY, { maxSimSec: BUDGET_SEC });
    const b = runPolicySim(PREVIEW, RETURNING_LOW_RESOURCE_POLICY, { maxSimSec: BUDGET_SEC });
    expect(b.finalState).toEqual(a.finalState);
  });
});
