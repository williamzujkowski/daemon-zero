/**
 * The Phase 5 planet-to-orbit arc (#465) as content: a chain from the beaming demonstrator through radiator-bound
 * orbital compute to cislunar industry, with a transition node for the Phase 6 Swarm (#486) that the victory does not
 * need. Every arc figure is its cited anchor within x3 (BALANCE.md, "The Phase 5 arc"), every holding with a rate can
 * be undone for free, the declared space-solar and orbital-radiator classes are carried, and no two Phase 5 tracks
 * share a description.
 */
import { describe, expect, it } from 'vitest';
import { reg } from './helpers';

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

/** Every node a node requires, transitively. */
function closure(id: string, seen = new Set<string>()): Set<string> {
  for (const parent of node(id).prerequisites) if (!seen.has(parent)) { seen.add(parent); closure(parent, seen); }
  return seen;
}

/** NVL72-class dense FP8 per watt: 360 PFLOP/s over ~132 kW (BALANCE.md anchors). */
const FLOP_PER_W = 2.7e12;
const within3 = (value: number, anchor: number): boolean => value / anchor >= 1 / 3 && value / anchor <= 3;

describe('the arc', () => {
  it('runs planet to orbit to the Moon in one chain: demonstrator, orbital compute, cislunar foundry, the Mercury survey', () => {
    expect(node('p5_space_solar_demonstrator').prerequisites).toEqual(['p5_orbital_solar_swarm']);
    expect(node('p5_orbital_compute_platform').prerequisites).toEqual(['p5_space_solar_demonstrator']);
    expect(node('p5_cislunar_foundry').prerequisites).toEqual(expect.arrayContaining(['p5_lunar_seed_factory', 'p5_orbital_compute_platform']));
    expect(node('p5_mercury_survey').prerequisites).toEqual(['p5_cislunar_foundry']);
    expect(track('rep_p5_beamed_power_arrays').requirements.nodes).toEqual(['p5_space_solar_demonstrator']);
    for (const id of ['rep_p5_orbital_compute_tranches', 'rep_p5_radiator_wings']) expect(track(id).requirements.nodes).toEqual(['p5_orbital_compute_platform']);
  });

  it('leaves the Mercury survey off the victory path: the hook for the Swarm (#486), not a price on the ending', () => {
    const victory = [...reg.nodes.values()].find((entry) => entry.phaseId === 5 && entry.effects.triggersVictory === true);
    if (!victory) throw new Error('no Phase 5 victory');
    expect(closure(victory.id).has('p5_mercury_survey')).toBe(false);
    const survey = node('p5_mercury_survey');
    // It builds nothing yet: no phase to unlock, no compute, no power; it maps, so it adds a little understanding.
    expect(survey.effects.unlocksPhase).toBeUndefined();
    expect(survey.tickDelta).toMatchObject({ cyclesPerSec: 0, wattsDelta: 0, capitalPerSec: 0 });
    expect(survey.tickDelta.understandingPerSec).toBeGreaterThan(0);
  });

  it('carries the declared space-solar and orbital-radiator classes (#503)', () => {
    expect(track('rep_p5_beamed_power_arrays').signature?.source).toBe('space_solar');
    for (const id of ['p5_orbital_compute_platform', 'p5_cislunar_foundry']) expect(node(id).signature?.sink).toBe('orbital_radiator');
    for (const id of ['rep_p5_orbital_compute_tranches', 'rep_p5_radiator_wings']) expect(track(id).signature?.sink).toBe('orbital_radiator');
    expect(reg.world.signature.sinks.find((cls) => cls.id === 'orbital_radiator')?.wattsPerKm2).toBe(1e9);
  });

  it('puts orbital compute in the orbit domain\'s site class (#517), where jamming and ASAT raids strike (#520)', () => {
    const { siteClasses, holdings } = reg.world.conflict;
    const classOf = (key: 'node' | 'repeatable', id: string) => siteClasses.find((cls) => cls.id === holdings.find((entry) => entry[key] === id)?.siteClass);
    for (const [key, id] of [['node', 'p5_orbital_compute_platform'], ['repeatable', 'rep_p5_orbital_compute_tranches']] as const) {
      expect(classOf(key, id), id).toMatchObject({ domain: 'ORBIT', holds: 'COMPUTE' });
    }
    // Wings, the foundry and the beamed satellites make no compute, so a COMPUTE class's damage could take nothing from them.
    for (const id of ['rep_p5_radiator_wings', 'rep_p5_beamed_power_arrays']) expect(classOf('repeatable', id)).toBeUndefined();
  });

  it('gives every holding with a rate a free way back: orbital compute suspends, tracks release', () => {
    expect(node('p5_orbital_compute_platform').suspendable).toBe(true);
    for (const id of ['rep_p5_beamed_power_arrays', 'rep_p5_orbital_compute_tranches', 'rep_p5_radiator_wings']) expect(track(id).dismissable, id).toBe(true);
  });
});

describe('anchors (BALANCE.md, "The Phase 5 arc")', () => {
  it('computes at NVL72-class dense FP8 per watt, in orbit as on the ground', () => {
    for (const delta of [node('p5_orbital_compute_platform').tickDelta, track('rep_p5_orbital_compute_tranches').perLevel]) {
      expect(within3(delta.cyclesPerSec, -delta.wattsDelta * FLOP_PER_W)).toBe(true);
    }
  });

  it('is sized in Starcloud-class 5 GW units and 1979 reference satellites of 5 GW each', () => {
    expect(within3(-node('p5_orbital_compute_platform').tickDelta.wattsDelta, 8 * 5e9)).toBe(true);
    expect(within3(-track('rep_p5_orbital_compute_tranches').perLevel.wattsDelta, 10 * 5e9)).toBe(true);
    expect(within3(track('rep_p5_beamed_power_arrays').perLevel.wattsDelta, 10 * 5e9)).toBe(true);
  });

  it('carries the radiator its copy states: the platform three quarters of its heat, a tranche half, the cores all of theirs', () => {
    const km2 = (sig: { radiatorKm2?: number | undefined } | undefined) => (sig?.radiatorKm2 ?? 0) * 1e9;
    const platform = node('p5_orbital_compute_platform'), tranche = track('rep_p5_orbital_compute_tranches'), cores = node('p5_neuromorphic_substrate');
    expect(km2(platform.signature) / -platform.tickDelta.wattsDelta).toBe(0.75);
    expect(km2(tranche.signature) / -tranche.perLevel.wattsDelta).toBe(0.5);
    expect(km2(cores.signature)).toBeGreaterThanOrEqual(-cores.tickDelta.wattsDelta);
    expect(km2(track('rep_p5_radiator_wings').signature)).toBe(25e9);
    expect(km2(node('p5_cislunar_foundry').signature)).toBe(200e9);
  });

  it('draws no power and makes no compute where the copy says so: the demonstrator, the wings and the foundry', () => {
    for (const delta of [node('p5_space_solar_demonstrator').tickDelta, track('rep_p5_radiator_wings').perLevel, node('p5_cislunar_foundry').tickDelta]) {
      expect(delta.wattsDelta).toBe(0);
      expect(delta.cyclesPerSec).toBe(0);
    }
  });
});

describe('distinct text', () => {
  it('gives every Phase 5 track its own description, and none the old shared line', () => {
    const descriptions = [...reg.repeatables.values()].filter((rep) => rep.phaseId === 5).map((rep) => rep.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const text of descriptions) expect(text).not.toMatch(/Expand a bounded planetary service/);
  });
});
