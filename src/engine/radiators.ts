/**
 * Radiator area (#465, docs/SCALE.md "Round 2": orbital compute, where radiator area binds). In orbit heat leaves only
 * as light, so a sink that declares `wattsPerKm2` sheds at most its deployed radiator area times that. Compute whose
 * heat leaves through such a sink runs at the share of its heat the area sheds; rates.ts and cycleContributions apply
 * that share, and the ledger states it. Ownership is the only thing that moves area or heat, so both are derived from it.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import { nodeOutputScaleIn, useScope, type UseScope } from './grantQuery';
import type { GameState } from './state';

/** One holding on an area-bound sink: the heat it rejects through it and the radiator it deploys into it (per level on a track). */
interface Holder { sink: number; heatW: number; km2: number }
interface AreaSink { id: string; name: string; wattsPerKm2: number }
interface Indexed {
  sinks: readonly AreaSink[];
  nodes: readonly { node: RegistryNode; holder: Holder }[];
  tracks: readonly { id: string; holder: Holder }[];
  /** Each holding's sink slot, by node or track id: the rates pass looks a holding up here. */
  sinkOf: ReadonlyMap<string, number>;
}

/** Content never changes after it is built, so the area-bound sinks and their holdings are read once per registry. */
const INDEX = new WeakMap<ContentRegistry, Indexed>();

function indexed(reg: ContentRegistry): Indexed {
  let found = INDEX.get(reg);
  if (found === undefined) {
    const sinks = reg.world.signature.sinks.flatMap((cls) => cls.wattsPerKm2 === undefined ? [] : [{ id: cls.id, name: cls.name, wattsPerKm2: cls.wattsPerKm2 }]);
    const holder = (sig: { sink?: string | undefined; radiatorKm2?: number | undefined } | undefined, wattsDelta: number): Holder | null => {
      const sink = sinks.findIndex((entry) => entry.id === sig?.sink);
      return sink < 0 ? null : { sink, heatW: Math.max(0, -wattsDelta), km2: sig?.radiatorKm2 ?? 0 };
    };
    const nodes = [...reg.nodes.values()].flatMap((node) => {
      const h = holder(node.signature, node.tickDelta.wattsDelta);
      return h === null ? [] : [{ node, holder: h }];
    });
    const tracks = [...reg.repeatables.values()].flatMap((rep) => {
      const h = holder(rep.signature, rep.perLevel.wattsDelta);
      return h === null ? [] : [{ id: rep.id, holder: h }];
    });
    const sinkOf = new Map([...nodes.map(({ node, holder: h }) => [node.id, h.sink] as const), ...tracks.map(({ id, holder: h }) => [id, h.sink] as const)]);
    found = { sinks, nodes, tracks, sinkOf };
    INDEX.set(reg, found);
  }
  return found;
}

/** One area-bound sink now. */
export interface RadiatorReading {
  sinkId: string;
  /** The sink's name (world.json), for the ledger line. */
  name: string;
  /** Radiator deployed into it by every running holding, in km². */
  areaKm2: number;
  /** Heat its running holdings reject through it: their full draw, in W. */
  heatW: number;
  /** What the area can shed: area times the sink's watts per km². */
  capacityW: number;
  /** The share of compute through it that runs: 1 with no heat, else capacity over heat, at most 1. */
  share: number;
  /** Whether anything rejecting heat through it makes compute, so a share below 1 throttles something. */
  throttlesCompute: boolean;
}

interface Totals { heat: Float64Array; area: Float64Array; compute: Uint8Array }

/** Heat and area per sink from every running holding: a suspended node's radiators and heat both stop. */
function totals(s: GameState, reg: ContentRegistry, given?: UseScope): Totals {
  const { sinks, nodes, tracks } = indexed(reg);
  const t: Totals = { heat: new Float64Array(sinks.length), area: new Float64Array(sinks.length), compute: new Uint8Array(sinks.length) };
  const add = (h: Holder, count: number, computes: boolean): void => {
    t.heat[h.sink] = (t.heat[h.sink] ?? 0) + h.heatW * count;
    t.area[h.sink] = (t.area[h.sink] ?? 0) + h.km2 * count;
    if (computes && h.heatW > 0) t.compute[h.sink] = 1;
  };
  let scope = given;
  for (const { node, holder: h } of nodes) {
    if (!s.unlockedNodes.includes(node.id)) continue;
    scope ??= useScope(s, reg);
    if (nodeOutputScaleIn(scope, node) !== null) add(h, 1, node.tickDelta.cyclesPerSec > 0);
  }
  for (const { id, holder: h } of tracks) {
    const level = s.levels[id] ?? 0;
    if (level > 0) add(h, level, (reg.repeatables.get(id)?.perLevel.cyclesPerSec ?? 0) > 0);
  }
  return t;
}

const FULL = (): number => 1;
const shareOf = (capacityW: number, heatW: number): number => (heatW > 0 ? Math.min(1, capacityW / heatW) : 1);

/** Every area-bound sink a running holding uses, in world.json order. Empty before any orbital holding is owned. */
export function radiatorReadings(s: GameState, reg: ContentRegistry): RadiatorReading[] {
  const { sinks } = indexed(reg);
  const t = totals(s, reg);
  return sinks.flatMap((sink, i): RadiatorReading[] => {
    const heatW = t.heat[i] ?? 0, areaKm2 = t.area[i] ?? 0;
    if (heatW <= 0 && areaKm2 <= 0) return [];
    const capacityW = areaKm2 * sink.wattsPerKm2;
    return [{ sinkId: sink.id, name: sink.name, areaKm2, heatW, capacityW, share: shareOf(capacityW, heatW), throttlesCompute: t.compute[i] === 1 }];
  });
}

/**
 * The share of its compute a holding runs at now, by node or track id: below 1 only for a holding whose heat leaves
 * through an area-bound sink that sheds less than it is given. One call per rates pass; the lookup it returns is cheap.
 */
export function radiatorShares(s: GameState, reg: ContentRegistry, scope?: UseScope): (id: string) => number {
  const { sinks, sinkOf, nodes, tracks } = indexed(reg);
  // The rates pass asks on every tick: nothing owned on an area-bound sink means every share is 1, with nothing built.
  if (!nodes.some(({ node }) => s.unlockedNodes.includes(node.id)) && !tracks.some(({ id }) => (s.levels[id] ?? 0) > 0)) return FULL;
  const t = totals(s, reg, scope);
  const shares = sinks.map((sink, i) => shareOf((t.area[i] ?? 0) * sink.wattsPerKm2, t.heat[i] ?? 0));
  return (id) => {
    const slot = sinkOf.get(id);
    return slot === undefined ? 1 : shares[slot] ?? 1;
  };
}
