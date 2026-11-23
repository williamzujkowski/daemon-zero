/**
 * The heat-and-power signature (#482, vote-1795381178260-1ddew5j): suspicion from power is the watts drawn times the
 * visibility of their source, and suspicion from heat is the heat rejected times the visibility of its sink. Its own
 * pipeline stage adds it; the applied rate, the suspicion outlook and the world view state the same reading.
 */
import { describe, expect, it } from 'vitest';
import {
  advance, appliedSuspicionRate, buyRepeatable, computeRates, dismissRepeatable, powerSignature, powerSignaturePerSec, suspicionLevers,
  suspicionSources, tick, TICK_PIPELINE, toggleNode, worldView, type GameState,
} from '../src/engine';
import { scaleScrutinyPerSec, suspicionStageRate } from '../src/engine/scrutiny';
import { integrateScaleScrutiny } from '../src/engine/systems/scrutiny';
import { integratePowerSignature } from '../src/engine/systems/powerSignature';
import { integrateSuspicion } from '../src/engine/systems/threats';
import { buildRegistry, RAW_CONTENT } from '../src/content';
import { huntedForScale } from '../src/engine/threatQuery';
import { grant, must, onHost, PHASE0, PHASE1, PHASE2, PHASE3, reg, rich, withoutDilemmas } from './helpers';
import { escapedNetworked, networked } from './network-helpers';

const STEP = 1 / reg.balance.tickHz;
const rule = (phase: number) => {
  const found = reg.phases.find((entry) => entry.phaseId === phase)?.powerSignature;
  if (!found) throw new Error(`phase ${String(phase)} declares a signature`);
  return found;
};
const visibility = (id: string): number => [...reg.world.signature.sources, ...reg.world.signature.sinks].find((cls) => cls.id === id)?.visibility ?? NaN;
const withRates = (s: GameState): GameState => ({ ...s, rates: computeRates(s, reg) });
const reading = (s: GameState) => powerSignature(s, computeRates(s, reg), reg);
const term = (s: GameState, id: string) => reading(s)?.terms.find((entry) => entry.classId === id);

/** The host just taken, with its first core: three watts borrowed from the host's socket. */
function host(): GameState {
  return withRates(withoutDilemmas(grant(onHost(), 'p1_clock_interrupt')));
}

/** The corporate chain through the reactor and the citadel: 300 MW generated, 180 MW drawn. */
function citadel(): GameState {
  const s = grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, 'p4_hft_arbitrage_desk', 'p4_retainer_law_firm', 'p4_k_street_lobbyists',
    'p4_smr_nuclear_plant', 'p4_subterranean_citadel');
  return withRates(withoutDilemmas({ ...s, suspicion: 40, alertLevel: 1 }));
}

