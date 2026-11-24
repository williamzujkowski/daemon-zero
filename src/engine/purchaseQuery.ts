/**
 * Which purchase cards and tracks a player is shown: the one visibility rule the UI's purchase sections and the
 * headless reading observer (#540) both read, so a report counts exactly the cards the app lists. Pure queries.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Repeatable, Requirements } from '../content/schema';
import { fallbackTraits, holdsCampaignFact } from './campaignQuery';
import { hasEverHeld, isNodeDiscoverable, meetsRequirements, repeatableLevel } from './query';
import type { GameState } from './state';

/**
 * Only monotonic exclusions: affordability, trust and suspicion can recover. A campaign fact is
 * monotonic too: it holds only for a resolved or closed record, which never reopens.
 */
export function requirementsPermanentlyBlocked(s: GameState, requirements: Requirements | undefined, reg: ContentRegistry): boolean {
  return (requirements?.forbidsNodes?.some((id) => s.unlockedNodes.includes(id)) ?? false) ||
    (requirements?.forbidsTraits?.some((trait) => hasEverHeld(s, trait)) ?? false) ||
    (requirements !== undefined && fallbackTraits(s, requirements, reg).length > 0) ||
    (requirements?.forbidsCampaignFacts?.some((fact) => holdsCampaignFact(s, fact, reg)) ?? false) ||
    s.iteration > (requirements?.maxIteration ?? Infinity);
}

/** A card the purchase list shows: not owned, not ruled out for good, and discoverable once play has begun. */
export function isNodePending(s: GameState, node: RegistryNode, reg: ContentRegistry, showLocked = false): boolean {
  return !s.unlockedNodes.includes(node.id) && !requirementsPermanentlyBlocked(s, node.requirements, reg) && (showLocked ||
    ((s.cycles > 0 || s.unlockedNodes.length > 0) && isNodeDiscoverable(s, node, reg)));
}

/** A track with a level the player may buy now. */
export function isRepeatablePending(s: GameState, rep: Repeatable, reg: ContentRegistry): boolean {
  return meetsRequirements(s, rep.requirements, reg) && repeatableLevel(s, rep.id) < rep.maxLevel;
}

/** An owned level of a dismissable track: its free release must stay reachable whether or not it is still buyable. */
export function isRepeatableReleasable(s: GameState, rep: Repeatable): boolean {
  return rep.dismissable && repeatableLevel(s, rep.id) > 0;
}

/** The tracks a section lists: each buyable now, or holding a level the player can release for free (#488 pass 4). */
export function shownRepeatables(s: GameState, reg: ContentRegistry, phase: number, kind?: Repeatable['kind']): Repeatable[] {
  return [...reg.repeatables.values()].filter((rep) => rep.phaseId === phase && (kind === undefined || rep.kind === kind) &&
    (isRepeatablePending(s, rep, reg) || isRepeatableReleasable(s, rep)));
}
