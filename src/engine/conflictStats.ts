/**
 * Defense and offense in three domains (#517, vote-1795442100055-6zz6hug): each is summed from what the player owns and
 * runs, as content declares per node and per track level. Each defense type returns less as it stacks
 * (softCap x raw / (raw + softCap)), so a mix beats a pile, and meets each attack vector by its own counter multiplier.
 * There is no stored ledger: every reader (the raid rounds, the forecast, the readout) sums the same holdings. A fleet
 * (#518) counts its levels at what it has not lost, times its autonomy dial's output.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { ConflictDomain, ConflictDomainEntry, ConflictHolding, DefenseType, SiteClass } from '../content/schemaConflict';
import { fleetUnit, fleetYield } from './fleets';
import { nodeOutputScaleIn, useScope, type UseScope } from './grantQuery';
import type { GameState } from './state';

interface Source { holding: ConflictHolding; node: RegistryNode | undefined; repeatable: string | undefined }

interface Index {
  sources: readonly Source[];
  types: readonly DefenseType[];
  classes: ReadonlyMap<string, SiteClass>;
  /** The class each member holding's output is damaged through, by node or track id. */
  memberOf: ReadonlyMap<string, SiteClass>;
  /** Each class's member holdings. */
  members: ReadonlyMap<string, readonly Source[]>;
  /** The holdings that repair (#485's hook). */
  repairers: readonly Source[];
}

/** Content never changes after it is built, so the holdings are indexed once per registry. */
const INDEX = new WeakMap<ContentRegistry, Index>();

export function conflictIndex(reg: ContentRegistry): Index {
  let found = INDEX.get(reg);
  if (found === undefined) {
    const { holdings, defenseTypes, siteClasses } = reg.world.conflict;
    const classes = new Map(siteClasses.map((cls) => [cls.id, cls]));
    const sources = holdings.map((holding): Source => ({ holding, node: holding.node === undefined ? undefined : reg.nodes.get(holding.node), repeatable: holding.repeatable }));
    const memberOf = new Map<string, SiteClass>(), members = new Map<string, Source[]>();
    for (const source of sources) {
      const cls = source.holding.siteClass === undefined ? undefined : classes.get(source.holding.siteClass);
      const id = source.holding.node ?? source.holding.repeatable;
      if (cls === undefined || id === undefined) continue;
      memberOf.set(id, cls);
      members.set(cls.id, [...(members.get(cls.id) ?? []), source]);
    }
    found = { sources, types: defenseTypes, classes, memberOf, members, repairers: sources.filter((source) => source.holding.repairPerSec !== undefined) };
    INDEX.set(reg, found);
  }
  return found;
}

/** How many of a holding run now: 1 for an owned node whose output runs (not suspended, not enjoined), its level for a track. */
export function runningCount(scope: UseScope, source: Source): number {
  const { s } = scope;
  if (source.repeatable !== undefined) return s.levels[source.repeatable] ?? 0;
  if (source.node === undefined || !s.unlockedNodes.includes(source.node.id)) return 0;
  return nodeOutputScaleIn(scope, source.node) === null ? 0 : 1;
}

/** Diminishing returns: raw approaches softCap and never passes it. */
export function diminished(raw: number, softCap: number): number {
  return raw <= 0 ? 0 : (softCap * raw) / (raw + softCap);
}

export interface DefenseReading { type: DefenseType; raw: number; effective: number }
export interface DomainStats { domain: ConflictDomainEntry; defense: DefenseReading[]; offenseRaw: number; offense: number }

/**
 * Every domain's defense by type and offense now, in content order, summed from what runs. `withoutFleets` leaves the
 * fleets out: once a fleet battle's engagement has broken them, they no longer screen or strike that raid (#518).
 */
export function conflictStats(s: GameState, reg: ContentRegistry, withoutFleets = false): DomainStats[] {
  const idx = conflictIndex(reg), scope = useScope(s, reg);
  const typeRaw = new Map<string, number>(), offenseRaw = new Map<ConflictDomain, number>();
  for (const source of idx.sources) {
    const fleet = source.repeatable !== undefined && fleetUnit(reg, source.repeatable) !== undefined;
    if (fleet && withoutFleets) continue;
    const count = runningCount(scope, source) * (fleet ? fleetYield(s, reg, source.repeatable ?? '') : 1);
    if (count === 0) continue;
    for (const entry of source.holding.defense ?? []) typeRaw.set(entry.type, (typeRaw.get(entry.type) ?? 0) + entry.rating * count);
    for (const entry of source.holding.offense ?? []) offenseRaw.set(entry.domain, (offenseRaw.get(entry.domain) ?? 0) + entry.rating * count);
  }
  return reg.world.conflict.domains.map((domain) => {
    const raw = offenseRaw.get(domain.id) ?? 0;
    const defense = idx.types.filter((type) => type.domain === domain.id)
      .map((type) => ({ type, raw: typeRaw.get(type.id) ?? 0, effective: diminished(typeRaw.get(type.id) ?? 0, type.softCap) }));
    return { domain, defense, offenseRaw: raw, offense: diminished(raw, domain.offenseSoftCap) };
  });
}

/** What one type brings against a vector: its effective rating, times its duty cycle, times how hard it answers it. */
export function typeAgainst(reading: DefenseReading, vectorId: string): number {
  return reading.effective * reading.type.dutyCycle * (reading.type.counters[vectorId] ?? 0);
}

/** The defense that meets a vector: every type's contribution against it, summed. */
export function defenseAgainst(stats: readonly DomainStats[], vectorId: string): number {
  let total = 0;
  for (const domain of stats) for (const reading of domain.defense) total += typeAgainst(reading, vectorId);
  return total;
}

/** The offense a domain strikes back with. */
export function offenseIn(stats: readonly DomainStats[], domain: ConflictDomain): number {
  return stats.find((entry) => entry.domain.id === domain)?.offense ?? 0;
}
