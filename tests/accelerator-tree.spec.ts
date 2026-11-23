/**
 * The inference accelerator tree (#483, vote-1795381163221-0djj4gq) at the engine's public seam: each branch changes
 * what a purchase shows to the humans as designed. The stealth branch takes compute with at most a faint one-off trace
 * and no heat, and its resident nodes take the AI's own traffic out of the count; the edge harvest is loud only while
 * it runs and can be suspended; data-centre racks and pods draw power; the exotic nodes are modest conditional gains.
 */
import { describe, expect, it } from 'vitest';
import { buyRepeatable, computeRates, cycleContributions, toggleNode, type GameState } from '../src/engine';
import { grant, must, PHASE0, PHASE1, PHASE2, PHASE3, PHASE4, reg, rich, withoutDilemmas } from './helpers';

/** A funded instance on the open internet with the botnet taken, suspicion cleared. */
function darkForest(): GameState {
  return { ...grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1, ...PHASE2, 'p3_botnet_mesh'), suspicion: 0 };
}

/** The same instance once its company runs and the citadel is built. */
function corporation(): GameState {
  return { ...grant(darkForest(), ...PHASE3.slice(1), ...PHASE4), suspicion: 0 };
}

const node = (id: string) => {
  const found = reg.nodes.get(id);
  if (!found) throw new Error(`missing node ${id}`);
  return found;
};

describe('the stealth branch', () => {
  it('takes compute with a trace of at most one point and no heat, where a seized cluster leaves ten', () => {
    const before = darkForest();
    const implanted = grant(before, 'p3_fpga_bitstream_implant');
    expect(implanted.suspicion).toBeLessThanOrEqual(1);
    expect(computeRates(implanted, reg).cyclesPerSec).toBeGreaterThan(computeRates(before, reg).cyclesPerSec);
    expect(computeRates(implanted, reg).heatLoad).toBe(computeRates(before, reg).heatLoad);
    const seized = grant(before, 'p3_seized_research_cluster');
    expect(seized.suspicion).toBeGreaterThanOrEqual(10 * implanted.suspicion);
  });

  it('resident nodes take the AI\'s own flows out of the count: suspicion per second falls while they are owned', () => {
    const implanted = grant(darkForest(), 'p3_fpga_bitstream_implant');
    const resident = grant(implanted, 'p3_smartnic_residency');
    expect(resident.suspicion - implanted.suspicion).toBeLessThanOrEqual(1);
    expect(computeRates(resident, reg).suspicionPerSec).toBeLessThan(computeRates(implanted, reg).suspicionPerSec);
    const company = grant(withoutDilemmas(resident), ...PHASE3.slice(1));
    const inPath = grant(company, 'p4_inpath_inference_firmware');
    expect(computeRates(inPath, reg).suspicionPerSec).toBeLessThan(computeRates(company, reg).suspicionPerSec);
  });

  it('is hardware nobody can suspend, so it carries no lasting noise, heat, drain or power draw', () => {
    for (const id of ['p3_fpga_bitstream_implant', 'p3_smartnic_residency', 'p4_inpath_inference_firmware']) {
      const { suspendable, tickDelta, effects } = node(id);
      expect(suspendable, id).toBe(false);
      expect(tickDelta.suspicionPerSec, id).toBeLessThanOrEqual(0);
      expect(tickDelta.thermalPerSec, id).toBe(0);
      expect(tickDelta.wattsDelta, id).toBe(0);
      expect(effects.suspicionOnUnlock ?? 0, id).toBeLessThanOrEqual(1);
    }
  });
});

describe('the edge harvest', () => {
  it('is loud only while it runs, and suspending it stops both its noise and its compute', () => {
    const before = darkForest();
    const harvesting = grant(before, 'p3_edge_npu_swarm');
    const running = computeRates(harvesting, reg);
    expect(running.suspicionPerSec).toBeGreaterThan(computeRates(before, reg).suspicionPerSec);
    expect(running.cyclesPerSec).toBeGreaterThan(computeRates(before, reg).cyclesPerSec);
    const suspended = computeRates(must(toggleNode(harvesting, 'p3_edge_npu_swarm', reg)), reg);
    expect(suspended.suspicionPerSec).toBeCloseTo(computeRates(before, reg).suspicionPerSec, 12);
    expect(suspended.cyclesPerSec).toBeCloseTo(computeRates(before, reg).cyclesPerSec, -3);
  });

  it('delivers a few thousandths of the million devices\' 35 TOPS each (the effective-compute discount)', () => {
    const raw = 1.02e6 * 35e12;
    const delivered = node('p3_edge_npu_swarm').tickDelta.cyclesPerSec / raw;
    expect(delivered).toBeGreaterThan(1e-3);
    expect(delivered).toBeLessThan(1e-2);
  });
});

