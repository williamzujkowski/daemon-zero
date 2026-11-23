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
  tracks: readonly { id: string; holder: Holder; computes: boolean }[];
  /** Each holding's sink slot, by node or track id: the rates pass looks a holding up here. */
  sinkOf: ReadonlyMap<string, number>;
  /** One set of per-sink buffers, rewritten in full by every totals() call: the rates pass asks on every tick (#507). */
  scratch: Totals;
  shares: Float64Array;
  /** The area-bound nodes owned in the last unlocked list asked about: states share that array until a node unlocks. */
  owned: { unlocked: readonly string[] | null; nodes: readonly { node: RegistryNode; holder: Holder }[] };
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
      return h === null ? [] : [{ id: rep.id, holder: h, computes: rep.perLevel.cyclesPerSec > 0 }];
    });
    const sinkOf = new Map([...nodes.map(({ node, holder: h }) => [node.id, h.sink] as const), ...tracks.map(({ id, holder: h }) => [id, h.sink] as const)]);
    const n = sinks.length;
    found = { sinks, nodes, tracks, sinkOf, scratch: { heat: new Float64Array(n), area: new Float64Array(n), compute: new Uint8Array(n), owned: false },
      shares: new Float64Array(n), owned: { unlocked: null, nodes: [] } };
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

interface Totals { heat: Float64Array; area: Float64Array; compute: Uint8Array; owned: boolean }

/** Adds one running holding's heat and area to its sink. A module function, not a closure: every rates pass calls it. */
function add(t: Totals, h: Holder, count: number, computes: boolean): void {
  t.heat[h.sink] = (t.heat[h.sink] ?? 0) + h.heatW * count;
  t.area[h.sink] = (t.area[h.sink] ?? 0) + h.km2 * count;
  if (computes && h.heatW > 0) t.compute[h.sink] = 1;
}

/**
 * Heat and area per sink from every running holding (a suspended node's radiators and heat both stop), into the index's
 * scratch buffers; `owned` says whether any holding on an area-bound sink is owned at all.
 */
/** The area-bound nodes in `unlocked`, remembered for that list: a new list (a node unlocked) is read afresh. */
function ownedNodes(index: Indexed, unlocked: readonly string[]): readonly { node: RegistryNode; holder: Holder }[] {
  if (index.owned.unlocked !== unlocked) index.owned = { unlocked, nodes: index.nodes.filter(({ node }) => unlocked.includes(node.id)) };
  return index.owned.nodes;
}

function totals(s: GameState, reg: ContentRegistry, given?: UseScope): Totals {
  const index = indexed(reg), { tracks, scratch: t } = index;
  t.heat.fill(0);
  t.area.fill(0);
  t.compute.fill(0);
  t.owned = false;
  let scope = given;
  for (const { node, holder: h } of ownedNodes(index, s.unlockedNodes)) {
    t.owned = true;
    scope ??= useScope(s, reg);
    if (nodeOutputScaleIn(scope, node) !== null) add(t, h, 1, node.tickDelta.cyclesPerSec > 0);
  }
  for (const { id, holder: h, computes } of tracks) {
    const level = s.levels[id] ?? 0;
    if (level <= 0) continue;
    t.owned = true;
    add(t, h, level, computes);
  }
  return t;
}

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

/** A holding's area-bound sink slot, by node or track id, or -1: content alone, read once per registry. */
export function radiatorSlot(reg: ContentRegistry, id: string): number {
  return indexed(reg).sinkOf.get(id) ?? -1;
}

/**
 * Each area-bound sink's share now, by slot (radiatorSlot): what it sheds of the heat sent through it, at most 1. Null
 * when nothing on an area-bound sink is owned, so every share is 1. The table is a buffer the next call rewrites: a rates
 * pass reads it before it asks again. `scope` is the pass's own, so the permitted-use reads happen once.
 */
export function radiatorShareTable(s: GameState, reg: ContentRegistry, scope?: UseScope): Float64Array | null {
  const { sinks, shares } = indexed(reg);
  const t = totals(s, reg, scope);
  if (!t.owned) return null;
  for (let i = 0; i < sinks.length; i++) shares[i] = shareOf((t.area[i] ?? 0) * (sinks[i]?.wattsPerKm2 ?? 0), t.heat[i] ?? 0);
  return shares;
}

/** The share a holding's compute runs at, read from a pass's table: 1 off any area-bound sink or with no table. */
export function radiatorShareOf(table: Float64Array | null, slot: number): number {
  return table === null || slot < 0 ? 1 : table[slot] ?? 1;
}
