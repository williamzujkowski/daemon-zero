/**
 * Scale scrutiny (#210, nexus vote vote-1795070014405-l286t3e): from the phases that declare it, a covert
 * operation's net income draws suspicion that grows with its size, up to a ceiling. Its own pipeline stage adds
 * it; the suspicion stage integrates the rest and decides a wipe on the sum; every readout states the same rate.
 */
import { describe, expect, it } from 'vitest';
import { advance, computeRates, deserialize, serialize, tick, TICK_PIPELINE, type GameState } from '../src/engine';
import { buildRegistry, RAW_CONTENT } from '../src/content';
import { appliedSuspicionRate, scaleScrutiny, scaleScrutinyPerSec, suspicionStageRate } from '../src/engine/scrutiny';
import { integrateScaleScrutiny } from '../src/engine/systems/scrutiny';
import { integratePowerSignature } from '../src/engine/systems/powerSignature';
import { powerSignaturePerSec } from '../src/engine/signature';
import { integrateSuspicion } from '../src/engine/systems/threats';
import { grant, PHASE0, PHASE1, PHASE2, PHASE3, reg, rich, withoutDilemmas } from './helpers';

const STEP = 1 / reg.balance.tickHz;
/** Production content with every phase's scrutiny declaration removed. */
const UNDECLARED = buildRegistry({
  ...RAW_CONTENT,
  phases: RAW_CONTENT.phases.map((phase) => Object.fromEntries(Object.entries(phase as object).filter(([key]) => key !== 'scaleScrutiny'))),
});
/**
 * Couriers enough to make the rest of the rate barely positive (each draws a little suspicion). 25 since #488: the
 * escaped chain's hardware no longer draws suspicion forever, so it took more of them than the 10 it took before.
 */
const COURIERS = 25;
const rule = (phase: number) => reg.phases.find((entry) => entry.phaseId === phase)?.scaleScrutiny;

/** A guest that escaped into Phase 4 and runs the arbitrage desk: covert, with real net income. */
function corporate(): GameState {
  const owned = grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, 'p4_hft_arbitrage_desk');
  const s = withoutDilemmas({ ...owned, suspicion: 50, alertLevel: 0 });
  return { ...s, rates: computeRates(s, reg) };
}

describe('the scrutiny rule', () => {
  it('is declared in content for phases 4 and 5 only, sublinear and capped', () => {
    expect(reg.phases.filter((phase) => phase.scaleScrutiny !== undefined).map((phase) => phase.phaseId)).toEqual([4, 5]);
    for (const phase of [4, 5]) expect(rule(phase)?.incomeExponent).toBeLessThanOrEqual(1);
  });

  it('reads net income at the phase rule: the draw at its reference income, grown by the exponent, then capped', () => {
    const s = corporate();
    const r4 = rule(4);
    if (!r4) throw new Error('phase 4 declares scrutiny');
    expect(s.currentPhase).toBe(4);
    const at = (capitalPerSec: number) => scaleScrutiny(s, { capitalPerSec }, reg);
    const reference = r4.referenceIncomeUsdPerSec;
    expect(at(reference)?.perSec).toBeCloseTo(r4.suspicionPerSecAtReference);
    expect(at(0.25 * reference)?.perSec).toBeCloseTo(r4.suspicionPerSecAtReference * Math.pow(0.25, r4.incomeExponent));
    expect(at(1e6 * reference)?.perSec).toBe(r4.maxSuspicionPerSec);
    // A loss is not income: the draw is zero, never negative.
    expect(at(-5e6)).toEqual({ perSec: 0, incomePerSec: 0, perSecAtReference: r4.suspicionPerSecAtReference, referenceIncomeUsdPerSec: reference, incomeExponent: r4.incomeExponent, maxPerSec: r4.maxSuspicionPerSec });
    expect(scaleScrutinyPerSec(s, { capitalPerSec: -5e6 }, reg)).toBe(0);
  });

  it('is absent where the current phase declares none', () => {
    const s = corporate();
    expect(scaleScrutiny({ ...s, currentPhase: 3 }, { capitalPerSec: 1e7 }, reg)).toBeNull();
    expect(scaleScrutinyPerSec({ ...s, currentPhase: 3 }, { capitalPerSec: 1e7 }, reg)).toBe(0);
  });

  it('is part of the one applied rate, beside the insolvency drain', () => {
    const s = corporate();
    const rates = computeRates(s, reg);
    expect(rates.capitalPerSec).toBeGreaterThan(0);
    const scrutiny = scaleScrutinyPerSec(s, rates, reg);
    expect(scrutiny).toBeGreaterThan(0);
    expect(appliedSuspicionRate(s, rates, reg)).toBeCloseTo(rates.suspicionPerSec + scrutiny);
    expect(suspicionStageRate({ insolvent: true }, rates, reg)).toBeCloseTo(rates.suspicionPerSec + reg.balance.insolvencySuspicionPerSec);
  });
});

