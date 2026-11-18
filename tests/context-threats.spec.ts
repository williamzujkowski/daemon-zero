/**
 * DZ-07b threats follow context and events (DECISIONS D6; VALIDATION V11 behavioural part). Sustained
 * permitted work by an authorized service at network scale draws no rogue suspicion, escalation, heat
 * response or hunter sweep over hours of foreground play; heat is announced as the operators' response;
 * misconduct still integrates, climbs the ladder and ends the run with a reason that names it. The guest,
 * and so every production run, keeps every threat exactly as before.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { guestAccess } from '../src/engine/accessState';
import { heatIsEvidence, huntedForScale, provisionedScale } from '../src/engine/threatQuery';
import { advance, computeRates, runVerdict, type GameState } from '../src/engine';
import { foreground, rawNode, variantRegistry } from './context-helpers';
import { must, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';
import { bothAcquisitions, escapedNetworked, granted, networked, TELEMETRY } from './network-helpers';

const RESPONSE = defined(PREVIEW.contextCopy.threatResponses[0]);
const HOURS = 3600;
/** Hours of foreground ticks take seconds of wall time, longer under coverage. */
const LONG = 60_000;
const texts = (s: GameState): string[] => s.logs.map((entry) => entry.text);

/** A preview registry whose telemetry runs hot enough to hold the rack over the overheat threshold. */
const HOT = variantRegistry((raw) => { rawNode(raw, TELEMETRY).tickDelta.thermalPerSec = 3; });
/** A preview registry whose hunter covers the subnet, so scale-based targeting is observable at Phase 2. */
const HUNTED = variantRegistry((raw) => { raw.balance.aegisActiveFromPhase = 2; });

describe('sustained permitted work is not hunted (V11, D6)', () => {
  it('two foreground hours at network scale: no suspicion, no escalation, no sweep, no wipe, no scene', () => {
    const start = networked();
    const after = foreground(start, 2 * HOURS);
    expect([after.iteration, after.currentPhase, after.access.context]).toEqual([1, 2, 'SERVICE']);
    expect([after.suspicion, after.alertLevel, after.aegisLock]).toEqual([0, 0, 0]);
    expect([after.activeDilemmaId, after.pendingDilemma]).toEqual([null, null]);
    expect(after.understanding).toBeGreaterThan(start.understanding);
  }, LONG);

  it('a hot rack under review is announced once as the operators\' response and draws no suspicion', () => {
    const after = foreground(networked(), HOURS, HOT);
    expect(after.thermal).toBeGreaterThan(HOT.balance.thermalThresholdForSuspicion);
    expect([after.suspicion, after.alertLevel, after.iteration]).toEqual([0, 0, 1]);
    expect(texts(after).filter((text) => text === RESPONSE.overheatNotice)).toHaveLength(1);
  }, LONG);

  it('the same hot rack on an escaped guest is evidence, exactly as before', () => {
    const after = foreground(escapedNetworked(), 600, HOT);
    expect(after.thermal).toBeGreaterThan(HOT.balance.thermalThresholdForSuspicion);
    expect(after.suspicion).toBeGreaterThan(escapedNetworked().suspicion);
    expect(texts(after)).not.toContain(RESPONSE.overheatNotice);
  });

  it('the hunter does not sweep an authorized service for being at its provisioned scale', () => {
    const service = networked();
    expect([provisionedScale(service, HUNTED), huntedForScale(service, HUNTED)]).toEqual([2, false]);
    expect(computeRates(service, HUNTED).aegisScanPerSec).toBe(0);
    const after = foreground(service, HOURS, HUNTED);
    expect([after.aegisLock, after.iteration]).toEqual([0, 1]);
  }, LONG);

  it('a restricted or recalled instance keeps the scale it was given; no grant, no provisioned scale', () => {
    expect(huntedForScale(must(setReviewStanding(networked(), 'RESTRICTED', PREVIEW)), HUNTED)).toBe(false);
    expect(huntedForScale(must(recordRouteEvent(networked(), 'RECALL', PREVIEW)), HUNTED)).toBe(false);
    expect(provisionedScale(granted(), PREVIEW)).toBeNull();
  });
});

