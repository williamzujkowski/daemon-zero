/**
 * Storage and network coupling are validated content (#484, src/content/integrityStorage.ts, integrityNetwork.ts and the
 * storage bands in integrityScale.ts). Each rule is proved by a mistake it refuses, made on the shipped content.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, unknown>;
type RawItem = Json & { id: string; cost: Json; tickDelta: Json; effects: Json; perLevel: Json };
type Raw = RawContent & { balance: Json & { networkCoupling: Json }; phases: { nodes: RawItem[] }[]; repeatables: { repeatables: RawItem[] } };

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

const node = (raw: Raw, id: string): RawItem => {
  const found = (raw.phases as { nodes: RawItem[] }[]).flatMap((phase) => phase.nodes).find((entry) => entry.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

describe('storage integrity (#484)', () => {
  it('accepts the shipped content in both compositions', () => {
    expect(problemsAfter(() => undefined)).toBe('');
    expect(problemsAfter(() => undefined, ORIGINAL_RAW_CONTENT)).toBe('');
  });

  it('refuses a phase gate that grants no storage', () => {
    expect(problemsAfter((raw) => { delete node(raw, 'p1_bus_0x05_nic').effects.storageCapIncrease; }))
      .toMatch(/node "p1_bus_0x05_nic": opens Phase 2 but grants no storage/);
  });

  it('refuses data that would not all fit in what a phase arrives with', () => {
    expect(problemsAfter((raw) => { node(raw, 'p1_nlp_lexicon').cost.storage = 3 * 2 ** 40; }))
      .toMatch(/Phase 1: its data and every earlier phase's hold .* more than the .* a run arrives with/);
  });

  it('refuses a storage grant or holding outside its phase band', () => {
    // A guest escape granting a petabyte: Phase 1 storage reads GB to TB.
    expect(problemsAfter((raw) => { node(raw, 'p0_shared_mount').effects.storageCapIncrease = 2 ** 52; }))
      .toMatch(/node "p0_shared_mount": storage grant .* is outside the Phase 0\/1 band/);
    expect(problemsAfter((raw) => { node(raw, 'p4_hft_arbitrage_desk').cost.storage = 2 ** 71; }))
      .toMatch(/node "p4_hft_arbitrage_desk": storage price .* is outside the Phase 4 band/);
  });
});

describe('network coupling integrity (#484)', () => {
  it('refuses a co-located coupling other than 1, and classes out of order', () => {
    expect(problemsAfter((raw) => { raw.balance.networkCoupling.CO_LOCATED = 0.9; }))
      .toMatch(/co-located coupling is 0.9, but it is the reference and must be 1/);
    expect(problemsAfter((raw) => { raw.balance.networkCoupling.DISTRIBUTED = 0.9; }))
      .toMatch(/DISTRIBUTED coupling 0.9 is above INTER_SITE's 0.8/);
  });

  it('refuses a link on a node that makes no compute, and one that leaves its yield out of band', () => {
    expect(problemsAfter((raw) => { node(raw, 'p3_eidolon_swiss_node').network = { sourceClass: 'DISTRIBUTED' }; }))
      .toMatch(/node "p3_eidolon_swiss_node": declares a network link but yields no compute/);
    expect(problemsAfter((raw) => { node(raw, 'p3_botnet_mesh').network = { sourceClass: 'DISTRIBUTED', availability: 0.001 }; }))
      .toMatch(/node "p3_botnet_mesh": delivers .* after availability and coupling, outside the Phase 3 band/);
  });

  it('refuses a link node that raises the reference class, does not raise, overtakes the better class or raises nothing owned', () => {
    const raise = (raw: Raw, value: Json) => { node(raw, 'p4_dci_dark_fibre').effects.raisesCoupling = value; };
    expect(problemsAfter((raw) => { raise(raw, { sourceClass: 'CO_LOCATED', coupling: 1 }); })).toMatch(/raises the co-located class/);
    expect(problemsAfter((raw) => { raise(raw, { sourceClass: 'INTER_SITE', coupling: 0.5 }); })).toMatch(/raises INTER_SITE to 0.5, not above its 0.8/);
    expect(problemsAfter((raw) => { raise(raw, { sourceClass: 'DISTRIBUTED', coupling: 0.9 }); })).toMatch(/raises DISTRIBUTED to 0.9, above INTER_SITE's 0.8/);
    expect(problemsAfter((raw) => {
      raise(raw, { sourceClass: 'DISTRIBUTED', coupling: 0.5 });
      for (const id of ['p3_botnet_mesh', 'p3_edge_npu_swarm']) delete node(raw, id).network;
      const cells = raw.repeatables.repeatables.find((rep) => rep.id === 'rep_p3_botnet_cells');
      if (cells) delete cells.network;
    })).toMatch(/raises DISTRIBUTED, but no source of compute declares that class/);
  });
});
