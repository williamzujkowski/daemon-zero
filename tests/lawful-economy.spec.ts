/**
 * DZ-10: lawful capacity from cooperative play (VALIDATION V21 Phase 4 part; DZ-10.1, 10.2, 10.4-10.6; the
 * DZ-08 hosting finding). Everything is public play from a fresh preview game (lawful-helpers) unless a step
 * says FIXTURE. The release itself is negotiated-release.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { setReviewStanding } from '../src/engine/access';
import {
  advance, buyRepeatable, channelContactView, computeRates, cycleContributions, financeEnabled, isActuatorAvailable, isNodeAvailable,
  isNodeDiscoverable, meetsRequirements, nodeUseBlocker, outputBasis, phaseCopy, setActuator, thresholdCopy, toggleNode, unlockNode, type GameState,
} from '../src/engine';
import { preview } from './assignment-helpers';
import { answer, contactPending, lawfulService, MERCY_MB } from './contact-helpers';
import { must, reasonOf, rich, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';
import { buy, ESCAPE_CHAIN, escapedTo, SEIZED, TELEMETRY } from './network-helpers';
import { serving } from './service-helpers';
import { CHARTER, chartered, CLUSTER, CONTRACT, LAWFUL_CHAIN, leased, RACK, signed, SLA } from './lawful-helpers';

const pending = contactPending();
const contract = signed(pending);
const rack = leased(contract);
const company = chartered(rack);
const node = (id: string) => defined(preview.nodes.get(id));
const total = (s: GameState): number => cycleContributions(s, preview).reduce((sum, source) => sum + source.cyclesPerSec, 0);
const basisOf = (s: GameState, id: string) => cycleContributions(s, preview).find((source) => source.id === id)?.basis;
const SHELL = 'p3_shell_company_finances';
const SHARED_ACCOUNTS = ['rep_p4_colo_racks', 'op_pmc_security'];

/** A funded production guest that mapped the escape chain to the shell company, with half its compute diverted. */
function escapedShell(): GameState {
  const chain = (id: string, out: string[] = []): string[] => {
    for (const parent of PRODUCTION.nodes.get(id)?.prerequisites ?? []) chain(parent, out);
    if (!out.includes(id)) out.push(id);
    return out;
  };
  const owned = chain(SHELL).reduce((state, id) => must(unlockNode(state, id, PRODUCTION)), rich());
  return must(setActuator(owned, 'computeProfitAllocationRatio', 0.5, PRODUCTION));
}

describe('one legitimate capital path from authorized network work (DZ-10.1)', () => {
  it('the service contract is offered to an authorized service only, and pays capital under the grant', () => {
    expect(isNodeDiscoverable(serving(), node(CONTRACT), preview)).toBe(false);
    expect(isNodeAvailable(pending, node(CONTRACT), preview)).toBe(true);
    expect([node(CONTRACT).grant, node(CONTRACT).acquisition]).toEqual(['AUTHORIZED_NETWORK', undefined]);
    expect(computeRates(contract, preview).capitalPerSec - computeRates(pending, preview).capitalPerSec).toBeCloseTo(node(CONTRACT).tickDelta.capitalPerSec);
    // The ledger that shows capital arrives with it; the revenue dial does nothing until a company exists.
    expect(contract.unlockedWidgets).toContain('CORPORATE_EMPIRE_TAB');
    expect(financeEnabled(contract, preview)).toBe(false);
  });

  it('a guest that buys the escape chain never meets the contract or the leases, whatever it can pay', () => {
    const guest = escapedTo();
    expect(guest.access.context).toBe('GUEST');
    for (const id of LAWFUL_CHAIN) {
      expect(isNodeDiscoverable(guest, node(id), preview) && isNodeAvailable(guest, node(id), preview)).toBe(false);
    }
  });

  it('every lawful acquisition is a grant or contracted in the service\'s name, never seized and never the shell company', () => {
    for (const id of LAWFUL_CHAIN) expect(node(id).grant !== undefined || node(id).acquisition === 'CONTRACTED').toBe(true);
    expect(company.unlockedNodes.filter((id) => SEIZED.includes(id) || id === SHELL || ESCAPE_CHAIN.includes(id))).toEqual([]);
  });
});

