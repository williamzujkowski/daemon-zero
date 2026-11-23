/**
 * Orbital compute where radiator area binds (#465) at the engine's public seam. In orbit heat leaves only as light, so
 * the orbital radiators shed at most their deployed area times the sink's watts per km²; compute whose heat leaves
 * through them runs at the share they shed, in computeRates and in cycleContributions alike. More radiator raises the
 * share, more heat lowers it, and suspending the heat gives it back.
 */
import { describe, expect, it } from 'vitest';
import {
  buyRepeatable, computeRates, cycleContributions, dismissRepeatable, radiatorReadings, toggleNode, type GameState,
} from '../src/engine';
import { grant, must, PHASE0, PHASE1, PHASE2, PHASE3, PHASE4, reg, rich, sumTolerance, withoutDilemmas } from './helpers';

const PLATFORM = 'p5_orbital_compute_platform', CORES = 'p5_neuromorphic_substrate', TRANCHES = 'rep_p5_orbital_compute_tranches';
const WINGS = 'rep_p5_radiator_wings', BEAMED = 'rep_p5_beamed_power_arrays';

const sink = reg.world.signature.sinks.find((cls) => cls.wattsPerKm2 !== undefined);
if (sink?.wattsPerKm2 === undefined) throw new Error('no area-bound sink');
const PER_KM2 = sink.wattsPerKm2;

/** A Phase 5 instance in orbit, with the beaming demonstrator flown and nothing that rejects heat through radiators. */
function inOrbit(): GameState {
  return { ...grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, ...PHASE4, 'p4_orbital_cold_storage',
    'p5_orbital_solar_swarm', 'p5_space_solar_demonstrator'), suspicion: 0 };
}

const node = (id: string) => {
  const found = reg.nodes.get(id);
  if (!found) throw new Error(`missing node ${id}`);
  return found;
};
const track = (id: string) => {
  const found = reg.repeatables.get(id);
  if (!found) throw new Error(`missing track ${id}`);
  return found;
};
const reading = (s: GameState) => {
  const found = radiatorReadings(s, reg).find((entry) => entry.sinkId === sink.id);
  if (!found) throw new Error('no radiator reading');
  return found;
};
const cycles = (s: GameState) => computeRates(s, reg).cyclesPerSec;
const platformShare = (s: GameState) => (cycleContributions(s, reg).find((source) => source.id === PLATFORM)?.cyclesPerSec ?? 0);

