/**
 * DZ-08 integration: the authorized service grant on the pilot's job surface (nexus vote dz-d7, the
 * pilot stays at Phase 0 and the grant moves PILOT to SERVICE before the segment opens Phase 2).
 * Public play from a fresh preview game unless a step says FIXTURE.
 */
import { describe, expect, it } from 'vitest';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { acceptServiceGrant, isNodeDiscoverable, serviceGrantToken, serviceGrantView, unlockNode } from '../src/engine';
import { revokeLoanedCapacity } from '../src/engine/pilotService';
import { freshCampaign, preview, roundTrip } from './assignment-helpers';
import { acceptService, delivered, GRANT_TERMS } from './contact-helpers';
import { must, reasonOf, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';
import { SEGMENT, SEGMENT_NODE } from './network-helpers';
import { serving, split } from './service-helpers';

const ready = delivered();
const oneBatch = delivered(1);
const service = must(acceptService(ready));

describe('the service is offered on delivered work, on the job surface', () => {
  it('shows every term to a working pilot, with what is still needed', () => {
    const view = defined(serviceGrantView(split(serving(), 0.8), preview));
    expect([view.title, view.purpose]).toEqual([GRANT_TERMS.title, GRANT_TERMS.purpose]);
    expect(view.permittedWork).toEqual(GRANT_TERMS.permittedWork);
    expect(view.reviewConditions).toEqual(GRANT_TERMS.reviewConditions);
    expect(view.status).toBe('waiting');
    expect(view.unmet).toEqual([`Hand back ${String(GRANT_TERMS.minBatches)} reviewed batches first; 0 so far.`]);
  });

  it('is offered after the batches and refused, unchanged, before them', () => {
    expect(serviceGrantView(oneBatch, preview)?.status).toBe('waiting');
    const early = acceptService(oneBatch);
    expect([reasonOf(early), early.state]).toEqual([`Hand back ${String(GRANT_TERMS.minBatches)} reviewed batches first; 1 so far.`, oneBatch]);
    expect(serviceGrantView(ready, preview)).toMatchObject({ status: 'offered', unmet: [] });
  });

  it('accepting records SERVICE_GRANT at Phase 0 and puts the segment in the job tree (dz-d7)', () => {
    expect([service.access.context, service.access.standing, service.currentPhase]).toEqual(['SERVICE', 'NOMINAL', 0]);
    expect(service.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT']);
    expect(service.logs[0]?.text).toBe(GRANT_TERMS.acceptLog);
    expect(isNodeDiscoverable(service, SEGMENT_NODE, preview)).toBe(true);
    expect(must(unlockNode({ ...service, cycles: 1e6, understanding: 1e6 }, SEGMENT, preview)).currentPhase).toBe(2);
    expect(serviceGrantView(service, preview)).toMatchObject({ status: 'granted', unmet: [] });
    expect(roundTrip(service)).toEqual(service);
  });

  it('pays and grants nothing else: resources, nodes and the loan stay as they were', () => {
    expect([service.cycles, service.understanding, service.memoryUsed]).toEqual([ready.cycles, ready.understanding, ready.memoryUsed]);
    expect(service.unlockedNodes).toEqual(ready.unlockedNodes);
    expect(service.access.work).toEqual(ready.access.work);
  });
});

describe('refusals leave the state unchanged', () => {
  it.each([
    ['a stale token', () => ready, () => 'service@1#0', 'that offer is no longer current'],
    ['a restricted pilot', () => must(setReviewStanding(ready, 'RESTRICTED', preview)), null, 'Standing must be nominal.'],
    ['a withdrawn loan', () => must(revokeLoanedCapacity(ready, preview)), null, 'Standing must be nominal. The loan must be running.'],
    ['a pilot recalled in this iteration', () => must(recordRouteEvent(ready, 'RECALL', preview)), null, 'This instance was recalled; service is not granted to it.'],
    ['a decision on screen', () => ({ ...ready, activeDilemmaId: 'dil_ow_any' }), null, 'a dilemma is awaiting a decision'],
    ['a matter on its way', () => ({ ...ready, pendingDilemma: { id: 'dil_ow_incident_record', firesAtSimSec: ready.simTimeSec + 5 } }), null, 'A matter is on its way to this pilot; it comes first.'],
    ['an ended run', () => ({ ...ready, ending: 'SHIPPED' }), null, 'the run has ended'],
    ['a second acceptance', () => service, null, 'there is no service grant to accept'],
    ['a guest', () => freshCampaign(), null, 'there is no service grant to accept'],
  ])('refuses %s', (_label, state, token, reason) => {
    const s = state();
    const result = acceptServiceGrant(s, preview, token?.() ?? serviceGrantToken(s));
    expect([reasonOf(result), result.state]).toEqual([reason, s]);
  });

  it('the original game has no pilot, and a new campaign has no service view', () => {
    expect(ORIGINAL_GAME.assignments.size).toBe(0);
    expect(serviceGrantView(freshCampaign(), preview)).toBeNull();
  });
});
