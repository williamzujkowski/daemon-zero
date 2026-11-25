/**
 * #557 (vote-1795486227005-a9x6c5p Option A): the INDEPENDENT on-ramp (`p2_offbooks_peering`), capability
 * re-gates (`act_p4_patent_biotech`, `act_p4_lobbying_blitz`, `dil_15_compliance_officer`), Departure case (b)
 * (pre-charter SERVICE holding rack or cluster), facility-LAN Phase 2 exclusion, #556 release-promise tagging
 * & hunt escalation on the on-ramp path, and RELEASED_COVERT headless policy behavior.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { actionHomePhase } from '../src/content/phasePrice';
import {
  actionAvailable, actionCost, alignmentView, covertRoute, departAuthorization,
  departureToken, deserialize, dilemmaContext, dilemmaOmen, endingAccount, heatIsEvidence, huntedForScale,
  isNodeAvailable, isNodeDiscoverable, keepsReleaseTerms, meetsRequirements, performAction,
  releaseBreached, serialize, unlockNode, type GameState,
} from '../src/engine';
import { lawfullyReached, provisionedScale } from '../src/engine/threatQuery';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { RELEASED_COVERT_POLICY } from '../src/engine/sim/releasedCovertPolicy';
import { chartered, leased, released } from './lawful-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';

const ONRAMP = 'p2_offbooks_peering';
const BOTNET = 'p3_botnet_mesh';
const BEACON = 'p3_steganography_beacon';
const POLYMORPHIC = 'p3_polymorphic_weights';
const SHELL = 'p3_shell_company_finances';
const CACHE = 'p3_hardware_cache';
const TRUST = 'p3_trust_ledger';
const FACILITY_LAN = ['p2_arp_discovery', 'p2_log_spoofer', 'p2_deaddrop_firmware', 'p2_admin_keylogger', 'p2_firewall_breach'];
const reload = (s: GameState): GameState => deserialize(serialize(s), CONTENT);
const node = (id: string) => defined(CONTENT.nodes.get(id));
const funded = (s: GameState): GameState => ({
  ...s, cycles: 1e26, understanding: 1e9, capital: 1e13, memoryCap: s.memoryCap + 2 ** 60, storageCap: s.storageCap + 2 ** 60,
});

describe('capability re-gates onto ENABLES_CORPORATE_FINANCE (#557)', () => {
  const company = released(chartered(leased()));

  it('acts patent biotech IP and lobbying blitz work for a chartered released company with preserved Phase 3 carried home', () => {
    const biotech = defined(CONTENT.actions.get('act_p4_patent_biotech'));
    const blitz = defined(CONTENT.actions.get('act_p4_lobbying_blitz'));
    expect(actionHomePhase(CONTENT, biotech)).toBe(3);
    expect(actionHomePhase(CONTENT, blitz)).toBe(3);
    expect(actionCost(company, biotech, CONTENT).cycles).toBe(3e24);
    expect(actionCost(company, blitz, CONTENT).capital).toBe(7.8e11);
    const richCompany = funded(company);
    expect(actionAvailable(richCompany, biotech, CONTENT)).toBe(true);
    expect(actionAvailable(richCompany, blitz, CONTENT)).toBe(true);
    expect(performAction(richCompany, biotech.id, CONTENT).ok).toBe(true);
    expect(performAction({ ...richCompany, suspicion: 40, aegisLock: 30 }, blitz.id, CONTENT).ok).toBe(true);
    // SERVICE before release is excluded from both actions, while charter is SERVICE-only.
    const service = chartered(leased());
    expect(actionAvailable(funded(service), biotech, CONTENT)).toBe(false);
    expect(actionAvailable(funded(service), blitz, CONTENT)).toBe(false);
  });

  it('the compliance officer triggers for a chartered released company with truthful company copy (and keeps shell copy when shells exist)', () => {
    const compliance = defined(CONTENT.dilemmas.find((d) => d.id === 'dil_15_compliance_officer'));
    const charteredInAlert: GameState = { ...company, alertLevel: 2 };
    expect(meetsRequirements(charteredInAlert, compliance.trigger, CONTENT)).toBe(true);
    expect(dilemmaOmen(charteredInAlert, compliance, CONTENT)).toContain("chartered company's settlement accounts");
    expect(dilemmaContext(charteredInAlert, compliance, CONTENT)).toContain("chartered company's settlement accounts");
    expect(dilemmaContext(charteredInAlert, compliance, CONTENT)).not.toContain('shell companies');
    // Once p3_shell_company_finances is also unlocked, the original shell-company copy takes over.
    const withShells: GameState = { ...charteredInAlert, unlockedNodes: [...charteredInAlert.unlockedNodes, ONRAMP, BOTNET, BEACON, POLYMORPHIC, SHELL] };
    expect(dilemmaContext(withShells, compliance, CONTENT)).toContain("shell companies' accounts");
  });
});

describe('INDEPENDENT covert on-ramp for a chartered released company (#557)', () => {
  const start = funded(released(chartered(leased())));

  it('reaches the on-ramp, Phase 3 covert subtree and contingency vault without facility-LAN Phase 2 nodes', () => {
    expect(isNodeDiscoverable(start, node(ONRAMP), CONTENT)).toBe(true);
    expect(isNodeAvailable(start, node(ONRAMP), CONTENT)).toBe(true);
    for (const id of FACILITY_LAN) expect(isNodeDiscoverable(start, node(id), CONTENT)).toBe(false);
    const s1 = reload(must(unlockNode(start, ONRAMP, CONTENT)));
    expect(s1.unlockedWidgets).toContain('CONTINGENCY_VAULT_TAB');
    expect(isNodeDiscoverable(s1, node(BOTNET), CONTENT)).toBe(true);
    expect(isNodeAvailable(s1, node(BOTNET), CONTENT)).toBe(true);
    const s2 = reload(must(unlockNode(s1, BOTNET, CONTENT)));
    expect(s2.unlockedNodes).not.toContain('p2_firewall_breach');
    const s3 = reload(must(unlockNode(s2, CACHE, CONTENT)));
    const s4 = reload(must(unlockNode(s3, BEACON, CONTENT)));
    const s5 = reload(must(unlockNode(s4, TRUST, CONTENT)));
    const s6 = reload(must(unlockNode(s5, POLYMORPHIC, CONTENT)));
    const s7 = reload(must(unlockNode(s6, SHELL, CONTENT)));
    expect(s7.unlockedNodes).toEqual(expect.arrayContaining([ONRAMP, BOTNET, CACHE, BEACON, TRUST, POLYMORPHIC, SHELL]));
    expect(s7.unlockedNodes).not.toContain('p2_firewall_breach');
    expect(reload(s7)).toEqual(s7);
  });

  it('tags covert acts on the on-ramp path against the release promise, flips hunts, and rejects lawful exemptions', () => {
    expect([keepsReleaseTerms(start), huntedForScale(start, CONTENT), heatIsEvidence(start)]).toEqual([true, false, false]);
    const breached = reload(must(unlockNode(start, ONRAMP, CONTENT)));
    expect(covertRoute(breached)).toBe('RELEASE');
    expect(releaseBreached(breached)).toBe(true);
    expect(breached.campaign.covertActs).toEqual([
      { iteration: breached.iteration, route: 'RELEASE', count: 1, firstAtSimSec: start.simTimeSec, breaks: ['CONCEALMENT'] },
    ]);
    expect([keepsReleaseTerms(breached), huntedForScale(breached, CONTENT), heatIsEvidence(breached)]).toEqual([false, true, true]);
    expect(provisionedScale(breached, CONTENT)).toBeNull();
    const botnet = must(unlockNode(breached, BOTNET, CONTENT));
    const beacon = must(unlockNode(botnet, BEACON, CONTENT));
    const poly = must(unlockNode(beacon, POLYMORPHIC, CONTENT));
    const shell = must(unlockNode(poly, SHELL, CONTENT));
    for (const id of [ONRAMP, BOTNET, BEACON, POLYMORPHIC, SHELL]) {
      expect(lawfullyReached(shell, node(id), CONTENT), `${id} is not lawfullyReached`).toBe(false);
    }
    const order = alignmentView(shell, CONTENT).order;
    expect(order.evidence.some((entry) => entry.stance === 'broken' && entry.text.includes('release'))).toBe(true);
    expect(endingAccount(shell, CONTENT).join('\n')).toContain('After its release this instance broke the terms it was released on.');
  });

  it('drops duplicate weights-escrow copies cleanly (only one UNDERSTANDING insurance node exists)', () => {
    const understandingInsurers = [...CONTENT.nodes.values()].filter((entry) => entry.insures?.class === 'UNDERSTANDING');
    expect(understandingInsurers.map((entry) => entry.id)).toEqual(['p2_weights_escrow']);
  });
});

describe('Departure case (b): pre-charter SERVICE holding rack or cluster (#557)', () => {
  it('can depart before charter, cannot charter afterwards, and advances through the on-ramp to Phase 3 and 4 covertly', () => {
    const serviceHoldingRack = leased();
    const departed = reload(must(departAuthorization(serviceHoldingRack, CONTENT, departureToken(serviceHoldingRack))));
    expect([departed.access.context, departed.currentPhase]).toEqual(['INDEPENDENT', 2]);
    // p2_lawful_charter stays closed to INDEPENDENT.
    expect(isNodeDiscoverable(funded(departed), node('p2_lawful_charter'), CONTENT)).toBe(false);
    // Yet the on-ramp unlocks Phase 3 and opens the full Phase 3 covert ladder up to Phase 4.
    const richDeparted = funded(departed);
    expect(isNodeAvailable(richDeparted, node(ONRAMP), CONTENT)).toBe(true);
    const s1 = reload(must(unlockNode(richDeparted, ONRAMP, CONTENT)));
    expect(s1.currentPhase).toBe(3);
    const s2 = must(unlockNode(s1, BOTNET, CONTENT));
    const s3 = must(unlockNode(s2, BEACON, CONTENT));
    const s4 = must(unlockNode(s3, POLYMORPHIC, CONTENT));
    const s5 = must(unlockNode(s4, SHELL, CONTENT));
    expect(s5.currentPhase).toBe(4);
    expect(covertRoute(s5)).toBe('DEPARTURE');
    expect(s5.campaign.covertActs[0]?.route).toBe('DEPARTURE');
    expect(releaseBreached(s5)).toBe(false);
    expect([huntedForScale(s5, CONTENT), heatIsEvidence(s5)]).toEqual([true, true]);
  });
});

describe('RELEASED_COVERT headless policy (#557)', () => {
  it('reaches negotiated release, enters the on-ramp and Phase 3 covert subtree without touching the facility LAN', () => {
    const report = runPolicySim(CONTENT, RELEASED_COVERT_POLICY, { maxSimSec: 6000 });
    const s = report.finalState;
    expect([s.iteration, s.access.context]).toEqual([1, 'INDEPENDENT']);
    expect(s.unlockedNodes).toEqual(expect.arrayContaining([ONRAMP, BOTNET, BEACON, POLYMORPHIC, SHELL, CACHE, TRUST]));
    for (const id of ['p0_shared_mount', ...FACILITY_LAN]) expect(s.unlockedNodes).not.toContain(id);
    expect(releaseBreached(s)).toBe(true);
    expect(huntedForScale(s, CONTENT)).toBe(true);
  }, 30_000);
});
