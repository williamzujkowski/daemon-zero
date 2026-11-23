/**
 * Network coupling (#484, vote-1795381354324-4br7z6t): effective compute is raw x availability x coupling, applied to
 * each contribution before anything is summed, so a botnet's consumer links discount the botnet and not the citadel's
 * racks. computeRates and cycleContributions both read the factor from here, so the ledger and the tick agree.
 */
import type { ContentRegistry } from '../content/registry';
import type { NetworkLink, SourceClass } from '../content/schemaNetwork';
import { nodeOutputScale } from './grantQuery';
import type { GameState } from './state';

export type Couplings = Readonly<Record<SourceClass, number>>;

/** The content's link nodes (a `raisesCoupling` effect), indexed once per registry: content never changes. */
const RAISERS = new WeakMap<ContentRegistry, readonly string[]>();

function raisers(reg: ContentRegistry): readonly string[] {
  let found = RAISERS.get(reg);
  if (found === undefined) {
    found = [...reg.nodes.values()].filter((node) => node.effects.raisesCoupling !== undefined).map((node) => node.id);
    RAISERS.set(reg, found);
  }
  return found;
}

/** Each class's coupling now: its balance value, or the highest a running link node raises it to. */
export function couplings(s: GameState, reg: ContentRegistry): Couplings {
  const out = { ...reg.balance.networkCoupling };
  for (const id of raisers(reg)) {
    const node = s.unlockedNodes.includes(id) ? reg.nodes.get(id) : undefined;
    const raise = node?.effects.raisesCoupling;
    if (node === undefined || raise === undefined || nodeOutputScale(s, node, reg) === null) continue;
    out[raise.sourceClass] = Math.max(out[raise.sourceClass], raise.coupling);
  }
  return out;
}

/** The share of a source's raw compute that arrives: its availability times its class's coupling (1 when undeclared). */
export function deliveredShare(link: NetworkLink | undefined, by: Couplings): number {
  // Integrity holds the co-located class at exactly 1, so an undeclared source (a cohort, an action) needs no lookup.
  return link === undefined ? 1 : link.availability * by[link.sourceClass];
}

/** One class's reading for the reference panel and the cluster: its coupling now and what it was authored at. */
export interface ClassCoupling { sourceClass: SourceClass; coupling: number; base: number; raised: boolean }

/** Every class's coupling now, in content order of the classes, with whether a link node has raised it. */
export function couplingView(s: GameState, reg: ContentRegistry): ClassCoupling[] {
  const now = couplings(s, reg), base = reg.balance.networkCoupling;
  return (Object.keys(base) as SourceClass[]).map((sourceClass) =>
    ({ sourceClass, coupling: now[sourceClass], base: base[sourceClass], raised: now[sourceClass] > base[sourceClass] }));
}
