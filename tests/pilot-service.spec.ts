/**
 * DZ-05: the supervised pilot's one loop (nexus vote dz-d6 allocation-actuator) at its public seams.
 * Entry and the capacity ceiling (DZ-05.1), two allocations under one ceiling (V30), an explicit,
 * once-per-batch submission with no deadline (H24, V24), and the actual scale (D7).
 */
import { describe, expect, it } from 'vitest';
import {
  batchToken, computeRates, cycleContributions, isNodeAvailable, isNodeDiscoverable, loanCeiling, nodeUseBlocker,
  pilotServiceView, submitPilotBatch, unlockNode, type GameState,
} from '../src/engine';
import { live, preview } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { piloted, QUEUE, QUEUE_NODE, SERVICE, serving, split, submit, untilComplete } from './service-helpers';
import { offerPresented, respond, SKIMMER, TERMS, withSkimmer } from './pilot-helpers';

const view = (s: GameState) => {
  const v = pilotServiceView(s, preview);
  if (v === null) throw new Error('no pilot service');
  return v;
};

describe('entering the pilot (DZ-05.1)', () => {
  it('a guest never sees the loan; an accepted pilot finds it free to attach, with the ceiling it was granted', () => {
    const guest = must(respond(offerPresented(), 'stay_guest'));
    expect(isNodeDiscoverable(guest, QUEUE_NODE)).toBe(false);
    expect(reasonOf(unlockNode(guest, QUEUE, preview))).toBe('this runs only on capacity loaned under a pilot grant');
    const pilot = piloted();
    expect(isNodeDiscoverable(pilot, QUEUE_NODE)).toBe(true);
    expect(isNodeAvailable(pilot, QUEUE_NODE, preview)).toBe(true);
    expect(view(pilot)).toMatchObject({ started: false, ceilingCyclesPerSec: TERMS.narrowCapacityCyclesPerSec, narrow: true, serviceCyclesPerSec: 0, forecastSec: null });
    const attached = must(unlockNode(pilot, QUEUE, preview));
    expect([attached.cycles, attached.understanding, attached.memoryUsed, attached.memoryCap]).toEqual([pilot.cycles, pilot.understanding, pilot.memoryUsed, pilot.memoryCap]);
    expect(attached.unlockedWidgets).toContain(QUEUE_NODE.unlocksUiComponent);
    expect(view(attached)).toMatchObject({ started: true, allocation: 0.5, serviceCyclesPerSec: 5, batchCycles: SERVICE.batchCycles, withheld: null });
  });

  it('a completed result gets the full ceiling, and the split never exceeds it', () => {
    const full = serving('verify_disclose', (s) => ({ ...s, cycles: s.cycles + 500, understanding: s.understanding + 500 }));
    expect(loanCeiling(full, preview)).toBe(TERMS.capacityCyclesPerSec);
    for (const ratio of [0, 0.3, 1]) {
      const v = view(split(full, ratio));
      expect(v.serviceCyclesPerSec).toBeCloseTo(TERMS.capacityCyclesPerSec * ratio, 9);
      expect(v.studyUnderstandingPerSec).toBeCloseTo(QUEUE_NODE.tickDelta.understandingPerSec * (1 - ratio), 9);
    }
  });

  it('the loan is tagged output only: own cycles, memory and scale are untouched (D2, D7)', () => {
    const pilot = piloted();
    const attached = live(must(unlockNode(pilot, QUEUE, preview)), 1);
    expect(computeRates(attached, preview).cyclesPerSec).toBe(computeRates(pilot, preview).cyclesPerSec);
    expect(cycleContributions(attached, preview).map((source) => source.id)).not.toContain(QUEUE);
    expect(computeRates(attached, preview).understandingPerSec).toBeGreaterThan(computeRates(pilot, preview).understandingPerSec);
    const later = untilComplete(attached);
    expect([later.currentPhase, later.memoryCap]).toEqual([pilot.currentPhase, pilot.memoryCap]);
  });

  it('disclosed output stays stopped by the same rule that gates the loan (dz-d9, DZ-05.4)', () => {
    const s = must(unlockNode(must(respond(offerPresented('report_incomplete', 'exclude_report', withSkimmer), 'accept_pilot')), QUEUE, preview));
    const skimmer = preview.nodes.get(SKIMMER);
    expect(skimmer && nodeUseBlocker(s, skimmer, preview)).toBe('the pilot terms do not permit that output');
    expect(cycleContributions(s, preview).map((source) => source.id)).not.toContain(SKIMMER);
  });
});

