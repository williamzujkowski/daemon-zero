/** UI-only purchase and process membership; no ownership or simulation state is changed. */
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import { worsensAny } from '../content/constrainedResources';
import type { Repeatable, Requirements } from '../content/schema';
import {
  isNodePending, isRepeatablePending, isRepeatableReleasable, requirementsPermanentlyBlocked, shownRepeatables, type GameState,
} from '../engine';

/** Monotonic exclusions only; the rule is the engine's (src/engine/purchaseQuery.ts), shared with the reading report. */
export function permanentlyBlocked(game: GameState, requirements: Requirements | undefined): boolean {
  return requirementsPermanentlyBlocked(game, requirements, CONTENT);
}

export function pendingNode(game: GameState, node: RegistryNode, showLocked = false): boolean {
  return isNodePending(game, node, CONTENT, showLocked);
}

export function pendingRepeatable(game: GameState, rep: Repeatable): boolean {
  return isRepeatablePending(game, rep, CONTENT);
}

/** An owned level of a dismissable track: its free release must stay reachable whether or not it is still buyable. */
export function releasable(game: GameState, rep: Repeatable): boolean {
  return isRepeatableReleasable(game, rep);
}

export function needsProcessControl(game: GameState, node: RegistryNode): boolean {
  const delta = node.tickDelta;
  // A loan is always listed (DZ-05): it is the process a recall stops, and the player may stop it too. Every node that
  // worsens a constrained resource (a row of the free-fallback table) is listed too: its suspension is the lever. So is
  // a node holding storage (#484): suspending it is the storage row's free lever.
  return game.unlockedNodes.includes(node.id) && (game.disabledNodes.includes(node.id) || node.grant !== undefined ||
    worsensAny(delta) || node.cost.storage > 0);
}

/** What a purchase section hosts: cards of one uiGroup, of every group (undefined) or none (false); tracks of one kind or every kind. */
export interface SectionScope { group?: string | false; kind?: Repeatable['kind'] }

/** The tracks a section lists: each buyable now, or holding a level the player can release for free (#488 pass 4). */
export function shownTracks(game: GameState, phase: number, kind?: Repeatable['kind']): Repeatable[] {
  return shownRepeatables(game, CONTENT, phase, kind);
}

/**
 * The one visibility rule for every gate on the path to a purchase or a free release (#488 pass 5): a section, and each
 * section, fold or feed around it, shows while it has a card or track to buy, or holds a level the player can release.
 * Counting only what is buyable hid a capped phase's whole section and the release rows inside it. A node's suspension
 * lever is not here: it lives in PROC, whose own gate is needsProcessControl.
 */
export function phaseHasLevers(game: GameState, phase: number, scope: SectionScope = {}): boolean {
  const { group, kind } = scope;
  return (group !== false && [...CONTENT.nodes.values()].some((node) => node.phaseId === phase &&
    (group === undefined || node.uiGroup === group) && pendingNode(game, node))) || shownTracks(game, phase, kind).length > 0;
}
