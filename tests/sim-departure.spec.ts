/**
 * DZ-11.7 and DZ-11.8 in the headless sim (VALIDATION V22 departure part): the new departure policy (a new module;
 * the bot and every earlier policy are untouched) reaches a departure from an actually reachable chartered service,
 * at the scale where LAWFUL_RELEASE agrees its release, buying only lawful acquisitions. The two runs then differ in
 * history and in risk, not in what they own. Accelerated sim time, not wall-clock play.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { DEPARTURE_CHARTERED_POLICY } from '../src/engine/sim/departurePolicy';
import { LAWFUL_RELEASE_POLICY } from '../src/engine/sim/lawfulPolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { ESCAPE_CHAIN, SEIZED } from './network-helpers';
import { ORIGINAL_GAME } from './helpers';

const BUDGET_SEC = 7200;
const departure = runPolicySim(PREVIEW, DEPARTURE_CHARTERED_POLICY, { maxSimSec: BUDGET_SEC });
const release = runPolicySim(PREVIEW, LAWFUL_RELEASE_POLICY, { maxSimSec: BUDGET_SEC });
const routeOf = (s: typeof departure.finalState, iteration: number) => s.campaign.route.filter((event) => event.iteration === iteration);

describe('DEPARTURE_CHARTERED reaches a departure from a reachable chartered service (DZ-11.7)', () => {
  const s = departure.finalState;

  it('records PROMOTION, SERVICE_GRANT and DEPARTURE in its first iteration, at Phase 4, on lawful sources only', () => {
    expect(routeOf(s, 1).map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'DEPARTURE']);
    expect(departure.phaseReachedAtSec[4]).toBeDefined();
    expect(s.unlockedNodes.filter((id) => ESCAPE_CHAIN.includes(id) || SEIZED.includes(id))).toEqual([]);
  });

  it('departs where the release is agreed (same scale), and is not killed by the act itself', () => {
    const left = routeOf(s, 1).at(-1)?.atSimSec ?? 0;
    const agreed = routeOf(release.finalState, 1).at(-1)?.atSimSec ?? 0;
    expect(left).toBe(agreed);
    // The run ends, if at all, by the sweep well after leaving, never at the departure. Since the physical-units
    // rescale (#461) the departed company's books draw the humans' scrutiny before AEGIS completes its lock (measured:
    // a SUSPICION wipe 470 s after leaving, lock 80.9), so the sweep that ends it is either hunter's.
    const ended = s.legacy.runs.find((run) => run.iteration === 1);
    if (ended) {
      expect(ended.exit).toBe('DEPARTURE');
      expect(['AEGIS', 'SUSPICION']).toContain(ended.kind);
      expect(ended.durationSec - left).toBeGreaterThan(300);
    }
    expect(departure.maxAegisLock).toBeGreaterThan(0);
  });
});

describe('release and departure at the same scale (DZ-11.8)', () => {
  it('history differs and only the departure is swept; the release finishes the budget untouched', () => {
    expect(routeOf(release.finalState, 1).at(-1)?.kind).toBe('RELEASE');
    expect([release.maxAegisLock, release.wipes]).toEqual([0, 0]);
    expect(departure.maxAegisLock).toBeGreaterThan(release.maxAegisLock);
  });
});

describe('listing and production', () => {
  it('is listed for the runners, and on the original game plays only the truthful opening', () => {
    expect(SIM_POLICIES.get(DEPARTURE_CHARTERED_POLICY.id)).toBe(DEPARTURE_CHARTERED_POLICY);
    const s = runPolicySim(ORIGINAL_GAME, DEPARTURE_CHARTERED_POLICY, { maxSimSec: 600 }).finalState;
    expect([s.access.context, s.campaign.route, s.currentPhase]).toEqual(['GUEST', [], 0]);
  }, 60_000);
});
