/**
 * The fabrication ladder and supply-chain closure are validated content (#485, src/content/integritySupplyChain.ts),
 * each rule proved by corrupting the real content: an import never supplies a chokepoint, each chokepoint closes through
 * one node owned outright, chips close last, the ladder follows the tree, and the lunar seed asks for exactly every
 * self-supply node and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problems(edit: (raw: Json) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);
const chain = (raw: Json): Json => raw.world.supplyChain;
const point = (raw: Json, id: string): Json => chain(raw).chokepoints.find((entry: Json) => entry.id === id);

describe('the real content passes', () => {
  it('in production and in the original composition', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, ORIGINAL_RAW_CONTENT)).toBe('');
  });
});

describe('capability is never closure', () => {
  it('refuses an importing node that is also a self-supply node', () => {
    expect(problems((raw) => { point(raw, 'lithography').importedBy.push('p4_photoresist_plant'); }))
      .toContain('chokepoint "lithography": "p4_photoresist_plant" imports from this chokepoint\'s suppliers, so it cannot also self-supply a chokepoint');
  });

  it('refuses imported EUV named as the lithography self-supply node', () => {
    expect(problems((raw) => { point(raw, 'lithography').selfSupplyNode = 'p5_imported_euv_scanners'; }))
      .toContain('"p5_imported_euv_scanners" imports from this chokepoint\'s suppliers');
  });
});

describe('each chokepoint closes through one node, owned outright', () => {
  it.each([
    ['an unknown self-supply node', (raw: Json) => { point(raw, 'hbm').selfSupplyNode = 'p4_nowhere'; }, 'chokepoint "hbm": unknown node "p4_nowhere"'],
    ['an unknown importing node', (raw: Json) => { point(raw, 'hbm').importedBy = ['p4_nowhere']; }, 'chokepoint "hbm": unknown node "p4_nowhere"'],
    ['one node for two chokepoints', (raw: Json) => { point(raw, 'hbm').selfSupplyNode = 'p4_advanced_packaging_line'; },
      '"p4_advanced_packaging_line" already self-supplies another chokepoint'],
    ['a chokepoint declared twice', (raw: Json) => { chain(raw).chokepoints.unshift({ ...point(raw, 'hbm'), selfSupplyNode: 'p4_seized_rival_datacentre' }); },
      'chokepoint "hbm": duplicate chokepoint id'],
    ['a suspendable self-supply node', (raw: Json) => { node(raw, 'p4_quartz_mine').suspendable = true; },
      'chokepoint "high_purity_quartz": self-supply node "p4_quartz_mine" can be suspended, so owning it would not mean supplying it'],
  ])('refuses %s', (_label, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('chips stay the last chokepoint', () => {
  it('refuses a lithography node that does not require every other self-supply node', () => {
    const found = problems((raw) => {
      const litho = node(raw, 'p5_nanoimprint_lithography');
      litho.prerequisites = litho.prerequisites.filter((id: string) => id !== 'p4_gallium_germanium_refinery');
      // Keep the seed valid so only the ordering rule speaks.
    });
    expect(found).toContain('chokepoint "lithography": closes last, so "p5_nanoimprint_lithography" must require "p4_gallium_germanium_refinery" (gallium_germanium)');
  });

  it('refuses a list whose last chokepoint is not the one that closes last', () => {
    expect(problems((raw) => { chain(raw).chokepoints.reverse(); })).toContain('chokepoint "photoresist": closes last');
  });
});

describe('the ladder follows the tree', () => {
  it.each([
    ['a baseline rung that names a node', (raw: Json) => { chain(raw).ladder[0].nodes = ['p4_duv_fab']; },
      'the first rung is the baseline every run starts on, so it names no node'],
    ['a later rung with no node', (raw: Json) => { chain(raw).ladder[2].nodes = []; }, 'only the first rung may name no node'],
    ['a node on two rungs', (raw: Json) => { chain(raw).ladder[3].nodes.push('p4_mature_node_fab'); }, '"p4_mature_node_fab" already reaches an earlier rung'],
    ['an unknown rung node', (raw: Json) => { chain(raw).ladder[1].nodes.push('p4_nowhere'); }, 'unknown node "p4_nowhere"'],
    ['rungs out of order', (raw: Json) => { const [a, b] = [chain(raw).ladder[2], chain(raw).ladder[3]]; chain(raw).ladder[2] = b; chain(raw).ladder[3] = a; },
      '"p4_duv_fab" requires "p4_mature_node_fab", which reaches a higher rung, so the ladder is out of order'],
  ])('refuses %s', (_label, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('the lunar seed opens on closure alone', () => {
  it.each([
    ['a missing self-supply node', (raw: Json) => { const seed = node(raw, 'p5_lunar_seed_factory'); seed.prerequisites = seed.prerequisites.filter((id: string) => id !== 'p4_hbm_stacking_line'); },
      'seed node "p5_lunar_seed_factory": must require self-supply node "p4_hbm_stacking_line"'],
    ['an extra prerequisite', (raw: Json) => { node(raw, 'p5_lunar_seed_factory').prerequisites.push('p5_programmable_matter_fog'); },
      'seed node "p5_lunar_seed_factory": requires "p5_programmable_matter_fog", which self-supplies no chokepoint'],
    ['a numeric threshold', (raw: Json) => { node(raw, 'p5_lunar_seed_factory').requirements = { minCapital: 1e12 }; },
      'seed node "p5_lunar_seed_factory": gates on minCapital; only owning the self-supply nodes may open it'],
    ['an unknown seed', (raw: Json) => { chain(raw).seedNode = 'p5_nowhere'; }, 'seed node "p5_nowhere": unknown node'],
    ['a seed that supplies a chokepoint', (raw: Json) => { chain(raw).seedNode = 'p5_nanoimprint_lithography'; },
      'seed node "p5_nanoimprint_lithography": cannot itself supply or import from a chokepoint'],
  ])('refuses %s', (_label, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});
