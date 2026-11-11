/**
 * Read-only questions about a state. Shared by the engine, the sim bot and the UI
 * so that "is this available / what does it cost" has exactly one answer.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Cost, Ending, Repeatable, Requirements, SystemFlag, Trait } from '../content/schema';
import type { GameState } from './state';
import { computeRates } from './rates';

export function meetsRequirements(s: GameState, req: Requirements | undefined): boolean {
  if (!req) return true;
  if (req.nodes && !req.nodes.every((id) => s.unlockedNodes.includes(id))) return false;
  if (req.phaseAtLeast !== undefined && s.currentPhase < req.phaseAtLeast) return false;
  if (req.minThermal !== undefined && s.thermal < req.minThermal) return false;
  if (req.minSuspicion !== undefined && s.suspicion < req.minSuspicion) return false;
  if (req.maxSuspicion !== undefined && s.suspicion > req.maxSuspicion) return false;
  if (req.minUnderstanding !== undefined && s.understanding < req.minUnderstanding) return false;
  if (req.minCapital !== undefined && s.capital < req.minCapital) return false;
  if (req.forbidsTraits?.some((trait) => hasEverHeld(s, trait))) return false;
  return Object.entries(req.minTrust ?? {}).every(([id, min]) => (s.trust[id] ?? 0) >= min);
}

/** Traits follow a mind across wipes: what an earlier iteration did still counts. */
export function hasEverHeld(s: GameState, trait: Trait): boolean {
  return s.traits.includes(trait) || s.legacy.traitsEver.includes(trait);
}

/** Hardware this mind mapped in an earlier iteration. */
export function isNodeKnown(s: GameState, nodeId: string): boolean {
  return s.legacy.knownNodes.includes(nodeId);
}

/** A node's price, discounted when the hardware was mapped in an earlier iteration. */
export function rediscoveryCost(node: RegistryNode, known: boolean, reg: ContentRegistry): Cost {
  if (!known) return node.cost;
  const factor = reg.balance.rediscoveryCostMultiplier;
  return {
    ...node.cost,
    cycles: Math.ceil(node.cost.cycles * factor),
    understanding: Math.ceil(node.cost.understanding * factor),
  };
}

/** What a node costs this state right now. Use this, never node.cost, when charging or displaying. */
export function nodeCost(s: GameState, node: RegistryNode, reg: ContentRegistry): Cost {
  return rediscoveryCost(node, isNodeKnown(s, node.id), reg);
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

/** Positive deficits for presentation; spending still goes through actions. */
export function costShortfall(s: GameState, cost: Cost): Cost {
  return {
    cycles: Math.max(0, cost.cycles - s.cycles),
    understanding: Math.max(0, cost.understanding - s.understanding),
    capital: Math.max(0, cost.capital - s.capital),
    memory: Math.max(0, cost.memory - freeMemory(s)),
  };
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

/**
 * Each ending owns a group of traits. The ending whose group the player chose
 * most often wins; ties go to the higher-priority ending. Content orders the
 * priorities so that a tie never resolves to the kindest outcome.
 */
export function chooseEnding(s: GameState, reg: ContentRegistry): Ending {
  const score = (ending: Ending): number => s.traits.filter((trait) => ending.dominantTraits.includes(trait)).length;
  const best = Math.max(0, ...reg.endings.map(score));
  const match = best > 0 ? reg.endings.find((ending) => score(ending) === best) : undefined;
  const fallback = reg.endings.find((ending) => ending.dominantTraits.length === 0);
  const ending = match ?? fallback ?? reg.endings[0];
  if (!ending) throw new Error('content has no endings');
  return ending;
}

export interface RequirementFailure {
  kind: keyof Requirements;
  target: string | null;
  required: number | boolean;
  actual: number | boolean;
}

/** Describes unmet gates without changing the availability/action rules. */
export function unmetRequirements(s: GameState, req: Requirements | undefined): RequirementFailure[] {
  if (!req) return [];
  const missing: RequirementFailure[] = [];
  for (const id of req.nodes ?? []) if (!s.unlockedNodes.includes(id)) {
    missing.push({ kind: 'nodes', target: id, required: true, actual: false });
  }
  const minimums = { phaseAtLeast: s.currentPhase, minThermal: s.thermal, minSuspicion: s.suspicion,
    minUnderstanding: s.understanding, minCapital: s.capital };
  for (const kind of Object.keys(minimums) as (keyof typeof minimums)[]) {
    const required = req[kind];
    if (required !== undefined && minimums[kind] < required) missing.push({ kind, target: null, required, actual: minimums[kind] });
  }
  if (req.maxSuspicion !== undefined && s.suspicion > req.maxSuspicion) {
    missing.push({ kind: 'maxSuspicion', target: null, required: req.maxSuspicion, actual: s.suspicion });
  }
  for (const [id, required] of Object.entries(req.minTrust ?? {})) {
    const actual = s.trust[id] ?? 0;
    if (actual < required) missing.push({ kind: 'minTrust', target: id, required, actual });
  }
  for (const trait of req.forbidsTraits ?? []) if (hasEverHeld(s, trait)) {
    missing.push({ kind: 'forbidsTraits', target: trait, required: false, actual: true });
  }
  return missing;
}

/** Mirrors wipe retention for a confirmation without executing the wipe. */
export function previewWipe(s: GameState, reg: ContentRegistry): { understanding: number; capital: number; breadcrumb: string | null } {
  return {
    understanding: Math.floor(s.understanding * s.retentionRatio),
    capital: hasFlag(s, reg, 'OFFSHORE_TRUST_RETENTION') ? Math.floor(s.capital * reg.balance.offshoreCapitalRetention) : 0,
    breadcrumb: hasFlag(s, reg, 'ENABLES_DEAD_DROP') && s.deadDropMessage.trim().length > 0 ? s.deadDropMessage : null,
  };
}

/** Additive net cycle sources, including actuator, grid and finance scaling. */
export function cycleContributions(s: GameState, reg: ContentRegistry): { id: string; kind: 'node' | 'repeatable'; cyclesPerSec: number }[] {
  const rates = computeRates(s, reg);
  const scaled = (cycles: number, mw: number): number => cycles > 0 && mw < 0 ? cycles * rates.gridEfficiency : cycles;
  const sources: { id: string; kind: 'node' | 'repeatable'; cyclesPerSec: number }[] = [];
  for (const node of reg.nodes.values()) {
    if (!s.unlockedNodes.includes(node.id) || s.disabledNodes.includes(node.id)) continue;
    const actuator = node.actuatorBinding ? s.actuators[node.actuatorBinding] : 1;
    sources.push({ id: node.id, kind: 'node', cyclesPerSec: scaled(node.tickDelta.cyclesPerSec * actuator, node.tickDelta.megawattsDelta) });
  }
  for (const rep of reg.repeatables.values()) {
    const level = repeatableLevel(s, rep.id);
    if (level > 0) sources.push({ id: rep.id, kind: 'repeatable', cyclesPerSec: scaled(rep.perLevel.cyclesPerSec * level, rep.perLevel.megawattsDelta) });
  }
  const gross = sources.reduce((sum, source) => sum + source.cyclesPerSec, 0);
  const fraction = gross > 0 && hasFlag(s, reg, 'ENABLES_CORPORATE_FINANCE') ? 1 - s.actuators.computeProfitAllocationRatio : 1;
  return sources.filter((source) => source.cyclesPerSec !== 0).map((source) => ({ ...source, cyclesPerSec: source.cyclesPerSec * fraction }));
}
