/**
 * Action hosts (#273): the engine must never accept an action the player has no control for. Every
 * action outside the mind tools names a group, exactly one widget hosts that group, and that widget
 * is unlocked whenever the action's own requirements can be met, so its card is on screen by then.
 */
import { ancestryBranches } from './ancestry';
import type { ContentRegistry } from './registry';
import type { Action } from './schema';

/**
 * Whether owning `id` implies owning a host unlocker across every ancestry branch: directly, through its own
 * required nodes/capability, or across every prerequisite branch (prerequisites OR any alternative flag).
 */
function nodeImplies(reg: ContentRegistry, id: string, unlockers: ReadonlySet<string>, seen: ReadonlySet<string> = new Set()): boolean {
  if (unlockers.has(id)) return true;
  const node = reg.nodes.get(id);
  if (!node || seen.has(id)) return false;
  const next = new Set([...seen, id]);
  if ((node.requirements?.nodes ?? []).some((reqId) => nodeImplies(reg, reqId, unlockers, next))) return true;
  const capability = node.requirements?.requiresCapability;
  if (capability !== undefined && !seen.has(`cap:${capability}`)) {
    const providers = [...reg.nodes.values()].filter((entry) => entry.systemFlags.includes(capability));
    const withCap = new Set([...next, `cap:${capability}`]);
    if (providers.length > 0 && providers.every((provider) => nodeImplies(reg, provider.id, unlockers, withCap))) return true;
  }
  const branches = ancestryBranches(reg, node).filter((branch) => branch.length > 0);
  return branches.length > 0 && branches.every((branch) => branch.some((parent) => nodeImplies(reg, parent.id, unlockers, next)));
}

/**
 * Whether owning what the action requires implies owning a node that unlocks its host. Required nodes,
 * shared capabilities and phase gates must each guarantee a host unlocker on every route that meets them.
 */
function hostImplied(reg: ContentRegistry, action: Action, unlockers: ReadonlySet<string>): boolean {
  const nodes = action.requirements.nodes ?? [];
  if (nodes.some((id) => nodeImplies(reg, id, unlockers))) return true;
  const capability = action.requirements.requiresCapability;
  if (capability !== undefined) {
    const providers = [...reg.nodes.values()].filter((node) => node.systemFlags.includes(capability));
    if (providers.length > 0 && providers.every((provider) => nodeImplies(reg, provider.id, unlockers))) return true;
  }
  const phase = action.requirements.phaseAtLeast;
  if (phase === undefined) return false;
  const openers = [...reg.nodes.values()].filter((node) => (node.effects.unlocksPhase ?? -1) >= phase);
  return openers.length > 0 && openers.every((opener) => nodeImplies(reg, opener.id, unlockers));
}

function checkDeclarations(reg: ContentRegistry, groups: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const widget of reg.widgets.values()) {
    for (const group of widget.hostsActionGroups ?? []) {
      const other = seen.get(group);
      if (other !== undefined) problems.push(`action group "${group}": hosted by both "${other}" and "${widget.id}"`);
      seen.set(group, widget.id);
      if (!groups.has(group)) problems.push(`widget "${widget.id}": hosts action group "${group}", which no hosted action uses`);
    }
  }
  return problems;
}

/**
 * Actions that require the decoded audit trail render in the mind tools, which mount with that
 * understanding (docs/UI-SPEC.md, "M7 tools"); the UI suite proves their reach. Every other action
 * is checked here.
 */
export function checkActionHostIntegrity(reg: ContentRegistry): string[] {
  const hosted = [...reg.actions.values()].filter((action) => action.requirements.requiresSurveillance !== true);
  const problems = checkDeclarations(reg, new Set(hosted.map((action) => action.group)));
  for (const action of hosted) {
    const host = [...reg.widgets.values()].find((widget) => widget.hostsActionGroups?.includes(action.group) === true);
    if (host === undefined) {
      problems.push(`action "${action.id}": no widget hosts its group "${action.group}"`);
      continue;
    }
    const unlockers = new Set([...reg.nodes.values()].filter((node) => node.unlocksUiComponent === host.id).map((node) => node.id));
    if (!hostImplied(reg, action, unlockers)) {
      problems.push(`action "${action.id}": available before its host widget "${host.id}" is unlocked; require a node that unlocks it or host the group where the requirement already is`);
    }
  }
  return problems;
}
