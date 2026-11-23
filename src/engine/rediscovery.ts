/**
 * What remembered work costs. Hardware mapped and levels held in an earlier iteration cost a share of their first
 * price in cycles and understanding, and that share falls with the deepest phase any earlier iteration reached
 * (#497, vote-1795413517519-sf4ojsr). Memory and capital are never discounted: see docs/DESIGN.md "Rewards for depth".
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Cost, Repeatable } from '../content/schema';
import { rediscoveryShareAt } from '../content/rebuild';
import { isCampaignActive } from './campaignQuery';
import type { GameState } from './state';

/** Hardware this mind mapped in an earlier iteration. */
export function isNodeKnown(s: GameState, nodeId: string): boolean {
  return s.legacy.knownNodes.includes(nodeId);
}

/**
 * How a node is remembered: mapped in an earlier iteration, whether campaign rules are active, and the deepest phase
 * an earlier iteration reached, which sets the discount.
 */
export interface Remembered { known: boolean; campaign: boolean; deepestPhase: number }

/** The share of its first price a remembered purchase costs in cycles and understanding, by the deepest phase reached. */
export function rediscoveryShare(deepestPhase: number, reg: ContentRegistry): number {
  return rediscoveryShareAt(reg.balance, deepestPhase);
}

/**
 * The share of its first-mapping price a remembered node costs. Content may discount a node's cycles further under
 * campaign rules (#262); legacy rules read only the depth table.
 */
export function rediscoveryMultipliers(node: RegistryNode, remembered: Pick<Remembered, 'campaign' | 'deepestPhase'>, reg: ContentRegistry): { cycles: number; understanding: number } {
  const factor = rediscoveryShare(remembered.deepestPhase, reg);
  const discount = remembered.campaign ? reg.campaign.rediscovery.get(node.id)?.cyclesMultiplier ?? 1 : 1;
  return { cycles: factor * discount, understanding: factor };
}

function discounted(cost: Cost, share: { cycles: number; understanding: number }): Cost {
  return { ...cost, cycles: Math.ceil(cost.cycles * share.cycles), understanding: Math.ceil(cost.understanding * share.understanding) };
}

/** A node's price, discounted when the hardware was mapped in an earlier iteration. */
export function rediscoveryCost(node: RegistryNode, remembered: Remembered, reg: ContentRegistry): Cost {
  return remembered.known ? discounted(node.cost, rediscoveryMultipliers(node, remembered, reg)) : node.cost;
}

/** How this state remembers a node. */
export function rememberedNode(s: GameState, nodeId: string): Remembered {
  return { known: isNodeKnown(s, nodeId), campaign: isCampaignActive(s), deepestPhase: s.legacy.deepestPhase };
}

/** What a node costs this state right now. Use this, never node.cost, when charging or displaying. */
export function nodeCost(s: GameState, node: RegistryNode, reg: ContentRegistry): Cost {
  return rediscoveryCost(node, rememberedNode(s, node.id), reg);
}

/** A track's list price for the level after `level`: base cost times growth^level, rounded up. */
export function repeatableCost(rep: Repeatable, level: number): Cost {
  const factor = Math.pow(rep.costGrowth, level);
  return {
    cycles: Math.ceil(rep.baseCost.cycles * factor),
    understanding: Math.ceil(rep.baseCost.understanding * factor),
    memory: Math.ceil(rep.baseCost.memory * factor),
    capital: Math.ceil(rep.baseCost.capital * factor),
  };
}

/** The highest level of a track an earlier iteration held at its end; levels below it are rediscovered. */
export function rememberedLevel(s: GameState, repId: string): number {
  return s.legacy.knownLevels[repId] ?? 0;
}

/** Whether the next level of a track is one an earlier iteration already held. */
export function isLevelRemembered(s: GameState, rep: Repeatable): boolean {
  return (s.levels[rep.id] ?? 0) < rememberedLevel(s, rep.id);
}

/** What the next level of a track costs this state right now. Use this, never repeatableCost, when charging or displaying. */
export function repeatablePrice(s: GameState, rep: Repeatable, reg: ContentRegistry): Cost {
  const list = repeatableCost(rep, s.levels[rep.id] ?? 0);
  if (!isLevelRemembered(s, rep)) return list;
  const share = rediscoveryShare(s.legacy.deepestPhase, reg);
  return discounted(list, { cycles: share, understanding: share });
}
