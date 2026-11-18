/**
 * Action hosts (#273): the engine must never accept an action the player has no control for. Every
 * action outside the mind tools names a group, exactly one widget hosts that group, and that widget
 * is unlocked whenever the action's own requirements can be met, so its card is on screen by then.
 */
import type { ContentRegistry } from './registry';
import type { Action } from './schema';

/** The given ids and every prerequisite beneath them: owning the ids means owning all of these. */
function owned(reg: ContentRegistry, ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  const visit = (id: string): void => {
    if (out.has(id)) return;
    out.add(id);
    for (const parent of reg.nodes.get(id)?.prerequisites ?? []) visit(parent);
  };
  ids.forEach(visit);
  return out;
}

const holdsAny = (held: ReadonlySet<string>, unlockers: ReadonlySet<string>): boolean => [...held].some((id) => unlockers.has(id));

/**
 * Whether owning what the action requires implies owning a node that unlocks its host. Required nodes
 * bring their prerequisites. A phase gate is met only by owning some node that opens that phase or a
 * later one, so every such opener must bring a host unlocker. Other requirements only narrow further.
 */
function hostImplied(reg: ContentRegistry, action: Action, unlockers: ReadonlySet<string>): boolean {
  const nodes = action.requirements.nodes ?? [];
  if (nodes.length > 0 && holdsAny(owned(reg, nodes), unlockers)) return true;
  const phase = action.requirements.phaseAtLeast;
  if (phase === undefined) return false;
  const openers = [...reg.nodes.values()].filter((node) => (node.effects.unlocksPhase ?? -1) >= phase);
  return openers.length > 0 && openers.every((opener) => holdsAny(owned(reg, [opener.id]), unlockers));
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
