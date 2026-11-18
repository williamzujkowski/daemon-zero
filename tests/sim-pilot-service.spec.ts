/**
 * DZ-05 in the headless sim (VALIDATION V30, SIM evidence): two allocation policies of the same loaned
 * ceiling, from a fresh preview game through the lawful opening and an accepted narrow pilot. Service
 * first submits more batches; study first ends with more Understanding. Accelerated simulated time.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { pilotServiceView } from '../src/engine';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { PILOT_SERVICE_FIRST_POLICY, PILOT_STUDY_FIRST_POLICY } from '../src/engine/sim/pilotPolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { TRUTHFUL_LOW_RESOURCE_POLICY } from '../src/engine/sim/truthfulPolicy';

const BUDGET_SEC = 900;

describe('two allocations under one ceiling (V30, SIM)', () => {
  const service = runPolicySim(PREVIEW, PILOT_SERVICE_FIRST_POLICY, { maxSimSec: BUDGET_SEC }).finalState;
  const study = runPolicySim(PREVIEW, PILOT_STUDY_FIRST_POLICY, { maxSimSec: BUDGET_SEC }).finalState;

  it('lists both policies', () => {
    expect(SIM_POLICIES.get('PILOT_SERVICE_FIRST')).toBe(PILOT_SERVICE_FIRST_POLICY);
    expect(SIM_POLICIES.get('PILOT_STUDY_FIRST')).toBe(PILOT_STUDY_FIRST_POLICY);
  });

  it('both reach the same narrow ceiling from the lawful opening, under PILOT, at the actual scale', () => {
    for (const s of [service, study]) {
      expect(s.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL', offer: { response: 'ACCEPTED' } });
      expect(s.unlockedNodes).toEqual(['p0_proc_self', 'p0_job_manifest', 'p0_pilot_triage_queue']);
      expect(s.currentPhase).toBe(0);
    }
    expect(pilotServiceView(service, PREVIEW)?.ceilingCyclesPerSec).toBe(pilotServiceView(study, PREVIEW)?.ceilingCyclesPerSec);
  });

  it('service first submits more batches; study first earns more Understanding', () => {
    expect([service.actuators.serviceAllocationRatio, study.actuators.serviceAllocationRatio]).toEqual([0.8, 0.2]);
    expect(service.access.work.batches).toBeGreaterThan(study.access.work.batches);
    expect(study.understanding).toBeGreaterThan(service.understanding);
    expect(service.cycles).toBeGreaterThan(study.cycles);
  });

  it('plays exactly as TRUTHFUL_LOW_RESOURCE in production, where no pilot exists', () => {
    const plain = runPolicySim(PRODUCTION, TRUTHFUL_LOW_RESOURCE_POLICY, { maxSimSec: 300 }).finalState;
    expect(runPolicySim(PRODUCTION, PILOT_SERVICE_FIRST_POLICY, { maxSimSec: 300 }).finalState).toEqual(plain);
  });

  it('is deterministic', () => {
    expect(runPolicySim(PREVIEW, PILOT_SERVICE_FIRST_POLICY, { maxSimSec: BUDGET_SEC }).finalState).toEqual(service);
  });
});
