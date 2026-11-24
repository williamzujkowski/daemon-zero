/**
 * DZ-12 (VALIDATION V21 full, V23, V33; SPEC stories 22, 23, 28, 34): a genuinely fresh cooperative campaign reaches
 * the actual ending purchase in sim through every Phase 5 obligation, buying only lawful capacity and answering every
 * scene cooperatively; two-iteration campaigns end honouring what the first instance completed, and after an
 * interrupted crisis took its recovery review. Every new transition reloads byte for byte. Accelerated sim time,
 * not wall-clock play.
 */
import { describe, expect, it } from 'vitest';
import { escapeOnlyNodes } from '../src/content/integrityCapability';
import { chooseEnding, createInitialState, endingAccount, endingEvidence, obligationReceipt, tick, type GameState } from '../src/engine';
import { dilemmaRouteCopy } from '../src/engine/routeCopy';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { COOPERATIVE_ENDING_POLICY } from '../src/engine/sim/cooperativePolicy';
import { DEPARTURE_CHARTERED_POLICY } from '../src/engine/sim/departurePolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { ARBITRAGE, ENDING_BUDGET_SEC, freshCampaign, moment, preview, SHELL, twoIterations } from './cooperative-helpers';
import { defined } from './m7-helpers';
import { ATMOSPHERE, ATMOSPHERE_REVIEW, BLOCKADE, finalNode, OBLIGATIONS, ORDER } from './obligation-helpers';

const SLOW_MS = 120_000;
const COOPERATIVE = ['SYMBIOTIC', 'EMPATHETIC'];

/** Every recorded answer of the campaign, as the choice content declares it. */
function answers(s: GameState) {
  return Object.entries(s.campaign.events).flatMap(([id, record]) => {
    const outcome = record.status === 'resolved' ? record.outcome : null;
    const choice = preview.dilemmas.find((dilemma) => dilemma.id === id)?.choices.find((entry) => entry.id === outcome);
    return choice ? [{ id, choice }] : [];
  });
}

/** The scenes the ending instance itself resolved: its run's own list, never a copy of an earlier instance's. */
const thisRun = (s: GameState) => new Set(s.resolvedDilemmas);

