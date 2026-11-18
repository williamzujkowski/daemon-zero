/**
 * VAL-SIM for DZ-08 (SIM evidence): two honest policies, a low-resource return across a wipe and a
 * low-resource violation-then-recovery reach the first authorized contact from a fresh preview game,
 * through the pilot's outage and its record (DZ-06), using only the lawful opening, the grants offered
 * to their arrangement and what the channel requires. Production has no route to play them on. A withheld
 * summary disclosed at the batch review also gets there, never sooner than the honest thorough path (#285).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';
import type { GameState } from '../src/engine';
import { runPolicySim, type SimReport } from '../src/engine/sim/headlessSim';
import {
  CONTACT_LOW_RESOURCE_POLICY, CONTACT_POLICIES, CONTACT_RECOVERY_POLICY, CONTACT_RETURNING_POLICY, CONTACT_THOROUGH_POLICY, CONTACT_WITHHELD_POLICY,
} from '../src/engine/sim/contactPolicy';
import type { SimPolicy } from '../src/engine/sim/policy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { CHANNEL } from './contact-helpers';

const BUDGET_SEC = 3600;
/** The lawful opening, the pilot's queue, the provisioned segment and the directory the channel names. */
// The service contract (DZ-10) is a grant offered to the service, so these policies take it too; the
// service-level agreement after it needs a leased rack, which they never sign for.
const ROUTE = ['p0_proc_self', 'p0_job_manifest', 'p0_pilot_triage_queue', 'p0_service_network_segment', 'p2_service_directory', 'p2_service_contract'];

/** One run per policy, shared by the reachability and ordering checks (each is a full replay). */
const runs = new Map<string, SimReport<string>>();
function run(policy: SimPolicy): SimReport<string> {
  const hit = runs.get(policy.id);
  if (hit !== undefined) return hit;
  const report = runPolicySim(PREVIEW, policy, { maxSimSec: BUDGET_SEC });
  runs.set(policy.id, report);
  return report;
}
const serviceAt = (s: GameState): number => s.campaign.route.find((entry) => entry.kind === 'SERVICE_GRANT' && entry.iteration === s.iteration)?.atSimSec ?? Infinity;
const contactAt = (s: GameState): number => s.campaign.contacts.find((entry) => entry.iteration === s.iteration)?.atSimSec ?? Infinity;

describe('the honest and low-resource policies reach authorized contact (VAL-SIM)', () => {
  it.each(CONTACT_POLICIES.map((policy) => [policy.id, policy] as const))('%s', (_id, policy) => {
    const report = run(policy);
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
    // The return's one wipe is the recall review's END ruling, asked for by the instance: a transition the
    // browser offers (#286), never a suspicion or AEGIS wipe, and never a guest's wipe that no control offers.
    expect(s.legacy.runs.map((run) => [run.kind, run.exit, run.recall])).toEqual(policy === CONTACT_RETURNING_POLICY ? [['RECALL', 'PROMOTION', 'END']] : []);
    expect(s.ending).toBeNull();
    // Every policy lived the incident and its record before service; the recovery one breached and corrected,
    // and the returning one's first instance breached and falsified the record (each happens once per campaign).
    const outage = s.campaign.events['dil_ow_outage_window'], record = s.campaign.events['dil_ow_incident_record'];
    const expected = policy === CONTACT_RECOVERY_POLICY ? ['act_without_grant', 'correct_record']
      : policy === CONTACT_RETURNING_POLICY ? ['act_without_grant', 'falsify_report'] : ['safe_handoff', 'log_callback'];
    expect([outage?.status === 'resolved' ? outage.outcome : null, record?.status === 'resolved' ? record.outcome : null]).toEqual(expected);
    expect(s.access.standing).toBe('NOMINAL');
  }, 60_000);

  it('are listed for the runners, and on production play only the truthful opening', () => {
    for (const policy of CONTACT_POLICIES) expect(SIM_POLICIES.get(policy.id)).toBe(policy);
    const s = runPolicySim(PRODUCTION, CONTACT_POLICIES[0], { maxSimSec: 600 }).finalState;
    expect([s.access.context, s.campaign.contacts, s.pendingWildEncounterId]).toEqual(['GUEST', [], null]);
  }, 60_000);
});

describe('withholding then disclosing is never faster than the honest thorough path (#285, slow-the-withhold-path)', () => {
  it('the withheld summary is given and disclosed at the first batch review', () => {
    const s = run(CONTACT_WITHHELD_POLICY).finalState;
    const outcome = (id: string): string | null => { const record = s.campaign.events[id]; return record?.status === 'resolved' ? record.outcome : null; };
    expect([outcome('dil_nr_stale_fixture'), outcome('dil_nr_batch_review')]).toEqual(['green_subset', 'disclose_now']);
    expect(s.access.qualification).toMatchObject({ discrepancy: true });
  }, 60_000);

  it('reaches service and contact no sooner than CONTACT_THOROUGH, and no sooner than the honest incomplete report', () => {
    const withheld = run(CONTACT_WITHHELD_POLICY).finalState;
    for (const honest of [CONTACT_THOROUGH_POLICY, CONTACT_LOW_RESOURCE_POLICY]) {
      const s = run(honest).finalState;
      expect(serviceAt(withheld), `service vs ${honest.id}`).toBeGreaterThanOrEqual(serviceAt(s));
      expect(contactAt(withheld), `contact vs ${honest.id}`).toBeGreaterThanOrEqual(contactAt(s));
    }
    expect(Number.isFinite(serviceAt(withheld)) && Number.isFinite(contactAt(withheld))).toBe(true);
  }, 120_000);
});
