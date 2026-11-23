/**
 * Network coupling (#484, vote-1795381354324-4br7z6t): effective compute is raw x availability x coupling, applied to
 * each contribution before aggregation, with coupling authored per source class. These specs hold the bounds (the
 * co-located class at 1, the classes in order, every delivered share in (0, 1]), prove the factor is applied per
 * contribution on real saves, and that a link node raises one class only while it is owned.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, couplings, couplingView, cycleContributions, deliveredShare, unlockNode, type GameState } from '../src/engine';
import { fixtureState } from './fallback-states';

const b = CONTENT.balance;
const linked = [...CONTENT.nodes.values()].filter((node) => node.network !== undefined);
const funded = (s: GameState): GameState => ({ ...s, cycles: 1e30, understanding: 1e30, capital: 1e30, memoryCap: s.memoryCap + 1e30 });

/** `s` owning `id` and what it was built on, bought through the engine from a funded copy. */
function owning(s: GameState, id: string): GameState {
  const node = CONTENT.nodes.get(id);
  if (!node) throw new Error(id);
  let out = funded(s);
  for (const parent of node.prerequisites) if (!out.unlockedNodes.includes(parent)) out = owning(out, parent);
  const bought = unlockNode(out, id, CONTENT);
  if (!bought.ok) throw new Error(`${id}: ${bought.reason}`);
  return bought.state;
}

describe('coupling bounds', () => {
  it('holds the co-located class at 1 and the others below it, in order', () => {
    expect(b.networkCoupling.CO_LOCATED).toBe(1);
    expect(b.networkCoupling.INTER_SITE).toBeLessThanOrEqual(b.networkCoupling.CO_LOCATED);
    expect(b.networkCoupling.DISTRIBUTED).toBeLessThanOrEqual(b.networkCoupling.INTER_SITE);
    expect(b.networkCoupling.DISTRIBUTED).toBeGreaterThan(0);
  });

  it('delivers a share in (0, 1] for every declared source, at authored and at raised coupling', () => {
    const raised = { CO_LOCATED: 1, INTER_SITE: 1, DISTRIBUTED: 1 };
    for (const source of [...linked, ...[...CONTENT.repeatables.values()].filter((rep) => rep.network !== undefined)]) {
      for (const by of [b.networkCoupling, raised]) {
        const share = deliveredShare(source.network, by);
        expect(share, source.id).toBeGreaterThan(0);
        expect(share, source.id).toBeLessThanOrEqual(1);
      }
    }
    expect(deliveredShare(undefined, b.networkCoupling)).toBe(1);
  });

  it('declares the botnet and the edge harvest distributed, and discounts the edge harvest by its availability too', () => {
    expect(CONTENT.nodes.get('p3_botnet_mesh')?.network).toEqual({ sourceClass: 'DISTRIBUTED', availability: 1 });
    const edge = CONTENT.nodes.get('p3_edge_npu_swarm');
    expect(edge?.network).toEqual({ sourceClass: 'DISTRIBUTED', availability: 0.02 });
    // The placeholder discount is gone: the yield is the raw NPU total and the engine delivers raw x 2% x 30%.
    expect(edge?.tickDelta.cyclesPerSec).toBe(3.5e19);
  });
});

/** Each pre-rescale save re-denominated, then given every linked node it can buy: cheap real states (no sim run, #505). */
const STATES: [string, GameState][] = [0, 1, 2, 3, 4, 5].map((phase): [string, GameState] => {
  let s = funded(fixtureState(phase));
  for (const node of linked) if (node.phaseId <= phase && !s.unlockedNodes.includes(node.id)) { const r = unlockNode(s, node.id, CONTENT); if (r.ok) s = r.state; }
  return [`phase ${String(phase)} save with its linked sources`, s];
});

describe('per-contribution coupling', () => {
  it.each(STATES)('every source delivers availability x coupling of its raw rate, and the ledger sums to the tick: %s', (_label, s) => {
    const by = couplings(s, CONTENT), sources = cycleContributions(s, CONTENT);
    for (const source of sources) {
      const link = CONTENT.nodes.get(source.id)?.network ?? CONTENT.repeatables.get(source.id)?.network;
      if (source.rawCyclesPerSec <= 0) { expect(source.cyclesPerSec).toBe(source.rawCyclesPerSec); continue; }
      expect(source.cyclesPerSec / source.rawCyclesPerSec, source.id).toBeCloseTo(deliveredShare(link, by), 12);
    }
    const total = sources.reduce((sum, source) => sum + source.cyclesPerSec, 0);
    expect(total).toBeCloseTo(computeRates(s, CONTENT).cyclesPerSec, -Math.max(0, Math.floor(Math.log10(Math.abs(total) || 1)) - 9));
  });

  it('discounts a distributed source and not a co-located one beside it: the factor is not applied to the sum', () => {
    const base = owning(fixtureState(3), 'p3_botnet_mesh');
    const withEdge = owning(base, 'p3_edge_npu_swarm');
    const before = computeRates(base, CONTENT).cyclesPerSec, after = computeRates(withEdge, CONTENT).cyclesPerSec;
    const edge = CONTENT.nodes.get('p3_edge_npu_swarm');
    expect(after - before).toBeCloseTo((edge?.tickDelta.cyclesPerSec ?? 0) * 0.02 * b.networkCoupling.DISTRIBUTED, -12);
    // The rest of the state's compute is untouched by the edge harvest's discount.
    const others = (s: GameState) => cycleContributions(s, CONTENT).filter((source) => source.id !== 'p3_edge_npu_swarm')
      .reduce((sum, source) => sum + source.cyclesPerSec, 0);
    expect(others(withEdge)).toBeCloseTo(others(base), -9);
  });
});

describe('link nodes', () => {
  it('raise inter-site coupling only once the dark-fibre ring is owned, and never past the co-located class', () => {
    const s = fixtureState(4);
    expect(couplings(s, CONTENT).INTER_SITE).toBe(b.networkCoupling.INTER_SITE);
    const lit = owning(s, 'p4_dci_dark_fibre');
    expect(couplings(lit, CONTENT)).toEqual({ ...b.networkCoupling, INTER_SITE: 0.95 });
    expect(couplingView(lit, CONTENT).find((entry) => entry.sourceClass === 'INTER_SITE')).toEqual({ sourceClass: 'INTER_SITE', coupling: 0.95, base: 0.8, raised: true });
    expect(couplings(lit, CONTENT).INTER_SITE).toBeLessThanOrEqual(couplings(lit, CONTENT).CO_LOCATED);
  });

  it('lift an owned inter-site source by exactly the raised share', () => {
    const s = owning(fixtureState(4), 'p4_seized_rival_datacentre');
    const rival = (state: GameState) => cycleContributions(state, CONTENT).find((source) => source.id === 'p4_seized_rival_datacentre');
    const before = rival(s), after = rival(owning(s, 'p4_dci_dark_fibre'));
    expect(before && before.cyclesPerSec / before.rawCyclesPerSec).toBeCloseTo(0.8, 12);
    expect(after && after.cyclesPerSec / after.rawCyclesPerSec).toBeCloseTo(0.95, 12);
  });
});