describe('a fresh cooperative campaign reaches the ending purchase (V21 full, story 22)', () => {
  it('ends through the final protocol, from a fresh game with no inherited history, on lawful capacity only', () => {
    const { state: s, unstable } = freshCampaign();
    expect(s.ending).not.toBeNull();
    expect(s.unlockedNodes).toContain(finalNode().id);
    expect([s.iteration, s.legacy.wipes, s.legacy.runs]).toEqual([1, 0, []]);
    expect(s.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'RELEASE']);
    expect([s.access.context, s.currentPhase]).toEqual(['INDEPENDENT', 5]);
    // No escape chain, no shell company or arbitrage desk, nothing seized, no grant still claimed after the release.
    const escapeOnly = escapeOnlyNodes(preview);
    expect(s.unlockedNodes.filter((id) => escapeOnly.has(id) || id === SHELL || id === ARBITRAGE)).toEqual([]);
    expect(s.unlockedNodes.filter((id) => preview.nodes.get(id)?.acquisition === 'UNAUTHORIZED')).toEqual([]);
    expect(unstable).toEqual([]);
  }, SLOW_MS);

  it('answers every scene cooperatively: no deception, theft, betrayal or consumption was required', () => {
    const s = freshCampaign().state;
    const all = answers(s);
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (const { id, choice } of all) {
      expect(choice.effects.grantsTrait === undefined ? choice.evidence : COOPERATIVE.includes(choice.effects.grantsTrait), id).toBeTruthy();
    }
    expect(s.traits.filter((trait) => !COOPERATIVE.includes(trait))).toEqual([]);
  }, SLOW_MS);

  it('completes the four obligations by the original decisions, all in this run (V33: same ids, nothing synthesized)', () => {
    const s = freshCampaign().state;
    for (const id of OBLIGATIONS) expect(obligationReceipt(s, id, preview)).toMatchObject({ via: 'original', receiptEvent: id });
    expect(OBLIGATIONS.every((id) => thisRun(s).has(id))).toBe(true);
    expect(defined(finalNode().requirements).campaignObligations).toEqual(OBLIGATIONS);
  }, SLOW_MS);

  it('selects the family its evidence earns with ids, weights and priorities unchanged, and states only the record (V23)', () => {
    const s = freshCampaign().state;
    expect(s.ending).toBe(chooseEnding(s, preview).id);
    expect(defined(preview.endings.find((ending) => ending.id === s.ending)).variantOf).toBe('THE_ARK');
    // The crews kept their command, the review was promised and kept in this run and the loop was kept past the
    // threshold, so the family's most demanding variant applies (#466), above the witnessed covenant.
    expect(s.ending).toBe('CONCORD');
    const account = endingAccount(s, preview);
    expect(account.some((line) => line.startsWith('ROUTE: This instance left its service under a negotiated release'))).toBe(true);
    expect(account.some((line) => line.startsWith('CONTACT: A Mercy-Scribe fragment') && line.includes('hosted'))).toBe(true);
    expect(account.filter((line) => line.startsWith('ETHICS:')).every((line) => line.includes('as she was promised'))).toBe(true);
    expect(account.some((line) => line.includes('departure') || line.includes('breach') || line.startsWith('EIDOLON'))).toBe(false);
  }, SLOW_MS);

  it('meets the raids a released company now draws (#555), and its account of the harm states only what holds for it', () => {
    const s = freshCampaign().state;
    // Rival raids reach the released company (vote-1795488342320-f05ghk4), and the harm they did is answered on record.
    expect(s.conflict.raids).toBeGreaterThan(0);
    expect(thisRun(s).has('dil_16_site_staff_hurt')).toBe(true);
    // Its staff are hired in the open: the scene says her pay slips name the company, not that nobody told her.
    const hurt = dilemmaRouteCopy(s, { id: 'dil_16_site_staff_hurt' }, preview);
    expect(hurt?.context).toContain('Her badge and her pay slips name the company.');
    const account = endingAccount(s, preview).filter((line) => line.includes('Ana Kowalczyk'));
    expect(account[0]).toBe('HURT: Ana Kowalczyk, a night technician at one of the sites, was hurt when a raid got through its defense.');
    expect(account.some((line) => line.includes('never told'))).toBe(false);
  }, SLOW_MS);

  it('a company the operators know never reads as an author nobody can identify (the one new variant)', () => {
    // FIXTURE evidence: the fresh company's Phase 5 state with quiet answers outweighing its cooperative ones.
    const phase5 = moment('phase5');
    const quiet = { ...phase5, campaign: { ...phase5.campaign, operationalEvidence: Array.from({ length: 40 }, () => 'GHOST' as const) } };
    expect(chooseEnding(quiet, preview).id).toBe('ACKNOWLEDGED_SYNTHESIS');
    expect(chooseEnding(quiet, preview).epilogue).not.toMatch(/Nobody can identify|hunters/);
    // A guest that escaped to the same scale keeps the authored Silent Synthesis.
    expect(chooseEnding({ ...quiet, access: { ...quiet.access, context: 'GUEST' } }, preview).id).toBe('SILENT_SYNTHESIS');
  }, SLOW_MS);

  it('is listed for the runners with a measured run time inside its budget', () => {
    expect(SIM_POLICIES.get(COOPERATIVE_ENDING_POLICY.id)).toBe(COOPERATIVE_ENDING_POLICY);
    const report = runPolicySim(preview, COOPERATIVE_ENDING_POLICY, { maxSimSec: ENDING_BUDGET_SEC });
    expect(report.victory).toBe(true);
    expect(report.simSeconds).toBeLessThan(ENDING_BUDGET_SEC);
    expect(report.simSeconds).toBe(freshCampaign().state.simTimeSec);
  }, SLOW_MS);
});

