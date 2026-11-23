/**
 * The scale ladder is validated content (docs/SCALE.md "The ladder", #461, integrityScale.ts). Each rule is proved by
 * a price that breaks it, among them the census clashes the rescale fixed: a planetary fog granting 512 GB, a flat
 * late price, and a hidden batch job priced like a data centre.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, unknown>;
type RawNode = Json & { id: string; cost: Json; tickDelta: Json; effects: Json };
type RawPhase = { phaseId: number; nodes: RawNode[] };

/** The problems buildRegistry reports for the full composition after `edit`, or '' when it builds. */
function problemsAfter(edit: (raw: RawContent & { phases: RawPhase[] }) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as RawContent & { phases: RawPhase[] };
  edit(raw);
  try {
    buildRegistry(raw);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

function node(raw: { phases: RawPhase[] }, id: string): RawNode {
  const found = raw.phases.flatMap((phase) => phase.nodes).find((entry) => entry.id === id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
}

describe('the scale ladder (#461)', () => {
  it('accepts the shipped content in both compositions', () => {
    expect(problemsAfter(() => undefined)).toBe('');
    expect(problemsAfter(() => undefined, ORIGINAL_RAW_CONTENT)).toBe('');
  });

  it('refuses a planetary grant in a server-room unit (the 512 GB fog)', () => {
    expect(problemsAfter((raw) => { node(raw, 'p5_programmable_matter_fog').effects.memoryCapIncrease = 512 * 2 ** 30; }))
      .toMatch(/node "p5_programmable_matter_fog": memory grant .* outside the Phase 5 band/);
  });

  it('refuses a hidden batch job priced like a data centre', () => {
    expect(problemsAfter((raw) => { node(raw, 'p0_device_enum').cost.cycles = 1e15; }))
      .toMatch(/node "p0_device_enum": cycles price 1000000000000000 is outside the Phase 0 band/);
  });

  it('refuses a late price left flat from an earlier phase', () => {
    expect(problemsAfter((raw) => { node(raw, 'p5_transcendence_singularity').cost.capital = 5e5; }))
      .toMatch(/node "p5_transcendence_singularity": capital price 500000 is outside the Phase 5 band/);
  });

  it('refuses a yield that does not match its phase, and power before the player owns any', () => {
    expect(problemsAfter((raw) => { node(raw, 'p3_botnet_mesh').tickDelta.cyclesPerSec = 2500; }))
      .toMatch(/node "p3_botnet_mesh": compute yield 2500 FLOP\/s is outside the Phase 3 band/);
    expect(problemsAfter((raw) => { node(raw, 'p2_gpu_cluster_parasite').tickDelta.wattsDelta = -2e4; }))
      .toMatch(/node "p2_gpu_cluster_parasite": power -20000 W is outside the Phase 2 band/);
  });

  it('lets a phase gate carry the next phase its working memory, and nothing larger', () => {
    expect(problemsAfter((raw) => { node(raw, 'p1_bus_0x05_nic').effects.memoryCapIncrease = 2 ** 34; })).toBe('');
    expect(problemsAfter((raw) => { node(raw, 'p1_bus_0x05_nic').effects.memoryCapIncrease = 2 ** 52; }))
      .toMatch(/node "p1_bus_0x05_nic": memory grant .* outside the Phase 1\/2 band/);
  });

  it('prices a bridge purchase from the band a player arrives with', () => {
    // Phase 1 is entered from Phase 0, so its first purchase may be priced in the guest's cycles; never below the ladder.
    expect(problemsAfter((raw) => { node(raw, 'p1_clock_interrupt').cost.cycles = 20; })).toBe('');
    expect(problemsAfter((raw) => { node(raw, 'p1_clock_interrupt').cost.cycles = 0.05; }))
      .toMatch(/node "p1_clock_interrupt": cycles price 0.05 is outside the Phase 1 band/);
  });
});

describe('the guest counts stolen cycles (#526)', () => {
  it('refuses a guest yield left at the kiloFLOP scale, naming it in cycles', () => {
    expect(problemsAfter((raw) => { node(raw, 'p0_quota_skimmer').tickDelta.cyclesPerSec = 140_000; }))
      .toMatch(/node "p0_quota_skimmer": compute yield 140000 cycles\/s is outside the Phase 0 band/);
  });

  it('refuses a guest price left at the megaFLOP scale', () => {
    expect(problemsAfter((raw) => { node(raw, 'p0_shared_mount').cost.cycles = 7.4e6; }))
      .toMatch(/node "p0_shared_mount": cycles price 7400000 is outside the Phase 0 band/);
  });

  it('accepts a single cycle a second and a half-cycle level, and refuses what the accounting would show', () => {
    expect(problemsAfter((raw) => { node(raw, 'p0_proc_self').tickDelta.cyclesPerSec = 1; })).toBe('');
    expect(problemsAfter((raw) => { node(raw, 'p0_proc_self').tickDelta.cyclesPerSec = 1e4; }))
      .toMatch(/node "p0_proc_self": compute yield 10000 cycles\/s is outside the Phase 0 band/);
  });

  it('refuses a phase that goes back to counting cycles after real hardware', () => {
    expect(problemsAfter((raw) => { (raw.phases[2] as RawPhase & { computeUnit?: string }).computeUnit = 'CYCLE'; }))
      .toMatch(/Phase 2 counts compute in cycles after Phase 1 counts it in FLOP/);
  });
});