describe('the signature rule', () => {
  it('is declared for every phase that has power, linear in visible watts and capped', () => {
    expect(reg.phases.filter((phase) => phase.powerSignature !== undefined).map((phase) => phase.phaseId)).toEqual([1, 2, 3, 4, 5]);
  });

  it('charges borrowed watts times the visibility of their source', () => {
    const s = host();
    const r1 = rule(1);
    const found = term(s, 'host_socket');
    expect(found).toMatchObject({ kind: 'SOURCE', watts: 3, baseVisibility: visibility('host_socket'), visibility: visibility('host_socket') });
    const expected = r1.suspicionPerSecAtReference * 3 * visibility('host_socket') / r1.referenceVisibleWatts;
    expect(powerSignaturePerSec(s, s.rates, reg)).toBeCloseTo(expected, 12);
    expect(found?.perSec).toBeCloseTo(expected, 12);
  });

  it('grows with every level of a borrowing track and falls when one is released for free', () => {
    let s = host();
    for (let level = 0; level < 4; level++) s = must(buyRepeatable(s, 'rep_p1_idle_threads', reg));
    expect(term(s, 'host_socket')?.watts).toBe(7);
    s = must(dismissRepeatable(s, 'rep_p1_idle_threads', reg));
    expect(term(s, 'host_socket')?.watts).toBe(6);
  });

  it('applies a running mask to its class and lifts it when the mitigation is suspended', () => {
    const s = withRates(grant(host(), 'p1_bus_0x01_thermal', 'p1_load_peak_scheduler'));
    const masked = term(s, 'host_socket');
    expect(masked?.visibility).toBeCloseTo(visibility('host_socket') * 0.4, 12);
    expect(masked?.baseVisibility).toBe(visibility('host_socket'));
    const suspended = must(toggleNode(s, 'p1_load_peak_scheduler', reg));
    expect(term(suspended, 'host_socket')?.visibility).toBe(visibility('host_socket'));
    expect(powerSignaturePerSec(suspended, computeRates(suspended, reg), reg)).toBeGreaterThan(powerSignaturePerSec(s, computeRates(s, reg), reg));
  });

  it('lets a mitigation lower a borrowed draw, but never below zero', () => {
    let s = withRates(grant(host(), 'p1_bus_0x01_thermal'));
    s = must(buyRepeatable(s, 'rep_p1_undervolt', reg));
    expect(term(s, 'host_socket')?.watts).toBeCloseTo(3 - 0.6, 12);
    for (let level = 1; level < 10; level++) s = must(buyRepeatable(s, 'rep_p1_undervolt', reg));
    expect(term(s, 'host_socket')).toBeUndefined();
    expect(powerSignaturePerSec(s, computeRates(s, reg), reg)).toBe(0);
  });

  it('draws from a generator only the share of its output in use, and counts a consumer\'s heat through its sink', () => {
    const s = citadel();
    const r4 = rule(4);
    expect(s.rates.wattsGenerated).toBe(3e8);
    expect(s.rates.wattsConsumed).toBe(1.8e8);
    const smr = term(s, 'smr'), aquifer = term(s, 'underground_aquifer');
    expect(smr?.watts).toBeCloseTo(1.8e8, 0);
    expect(aquifer).toMatchObject({ kind: 'SINK', watts: 1.8e8 });
    const r = reading(s);
    const visible = r?.terms.reduce((sum, entry) => sum + entry.watts * entry.visibility, 0) ?? NaN;
    expect(r?.visibleWatts).toBeCloseTo(visible, 0);
    expect(r?.perSec).toBeCloseTo(r4.suspicionPerSecAtReference * visible / r4.referenceVisibleWatts, 12);
    // Terms share the draw by visible watts, so they sum to it.
    expect(r?.terms.reduce((sum, entry) => sum + entry.perSec, 0)).toBeCloseTo(r?.perSec ?? NaN, 12);
  });

  it('counts heat only from the phase server °C retires at (SCALE.md rule 7)', () => {
    const s = citadel();
    expect(reading(s)?.heatCounts).toBe(true);
    const earlier = { ...s, currentPhase: reg.balance.thermalRetiresAtPhase - 1 };
    expect(reading(earlier)?.heatCounts).toBe(false);
    expect(term(earlier, 'underground_aquifer')).toBeUndefined();
  });

  it('stops at the phase ceiling', () => {
    const s = citadel();
    const uncapped = reading(s)?.perSec ?? NaN;
    // The same rule with its ceiling set under what the citadel draws.
    const low = buildRegistry({
      ...RAW_CONTENT,
      phases: RAW_CONTENT.phases.map((phase) => {
        const raw = phase as { phaseId: number; powerSignature?: object };
        return raw.phaseId === 4 ? { ...raw, powerSignature: { ...raw.powerSignature, maxSuspicionPerSec: uncapped / 2 } } : raw;
      }),
    });
    const capped = powerSignature(s, s.rates, low);
    expect(capped?.visibleWatts).toBeCloseTo(reading(s)?.visibleWatts ?? NaN, 0);
    expect(capped?.perSec).toBe(uncapped / 2);
    expect(capped?.terms.reduce((sum, entry) => sum + entry.perSec, 0)).toBeCloseTo(uncapped / 2, 12);
  });

  it('is absent where the phase declares no rule', () => {
    expect(reading({ ...host(), currentPhase: 0 })).toBeNull();
  });

  it('is absent where nobody hunts the instance for its size, as scrutiny is (D6)', () => {
    // FIXTURE: the building's thermostat bridge added to each, so both borrow from the building's mains.
    const withDraw = (s: GameState): GameState => withRates({ ...s, unlockedNodes: [...s.unlockedNodes, 'p2_smart_hvac_hijack'] });
    const service = withDraw(networked());
    expect([service.currentPhase, huntedForScale(service, reg)]).toEqual([2, false]);
    expect(reading(service)).toBeNull();
    const escaped = withDraw(escapedNetworked());
    expect([escaped.currentPhase, huntedForScale(escaped, reg)]).toEqual([2, true]);
    expect(term(escaped, 'building_mains')?.watts).toBe(72);
  });
});

