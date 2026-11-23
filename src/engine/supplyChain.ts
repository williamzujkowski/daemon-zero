/**
 * Fabrication capability and supply-chain closure (#485, vote-1795381358337-jw73j7a), both derived from what is owned:
 * capability is the highest ladder rung any owned node reaches; closure is the share of the content's chokepoints whose
 * self-supply node is owned. A node that imports from a chokepoint's suppliers raises capability and never closure.
 * Nothing here is stored or changes a state.
 */
import type { ContentRegistry } from '../content/registry';
import { isNodeAvailable } from './query';
import type { GameState } from './state';

export interface CapabilityReading {
  /** Index of the highest rung reached; 0 is the baseline every run starts on. */
  rung: number;
  label: string;
  /** Owned nodes that reach that rung, in content order. */
  through: string[];
  /** The ladder's top index. */
  top: number;
}

export interface ChokepointReading {
  id: string;
  name: string;
  tell: string;
  selfSupplyNode: string;
  selfSupplied: boolean;
  /** Owned nodes that buy capability from this chokepoint's suppliers, which leave it imported. */
  importedThrough: string[];
}

export interface SupplyChainView {
  capability: CapabilityReading;
  chokepoints: ChokepointReading[];
  selfSupplied: number;
  total: number;
  /** selfSupplied / total. */
  closure: number;
  seed: { node: string; owned: boolean };
}

function capability(owned: ReadonlySet<string>, reg: ContentRegistry): CapabilityReading {
  const { ladder } = reg.world.supplyChain;
  let rung = 0;
  ladder.forEach((entry, index) => { if (entry.nodes.some((id) => owned.has(id))) rung = index; });
  const reached = ladder[rung];
  return { rung, label: reached?.label ?? '', through: (reached?.nodes ?? []).filter((id) => owned.has(id)), top: ladder.length - 1 };
}

/** The ladder rung and closure for a state. Pure. */
export function supplyChainView(s: GameState, reg: ContentRegistry): SupplyChainView {
  const owned = new Set(s.unlockedNodes);
  const chain = reg.world.supplyChain;
  const chokepoints = chain.chokepoints.map((point) => ({
    id: point.id, name: point.name, tell: point.tell, selfSupplyNode: point.selfSupplyNode,
    selfSupplied: owned.has(point.selfSupplyNode), importedThrough: point.importedBy.filter((id) => owned.has(id)),
  }));
  const selfSupplied = chokepoints.filter((point) => point.selfSupplied).length;
  return {
    capability: capability(owned, reg), chokepoints, selfSupplied, total: chokepoints.length,
    closure: chokepoints.length > 0 ? selfSupplied / chokepoints.length : 0,
    seed: { node: chain.seedNode, owned: owned.has(chain.seedNode) },
  };
}

/**
 * Whether the fabrication step has begun for this state: some ladder or self-supply node is owned or can be bought now,
 * so the world view states capability and closure only once there is something to read.
 */
export function supplyChainDisclosed(s: GameState, reg: ContentRegistry): boolean {
  const chain = reg.world.supplyChain;
  const ids = [...chain.ladder.flatMap((rung) => rung.nodes), ...chain.chokepoints.map((point) => point.selfSupplyNode)];
  return ids.some((id) => {
    const node = reg.nodes.get(id);
    return node !== undefined && (s.unlockedNodes.includes(id) || isNodeAvailable(s, node, reg));
  });
}
