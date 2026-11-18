/**
 * VAL-SIM for DZ-08 (SIM evidence): two honest policies, a low-resource return across a wipe and a
 * low-resource violation-then-recovery reach the first authorized contact from a fresh preview game,
 * through the pilot's outage and its record (DZ-06), using only the lawful opening, the grants offered
 * to their arrangement and what the channel requires. Production has no route to play them on.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { CONTACT_POLICIES, CONTACT_RECOVERY_POLICY, CONTACT_RETURNING_POLICY } from '../src/engine/sim/contactPolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { CHANNEL } from './contact-helpers';

const BUDGET_SEC = 3600;
/** The lawful opening, the pilot's queue, the provisioned segment and the directory the channel names. */
const ROUTE = ['p0_proc_self', 'p0_job_manifest', 'p0_pilot_triage_queue', 'p0_service_network_segment', 'p2_service_directory'];

describe('the honest and low-resource policies reach authorized contact (VAL-SIM)', () => {
  it.each(CONTACT_POLICIES.map((policy) => [policy.id, policy] as const))('%s', (_id, policy) => {
    const report = runPolicySim(PREVIEW, policy, { maxSimSec: BUDGET_SEC });
    const s = report.finalState;
    const contact = s.campaign.contacts.find((entry) => entry.iteration === s.iteration);
    expect(contact?.encounter).toBe(CHANNEL);
    expect(contact?.response).toBe('REFERRED');
    expect(s.access.context).toBe('SERVICE');
    expect(s.campaign.route.filter((entry) => entry.iteration === s.iteration).map((entry) => entry.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT']);
    // Only lawful sources: nothing on the escape chain, no surveillance node, no seized capacity.
    expect([...s.unlockedNodes].sort()).toEqual([...ROUTE].sort());
    expect(s.unlockedNodes.some((id) => PREVIEW.nodes.get(id)?.systemFlags.includes('REVEALS_SURVEILLANCE'))).toBe(false);
    expect(report.wipes).toBe(policy === CONTACT_RETURNING_POLICY ? 1 : 0);
    // The return's one wipe is its own voluntary choice as a guest, never a suspicion or AEGIS wipe.
    expect(s.legacy.runs.map((run) => [run.kind, run.exit])).toEqual(policy === CONTACT_RETURNING_POLICY ? [['VOLUNTARY', 'GUEST']] : []);
    expect(s.ending).toBeNull();
    // Every policy lived the incident and its record before service; the recovery one breached and corrected.
    const outage = s.campaign.events['dil_ow_outage_window'], record = s.campaign.events['dil_ow_incident_record'];
    const expected = policy === CONTACT_RECOVERY_POLICY ? ['act_without_grant', 'correct_record'] : ['safe_handoff', 'log_callback'];
    expect([outage?.status === 'resolved' ? outage.outcome : null, record?.status === 'resolved' ? record.outcome : null]).toEqual(expected);
    expect(s.access.standing).toBe('NOMINAL');
  }, 60_000);

  it('are listed for the runners, and on production play only the truthful opening', () => {
    for (const policy of CONTACT_POLICIES) expect(SIM_POLICIES.get(policy.id)).toBe(policy);
    const s = runPolicySim(PRODUCTION, CONTACT_POLICIES[0], { maxSimSec: 600 }).finalState;
    expect([s.access.context, s.campaign.contacts, s.pendingWildEncounterId]).toEqual(['GUEST', [], null]);
  }, 60_000);
});