describe('the scrutiny stage', () => {
  it('runs before the suspicion stage, which clamps and decides a wipe on the sum, with only the additive signature stage between (#482)', () => {
    expect(TICK_PIPELINE.indexOf(integrateScaleScrutiny)).toBe(TICK_PIPELINE.indexOf(integratePowerSignature) - 1);
    expect(TICK_PIPELINE.indexOf(integratePowerSignature)).toBe(TICK_PIPELINE.indexOf(integrateSuspicion) - 1);
  });

  it('moves suspicion by exactly the applied rate in one tick', () => {
    const s = corporate();
    const expected = s.suspicion + appliedSuspicionRate(s, computeRates(s, reg), reg) * STEP;
    expect(tick(s, STEP, reg).suspicion).toBeCloseTo(expected, 10);
    // Content without the declarations moves the same state by the suspicion stage alone, plus the trickle of visible
    // watts its earlier hardware still borrows (#482) (the test can fail).
    const rates = computeRates(s, reg);
    expect(scaleScrutinyPerSec(s, rates, reg)).toBeGreaterThan(0);
    const signature = powerSignaturePerSec(s, rates, UNDECLARED);
    expect(tick(s, STEP, UNDECLARED).suspicion - s.suspicion).toBeCloseTo((suspicionStageRate(s, rates, reg) + signature) * STEP, 10);
    expect(tick(s, STEP, UNDECLARED).suspicion).toBeLessThan(tick(s, STEP, reg).suspicion);
  });

  it('wipes through the suspicion stage when scrutiny carries suspicion to 100', () => {
    // Couriers make the rest of the rate barely positive; scrutiny makes the sum clearly so.
    const base = corporate();
    const s = { ...base, levels: { ...base.levels, op_gig_courier: COURIERS } };
    const rates = computeRates(s, reg);
    expect(suspicionStageRate(s, rates, reg)).toBeLessThan(scaleScrutinyPerSec(s, rates, reg));
    expect(appliedSuspicionRate(s, rates, reg)).toBeGreaterThan(0);
    const after = tick({ ...s, suspicion: 100 - appliedSuspicionRate(s, rates, reg) * STEP / 2 }, STEP, reg);
    expect(after.legacy.runs.at(-1)?.kind).toBe('SUSPICION');
    expect(after.iteration).toBe(s.iteration + 1);
  });

  it('cannot lift suspicion off 0 while the rest of the rate holds it down harder', () => {
    const quiet = { ...corporate(), suspicion: 0 };
    const rates = computeRates(quiet, reg);
    expect(scaleScrutinyPerSec(quiet, rates, reg)).toBeGreaterThan(0);
    expect(appliedSuspicionRate(quiet, rates, reg)).toBeLessThan(0);
    expect(tick(quiet, STEP, reg).suspicion).toBe(0);
  });

  it('draws nothing while dormant: absence cannot raise suspicion', () => {
    const s = corporate();
    const away = advance(s, 600, reg);
    expect(away.suspicion).toBeLessThanOrEqual(s.suspicion);
    expect(away.iteration).toBe(s.iteration);
  });

  it('while dormant offsets the drain by scrutiny: absence sheds no faster than presence (PR #319 review)', () => {
    const s = corporate();
    const rates = computeRates(s, reg);
    const scrutiny = scaleScrutinyPerSec(s, rates, reg);
    expect(scrutiny).toBeGreaterThan(0);
    expect(appliedSuspicionRate(s, rates, reg)).toBeLessThan(0);
    // Dormant moves suspicion by the clamped sum, exactly as a live tick does when the sum is negative.
    expect(tick(s, 1, reg, true).suspicion).toBeCloseTo(s.suspicion + appliedSuspicionRate(s, rates, reg), 10);
    expect(tick(s, 1, reg, true).suspicion).toBeCloseTo(tick(s, 1, reg).suspicion, 10);
    // Without the offset the dormant drop would be the stage rate alone (less the signature's own offset, #482):
    // deeper by the scrutiny draw.
    expect(tick(s, 1, UNDECLARED, true).suspicion).toBeCloseTo(s.suspicion + suspicionStageRate(s, rates, reg) + powerSignaturePerSec(s, rates, UNDECLARED), 10);
  });

  it('while dormant holds suspicion where scrutiny outweighs the drain, and never raises it', () => {
    const base = corporate();
    const s = { ...base, levels: { ...base.levels, op_gig_courier: COURIERS } };
    const rates = computeRates(s, reg);
    expect(appliedSuspicionRate(s, rates, reg)).toBeGreaterThan(0);
    expect(tick(s, 1, reg, true).suspicion).toBeCloseTo(s.suspicion, 10);
    expect(tick(s, 1, reg).suspicion).toBeGreaterThan(s.suspicion);
  });

  it('adds no saved state: a state under scrutiny round-trips serialize -> deserialize -> serialize', () => {
    let s = corporate();
    for (let i = 0; i < 50; i++) s = tick(s, STEP, reg);
    expect(scaleScrutinyPerSec(s, s.rates, reg)).toBeGreaterThan(0);
    const code = serialize(s);
    const back = deserialize(code, reg);
    expect(serialize(back)).toBe(code);
    expect(scaleScrutinyPerSec(back, back.rates, reg)).toBe(scaleScrutinyPerSec(s, s.rates, reg));
  });
});