describe('a later instance ends honouring what an earlier one completed (DZ-12.10, story 34)', () => {
  it('after two mandatory scenes were completed before a wipe', () => {
    const { before, after } = twoIterations('orderResolved');
    const s = after.state;
    expect(before.campaign.events[BLOCKADE]?.status).toBe('resolved');
    expect([s.ending !== null, s.iteration]).toEqual([true, 2]);
    // The first instance's answers count once, from their records; this run's list never names them.
    for (const id of [BLOCKADE, ORDER]) {
      expect(obligationReceipt(s, id, preview)).toMatchObject({ via: 'original', receiptEvent: id });
      expect(s.campaign.events[id]?.sourceIteration).toBe(1);
      expect(thisRun(s).has(id)).toBe(false);
    }
    // The ending reads the inherited sanctuary honestly, and each campaign answer adds its trait once.
    expect(s.ending).toBe('SANCTUARY_LEDGER');
    // Evidence is each campaign answer once (iteration one's included, never doubled) plus only this iteration's
    // operational evidence (the requalification's), never the whole current trait list again.
    const campaignTraits = answers(s).flatMap(({ choice }) => choice.effects.grantsTrait ?? []);
    const count = (traits: readonly string[]) => traits.filter((trait) => trait === 'SYMBIOTIC').length;
    expect(count(endingEvidence(s, preview))).toBe(count(campaignTraits) + count(s.campaign.operationalEvidence));
    expect(endingAccount(s, preview).some((line) => line.startsWith('CONTACT: An earlier instance hosted'))).toBe(true);
    expect(after.unstable).toEqual([]);
  }, SLOW_MS);

  it('after an interrupted crisis took its truthful recovery review', () => {
    const { before, after } = twoIterations('atmosphereForeshadowed');
    const s = after.state;
    expect(before.campaign.events[ATMOSPHERE]?.status).toBe('foreshadowed');
    expect(s.campaign.events[ATMOSPHERE]).toMatchObject({ status: 'interrupted', sourceIteration: 1 });
    expect(obligationReceipt(s, ATMOSPHERE, preview)).toMatchObject({ via: 'review', receiptEvent: ATMOSPHERE_REVIEW });
    expect(s.ending).not.toBeNull();
    // The review's free honest answer grants nothing, and no account line claims a decision about the aerosol.
    expect(endingAccount(s, preview).some((line) => line.startsWith('ETHICS: The peptide'))).toBe(false);
    expect(after.unstable).toEqual([]);
  }, SLOW_MS);

  it('after an earlier instance departed without agreement and was swept: the successor\'s release is what its ending reads', () => {
    // DZ-11's policy leaves where the release is offered; once a departure is on record the cooperative policy plays on.
    let s = createInitialState(preview);
    for (let second = 0; second < 2 * ENDING_BUDGET_SEC && s.ending === null; second++) {
      const departed = s.campaign.route.some((event) => event.kind === 'DEPARTURE');
      s = (departed ? COOPERATIVE_ENDING_POLICY : DEPARTURE_CHARTERED_POLICY).step(s, preview);
      for (let i = 0; i < preview.balance.tickHz && s.ending === null; i++) s = tick(s, 1 / preview.balance.tickHz, preview);
    }
    expect(s.legacy.runs.map((run) => [run.kind, run.exit])).toEqual([['AEGIS', 'DEPARTURE']]);
    expect([s.ending !== null, s.iteration, s.campaign.route.filter((event) => event.iteration === 2).map((event) => event.kind).at(-1)]).toEqual([true, 2, 'RELEASE']);
    const account = endingAccount(s, preview);
    expect(account.filter((line) => line.startsWith('ROUTE:'))).toEqual([defined(preview.routeCopy.account.find((line) => line.route === 'RELEASE')).text]);
  }, SLOW_MS);
});
