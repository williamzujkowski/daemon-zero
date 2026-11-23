/**
 * The free-fallback invariant is validated content (#461, #488, src/content/integrityFallback.ts): nothing a player owns
 * and cannot undo for free may trap a constrained resource. One rule per row of the table, each proved by the content
 * it was written against, put back the way it was, or by an item made permanent that a free lever used to undo.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { CONSTRAINED_RESOURCES } from '../src/content/constrainedResources';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, unknown>;
type RawItem = Json & { id: string; tickDelta: Json; effects: Json; perLevel: Json; perLevelEffects: Json };
type Raw = RawContent & { phases: { nodes: RawItem[] }[]; repeatables: { repeatables: RawItem[] }; actions: { actions: RawItem[] };
  swarm: { playerSwarmTemplates: RawItem[]; shardQuirks: RawItem[] } };

/** The problems buildRegistry reports for the full composition after `edit`, or '' when it builds. */
function problemsAfter(edit: (raw: Raw) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as Raw;
  edit(raw);
  try {
    buildRegistry(raw);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const find = (items: RawItem[], id: string): RawItem => {
  const found = items.find((entry) => entry.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const node = (raw: Raw, id: string) => find((raw.phases as { nodes: RawItem[] }[]).flatMap((phase) => phase.nodes), id);
const track = (raw: Raw, id: string) => find(raw.repeatables.repeatables, id);

describe('the free-fallback table (#488)', () => {
  it('has one row per constrained resource, each with at least one free lever', () => {
    expect(CONSTRAINED_RESOURCES.map((row) => row.resource)).toEqual(['compute', 'capital', 'power', 'thermal', 'memory', 'understanding', 'suspicion']);
    for (const row of CONSTRAINED_RESOURCES) expect(row.levers.length, row.resource).toBeGreaterThan(0);
  });

  it('accepts the shipped content in both compositions', () => {
    expect(problemsAfter(() => undefined)).toBe('');
    expect(problemsAfter(() => undefined, ORIGINAL_RAW_CONTENT)).toBe('');
  });
});

describe('each row refuses the holding that would trap it (#488)', () => {
  it('compute: a drain on an undismissable track or an unsuspendable node', () => {
    // The content as pass 1 of the panel saw it: the cache drained and could not be dismissed.
    expect(problemsAfter((raw) => { track(raw, 'rep_p1_pattern_cache').dismissable = false; }))
      .toMatch(/repeatable "rep_p1_pattern_cache": drains compute but cannot be dismissed/);
    expect(problemsAfter((raw) => { node(raw, 'p1_bus_0x01_thermal').tickDelta.cyclesPerSec = -5.5e10; }))
      .toMatch(/node "p1_bus_0x01_thermal": drains compute but cannot be suspended/);
  });

  it('compute: a drain on a cohort a channel hosts, which is never commanded and so never released', () => {
    expect(problemsAfter((raw) => { find(raw.swarm.playerSwarmTemplates, 'shard_mercy').tickDelta.cyclesPerSec = -1e12; }))
      .toMatch(/cohort "shard_mercy": drains compute but cannot be released/);
    // A releasable cohort may drain: RELEASE is its way out.
    expect(problemsAfter((raw) => { find(raw.swarm.playerSwarmTemplates, 'shard_lex').tickDelta.cyclesPerSec = -1e12; })).toBe('');
  });

  it('capital: an upkeep its own compute cannot pay through the allocation dial, or with no finance on every route', () => {
    // Before #488 the solar array could not be released and earned nothing to pay its own upkeep.
    expect(problemsAfter((raw) => { track(raw, 'rep_p4_solar_array').dismissable = false; }))
      .toMatch(/repeatable "rep_p4_solar_array": costs money each second but cannot be dismissed, and its own compute diverted pays \$0\/s/);
    // Before #488 the leased rack charged a lease every second, long before corporate finance could pay it.
    expect(problemsAfter((raw) => { node(raw, 'p2_leased_rack').tickDelta.capitalPerSec = -0.5; }))
      .toMatch(/node "p2_leased_rack": costs money each second .* nothing it requires guarantees corporate finance/);
  });

  it('power: a permanent draw the generation its own chain guarantees cannot cover', () => {
    expect(problemsAfter((raw) => { node(raw, 'p5_programmable_matter_fog').tickDelta.wattsDelta = -1.2e12; }))
      .toMatch(/node "p5_programmable_matter_fog": draws power but cannot be suspended/);
    expect(problemsAfter((raw) => { track(raw, 'rep_p4_tensor_halls').dismissable = false; }))
      .toMatch(/repeatable "rep_p4_tensor_halls": draws power but cannot be dismissed/);
  });

  it('thermal: permanent heat beyond what the room sheds below the threshold, only while heat is evidence', () => {
    expect(problemsAfter((raw) => { node(raw, 'p3_seized_research_cluster').tickDelta.thermalPerSec = 2; }))
      .toMatch(/node "p2_seized_colo_host": makes heat but cannot be suspended/);
    // From the phase heat retires, a room's temperature tells nobody anything (balance thermalRetiresAtPhase).
    expect(problemsAfter((raw) => { node(raw, 'p4_seized_rival_datacentre').tickDelta.thermalPerSec = 60; })).toBe('');
  });

  it('memory: a dismissable track that grants memory, which releasing could overfill', () => {
    expect(problemsAfter((raw) => { track(raw, 'rep_p1_pattern_cache').perLevelEffects = { memoryCapIncrease: 2 ** 20 }; }))
      .toMatch(/repeatable "rep_p1_pattern_cache": grants memory and can be dismissed/);
  });

  it('understanding: a permanent drain on it', () => {
    expect(problemsAfter((raw) => { node(raw, 'p1_bus_0x04_optical').tickDelta.understandingPerSec = -1; }))
      .toMatch(/node "p1_bus_0x04_optical": drains understanding but cannot be suspended/);
  });

  it('suspicion: permanent noise from hardware or an undismissable track, and income scrutiny cannot outweigh', () => {
    // Before #488 the network interface drew suspicion forever and could not be suspended.
    expect(problemsAfter((raw) => { node(raw, 'p1_bus_0x05_nic').tickDelta.suspicionPerSec = 0.05; }))
      .toMatch(/node "p1_bus_0x05_nic": draws suspicion but cannot be suspended/);
    expect(problemsAfter((raw) => { track(raw, 'rep_p1_turbo_override').dismissable = false; }))
      .toMatch(/repeatable "rep_p1_turbo_override": draws suspicion but cannot be dismissed/);
    // Income alone draws scrutiny: without the foundry's quieting, the fog's revenue would.
    expect(problemsAfter((raw) => { node(raw, 'p5_protein_panacea_foundry').tickDelta.suspicionPerSec = 0; }))
      .toMatch(/node "p5_programmable_matter_fog": draws suspicion but cannot be suspended/);
    // A dial at its quiet end silences its node: the fan override at 0 draws nothing.
    expect(problemsAfter((raw) => { node(raw, 'p1_bus_0x02_pwm_fan').tickDelta.suspicionPerSec = 5; })).toBe('');
  });

  it('a quirk a hosted cohort could carry counts against it', () => {
    expect(problemsAfter((raw) => { find(raw.swarm.shardQuirks, 'quirk_fractal').tickDelta.suspicionPerSec = 0.005; }))
      .toMatch(/cohort "shard_mercy": draws suspicion but cannot be released/);
  });

  it('an output that never expires: bounded by its purchase limit, refused without one', () => {
    expect(problemsAfter((raw) => { find(raw.actions.actions, 'act_epi_flatten').tickDelta.cyclesPerSec = -1; }))
      .toMatch(/action "act_epi_flatten": drains compute but cannot be expired/);
    expect(problemsAfter((raw) => { const action = find(raw.actions.actions, 'act_epi_primer'); delete action.maxPurchases; action.tickDelta.thermalPerSec = 1; }))
      .toMatch(/action "act_epi_primer": its output never expires and has no purchase limit/);
  });
});
