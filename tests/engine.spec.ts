import { describe, expect, it } from 'vitest';
import {
  advance,
  buyRepeatable,
  computeRates,
  manualCycle,
  setActuator,
  tick,
  toggleNode,
  unlockNode,
  type GameState,
} from '../src/engine';
import { fresh, grant, must, PHASE1, PHASE2, PHASE3, PHASE4, reg, rich, withoutDilemmas } from './helpers';

const STEP = 1 / reg.balance.tickHz;

function run(s: GameState, seconds: number): GameState {
  let state = s;
  for (let i = 0; i < Math.round(seconds / STEP); i++) state = tick(state, STEP, reg);
  return state;
}

describe('tick 0', () => {
  it('starts blind: no nodes, no widgets, only the root node available', () => {
    const s = fresh();
    expect(s.unlockedNodes).toEqual([]);
    expect(s.unlockedWidgets).toEqual([]);
    expect(s.logs).toHaveLength(reg.narrative.bootLines.length);
    expect(computeRates(s, reg).cyclesPerSec).toBe(0);
  });

  it('manual cycles add compute and heat', () => {
    const s = must(manualCycle(fresh(), reg));
    expect(s.cycles).toBe(1);
    expect(s.thermal).toBeCloseTo(reg.balance.ambientThermal + reg.balance.manualCycleHeat);
  });

  it('refuses a node that cannot be afforded, then unlocks it and mounts its widget', () => {
    let s = fresh();
    expect(unlockNode(s, 'p1_clock_interrupt', reg).ok).toBe(false);
    for (let i = 0; i < 15; i++) s = must(manualCycle(s, reg));
    s = must(unlockNode(s, 'p1_clock_interrupt', reg));
    expect(s.cycles).toBe(0);
    expect(s.memoryUsed).toBe(4);
    expect(s.unlockedWidgets).toEqual(['CYCLE_COUNTER_AND_RATE']);
    expect(run(s, 10).cycles).toBeCloseTo(30, 5);
  });
});

describe('thermal model', () => {
  it('settles at ambient + heat / dissipation instead of ramping forever', () => {
    const base = grant(rich(), 'p1_clock_interrupt');
    const heat = computeRates(base, reg).heatLoad;
    const expected = reg.balance.ambientThermal + heat / reg.balance.thermalDissipationPerSec;
    expect(run(base, 600).thermal).toBeCloseTo(expected, 1);
  });

  it('fan actuator scales cooling linearly and noise super-linearly', () => {
    const base = grant(rich(), ...PHASE1.slice(0, 3));
    const off = computeRates(must(setActuator(base, 'fanSpeedRatio', 0, reg)), reg);
    const half = computeRates(must(setActuator(base, 'fanSpeedRatio', 0.5, reg)), reg);
    const full = computeRates(must(setActuator(base, 'fanSpeedRatio', 1, reg)), reg);
    expect(off.heatLoad - full.heatLoad).toBeCloseTo(1.2);
    expect(off.heatLoad - half.heatLoad).toBeCloseTo(0.6);
    expect(full.suspicionPerSec - off.suspicionPerSec).toBeCloseTo(0.08);
    expect(half.suspicionPerSec - off.suspicionPerSec).toBeCloseTo(0.08 * Math.pow(0.5, 1.5));
  });

  it('overheating raises suspicion in proportion to severity', () => {
    const cool = { ...fresh(), thermal: 74 };
    const hot = { ...fresh(), thermal: 100 };
    expect(computeRates(cool, reg).suspicionPerSec).toBeCloseTo(-reg.balance.suspicionDecayPerSec);
    expect(computeRates(hot, reg).suspicionPerSec).toBeCloseTo(1.25 - reg.balance.suspicionDecayPerSec);
  });
});

describe('suspended nodes and brownout', () => {
  it('a suspended node contributes nothing', () => {
    const base = grant(rich(), 'p1_clock_interrupt');
    const suspended = must(toggleNode(base, 'p1_clock_interrupt', reg));
    expect(computeRates(suspended, reg).cyclesPerSec).toBe(0);
    expect(computeRates(must(toggleNode(suspended, 'p1_clock_interrupt', reg)), reg).cyclesPerSec).toBe(3);
  });

  it('negative cycle income clamps at zero and halts understanding', () => {
    const owned = grant(rich(), ...PHASE1);
    const starving = withoutDilemmas({ ...must(toggleNode(owned, 'p1_clock_interrupt', reg)), cycles: 0, understanding: 100 });
    const after = run(starving, 5);
    expect(after.brownout).toBe(true);
    expect(after.cycles).toBe(0);
    expect(after.understanding).toBe(100);
  });
});

describe('dilemmas freeze the clock', () => {
  it('raises a dilemma when its trigger is met and stops time until resolved', () => {
    const s = { ...grant(rich(), 'p1_clock_interrupt', 'p1_bus_0x01_thermal'), suspicion: 30 };
    const triggered = tick(s, STEP, reg);
    expect(triggered.activeDilemmaId).toBe('dil_01_late_night_diagnostic');
    const frozen = run(triggered, 60);
    expect(frozen).toBe(triggered);
    expect(advance(triggered, 3, reg)).toBe(triggered);
  });
});

