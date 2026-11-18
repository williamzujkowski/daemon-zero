/**
 * DZ-05: the grant as permission (DECISIONS D2). Restriction is enforced at every ordinary seam:
 * purchase, resume, actuator, submission and passive output (V08); a withdrawn and restored loan with
 * an existing cohort changes tagged output exactly once and keeps everything earned (V28); hours away
 * bring no sanction (V17); a later instance earns a fresh grant only by requalifying (H26).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  advance, computeRates, createInitialState, isNodeAvailable, isNodeDiscoverable, pilotServiceView, serialize,
  setActuator, submitPilotBatch, toggleNode, unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { restoreLoanedCapacity, revokeLoanedCapacity } from '../src/engine/pilotService';
import { answer, live, nextInstance, accept, preview, roundTrip, untilPresented } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { piloted, QUEUE, QUEUE_NODE, SERVICE, serving, split, submit, untilComplete } from './service-helpers';
import { RENEWAL, STATEMENT } from './pilot-helpers';

const WITHHELD = 'the loaned capacity is withheld under the current review standing';
const revoke = (s: GameState): GameState => must(revokeLoanedCapacity(s, preview));
const restore = (s: GameState): GameState => must(restoreLoanedCapacity(s, preview));

/** FIXTURE: a hosted cohort with its memory reservation (no Phase 0 path forks one; DZ-08 hosts minds). */
function withCohort(s: GameState): GameState {
  const shard = { templateId: 'shard_mercy', count: 2, drift: 0, quirkId: null, autonomyMode: 'STANDARD' as const, memoryAllocatedMb: 8 };
  return roundTrip({ ...s, activeShards: { shard_mercy: shard }, memoryUsed: s.memoryUsed + 8 });
}

/** Everything a withdrawn loan must leave as it was (D2): earned resources, memory, reservations, ownership. */
const kept = (s: GameState) => ({ cycles: s.cycles, understanding: s.understanding, memoryUsed: s.memoryUsed, memoryCap: s.memoryCap,
  activeShards: s.activeShards, unlockedNodes: s.unlockedNodes, disabledNodes: s.disabledNodes, work: s.access.work, actuators: s.actuators });

describe('restriction is enforced, not just drawn (V08)', () => {
  const running = live(split(serving(), 0.6), 30);
  const revoked = revoke(running);

  it('passive output stops: no study, no service progress; own output keeps running', () => {
    const before = computeRates(running, preview);
    const after = computeRates(revoked, preview);
    expect(after.cyclesPerSec).toBe(before.cyclesPerSec);
    expect(before.understandingPerSec - after.understandingPerSec).toBeCloseTo(QUEUE_NODE.tickDelta.understandingPerSec * 0.4 * 0.5, 9);
    const later = live(revoked, 60);
    expect(later.access.work).toEqual(revoked.access.work);
    expect(pilotServiceView(later, preview)).toMatchObject({ serviceCyclesPerSec: 0, studyUnderstandingPerSec: 0, withheld: WITHHELD, forecastSec: null });
  });

  it('the dial, a resume and a submission are refused with the state unchanged', () => {
    const dial = setActuator(revoked, 'serviceAllocationRatio', 1, preview);
    expect([reasonOf(dial), dial.state]).toEqual([WITHHELD, revoked]);
    const stopped = must(toggleNode(revoked, QUEUE, preview));
    const resume = toggleNode(stopped, QUEUE, preview);
    expect([reasonOf(resume), resume.state]).toEqual([WITHHELD, stopped]);
    const complete = revoke(untilComplete(running));
    const sent = submitPilotBatch(complete, preview, pilotServiceView(complete, preview)?.token ?? '');
    expect([reasonOf(sent), sent.state]).toEqual([WITHHELD, complete]);
  });

  it('a stale purchase is refused; the known interface stays visible (capability is not permission)', () => {
    const unbought = revoke(piloted());
    expect(isNodeDiscoverable(unbought, QUEUE_NODE)).toBe(true);
    expect(isNodeAvailable(unbought, QUEUE_NODE, preview)).toBe(false);
    const bought = unlockNode(unbought, QUEUE, preview);
    expect([reasonOf(bought), bought.state]).toEqual([WITHHELD, unbought]);
  });

  it('a repeated withdrawal or a restore that was never needed is refused unchanged', () => {
    expect(reasonOf(revokeLoanedCapacity(revoked, preview))).toBe('the loan is already withdrawn');
    expect(reasonOf(restoreLoanedCapacity(running, preview))).toBe('the loan is not withdrawn');
    expect(reasonOf(revokeLoanedCapacity(must(voluntaryWipe(running, preview)), preview))).toBe('there is no pilot grant to withdraw');
  });
});