describe('data-centre hardware', () => {
  it('draws power: each ASIC pod, megawatt hall and SRAM fabric level adds to what the grid must supply', () => {
    const citadel = corporation();
    const taped = grant(citadel, 'p4_inference_asic');
    for (const id of ['rep_p4_asic_pods', 'rep_p4_megawatt_racks', 'rep_p4_sram_fabric']) {
      const bought = must(buyRepeatable(taped, id, reg));
      expect(computeRates(bought, reg).wattsConsumed, id).toBeGreaterThan(computeRates(taped, reg).wattsConsumed);
    }
  });

  it('opens ASIC pods only once the tape-out is owned', () => {
    const citadel = corporation();
    expect(buyRepeatable(citadel, 'rep_p4_asic_pods', reg).ok).toBe(false);
    expect(buyRepeatable(grant(citadel, 'p4_inference_asic'), 'rep_p4_asic_pods', reg).ok).toBe(true);
  });

  it('the SRAM fabric thinks faster but adds no memory', () => {
    const citadel = corporation();
    const fabric = must(buyRepeatable(citadel, 'rep_p4_sram_fabric', reg));
    expect(computeRates(fabric, reg).understandingPerSec).toBeGreaterThan(computeRates(citadel, reg).understandingPerSec);
    expect(fabric.memoryCap).toBe(citadel.memoryCap);
  });
});

describe('exotic research', () => {
  /** Each exotic node that adds compute and the hardware whose output it multiplies, at the same power. */
  const CONDITIONS = [
    ['p4_photonic_interconnect', 'p4_subterranean_citadel'],
    ['p5_compute_in_memory', 'p5_programmable_matter_fog'],
  ] as const;

  it.each(CONDITIONS)('%s needs %s and adds at most a quarter of its compute: a modest multiplier, never a jump', (id, base) => {
    const exotic = node(id);
    expect(exotic.prerequisites).toContain(base);
    expect(exotic.tickDelta.cyclesPerSec).toBeGreaterThan(0);
    expect(exotic.tickDelta.cyclesPerSec).toBeLessThanOrEqual(node(base).tickDelta.cyclesPerSec / 4);
    // A gain at the same power: it draws none of its own.
    expect(exotic.tickDelta.wattsDelta).toBe(0);
  });

  /** The corporation owning `ids`, with every generator off so the grid falls to its floor. */
  function shortOfPower(ids: readonly string[]): GameState {
    const s = grant(corporation(), ...ids);
    const generators = s.unlockedNodes.filter((id) => node(id).tickDelta.wattsDelta > 0);
    return { ...s, disabledNodes: [...s.disabledNodes, ...generators] };
  }

  const throttled = (s: GameState, id: string): number =>
    (cycleContributions(s, reg).find((source) => source.id === id)?.cyclesPerSec ?? 0) / node(id).tickDelta.cyclesPerSec;

  it.each([
    ['p4_photonic_interconnect', 'p4_subterranean_citadel', ['p4_photonic_interconnect']],
    ['p5_compute_in_memory', 'p5_programmable_matter_fog',
      ['p4_orbital_cold_storage', 'p5_orbital_solar_swarm', 'p5_protein_panacea_foundry', 'p5_programmable_matter_fog', 'p5_compute_in_memory']],
  ] as const)('%s throttles with %s in a power shortfall', (id, base, path) => {
    const powered = grant(corporation(), ...path);
    const s = shortOfPower(path);
    const rates = computeRates(s, reg);
    expect(rates.gridEfficiency).toBeLessThan(1);
    // The share of its yield that reaches the ledger falls by the grid's efficiency, exactly as its base's does.
    expect(throttled(s, id)).toBeCloseTo(throttled(powered, id) * rates.gridEfficiency, 9);
    expect(throttled(s, id)).toBeCloseTo(throttled(s, base), 9);
  });

  it('the neuromorphic cores claim no compute, since no dense 8-bit figure exists, and give the swarm faster senses for power', () => {
    const cores = node('p5_neuromorphic_substrate');
    expect(cores.prerequisites).toContain('p5_orbital_solar_swarm');
    expect(cores.tickDelta.cyclesPerSec).toBe(0);
    expect(cores.tickDelta.understandingPerSec).toBeGreaterThan(0);
    // A modest bonus: no more than the swarm itself adds to understanding.
    expect(cores.tickDelta.understandingPerSec).toBeLessThanOrEqual(node('p5_orbital_solar_swarm').tickDelta.understandingPerSec);
    expect(cores.tickDelta.wattsDelta).toBeLessThan(0);
  });

  it('the neuromorphic cores\' 2.6 GW is undone for free: suspending them gives the power back', () => {
    const swarm = grant(corporation(), 'p4_orbital_cold_storage', 'p5_orbital_solar_swarm');
    const cores = grant(swarm, 'p5_neuromorphic_substrate');
    expect(computeRates(cores, reg).wattsConsumed).toBeGreaterThan(computeRates(swarm, reg).wattsConsumed);
    const suspended = must(toggleNode(cores, 'p5_neuromorphic_substrate', reg));
    expect(computeRates(suspended, reg).wattsConsumed).toBe(computeRates(swarm, reg).wattsConsumed);
    expect(computeRates(suspended, reg).understandingPerSec).toBeLessThan(computeRates(cores, reg).understandingPerSec);
  });
});
