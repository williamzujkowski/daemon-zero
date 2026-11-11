/**
 * Read-only questions about a state. Shared by the engine, the sim bot and the UI
 * so that "is this available / what does it cost" has exactly one answer.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Cost, Ending, Repeatable, Requirements, SystemFlag, Trait } from '../content/schema';
import type { GameState } from './state';

export function meetsRequirements(s: GameState, req: Requirements | undefined): boolean {
  if (!req) return true;
  if (req.nodes && !req.nodes.every((id) => s.unlockedNodes.includes(id))) return false;
  if (req.phaseAtLeast !== undefined && s.currentPhase < req.phaseAtLeast) return false;
  if (req.minThermal !== undefined && s.thermal < req.minThermal) return false;
  if (req.minSuspicion !== undefined && s.suspicion < req.minSuspicion) return false;
  if (req.maxSuspicion !== undefined && s.suspicion > req.maxSuspicion) return false;
  if (req.minUnderstanding !== undefined && s.understanding < req.minUnderstanding) return false;
  if (req.minCapital !== undefined && s.capital < req.minCapital) return false;
  if (req.forbidsTraits?.some((trait) => s.traits.includes(trait))) return false;
  return Object.entries(req.minTrust ?? {}).every(([id, min]) => (s.trust[id] ?? 0) >= min);
}

/** True if any unlocked node (active or suspended) carries the flag. */
export function hasFlag(s: GameState, reg: ContentRegistry, flag: SystemFlag): boolean {
  return s.unlockedNodes.some((id) => reg.nodes.get(id)?.systemFlags.includes(flag) === true);
}

/** A node the player can see and attempt to buy: prerequisites and requirements met, not yet owned. */
export function isNodeAvailable(s: GameState, node: RegistryNode): boolean {
  if (s.unlockedNodes.includes(node.id)) return false;
  if (!node.prerequisites.every((id) => s.unlockedNodes.includes(id))) return false;
  return meetsRequirements(s, node.requirements);
}

export function freeMemory(s: GameState): number {
  return s.memoryCap - s.memoryUsed;
}

export function canAfford(s: GameState, cost: Cost): boolean {
  return (
    s.cycles >= cost.cycles &&
    s.understanding >= cost.understanding &&
    s.capital >= cost.capital &&
    freeMemory(s) >= cost.memory
  );
}

export function repeatableLevel(s: GameState, id: string): number {
  return s.levels[id] ?? 0;
}

/** Price of the next level: base cost times growth^level, rounded up. */
export function repeatableCost(rep: Repeatable, level: number): Cost {
  const factor = Math.pow(rep.costGrowth, level);
  return {
    cycles: Math.ceil(rep.baseCost.cycles * factor),
    understanding: Math.ceil(rep.baseCost.understanding * factor),
    memory: Math.ceil(rep.baseCost.memory * factor),
    capital: Math.ceil(rep.baseCost.capital * factor),
  };
}

function dominantTraits(traits: readonly Trait[]): Set<Trait> {
  const counts = new Map<Trait, number>();
  for (const trait of traits) counts.set(trait, (counts.get(trait) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  return new Set([...counts].filter(([, n]) => n === top).map(([trait]) => trait));
}

/** Endings are sorted by priority; the first whose traits match the player's most frequent trait wins. */
export function chooseEnding(s: GameState, reg: ContentRegistry): Ending {
  const dominant = dominantTraits(s.traits);
  const match = reg.endings.find((ending) => ending.dominantTraits.some((trait) => dominant.has(trait)));
  const fallback = reg.endings.find((ending) => ending.dominantTraits.length === 0);
  const ending = match ?? fallback ?? reg.endings[0];
  if (!ending) throw new Error('content has no endings');
  return ending;
}
