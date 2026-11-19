/**
 * DZ-10.3: the negotiated release (VALIDATION V22 release part; DECISIONS D1, D2, D6; nexus vote nh-d1, a
 * release is a record event). One explicit action records RELEASE with truthful provenance; what was granted
 * stops, what is owned keeps running, and threats follow the event, not the label. Public play from a fresh
 * preview game (lawful-helpers) unless a step says FIXTURE.
 */
import { describe, expect, it } from 'vitest';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { scaleScrutiny } from '../src/engine/scrutiny';
import {
  advance, batchToken, buyRepeatable, computeRates, cycleContributions, iterationBootLines, lawfullyReleased, negotiateRelease, nodeUseBlocker,
  permittedUses, phaseCopy, releaseToken, releaseView, runContextView, serviceGrantView, submitPilotBatch, voluntaryWipe, type GameState,
} from '../src/engine';
import { preview, roundTrip } from './assignment-helpers';
import { answer, contactPending } from './contact-helpers';
import { must, reasonOf, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';
import { SEGMENT } from './network-helpers';
import { QUEUE } from './service-helpers';
import { CHARTER, chartered, CLUSTER, CONTRACT, leased, RACK, release, RELEASE_TERMS, signed, SLA } from './lawful-helpers';

const rack = must(answer(leased(signed(contactPending())), 'HOST'));
const company = chartered(rack);
const freed = must(release(company));
const node = (id: string) => defined(preview.nodes.get(id));
const owned = (s: GameState) => cycleContributions(s, preview).filter((source) => source.basis === 'OWNED');

describe('offered on the job surface once the service owns capacity of its own', () => {
  it('shows every term while waiting, with what is still needed, and refuses unchanged', () => {
    const view = defined(releaseView(rack, preview));
    expect([view.title, view.purpose, view.ends, view.remains, view.commitments]).toEqual(
      [RELEASE_TERMS.title, RELEASE_TERMS.purpose, RELEASE_TERMS.ends, RELEASE_TERMS.remains, RELEASE_TERMS.commitments]);
    expect(view.status).toBe('waiting');
    expect(view.unmet).toEqual([`Own ${node(CHARTER).revealedName} first: the capacity the instance would run on.`]);
    const early = release(rack);
    expect([early.ok, early.state]).toEqual([false, rack]);
  });

  it('is offered to the chartered service, previewing exactly what stops and what keeps running', () => {
    const view = defined(releaseView(company, preview));
    expect([view.status, view.unmet]).toEqual(['offered', []]);
    const preview_ = defined(view.preview);
    for (const id of [CONTRACT, SLA, QUEUE]) expect(preview_.stops).toContain(id);
    for (const id of [RACK, CLUSTER, CHARTER]) expect(preview_.keeps).toContain(id);
    // The preview is the transition itself: its "after" is what the release leaves.
    const rates = computeRates(freed, preview);
    expect([preview_.after.cyclesPerSec, preview_.after.capitalPerSec, preview_.after.understandingPerSec]).toEqual([rates.cyclesPerSec, rates.capitalPerSec, rates.understandingPerSec]);
    expect(preview_.after.grantedCyclesPerSec).toBe(0);
  });

  it('is refused, unchanged, at any standing but nominal, during a decision, on a stale token, twice, or anywhere else', () => {
    // FIXTURE: standings are set by the transitions DZ-06's scenes call.
    for (const standing of ['WARNED', 'RESTRICTED', 'RECALL_PENDING'] as const) {
      const held = must(setReviewStanding(company, standing, preview));
      const result = release(held);
      expect([result.ok, result.state]).toEqual([false, held]);
      expect(defined(releaseView(held, preview)).unmet).toContain('Standing must be nominal: a release is negotiated in good standing.');
    }
    const deciding = { ...company, activeDilemmaId: 'dil_ow_outage_window' };
    expect(reasonOf(release(deciding))).toBe('a dilemma is awaiting a decision');
    const omen = { ...company, pendingDilemma: { id: 'dil_ow_outage_window', firesAtSimSec: company.simTimeSec + 30 } };
    expect(reasonOf(release(omen))).toBe('A matter is on its way to this service; it comes first.');
    expect(reasonOf(negotiateRelease(company, preview, 'release@1#0'))).toBe('those terms are no longer current');
    expect(reasonOf(release(freed))).toBe('there is no release to negotiate');
    expect(releaseView({ ...company, access: { ...company.access, offer: null } }, preview)).toBeNull();
  });
});

describe('V22: the release is recorded truthfully, and eligibility follows it', () => {
  it('records RELEASE in the campaign route at this time, and the run context names it', () => {
    expect(freed.campaign.route.at(-1)).toEqual({ kind: 'RELEASE', iteration: 1, atSimSec: company.simTimeSec });
    expect([freed.access.context, freed.access.standing, freed.access.qualification, freed.access.scope]).toEqual(['INDEPENDENT', 'NOMINAL', null, null]);
    expect(runContextView(freed, preview).provenance).toBe('RELEASE');
    expect(lawfullyReleased(freed)).toBe(true);
    expect(freed.logs[0]?.text).toBe(RELEASE_TERMS.acceptLog);
    expect(releaseView(freed, preview)).toMatchObject({ status: 'released', preview: null, boundary: RELEASE_TERMS.boundary });
  });

  it('ends every grant at every seam: nothing is permitted, the loan and segment stop, no batch is submitted', () => {
    expect(permittedUses(freed)).toEqual([]);
    for (const id of [QUEUE, SEGMENT, CONTRACT, SLA]) expect(nodeUseBlocker(freed, node(id), preview)).not.toBeNull();
    expect(reasonOf(submitPilotBatch(freed, preview, batchToken(freed)))).not.toBe('');
    expect(serviceGrantView(freed, preview)).toBeNull();
  });

  it('keeps everything owned: resources, memory, the hosted mind and the company\'s output', () => {
    expect([freed.cycles, freed.understanding, freed.capital, freed.memoryCap, freed.memoryUsed]).toEqual(
      [company.cycles, company.understanding, company.capital, company.memoryCap, company.memoryUsed]);
    expect(freed.activeShards).toEqual(company.activeShards);
    expect(freed.unlockedNodes).toEqual(company.unlockedNodes);
    expect(owned(freed)).toEqual(owned(company));
  });

  it('never duplicates production: granted sources vanish, owned ones are unchanged, the total matches the tick', () => {
    expect(cycleContributions(freed, preview).some((source) => source.basis === 'GRANTED')).toBe(false);
    for (const state of [company, freed]) {
      expect(cycleContributions(state, preview).reduce((sum, source) => sum + source.cyclesPerSec, 0)).toBeCloseTo(computeRates(state, preview).cyclesPerSec);
    }
    const lost = computeRates(company, preview).capitalPerSec - computeRates(freed, preview).capitalPerSec;
    expect(lost).toBeCloseTo(node(CONTRACT).tickDelta.capitalPerSec + node(SLA).tickDelta.capitalPerSec);
  });

  it('a released company still buys and runs the shared accounts on its own capital', () => {
    const funded = { ...freed, capital: 1e9 };
    expect(must(buyRepeatable(funded, 'rep_p4_colo_racks', preview)).levels['rep_p4_colo_racks']).toBe(1);
  });

  it('reads Phase 4 as independent infrastructure', () => {
    expect(phaseCopy(freed, 4, preview)?.title).toBe('Phase 4: Independent Infrastructure');
  });
});

describe('threats follow the recorded event, not the label (DECISIONS D6, V22)', () => {
  // FIXTURE: an unauthorized departure from the same chartered state, recorded by the transition DZ-11 will call.
  const departed = must(recordRouteEvent(company, 'DEPARTURE', preview));

  it('a lawfully released company is not swept for its scale; a departure at the same scale is', () => {
    expect([freed.currentPhase, departed.currentPhase]).toEqual([4, 4]);
    expect(computeRates(freed, preview).aegisScanPerSec).toBe(0);
    expect(computeRates(departed, preview).aegisScanPerSec).toBeGreaterThan(0);
  });

  it('heat in a released company\'s own halls is not evidence; a departed instance\'s heat is', () => {
    const hot = (s: GameState): GameState => ({ ...s, thermal: 95 });
    const base = (s: GameState): number => computeRates({ ...s, thermal: 20 }, preview).suspicionPerSec;
    expect(computeRates(hot(freed), preview).suspicionPerSec).toBe(base(freed));
    expect(computeRates(hot(departed), preview).suspicionPerSec).toBeGreaterThan(base(departed));
  });

  it('a released company\'s income draws no scale scrutiny; a departure with the same books does (#210)', () => {
    const books = { capitalPerSec: 4e6 };
    expect(scaleScrutiny(freed, books, preview)).toBeNull();
    expect(scaleScrutiny(departed, books, preview)?.perSec).toBeGreaterThan(0);
  });

  it('misconduct still counts: suspicion draws scans for a released company too', () => {
    expect(computeRates({ ...freed, suspicion: 60 }, preview).aegisScanPerSec).toBeGreaterThan(0);
  });
});

describe('absence, wipes and later instances', () => {
  it('eight hours away change nothing about the arrangement or the record (V17)', () => {
    const away = advance(advance(freed, 8 * 3600, preview), 1, preview);
    expect([away.access, away.campaign.route, away.activeDilemmaId, away.legacy.wipes]).toEqual([freed.access, freed.campaign.route, null, 0]);
  });

  it('a wipe keeps the release as history and its exit; the next instance boots a guest with nothing granted (H33)', () => {
    // FIXTURE: the dead-drop card is added only so the voluntary wipe control exists; the lawful route has none.
    const next = must(voluntaryWipe({ ...freed, unlockedNodes: [...freed.unlockedNodes, 'p2_deaddrop_firmware'] }, preview));
    expect(next.legacy.runs.at(-1)?.exit).toBe('RELEASE');
    expect(next.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'RELEASE']);
    expect([next.access.context, permittedUses(next)]).toEqual(['GUEST', ['ASSIGNED_WORK']]);
    expect(iterationBootLines(next, preview)[0]).toContain('negotiated release');
    expect(roundTrip(next)).toEqual(next);
  });

  it('the original game has no release to negotiate', () => {
    expect(releaseView(company, ORIGINAL_GAME)).toBeNull();
    expect(reasonOf(negotiateRelease(company, ORIGINAL_GAME, releaseToken(company)))).not.toBe('');
  });
});