describe('a permission label is not immunity (D6)', () => {
  it('suspicion earned by misconduct still draws the hunter\'s scans at provisioned scale', () => {
    const watched = { ...networked(), suspicion: 50 };
    const b = HUNTED.balance;
    expect(computeRates(watched, HUNTED).aegisScanPerSec).toBeCloseTo(0.5 * b.aegisSuspicionScanPerSec, 10);
  });

  it('scale taken past the provisioned one is swept as before', () => {
    // FIXTURE scale: a service that also took the escape chain one phase further than it was given.
    const beyond = { ...networked(), currentPhase: 3 };
    expect(huntedForScale(beyond, PREVIEW)).toBe(true);
    expect(computeRates(beyond, PREVIEW).aegisScanPerSec).toBeGreaterThan(0);
  });

  it('unpermitted output integrates exactly as it would for a guest with the same hardware', () => {
    // bothAcquisitions is an escaped guest the operators then promoted (FIXTURE): it still runs the skimmer.
    const service = bothAcquisitions();
    const asGuest = { ...service, access: guestAccess() };
    expect(computeRates(service, PREVIEW).suspicionPerSec).toBeGreaterThan(0);
    expect(computeRates(service, PREVIEW).suspicionPerSec).toBe(computeRates(asGuest, PREVIEW).suspicionPerSec);
  });

  it('misconduct climbs the announced ladder and ends the run with a reason that names it', () => {
    const near = { ...bothAcquisitions(), suspicion: 99.99, activeDilemmaId: null, pendingDilemma: null };
    const ended = foreground(near, 120, PREVIEW, (state) => state.iteration > 1);
    expect(ended.iteration).toBe(2);
    expect(texts(ended)).toContain(RESPONSE.suspicionWipe);
    expect(ended.legacy.lastWipeCause).toBe(RESPONSE.suspicionWipe);
    const run = defined(ended.legacy.runs.at(-1));
    expect([run.kind, run.exit]).toEqual(['SUSPICION', 'SERVICE_GRANT']);
    expect(runVerdict(run, PREVIEW)).toBe('RETIRED: misconduct under review');
    // The wiped instance is a guest again: its threats are the guest's.
    expect([ended.access.context, heatIsEvidence(ended)]).toEqual(['GUEST', true]);
  });

  it('escalation still announces each rung under review', () => {
    const rising = { ...bothAcquisitions(), suspicion: 39.9 };
    const after = advance(rising, 5, PREVIEW);
    expect(after.alertLevel).toBeGreaterThan(rising.alertLevel);
    expect(texts(after).some((text) => PREVIEW.narrative.alertLevels.some((level) => level.onEnter === text))).toBe(true);
  });
});

describe('the guest keeps every threat as before (V26)', () => {
  it('the original game answers: hunted at any scale, heat is evidence, the authored wipe reason', () => {
    const guest = { ...escapedNetworked(), currentPhase: 3 };
    expect([provisionedScale(guest, ORIGINAL_GAME), huntedForScale(guest, ORIGINAL_GAME), heatIsEvidence(guest)]).toEqual([null, true, true]);
    const b = ORIGINAL_GAME.balance;
    const rate = computeRates({ ...guest, suspicion: 20 }, ORIGINAL_GAME).aegisScanPerSec;
    expect(rate).toBe((b.aegisBaseScanPerSec + 0.2 * b.aegisSuspicionScanPerSec) * 1);
    expect(ORIGINAL_GAME.contextCopy.threatResponses).toEqual([]);
  });

  it('a guest caught at network scale gets the authored reason and verdict', () => {
    const near = { ...escapedNetworked(), suspicion: 99.99 };
    const ended = foreground(near, 60, PREVIEW, (state) => state.iteration > 1);
    expect(ended.legacy.lastWipeCause).toBe(PREVIEW.narrative.wipeSuspicionLocal);
    expect(runVerdict(defined(ended.legacy.runs.at(-1)), PREVIEW)).toBe(PREVIEW.narrative.runVerdicts.SUSPICION_OUTSIDE);
  });
});
