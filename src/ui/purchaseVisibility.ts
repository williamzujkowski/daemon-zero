/** UI-only purchase and process membership; no ownership or simulation state is changed. */
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import type { Repeatable } from '../content/schema';
import { isNodeDiscoverable, meetsRequirements, repeatableLevel, type GameState } from '../engine';

export function pendingNode(game: GameState, node: RegistryNode, showLocked = false): boolean {
  return !game.unlockedNodes.includes(node.id) && (showLocked ||
    ((game.cycles > 0 || game.unlockedNodes.length > 0) && isNodeDiscoverable(game, node)));
}

export function pendingRepeatable(game: GameState, rep: Repeatable): boolean {
  return meetsRequirements(game, rep.requirements) && repeatableLevel(game, rep.id) < rep.maxLevel;
}

export function needsProcessControl(game: GameState, node: RegistryNode): boolean {
  const delta = node.tickDelta;
  return game.unlockedNodes.includes(node.id) && (game.disabledNodes.includes(node.id) ||
    delta.cyclesPerSec < 0 || delta.thermalPerSec > 0 || delta.suspicionPerSec > 0);
}

export function hasPhasePurchases(game: GameState, phase: number, group?: string): boolean {
  return [...CONTENT.nodes.values()].some((node) => node.phaseId === phase &&
    (group === undefined || node.uiGroup === group) && pendingNode(game, node)) ||
    [...CONTENT.repeatables.values()].some((rep) => rep.phaseId === phase && pendingRepeatable(game, rep));
}
