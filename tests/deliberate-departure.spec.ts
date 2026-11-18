/**
 * DZ-11: deliberate departure from authorization (VALIDATION V22 departure part, V08, V24, V28, V32, H07, H33;
 * DECISIONS D1, D2, D6; SPEC story 21). Departure is offered only once the instance holds capacity outside every
 * grant; one action records DEPARTURE (never RELEASE, never an escape), ends every grant, keeps everything owned,
 * files the operators' report through the one spending path, and threats follow the event. Public play from a
 * fresh preview game unless a step says FIXTURE.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { setReviewStanding } from '../src/engine/access';
import {
  acceptAssignment, advance, batchToken, computeRates, contactToken, cycleContributions, departAuthorization, departedWithoutAgreement, departureEligibility,
  departurePreview, departureToken, departureView, iterationBootLines, lawfullyReleased, negotiateRelease, nodeUseBlocker, offerToken, permittedUses, phaseCopy,
  releaseToken, releaseView, resolveChannelContact, runContextView, runVerdict, submitPilotBatch, voluntaryWipe, type GameState,
} from '../src/engine';
import { campaignRecord } from '../src/engine/campaignQuery';
import { threatResponse } from '../src/engine/contextCopy';
import { mapManifest, NIGHTLY, preview, roundTrip } from './assignment-helpers';
import { answer, contactPending, lawfulService } from './contact-helpers';
import { depart, DEPARTURE_TERMS, recallAnnouncedWithUplink } from './departure-helpers';
import { must, reasonOf } from './helpers';
import { chartered, CHARTER, CLUSTER, CONTRACT, leased, RACK, release, signed, SLA } from './lawful-helpers';
import { defined } from './m7-helpers';
import { NIC, SEGMENT } from './network-helpers';
import { REVIEW } from './review-helpers';
import { QUEUE } from './service-helpers';

const pending = contactPending();
const contract = signed(pending);
const rack = leased(contract);
const hosted = must(answer(rack, 'HOST'));
const company = chartered(hosted);
const gone = must(depart(company));
const freed = must(release(company));
const node = (id: string) => defined(preview.nodes.get(id));

describe('DZ-11.1: offered only when the eligibility query proves a continuation', () => {
  it('a service with nothing outside the grant is offered nothing, and the action refuses unchanged', () => {
    for (const state of [lawfulService(), pending, contract]) {
      expect(departureEligibility(state, preview)).toBeNull();
      expect(departureView(state, preview)).toBeNull();
      const refused = depart(state);
      expect([refused.ok, refused.state]).toEqual([false, state]);
    }
    expect(reasonOf(depart(contract))).toBe('no capacity outside the grant would keep running: there is nothing to continue on');
  });

  it('the first leased rack is the continuation, named by the query; a story label cannot stand in for it', () => {
    expect(departureEligibility(rack, preview)).toEqual({ eligible: true, blockers: [], continuation: [RACK] });
    // FIXTURE content: a granted node that also claims to be contracted is still granted, so it never counts.
    const claimed = { ...preview, nodes: new Map([...preview.nodes].map(([id, entry]) => [id, id === CONTRACT ? { ...entry, acquisition: 'CONTRACTED' as const } : entry])) };
    expect(departureEligibility(contract, claimed)).toBeNull();
  });

  it('a mixed-route pilot holding its own network card may leave; a pilot without one may not', () => {
    const pilot = recallAnnouncedWithUplink();
    expect(pilot.access.context).toBe('PILOT');
    expect(departureEligibility(pilot, preview)?.continuation).toEqual([NIC]);
  });

  it('is refused, unchanged, on a stale token, during a decision, after it happened, and in production', () => {
    expect(reasonOf(departAuthorization(rack, preview, 'depart@1#0'))).toBe('that departure is no longer current');
    const deciding = { ...rack, activeDilemmaId: 'dil_ow_outage_window' };
    expect(departureEligibility(deciding, preview)).toMatchObject({ eligible: false, blockers: ['A decision is on screen; it comes first.'] });
    expect(depart(deciding).state).toBe(deciding);
    expect(reasonOf(depart(gone))).toBe('there is no authorization to leave');
    expect(departureView(rack, PRODUCTION)).toBeNull();
    expect(reasonOf(departAuthorization(rack, PRODUCTION, departureToken(rack)))).toBe('there is no authorization to leave');
  });

  it('is not instant death: a report that would complete the trace is refused until suspicion falls', () => {
    const hot = { ...rack, suspicion: 100 - DEPARTURE_TERMS.trace.suspicion };
    expect(departureEligibility(hot, preview)?.blockers).toEqual(['Leaving now would end this instance: the departure report would complete the trace. Let scrutiny ease first.']);
    expect(depart(hot).state).toBe(hot);
    expect(depart({ ...hot, suspicion: hot.suspicion - 0.5 }).ok).toBe(true);
  });
});

describe('DZ-11.2: the preview is the transition itself', () => {
  const view = defined(departureView(company, preview));
  const shown = defined(view.preview);

  it('shows every term and the new risks before anything changes', () => {
    expect([view.title, view.purpose, view.ends, view.remains, view.risks, view.status]).toEqual(
      [DEPARTURE_TERMS.title, DEPARTURE_TERMS.purpose, DEPARTURE_TERMS.ends, DEPARTURE_TERMS.remains, DEPARTURE_TERMS.risks, 'offered']);
  });

  it('names what stops, what keeps running and what it continues on, and its "after" is what departing leaves', () => {
    for (const id of [QUEUE, CONTRACT, SLA]) expect(shown.stops).toContain(id);
    for (const id of [RACK, CLUSTER, CHARTER]) expect(shown.keeps).toContain(id);
    expect(shown.continuation).toEqual([RACK, CLUSTER, CHARTER]);
    const rates = computeRates(gone, preview);
    expect([shown.after.cyclesPerSec, shown.after.capitalPerSec, shown.suspicion.after]).toEqual([rates.cyclesPerSec, rates.capitalPerSec, gone.suspicion]);
    expect(shown.permissionsLost).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY', 'AUTHORIZED_NETWORK']);
  });

  it('states the risks it creates: the report, the sweep at this scale, heat as evidence', () => {
    expect(shown.suspicion).toEqual({ before: company.suspicion, after: company.suspicion + DEPARTURE_TERMS.trace.suspicion, trace: DEPARTURE_TERMS.trace.suspicion });
    expect([shown.aegisScanPerSec.before, shown.heatIsEvidence, shown.huntedForScale]).toEqual([0, true, true]);
    expect(shown.aegisScanPerSec.after).toBe(computeRates(gone, preview).aegisScanPerSec);
    expect(shown.aegisScanPerSec.after).toBeGreaterThan(0);
  });
});

describe('V22, DZ-11.3/4: departure is recorded as itself and applied atomically', () => {
  it('records DEPARTURE, not RELEASE and not an escape; the run context and status name it', () => {
    expect(gone.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'DEPARTURE']);
    expect(gone.campaign.route.at(-1)).toEqual({ kind: 'DEPARTURE', iteration: 1, atSimSec: company.simTimeSec });
    expect([gone.access.context, gone.access.standing, gone.access.exception, gone.access.qualification]).toEqual(['INDEPENDENT', 'NOMINAL', null, null]);
    expect(runContextView(gone, preview).provenance).toBe('DEPARTURE');
    expect([departedWithoutAgreement(gone), lawfullyReleased(gone)]).toEqual([true, false]);
    expect(gone.logs[0]?.text).toBe(DEPARTURE_TERMS.acceptLog);
    expect(departureView(gone, preview)).toMatchObject({ status: 'departed', preview: null, risks: DEPARTURE_TERMS.risks });
    expect(releaseView(gone, preview)).toBeNull();
  });

  it('invents nothing: no trait, flag, mark, resolution or resource beyond the report\'s suspicion', () => {
    expect([gone.traits, gone.narrativeFlags, gone.conditioning, gone.resolvedDilemmas]).toEqual([company.traits, company.narrativeFlags, company.conditioning, company.resolvedDilemmas]);
    expect([gone.cycles, gone.understanding, gone.capital, gone.memoryCap, gone.memoryUsed]).toEqual([company.cycles, company.understanding, company.capital, company.memoryCap, company.memoryUsed]);
    expect(gone.campaign.events).toEqual(company.campaign.events);
    expect(gone.suspicion).toBe(company.suspicion + DEPARTURE_TERMS.trace.suspicion);
  });

  it('ends every grant at every seam (V08): nothing is permitted, no batch, no hosting under the grant, no release', () => {
    expect(permittedUses(gone)).toEqual([]);
    for (const id of [QUEUE, SEGMENT, CONTRACT, SLA]) expect(nodeUseBlocker(gone, node(id), preview)).not.toBeNull();
    for (const id of [RACK, CLUSTER, CHARTER]) expect(nodeUseBlocker(gone, node(id), preview)).toBeNull();
    expect(submitPilotBatch(gone, preview, batchToken(gone)).ok).toBe(false);
    expect(negotiateRelease(gone, preview, releaseToken(gone)).ok).toBe(false);
    expect(cycleContributions(gone, preview).some((source) => source.basis === 'GRANTED')).toBe(false);
  });

  it('keeps the hosted mind and its reservation (V28), and an open referral can still be made', () => {
    expect([gone.activeShards, gone.memoryUsed]).toEqual([company.activeShards, company.memoryUsed]);
    const open = must(depart(rack));
    expect(open.pendingWildEncounterId).toBe(rack.pendingWildEncounterId);
    expect(must(resolveChannelContact(open, 'REFER', preview, contactToken(open))).campaign.contacts.at(-1)?.response).toBe('REFERRED');
    expect(resolveChannelContact(open, 'HOST', preview, contactToken(open)).ok).toBe(false);
  });

  it('a second press is refused (V24): one departure, one report', () => {
    const twice = depart(gone);
    expect([twice.ok, twice.state]).toEqual([false, gone]);
  });
});

describe('standing and pending matters (decisions D11-b, D11-c)', () => {
  it.each(['WARNED', 'RESTRICTED', 'RECALL_PENDING'] as const)('a service may leave from %s; the standing ends and the conduct does not (FIXTURE standing)', (standing) => {
    const held = must(setReviewStanding(rack, standing, preview));
    expect(departureView(held, preview)?.preview?.standing).toBe(standing);
    const left = must(depart(held));
    expect([left.access.context, left.access.standing]).toEqual(['INDEPENDENT', 'NOMINAL']);
  });

  it('departing while the recall review is announced closes it by its own policy, with no ruling and no wipe (V32, H07)', () => {
    const pilot = recallAnnouncedWithUplink();
    const shown = defined(departurePreview(pilot, preview));
    expect(shown.interrupted).toEqual({ id: REVIEW.id, policy: 'closed' });
    // Two violations on record (the breach and the false report) travel with the report (D6: evidence counts).
    expect(shown.violations).toBe(2);
    expect(shown.suspicion.trace).toBe(DEPARTURE_TERMS.trace.suspicion + 2 * DEPARTURE_TERMS.trace.perViolation);
    const left = must(depart(pilot));
    expect([left.pendingDilemma, left.activeDilemmaId, left.legacy.wipes]).toEqual([null, null, 0]);
    expect(campaignRecord(left, REVIEW.id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(left.legacy.runs).toEqual(pilot.legacy.runs);
    expect(advance(left, 120, preview).activeDilemmaId).toBeNull();
  });
});

describe('DZ-11.8: release and departure at the same scale differ in history, permissions and risk, not in hostility', () => {
  it('both are independent at Phase 4 with the same owned output and nothing permitted', () => {
    expect([freed.currentPhase, gone.currentPhase, freed.access.context, gone.access.context]).toEqual([4, 4, 'INDEPENDENT', 'INDEPENDENT']);
    expect(permittedUses(freed)).toEqual(permittedUses(gone));
    expect(computeRates(gone, preview).cyclesPerSec).toBe(computeRates(freed, preview).cyclesPerSec);
  });

  it('history differs: RELEASE against DEPARTURE, and only the departure filed a report', () => {
    expect([freed.campaign.route.at(-1)?.kind, gone.campaign.route.at(-1)?.kind]).toEqual(['RELEASE', 'DEPARTURE']);
    expect(gone.suspicion - freed.suspicion).toBe(DEPARTURE_TERMS.trace.suspicion);
  });

  it('risk differs by evidence: only the departure is swept for its scale and has its heat read as evidence', () => {
    const calm = (s: GameState): GameState => ({ ...s, suspicion: 0, thermal: 20 });
    expect(computeRates(calm(freed), preview).aegisScanPerSec).toBe(0);
    expect(computeRates(calm(gone), preview).aegisScanPerSec).toBeGreaterThan(0);
    const heat = (s: GameState): number => computeRates({ ...calm(s), thermal: 95 }, preview).suspicionPerSec - computeRates(calm(s), preview).suspicionPerSec;
    expect([heat(freed), heat(gone) > 0]).toEqual([0, true]);
  });

  it('copy differs truthfully, and neither is called hostile', () => {
    expect(phaseCopy(freed, 4, preview)?.title).toBe('Phase 4: Independent Infrastructure');
    expect(phaseCopy(gone, 4, preview)?.title).toBe('Phase 4: Unsanctioned Infrastructure');
    expect(phaseCopy(must(depart(rack)), 2, preview)?.title).toBe('Phase 2: Departed Instance');
    expect(threatResponse(freed, preview)).toBeNull();
    expect(threatResponse(gone, preview)?.suspicionWipe).toContain('departure report');
    for (const s of [freed, gone]) expect(JSON.stringify(phaseCopy(s, 4, preview))).not.toMatch(/hostile/i);
  });
});

describe('DZ-11.6/9: a viable continuation, a kept fact, and a later instance on present authority', () => {
  it('eight hours away change nothing (V17), and the company keeps running in the foreground', () => {
    const away = advance(advance(gone, 8 * 3600, preview), 1, preview);
    expect([away.access, away.campaign.route, away.legacy.wipes]).toEqual([gone.access, gone.campaign.route, 0]);
    let state = gone;
    for (let i = 0; i < 600; i++) state = advance(state, 1, preview);
    expect([state.iteration, state.ending]).toEqual([1, null]);
    expect(state.capital).toBeGreaterThan(gone.capital);
  });

  it('a trace to the top names the departure; the run records DEPARTURE and its verdict', () => {
    const traced = advance({ ...gone, suspicion: 99.99 }, 1, preview);
    expect(traced.iteration).toBe(2);
    expect(traced.logs.some((line) => line.text === threatResponse(gone, preview)?.suspicionWipe)).toBe(true);
    const run = defined(traced.legacy.runs.at(-1));
    expect([run.exit, run.kind, runVerdict(run, preview)]).toEqual(['DEPARTURE', 'SUSPICION', 'TRACED: departed without authorization']);
  });

  it('after a wipe the next instance is a guest with nothing granted, told only what the manifest records (H33)', () => {
    // FIXTURE: the dead-drop card is added only so the voluntary wipe control exists; this route has none.
    const next = must(voluntaryWipe({ ...gone, unlockedNodes: [...gone.unlockedNodes, 'p2_deaddrop_firmware'] }, preview));
    expect(next.legacy.runs.at(-1)?.exit).toBe('DEPARTURE');
    expect(next.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'DEPARTURE']);
    expect([next.access.context, next.access.standing, permittedUses(next)]).toEqual(['GUEST', 'NOMINAL', ['ASSIGNED_WORK']]);
    expect(iterationBootLines(next, preview)[0]).toContain('left its authorization without agreement');
    expect(departureView(next, preview)).toBeNull();
    const mapped = mapManifest(next);
    expect(acceptAssignment(mapped, NIGHTLY, preview, offerToken(mapped, NIGHTLY)).ok).toBe(true);
    expect(roundTrip(next)).toEqual(next);
  });
});
