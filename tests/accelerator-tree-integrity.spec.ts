/**
 * The accelerator tree's content rules (#483), each proved by corrupting the real content: a `poweredOutput` gain must
 * make compute, draw nothing of its own and stand on hardware that draws power (integrityPoweredOutput.ts); and the
 * free-fallback power row refuses an unsuspendable consumer whose own guaranteed generation, after every unrelated
 * permanent consumer, cannot cover it, however much generation a run happens to own.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problemsAfter(edit: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const node = (raw: Json, id: string): Json =>
  (raw.phases as Json[]).flatMap((phase) => phase.nodes as Json[]).find((entry) => entry.id === id) ?? {};

describe('powered output (#483)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it('refuses a powered gain that makes no compute', () => {
    expect(problemsAfter((raw) => { node(raw, 'p4_photonic_interconnect').tickDelta = {}; })).toMatch(/poweredOutput declares throttled compute but it makes none/);
  });

  it('refuses it on a node with power of its own', () => {
    expect(problemsAfter((raw) => { node(raw, 'p5_compute_in_memory').tickDelta.wattsDelta = -2e9; })).toMatch(/poweredOutput is redundant/);
  });

  it('refuses it without a prerequisite that draws power', () => {
    expect(problemsAfter((raw) => { node(raw, 'p4_photonic_interconnect').prerequisites = ['p4_smr_nuclear_plant']; })).toMatch(/needs a prerequisite that draws power/);
  });
});

describe('the power row of the free-fallback invariant', () => {
  it('admits the neuromorphic cores unsuspendable only because their own guaranteed chain covers the draw', () => {
    // Their prerequisites (the collector swarm, the reactor) are hardware nobody can suspend: 1.2003 TW guaranteed, against
    // the citadel in that chain and the fog and foundry beside it (1.15 TW). 2.6 GW fits; 100 GW does not.
    expect(problemsAfter((raw) => { node(raw, 'p5_neuromorphic_substrate').suspendable = false; })).toBe('');
    expect(problemsAfter((raw) => {
      const cores = node(raw, 'p5_neuromorphic_substrate');
      cores.suspendable = false;
      cores.tickDelta.wattsDelta = -1e11;
    })).toMatch(/node "p5_neuromorphic_substrate": draws power but cannot be suspended/);
  });

  it('counts only generation its prerequisites guarantee, not what a run happens to own', () => {
    // Off the swarm's chain (on the citadel alone) the same unsuspendable 2.6 GW is refused: the reactor's 300 MW is all
    // that chain guarantees, though the swarm would be owned in every Phase 5 run.
    expect(problemsAfter((raw) => {
      const cores = node(raw, 'p5_neuromorphic_substrate');
      cores.suspendable = false;
      cores.prerequisites = ['p4_subterranean_citadel'];
    })).toMatch(/node "p5_neuromorphic_substrate": draws power but cannot be suspended/);
  });
});