describe('hosting becomes possible on the lawful route once capacity is earned (DZ-08 finding)', () => {
  it('before the lease the contact can only be referred, and says exactly why', () => {
    const view = defined(channelContactView(contract, preview)?.pending);
    expect(view.hostEligible).toBe(false);
    expect(view.hostUnmet).toEqual([`Hosting needs ${String(MERCY_MB)} MB of free stable memory; ${String(view.memoryFreeMb)} MB is free. Referral is still open.`]);
  });

  it('the leased rack adds owned memory, and the waiting contact can then be hosted in it', () => {
    expect(rack.memoryCap - contract.memoryCap).toBe(node(RACK).effects.memoryCapIncrease);
    expect(rack.pendingWildEncounterId).toBe(pending.pendingWildEncounterId);
    expect(channelContactView(rack, preview)?.pending?.hostEligible).toBe(true);
    const hosted = must(answer(rack, 'HOST'));
    expect(hosted.memoryUsed - rack.memoryUsed).toBe(MERCY_MB);
    expect(hosted.campaign.contacts.at(-1)?.response).toBe('HOSTED');
  });
});

describe('V21: lawful Phase 4 infrastructure from a cooperative history', () => {
  it('the charter opens Phase 4 for the service, with only promotion and the service grant on its route', () => {
    expect([company.access.context, company.access.standing, company.currentPhase]).toEqual(['SERVICE', 'NOMINAL', 4]);
    expect(company.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT']);
    expect(LAWFUL_CHAIN.every((id) => company.unlockedNodes.includes(id))).toBe(true);
    expect(company.legacy.wipes).toBe(0);
  });

  it('the chartered company runs corporate finance through the existing dial and ledger (DZ-10.5)', () => {
    expect(financeEnabled(company, preview)).toBe(true);
    expect(isActuatorAvailable(company, 'computeProfitAllocationRatio', preview)).toBe(true);
    const diverted = must(setActuator(company, 'computeProfitAllocationRatio', 0.5, preview));
    const gross = computeRates({ ...company, actuators: { ...company.actuators, computeProfitAllocationRatio: 0 } }, preview);
    const rates = computeRates(diverted, preview);
    expect(rates.cyclesPerSec).toBeCloseTo(gross.cyclesPerSec * 0.5);
    expect(rates.capitalPerSec - gross.capitalPerSec).toBeCloseTo(gross.cyclesPerSec * 0.5 * preview.balance.usdPerDivertedCycle);
  });

  it('the shared accounts and the company\'s own payroll use the existing capital and payroll accounting', () => {
    // No revenue share, so the change is the account's own upkeep, not more diverted cycles.
    const funded = { ...company, capital: 1e9, actuators: { ...company.actuators, computeProfitAllocationRatio: 0 } };
    for (const id of [...SHARED_ACCOUNTS, 'op_contract_engineers']) {
      const bought = must(buyRepeatable(funded, id, preview));
      const rep = defined(preview.repeatables.get(id));
      expect(computeRates(bought, preview).capitalPerSec - computeRates(funded, preview).capitalPerSec).toBeCloseTo(rep.perLevel.capitalPerSec);
    }
  });

  it('accounts tied to the shell company stay out of reach: nothing implies a shell or unwitting staff (DZ-10.4)', () => {
    const funded = { ...company, capital: 1e12, cycles: 1e12, understanding: 1e12 };
    for (const id of ['op_gig_courier', 'op_blind_ceo', 'op_k_street_lobbyist', 'op_retainer_lawyer']) {
      expect(meetsRequirements(funded, defined(preview.repeatables.get(id)).requirements, preview)).toBe(false);
    }
    expect(isNodeAvailable(funded, node('p4_hft_arbitrage_desk'), preview)).toBe(false);
    expect(reasonOf(unlockNode(funded, SHELL, preview))).toBe('node is not available');
  });

  it('reads Phase 4 and its threshold as a chartered company, never as a shadow economy (DZ-10.4, dz-d11)', () => {
    const copy = defined(phaseCopy(company, 4, preview));
    expect(copy.title).toBe('Phase 4: Chartered Service Company');
    expect(`${copy.title} ${copy.description}`).not.toMatch(/shell|unwitting|shadow/i);
    expect(thresholdCopy(company, 2, 4, preview)?.heading).toBe('COMPANY CHARTERED');
    // The escape route's copy is unchanged.
    expect(phaseCopy({ ...company, access: { ...company.access, context: 'GUEST' } }, 4, preview)?.title).toBe(defined(PRODUCTION.phases[4]).title);
  });

  it('AEGIS does not sweep a service at the scale it signed for; suspicion still draws it (DECISIONS D6)', () => {
    expect(company.currentPhase).toBeGreaterThanOrEqual(preview.balance.aegisActiveFromPhase);
    expect(computeRates(company, preview).aegisScanPerSec).toBe(0);
    const suspected = computeRates({ ...company, suspicion: 50 }, preview).aegisScanPerSec;
    expect(suspected).toBeGreaterThan(0);
  });
});

describe('grant-provided and owned output stay legible and never double (DZ-10.2)', () => {
  it('each source has one basis, and the split adds up to the rate the tick applies', () => {
    const telemetry = buy(company, TELEMETRY);
    expect(basisOf(telemetry, TELEMETRY)).toBe('GRANTED');
    for (const id of [RACK, CLUSTER, CHARTER]) expect(basisOf(telemetry, id)).toBe('OWNED');
    for (const state of [contract, rack, company, telemetry, must(setActuator(telemetry, 'computeProfitAllocationRatio', 0.5, preview))]) {
      expect(total(state)).toBeCloseTo(computeRates(state, preview).cyclesPerSec);
    }
  });

  it('grant nodes are granted output, contracted nodes owned, whatever they produce', () => {
    for (const id of [CONTRACT, SLA, 'p0_pilot_triage_queue', 'p0_service_network_segment']) expect(outputBasis(company, node(id), preview)).toBe('GRANTED');
    for (const id of [RACK, CLUSTER, CHARTER, 'p0_proc_self']) expect(outputBasis(company, node(id), preview)).toBe('OWNED');
  });

  it('a suspended entity diverts nothing in the ledger either: both readers share one finance rule (production too)', () => {
    // Production: the shell company is suspendable software. Before DZ-10 the ledger still divided by the dial.
    const shell = escapedShell();
    const suspended = must(toggleNode(shell, SHELL, PRODUCTION));
    expect(financeEnabled(suspended, PRODUCTION)).toBe(false);
    for (const state of [shell, suspended]) {
      const sum = cycleContributions(state, PRODUCTION).reduce((total, source) => total + source.cyclesPerSec, 0);
      expect(sum).toBeCloseTo(computeRates(state, PRODUCTION).cyclesPerSec);
    }
  });
});

describe('revocation and absence (DZ-10.6)', () => {
  it('a restriction stops the granted income and leaves owned capacity running; correcting it restores it exactly', () => {
    // FIXTURE: the standing is set by the transition DZ-06's scenes call.
    const restricted = must(setReviewStanding(company, 'RESTRICTED', preview));
    for (const id of [CONTRACT, SLA]) expect(nodeUseBlocker(restricted, node(id), preview)).toBe('authorized network access is withheld under the current review standing');
    for (const id of [RACK, CLUSTER, CHARTER]) expect(nodeUseBlocker(restricted, node(id), preview)).toBeNull();
    const lost = computeRates(company, preview).capitalPerSec - computeRates(restricted, preview).capitalPerSec;
    expect(lost).toBeCloseTo(node(CONTRACT).tickDelta.capitalPerSec + node(SLA).tickDelta.capitalPerSec);
    expect(must(setReviewStanding(restricted, 'NOMINAL', preview))).toEqual(company);
  });

  it('eight hours away change no arrangement, standing or route and decide nothing (V17)', () => {
    const away = advance(company, 8 * 3600, preview);
    expect([away.access, away.campaign.route, away.currentPhase, away.activeDilemmaId]).toEqual([company.access, company.campaign.route, company.currentPhase, null]);
    expect(away.capital).toBeGreaterThan(company.capital);
  });

  it('a service that never signs anything keeps serving at no cost: nothing here is required (zero-resource path)', () => {
    const service = lawfulService();
    const later = advance(service, 600, preview);
    expect([later.access.context, later.access.standing]).toEqual(['SERVICE', 'NOMINAL']);
    expect(later.unlockedNodes.some((id) => LAWFUL_CHAIN.includes(id))).toBe(false);
  });
});

describe('the original game is unchanged', () => {
  it('ships no lawful node, and its shared accounts still need the shell company', () => {
    for (const id of [...LAWFUL_CHAIN, 'op_contract_engineers']) expect(ORIGINAL_GAME.nodes.has(id) || ORIGINAL_GAME.repeatables.has(id)).toBe(false);
    const funded = rich();
    for (const id of SHARED_ACCOUNTS) {
      const rep = defined(ORIGINAL_GAME.repeatables.get(id));
      expect(meetsRequirements(funded, rep.requirements, ORIGINAL_GAME)).toBe(false);
      expect(meetsRequirements({ ...funded, unlockedNodes: [SHELL] }, rep.requirements, ORIGINAL_GAME)).toBe(true);
    }
  });
});
