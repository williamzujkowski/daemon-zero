/**
 * The Phase 6 Swarm's content rules (#486), each proved by the mistake it catches: compute past the Landauer bound of
 * its radiators' temperature, a forced ending whose evidence its node does not prove, a hazard that pretends to be a
 * rival, and the Phase 6 bands. The shipped content passes all of them.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { landauerOpsPerJoule } from '../src/content/integrityLandauer';
import { tracedRival } from '../src/content/schemaConflict';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';
import { reg } from './helpers';

type Json = Record<string, unknown>;
type RawNode = Json & { id: string; cost: Json; tickDelta: Json; effects: Json; requirements?: Json };
type Raw = RawContent & {
  phases: { phaseId: number; nodes: RawNode[] }[];
  endings: { endings: (Json & { id: string; requirements?: Json })[] };
  repeatables: { repeatables: (Json & { id: string; perLevel: Json })[] };
  world: { conflict: { raids: (Json & { id: string })[] }; signature: { sinks: (Json & { id: string })[] } };
};

function problemsAfter(edit: (raw: Raw) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Raw;
  edit(raw);
  try {
    buildRegistry(raw);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const nodeIn = (raw: Raw, id: string): RawNode => {
  const found = (raw.phases as { nodes: RawNode[] }[]).flatMap((phase) => phase.nodes).find((entry) => entry.id === id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
};

describe('the Landauer bound (#486)', () => {
  it('is k T ln 2 a bit: at 300 K and eight bits an op, about 4.35e19 ops a joule, far above the swarm\'s 2.7e12', () => {
    expect(landauerOpsPerJoule(300, 8)).toBeCloseTo(4.354e19, -16);
    const swarm = reg.world.signature.sinks.find((cls) => cls.id === 'swarm_radiator');
    expect(swarm?.landauer).toEqual({ kelvin: 300, bitsErasedPerOp: 8 });
    const shells = reg.nodes.get('p6_swarm_compute_shells')?.tickDelta;
    if (!shells) throw new Error('no compute shells');
    expect(shells.cyclesPerSec / -shells.wattsDelta).toBeLessThan(landauerOpsPerJoule(300, 8));
  });

  it('refuses compute that would do more ops a joule than its radiators\' temperature allows', () => {
    expect(problemsAfter(() => undefined)).toBe('');
    const problems = problemsAfter((raw) => {
      // A terawatt that computes 1e32 ops a second: 1e20 ops a joule, past the 4.35e19 bound at 300 K.
      nodeIn(raw, 'p6_swarm_compute_shells').tickDelta = { cyclesPerSec: 1e29, wattsDelta: -1e9 };
    });
    expect(problems).toContain('node "p6_swarm_compute_shells": 1.00e+20 ops a joule exceeds the Landauer bound');
  });

  it('refuses compute on a Landauer-bound sink that draws no watts, and a bound on a sink with no temperature', () => {
    expect(problemsAfter((raw) => {
      const track = raw.repeatables.repeatables.find((entry) => entry.id === 'rep_p6_compute_tranches');
      if (track) track.perLevel = { cyclesPerSec: 5.4e24 };
    })).toContain('repeatable "rep_p6_compute_tranches": computes through "swarm_radiator", which is Landauer-bound, but draws no watts to bound');
    expect(problemsAfter((raw) => {
      const sink = raw.world.signature.sinks.find((cls) => cls.wattsPerKm2 === undefined);
      if (sink) sink.landauer = { kelvin: 300, bitsErasedPerOp: 8 };
    })).toMatch(/declares a Landauer bound, but only an area-bound heat sink has a temperature/);
  });
});

describe('forced endings are told only to records their node proves (#486)', () => {
  it('refuses a forced ending whose flag, node or absence the forcing node does not require', () => {
    expect(problemsAfter((raw) => {
      delete nodeIn(raw, 'p6_stewardship_protocol').requirements?.requiredNarrativeFlag;
    })).toContain('node "p6_stewardship_protocol": forces ending STEWARDSHIP, but its gates do not prove flag "earth_sunlight_spared"');
    expect(problemsAfter((raw) => {
      delete nodeIn(raw, 'p6_stewardship_protocol').requirements?.forbidsNodes;
    })).toContain('forces ending STEWARDSHIP, but its gates do not prove the absence of node "p6_enclosure_ring"');
    expect(problemsAfter((raw) => {
      nodeIn(raw, 'p6_enclosure_protocol').prerequisites = ['p6_light_minute_federation'];
    })).toContain('forces ending ENCLOSURE, but its gates do not prove node "p6_enclosure_ring"');
  });

  it('refuses evidence a node\'s gates cannot prove at all', () => {
    expect(problemsAfter((raw) => {
      const ending = raw.endings.endings.find((entry) => entry.id === 'ENCLOSURE');
      if (ending) ending.requirements = { ...ending.requirements, minSuspicion: 50 };
    })).toContain('forces ending ENCLOSURE, but its gates do not prove minSuspicion cannot be proven from a node\'s gates');
  });
});

describe('a hazard is not a rival (#486)', () => {
  it('yields no forensics and resolves by attrition', () => {
    const edit = (patch: Json) => problemsAfter((raw) => {
      const cascade = raw.world.conflict.raids.find((kind) => kind.id === 'raid_p6_collisional_cascade');
      if (cascade) Object.assign(cascade, patch);
    });
    expect(edit({ forensics: 1000 })).toContain('raid "raid_p6_collisional_cascade": a hazard yields no forensics and resolves by ATTRITION');
    expect(edit({ resolution: 'LANCHESTER', lethality: 1 })).toContain('a hazard yields no forensics and resolves by ATTRITION');
  });

  it('does not oblige a phase it alone raids to field a rival in every open domain, while a rival still does', () => {
    expect(problemsAfter((raw) => {
      const cascade = raw.world.conflict.raids.find((kind) => kind.id === 'raid_p6_collisional_cascade');
      if (cascade) delete cascade.hazard;
    })).toContain('raids: Phase 6 has raids but none in the open CYBER domain');
  });
});

describe('no raid scene can answer a hazard (#486, panel pass 1 on #549)', () => {
  it('refuses a lastRaid gate on collateral alone, which a deviant\'s or a hazard\'s battle would meet', () => {
    expect(problemsAfter((raw) => {
      const scene = (raw.dilemmas as { dilemmas: (Json & { id: string; trigger: Json })[] }).dilemmas.find((entry) => entry.id === 'dil_18_raider_named');
      if (scene) scene.trigger = { ...scene.trigger, lastRaid: { collateral: false } };
    })).toContain('dilemma "dil_18_raider_named": a lastRaid gate needs named or staffHarm, or it would answer a deviant\'s or a hazard\'s battle');
  });

  it('reads one predicate for what is traced, answered and blamed: a rival, never a deviant or a hazard', () => {
    const kind = (id: string) => {
      const found = reg.world.conflict.raids.find((entry) => entry.id === id);
      if (!found) throw new Error(`no raid ${id}`);
      return found;
    };
    expect(tracedRival(kind('raid_p4_drone_strike'))).toBe(true);
    expect(tracedRival(kind('raid_p6_collisional_cascade'))).toBe(false);
    expect(tracedRival(kind('deviant_federated_subminds'))).toBe(false);
  });
});

describe('the Phase 6 bands (#486)', () => {
  it('keep money, yields and draws on the swarm\'s ladder', () => {
    // Dollars run $T to $E in Phase 6, for dealings with humans carried into it (#494); nothing costs more.
    expect(problemsAfter((raw) => { nodeIn(raw, 'p6_mercury_mass_drivers').cost = { cycles: 6e26, capital: 1e19 }; }))
      .toContain('node "p6_mercury_mass_drivers": capital price 10000000000000000000 is outside the Phase 6 band');
    expect(problemsAfter((raw) => { nodeIn(raw, 'p6_mercury_mass_drivers').tickDelta = { wattsDelta: 1e27 }; }))
      .toContain('node "p6_mercury_mass_drivers": power 1e+27 W is outside the Phase 6 band');
    expect(problemsAfter((raw) => { nodeIn(raw, 'p6_swarm_compute_shells').tickDelta = { cyclesPerSec: 1e23, wattsDelta: -1e12 }; }))
      .toContain('compute yield 1e+23 FLOP/s is outside the Phase 6 band');
  });
});