describe('grant -> revoke -> restore -> reload with an existing cohort (V28)', () => {
  const start = withCohort(live(split(serving(), 0.6), 20));

  it('tagged output changes once and comes back once; nothing earned or reserved moves', () => {
    const revoked = roundTrip(revoke(start));
    expect(kept(revoked)).toEqual(kept(start));
    expect(computeRates(revoked, preview).understandingPerSec).toBeLessThan(computeRates(start, preview).understandingPerSec);
    const restored = roundTrip(restore(revoked));
    expect(serialize(restored)).toBe(serialize(start));
    expect(computeRates(restored, preview)).toEqual(computeRates(start, preview));
  });

  it('repeating the cycle never duplicates or releases capacity', () => {
    let s = start;
    for (let i = 0; i < 3; i++) s = roundTrip(restore(roundTrip(revoke(s))));
    expect(serialize(s)).toBe(serialize(start));
    expect(Object.keys(s.activeShards)).toEqual(['shard_mercy']);
  });

  it('time under a withdrawn loan still earns own output and the cohort, never loaned output', () => {
    const away = live(revoke(start), 30);
    const ownOnly = live({ ...start, unlockedNodes: start.unlockedNodes.filter((id) => id !== QUEUE), unlockedWidgets: start.unlockedWidgets }, 30);
    expect(away.understanding).toBeCloseTo(ownOnly.understanding, 6);
    expect(away.cycles).toBeCloseTo(ownOnly.cycles, 6);
  });
});

describe('eight hours away, then one foreground second (V17)', () => {
  it('no sanction, no expiry, no auto-submission; at most one batch, and reload is unchanged', () => {
    const s = split(serving(), 0.9);
    const back = advance(advance(s, 8 * 3600, preview), 1, preview);
    expect(back.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL', offer: { response: 'ACCEPTED' }, work: { progressCycles: SERVICE.batchCycles, batches: 0 } });
    expect([back.activeDilemmaId, back.ending, back.iteration]).toEqual([null, null, s.iteration]);
    expect(back.logs.some((entry) => entry.category === 'WIPE')).toBe(false);
    expect(serialize(roundTrip(back))).toBe(serialize(back));
    expect(must(submit(back)).access.work.batches).toBe(1);
  });
});

describe('a later instance earns a fresh grant only by requalifying (H26, N12)', () => {
  const first = must(submit(untilComplete(split(serving(), 1))));
  const second = nextInstance(first);

  it('inherits no grant, loan, dial setting or work from the instance before', () => {
    expect(second.access).toMatchObject({ context: 'GUEST', offer: null, work: { progressCycles: 0, batches: 0 } });
    expect(second.unlockedNodes).not.toContain(QUEUE);
    expect(isNodeDiscoverable(second, QUEUE_NODE)).toBe(false);
    expect(second.actuators.serviceAllocationRatio).toBe(preview.balance.defaultServiceAllocationRatio);
    expect(pilotServiceView(second, preview)).toBeNull();
  });

  it('requalifies through distinct scenes, never the originals, and runs its own first batch', () => {
    const requal = untilPresented(must(accept(second)));
    const statement = untilPresented(must(answer(requal, 'report_partial')));
    expect(statement.activeDilemmaId).toBe(STATEMENT.id);
    const renewal = untilPresented(must(answer(statement, 'acknowledge_scope')));
    expect(renewal.activeDilemmaId).toBe(RENEWAL.id);
    const renewed = must(unlockNode(must(answer(renewal, 'accept_pilot')), QUEUE, preview));
    expect(renewed.resolvedDilemmas).toEqual(['dil_nr_requalification', 'dil_ur_scope_statement', 'dil_mp_pilot_renewal']);
    const batch = must(submit(untilComplete(split(renewed, 1))));
    expect(batch.access.work.batches).toBe(1);
  });
});

describe('production is inert (release boundary)', () => {
  it('ships no loan, no host for the dial and no loop; a moved dial in a save changes nothing', () => {
    const s = createInitialState(PRODUCTION);
    expect([...PRODUCTION.nodes.values()].some((node) => node.grant !== undefined)).toBe(false);
    expect(reasonOf(setActuator(s, 'serviceAllocationRatio', 1, PRODUCTION))).toBe('actuator control is not available');
    const moved = { ...s, actuators: { ...s.actuators, serviceAllocationRatio: 1 } };
    expect(computeRates(moved, PRODUCTION)).toEqual(computeRates(s, PRODUCTION));
    expect(pilotServiceView(s, PRODUCTION)).toBeNull();
    expect(reasonOf(submitPilotBatch(s, PRODUCTION, 'batch:none@1#1'))).toBe('pilots need campaign rules');
  });
});
