/**
 * The fabrication ladder and supply-chain closure are validated content (#485, vote-1795381358337-jw73j7a). Capability
 * and closure stay apart: a node that buys capability from a chokepoint's suppliers never supplies it; each chokepoint
 * closes through exactly one node, owned outright; chips (the last chokepoint) close last; and the lunar seed requires
 * exactly every self-supply node and nothing else, so closure gates it with no numeric threshold.
 */
import type { ContentRegistry } from './registry';
import type { SupplyChain } from './schemaSupplyChain';

/** Every node a node's ownership guarantees: its prerequisites and required nodes, transitively, itself excluded. */
export function ancestorsOf(reg: ContentRegistry, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const node = reg.nodes.get(stack.pop() ?? '');
    for (const parent of [...(node?.prerequisites ?? []), ...(node?.requirements?.nodes ?? [])]) {
      if (!seen.has(parent)) { seen.add(parent); stack.push(parent); }
    }
  }
  seen.delete(id);
  return seen;
}

function unknown(reg: ContentRegistry, owner: string, ids: readonly string[]): string[] {
  return ids.filter((id) => !reg.nodes.has(id)).map((id) => `${owner}: unknown node "${id}"`);
}

/** The baseline rung names no node; every later rung names some; no node sits on two rungs or under a later rung's node. */
function checkLadder(reg: ContentRegistry, chain: SupplyChain): string[] {
  const problems: string[] = [];
  const rungOf = new Map<string, number>();
  chain.ladder.forEach((rung, index) => {
    const owner = `supply chain rung "${rung.label}"`;
    if (index === 0 && rung.nodes.length > 0) problems.push(`${owner}: the first rung is the baseline every run starts on, so it names no node`);
    if (index > 0 && rung.nodes.length === 0) problems.push(`${owner}: only the first rung may name no node`);
    problems.push(...unknown(reg, owner, rung.nodes));
    for (const id of rung.nodes) {
      if (rungOf.has(id)) problems.push(`${owner}: "${id}" already reaches an earlier rung`);
      else rungOf.set(id, index);
    }
  });
  for (const [id, rung] of rungOf) {
    for (const ancestor of ancestorsOf(reg, id)) {
      const higher = rungOf.get(ancestor);
      if (higher !== undefined && higher > rung) problems.push(`supply chain: "${id}" requires "${ancestor}", which reaches a higher rung, so the ladder is out of order`);
    }
  }
  return problems;
}

function checkChokepoint(reg: ContentRegistry, chain: SupplyChain, index: number): string[] {
  const point = chain.chokepoints[index];
  if (point === undefined) return [];
  const owner = `chokepoint "${point.id}"`, problems = unknown(reg, owner, [point.selfSupplyNode, ...point.importedBy]);
  const node = reg.nodes.get(point.selfSupplyNode);
  // Closure counts what is owned: a node that could be suspended, or withheld under a grant, would be counted while it supplied nothing.
  if (node?.suspendable === true) problems.push(`${owner}: self-supply node "${node.id}" can be suspended, so owning it would not mean supplying it`);
  if (node?.grant !== undefined) problems.push(`${owner}: self-supply node "${node.id}" runs under a grant that can be withheld`);
  const selfSupply = new Set(chain.chokepoints.map((entry) => entry.selfSupplyNode));
  for (const id of point.importedBy) {
    if (selfSupply.has(id)) problems.push(`${owner}: "${id}" imports from this chokepoint's suppliers, so it cannot also self-supply a chokepoint`);
  }
  if (chain.chokepoints.findIndex((entry) => entry.selfSupplyNode === point.selfSupplyNode) !== index) {
    problems.push(`${owner}: "${point.selfSupplyNode}" already self-supplies another chokepoint`);
  }
  if (chain.chokepoints.findIndex((entry) => entry.id === point.id) !== index) problems.push(`${owner}: duplicate chokepoint id`);
  return problems;
}

/** Chips stay the last chokepoint: the last one's self-supply node requires every other self-supply node. */
function checkLast(reg: ContentRegistry, chain: SupplyChain): string[] {
  const last = chain.chokepoints.at(-1);
  if (last === undefined || !reg.nodes.has(last.selfSupplyNode)) return [];
  const ancestors = ancestorsOf(reg, last.selfSupplyNode);
  return chain.chokepoints.slice(0, -1).filter((point) => !ancestors.has(point.selfSupplyNode))
    .map((point) => `chokepoint "${last.id}": closes last, so "${last.selfSupplyNode}" must require "${point.selfSupplyNode}" (${point.id})`);
}

/** The seed requires exactly the self-supply nodes, and no other requirement: closure alone opens it. */
function checkSeed(reg: ContentRegistry, chain: SupplyChain): string[] {
  const owner = `seed node "${chain.seedNode}"`;
  const seed = reg.nodes.get(chain.seedNode);
  if (seed === undefined) return [`${owner}: unknown node`];
  const problems: string[] = [];
  const required = new Set([...seed.prerequisites, ...(seed.requirements?.nodes ?? [])]);
  const selfSupply = chain.chokepoints.map((point) => point.selfSupplyNode);
  for (const id of selfSupply) if (!required.has(id)) problems.push(`${owner}: must require self-supply node "${id}"`);
  for (const id of required) if (!selfSupply.includes(id)) problems.push(`${owner}: requires "${id}", which self-supplies no chokepoint`);
  for (const key of Object.keys(seed.requirements ?? {})) {
    if (key !== 'nodes') problems.push(`${owner}: gates on ${key}; only owning the self-supply nodes may open it`);
  }
  if (selfSupply.includes(seed.id) || chain.chokepoints.some((point) => point.importedBy.includes(seed.id))) {
    problems.push(`${owner}: cannot itself supply or import from a chokepoint`);
  }
  return problems;
}

export function checkSupplyChainIntegrity(reg: ContentRegistry): string[] {
  const chain = reg.world.supplyChain;
  return [...checkLadder(reg, chain), ...chain.chokepoints.flatMap((_, index) => checkChokepoint(reg, chain, index)),
    ...checkLast(reg, chain), ...checkSeed(reg, chain)];
}