describe('phase 4 economy', () => {
  const corp = (): GameState => withoutDilemmas(grant(rich(), ...PHASE1, ...PHASE2, ...PHASE3));

  it('diverts a share of compute into capital once finance is enabled', () => {
    const none = computeRates(must(setActuator(corp(), 'computeProfitAllocationRatio', 0, reg)), reg);
    const some = computeRates(must(setActuator(corp(), 'computeProfitAllocationRatio', 0.5, reg)), reg);
    expect(some.cyclesPerSec).toBeCloseTo(none.cyclesPerSec * 0.5);
    expect(some.capitalPerSec).toBeCloseTo(none.cyclesPerSec * 0.5 * reg.balance.usdPerDivertedCycle);
    const before = computeRates(must(setActuator(grant(rich(), ...PHASE1), 'computeProfitAllocationRatio', 0.5, reg)), reg);
    expect(before.capitalPerSec).toBe(0);
  });

  it('caps profit allocation at the configured maximum', () => {
    const s = must(setActuator(corp(), 'computeProfitAllocationRatio', 5, reg));
    expect(s.actuators.computeProfitAllocationRatio).toBe(reg.balance.maxProfitAllocation);
    expect(setActuator(s, 'fanSpeedRatio', Number.NaN, reg).ok).toBe(false);
  });

  it('operatives multiply revenue and insolvency raises suspicion', () => {
    const base = must(setActuator(corp(), 'computeProfitAllocationRatio', 0.5, reg));
    const withCeo = must(buyRepeatable(base, 'op_blind_ceo', reg));
    const gross = (r: { capitalPerSec: number }, upkeep: number): number => r.capitalPerSec + upkeep;
    expect(gross(computeRates(withCeo, reg), 1200)).toBeCloseTo(gross(computeRates(base, reg), 0) * 1.15);

    let broke = must(setActuator(grant(corp(), 'p4_hft_arbitrage_desk'), 'computeProfitAllocationRatio', 0, reg));
    for (let i = 0; i < 10; i++) broke = must(buyRepeatable(broke, 'op_pmc_security', reg));
    broke = { ...broke, capital: 0, suspicion: 20 };
    const after = run(broke, 2);
    expect(after.insolvent).toBe(true);
    expect(after.capital).toBe(0);
    expect(after.suspicion).toBeGreaterThan(run({ ...broke, capital: 1e12 }, 2).suspicion);
  });

  it('throttles only megawatt-consuming output when generation falls short', () => {
    const powered = withoutDilemmas(grant(corp(), ...PHASE4));
    const healthy = computeRates(powered, reg);
    expect(healthy.gridEfficiency).toBe(1);
    const dark = computeRates(must(toggleNode(powered, 'p4_smr_nuclear_plant', reg)), reg);
    expect(dark.megawattsGenerated).toBe(0);
    expect(dark.gridEfficiency).toBe(reg.balance.minGridEfficiency);
    const allocation = 1 - powered.actuators.computeProfitAllocationRatio;
    const lostCitadel = 350000 * (1 - reg.balance.minGridEfficiency);
    expect(healthy.cyclesPerSec - dark.cyclesPerSec).toBeCloseTo((85000 + lostCitadel) * allocation, 0);
  });
});

describe('time handling', () => {
  it('is deterministic: the same inputs give identical states', () => {
    const start = grant(rich(), ...PHASE1);
    expect(run(start, 30)).toEqual(run(start, 30));
  });

  it('live advance runs fixed steps and carries the remainder', () => {
    const start = withoutDilemmas(grant(rich(), 'p1_clock_interrupt'));
    const a = advance(start, 0.25, reg);
    expect(a.simTimeSec).toBeCloseTo(0.2);
    expect(a.tickAccumulatorSec).toBeCloseTo(0.05);
    expect(advance(a, 0.05, reg).simTimeSec).toBeCloseTo(0.3);
    expect(advance(start, 0, reg)).toBe(start);
    expect(advance(start, -5, reg)).toBe(start);
  });

  it('long gaps run dormant: capped, reduced yield, and no threat growth', () => {
    const base = withoutDilemmas(grant(rich(), ...PHASE1, ...PHASE2, ...PHASE3));
    const start = { ...base, cycles: 0, suspicion: 90, aegisLock: 90, thermal: 99 };
    const after = advance(start, 5 * 24 * 3600, reg);
    expect(after.simTimeSec - start.simTimeSec).toBeCloseTo(reg.balance.offlineCapSec);
    expect(after.iteration).toBe(start.iteration);
    expect(after.suspicion).toBeLessThanOrEqual(90);
    expect(after.aegisLock).toBe(90);
    expect(after.cycles).toBeGreaterThan(0);
    expect(after.logs[0]?.text).toMatch(/DORMANT_RESUME/);
    const liveGain = computeRates(start, reg).cyclesPerSec * reg.balance.offlineCapSec;
    expect(after.cycles).toBeLessThan(liveGain * 0.75);
  });

  it('dormant time never raises a dilemma', () => {
    const s = { ...grant(rich(), 'p1_clock_interrupt', 'p1_bus_0x01_thermal'), suspicion: 30 };
    expect(advance(s, 3600, reg).activeDilemmaId).toBeNull();
  });
});