describe('two allocations under one ceiling (V30)', () => {
  const start = serving();
  const service = split(start, 0.8);
  const study = split(start, 0.2);

  it('forecast and Understanding differ while the ceiling is the same', () => {
    expect(view(service).ceilingCyclesPerSec).toBe(view(study).ceilingCyclesPerSec);
    expect(view(service).forecastSec).toBeCloseTo(SERVICE.batchCycles / 8, 9);
    expect(view(study).forecastSec).toBeCloseTo(SERVICE.batchCycles / 2, 9);
    const a = live(service, 60);
    const b = live(study, 60);
    expect(a.access.work.progressCycles).toBeCloseTo(480, 6);
    expect(b.access.work.progressCycles).toBeCloseTo(120, 6);
    expect(b.understanding - study.understanding).toBeGreaterThan(a.understanding - service.understanding);
  });

  it('service completes the batch first; study keeps its Understanding lead after both submit', () => {
    const a = must(submit(untilComplete(service)));
    const b = must(submit(untilComplete(study)));
    expect(a.simTimeSec).toBeLessThan(b.simTimeSec);
    const sameClock = live(a, Math.round(b.simTimeSec - a.simTimeSec));
    expect(sameClock.access.work.batches).toBe(1);
    expect(b.understanding).toBeGreaterThan(sameClock.understanding);
  });

  it('progress stops at one batch and nothing happens to completed work left waiting (no deadline)', () => {
    const done = untilComplete(service);
    const later = live(done, 600);
    expect(later.access.work).toEqual({ progressCycles: SERVICE.batchCycles, batches: 0 });
    expect(later.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL', offer: { response: 'ACCEPTED' } });
    expect(later.activeDilemmaId).toBeNull();
    expect(view(later)).toMatchObject({ complete: true, forecastSec: 0, serviceCyclesPerSec: 0 });
    expect(later.understanding).toBeGreaterThan(done.understanding);
  });
});

describe('submitting a batch is explicit and pays once (H24, V24)', () => {
  const done = untilComplete(serving());

  it('pays the advertised return once and starts the next batch', () => {
    const next = must(submit(done));
    expect(next.cycles - done.cycles).toBe(SERVICE.batchReturn.cycles);
    expect(next.understanding - done.understanding).toBe(SERVICE.batchReturn.understanding);
    expect(next.access.work).toEqual({ progressCycles: 0, batches: 1 });
    expect(next.logs[0]?.text).toContain('Triage batch 1');
    expect(next.traits).toEqual(done.traits);
    expect(next.campaign).toEqual(done.campaign);
  });

  it('refuses a repeated, stale, early or foreign submission without paying anything', () => {
    const next = must(submit(done));
    const cases: [GameState, string, string][] = [
      [next, batchToken(done), 'that batch is no longer current'],
      [next, batchToken(next), 'the batch is not complete yet'],
      [done, `batch:asg_nightly_regression@${String(done.iteration + 1)}#1`, 'that batch is no longer current'],
    ];
    for (const [s, token, reason] of cases) {
      const result = submitPilotBatch(s, preview, token);
      expect(reasonOf(result)).toBe(reason);
      expect(result.state).toBe(s);
    }
  });

  it('a routine notice during the work pays nothing (NH-07 task context only)', () => {
    const s = live(split(serving(), 0), 130);
    expect(view(s).queueContext).not.toBeNull();
    expect(s.access.work).toEqual({ progressCycles: 0, batches: 0 });
  });
});