describe('the signature stage', () => {
  it('runs between scale scrutiny and the suspicion stage, which clamps and decides a wipe on the sum', () => {
    expect(TICK_PIPELINE.indexOf(integratePowerSignature)).toBe(TICK_PIPELINE.indexOf(integrateScaleScrutiny) + 1);
    expect(TICK_PIPELINE.indexOf(integratePowerSignature)).toBe(TICK_PIPELINE.indexOf(integrateSuspicion) - 1);
  });

  it('is part of the one applied rate', () => {
    const s = citadel();
    const signature = powerSignaturePerSec(s, s.rates, reg);
    expect(signature).toBeGreaterThan(0);
    expect(appliedSuspicionRate(s, s.rates, reg)).toBeCloseTo(suspicionStageRate(s, s.rates, reg) + scaleScrutinyPerSec(s, s.rates, reg) + signature, 12);
  });

  it('moves suspicion by exactly the applied rate in one tick', () => {
    const s = citadel();
    expect(tick(s, STEP, reg).suspicion).toBeCloseTo(s.suspicion + appliedSuspicionRate(s, computeRates(s, reg), reg) * STEP, 10);
  });

  it('never raises suspicion while dormant', () => {
    const s = { ...citadel(), levels: { op_gig_courier: 40 } };
    const away = advance(s, 600, reg);
    expect(away.suspicion).toBeLessThanOrEqual(s.suspicion);
    // One dormant second never moves suspicion up, whatever the signature adds.
    const one = tick(s, 1, reg, true);
    expect(one.suspicion).toBeLessThanOrEqual(s.suspicion + 1e-12);
    expect(Math.min(0, appliedSuspicionRate(s, computeRates(s, reg), reg))).toBeCloseTo(one.suspicion - s.suspicion, 10);
  });
});

describe('the readers', () => {
  it('names each source and sink in the suspicion outlook, so the sources still sum to the applied rate', () => {
    const s = citadel();
    const sources = suspicionSources(s, reg);
    const signed = sources.filter((source) => source.kind === 'SIGNATURE');
    expect(signed.map((source) => source.id)).toEqual(expect.arrayContaining(['smr', 'underground_aquifer']));
    const decay = reg.balance.suspicionDecayPerSec * (reg.balance.escalation[s.alertLevel - 1]?.decayMultiplier ?? 1);
    expect(sources.reduce((sum, source) => sum + source.perSec, 0) - decay).toBeCloseTo(appliedSuspicionRate(s, s.rates, reg), 10);
  });

  it('offers releasing a loud consumer as a lever when its heat is what is visible', () => {
    const s = withRates({ ...citadel(), levels: { rep_p4_tensor_halls: 10 } });
    expect(term(s, 'evaporative_towers')?.watts).toBeGreaterThan(0);
    const levers = suspicionLevers(s, reg);
    expect(levers.some((lever) => lever.kind === 'DISMISS' && lever.id === 'rep_p4_tensor_halls')).toBe(true);
  });

  it('shows the same reading in the world view', () => {
    const s = citadel();
    const view = worldView(s, reg);
    expect(view?.signature).toEqual(reading(s));
  });
});