describe('radiator area', () => {
  it('reads nothing before anything in orbit rejects heat or deploys radiator', () => {
    expect(radiatorReadings(inOrbit(), reg)).toEqual([]);
  });

  it('sheds a square kilometre a gigawatt (research B.4, 300 K two-sided)', () => {
    expect(PER_KM2).toBe(1e9);
  });

  it('runs the platform at the share its own radiators shed of its heat', () => {
    const s = grant(inOrbit(), PLATFORM);
    const platform = node(PLATFORM), km2 = platform.signature?.radiatorKm2 ?? 0, heat = -platform.tickDelta.wattsDelta;
    const r = reading(s);
    expect(r).toMatchObject({ areaKm2: km2, heatW: heat, capacityW: km2 * PER_KM2, throttlesCompute: true });
    expect(r.share).toBeCloseTo(km2 * PER_KM2 / heat, 12);
    expect(r.share).toBeLessThan(1);
  });

  it('applies the share in the rates and in the ledger of contributions alike', () => {
    const s = grant(inOrbit(), PLATFORM);
    const sum = cycleContributions(s, reg).reduce((total, source) => total + source.cyclesPerSec, 0);
    expect(sum).toBeCloseTo(cycles(s), -Math.log10(sumTolerance(cycles(s))));
    // With the radiators made whole (wings to cover the shortfall) the platform's contribution rises by exactly 1/share.
    const short = reading(s).share;
    const covered = must(buyRepeatable(s, WINGS, reg));
    expect(reading(covered).share).toBe(1);
    expect(platformShare(covered) / platformShare(s)).toBeCloseTo(1 / short, 9);
  });

  it('lets more heat throttle the whole fleet, and more radiator free it', () => {
    const platform = grant(inOrbit(), PLATFORM);
    const tranche = must(buyRepeatable(platform, TRANCHES, reg));
    expect(reading(tranche).share).toBeLessThan(reading(platform).share);
    expect(platformShare(tranche)).toBeLessThan(platformShare(platform));
    // A tranche still adds compute: it carries half its own radiator (content), so the fleet gains on balance.
    expect(cycles(tranche)).toBeGreaterThan(cycles(platform));
    let s = tranche;
    while (reading(s).share < 1) s = must(buyRepeatable(s, WINGS, reg));
    // Once the area covers the heat, both run at their full raw rate relative to each other, and more radiator adds nothing.
    const raw = (id: string) => cycleContributions(s, reg).find((source) => source.id === id)?.rawCyclesPerSec ?? 0;
    expect(raw(TRANCHES) / raw(PLATFORM)).toBeCloseTo(track(TRANCHES).perLevel.cyclesPerSec / node(PLATFORM).tickDelta.cyclesPerSec, 12);
    expect(cycles(must(buyRepeatable(s, WINGS, reg)))).toBe(cycles(s));
  });

  it('counts heat that makes no compute against the area, and a suspended holding gives both back', () => {
    const platform = grant(inOrbit(), PLATFORM);
    const cores = grant(platform, CORES);
    const coresHeat = -node(CORES).tickDelta.wattsDelta, coresArea = node(CORES).signature?.radiatorKm2 ?? 0;
    expect(reading(cores).heatW - reading(platform).heatW).toBe(coresHeat);
    expect(reading(cores).areaKm2 - reading(platform).areaKm2).toBe(coresArea);
    const suspended = must(toggleNode(cores, PLATFORM, reg));
    expect(reading(suspended)).toMatchObject({ heatW: coresHeat, areaKm2: coresArea, throttlesCompute: false });
  });

  it('a released level takes its heat and its radiator back with it', () => {
    const s = must(buyRepeatable(grant(inOrbit(), PLATFORM), TRANCHES, reg));
    const released = must(dismissRepeatable(s, TRANCHES, reg));
    expect(reading(released)).toEqual(reading(grant(inOrbit(), PLATFORM)));
  });

  it('throttles nothing off the orbital radiators: Phase 4 compute is unchanged by any radiator shortfall', () => {
    const s = grant(inOrbit(), PLATFORM);
    const ground = cycleContributions(s, reg).filter((source) => source.id !== PLATFORM);
    const before = cycleContributions(inOrbit(), reg);
    for (const source of ground) {
      const was = before.find((entry) => entry.id === source.id);
      if (was) expect(source.rawCyclesPerSec).toBeCloseTo(was.rawCyclesPerSec, -Math.log10(sumTolerance(was.rawCyclesPerSec)));
    }
  });
});

describe('energy still binds the arc', () => {
  it('puts the fleet past the swarm\'s generation, and beamed power is what closes the gap', () => {
    const fleet = ['p5_protein_panacea_foundry', 'p5_quantum_molecular_simulation', PLATFORM, 'p5_programmable_matter_fog'];
    let s = grant(inOrbit(), ...fleet);
    s = must(buyRepeatable(s, TRANCHES, reg));
    const short = computeRates(s, reg);
    expect(short.wattsConsumed).toBeGreaterThan(short.wattsGenerated);
    expect(short.gridEfficiency).toBeLessThan(1);
    const beamed = must(buyRepeatable(s, BEAMED, reg));
    expect(computeRates(beamed, reg).wattsGenerated - short.wattsGenerated).toBe(track(BEAMED).perLevel.wattsDelta);
    expect(computeRates(beamed, reg).gridEfficiency).toBe(1);
    expect(cycles(beamed)).toBeGreaterThan(cycles(s));
  });
});

describe('orbit-domain damage (#517)', () => {
  it('takes its share of orbital compute on top of the radiator share, and touches neither area nor heat', () => {
    const s = grant(inOrbit(), PLATFORM);
    const damaged: GameState = { ...s, conflict: { ...s.conflict, damage: { orbital: 0.3 } } };
    expect(platformShare(damaged) / platformShare(s)).toBeCloseTo(0.7, 9);
    expect(reading(damaged)).toEqual(reading(s));
  });
});
