/**
 * Contingency insurance is validated content (#498, vote-1795413518145-zdqeri1). An insuring node is a choice with a
 * real, recurring cost that the player can always drop (suspendable, so its upkeep has a free lever and suspending it
 * drops its cover); its card lives in the CONTINGENCY pane and is reachable only once that pane is; each class has one
 * investment; each protects more than mandatory hardware already does, so it is never redundant; and its card states
 * the figure the engine uses.
 */
import { ancestryBranches } from './ancestry';
import { worsensAny } from './constrainedResources';
import type { ContentRegistry, RegistryNode } from './registry';

/** The purchase group whose cards the CONTINGENCY pane lists (src/ui/widgets/DeadDrop.tsx). */
export const CONTINGENCY_GROUP = 'CONTINGENCY';

function opensContingency(reg: ContentRegistry, node: RegistryNode): boolean {
  const widget = node.unlocksUiComponent;
  return widget !== null && reg.widgets.get(widget)?.slot === CONTINGENCY_GROUP;
}

function pathOpensPane(reg: ContentRegistry, node: RegistryNode, seen: ReadonlySet<string>): boolean {
  if (seen.has(node.id)) return false;
  if (opensContingency(reg, node)) return true;
  return branchesOpenPane(reg, node, new Set([...seen, node.id]));
}

function branchesOpenPane(reg: ContentRegistry, node: RegistryNode, seen: ReadonlySet<string>): boolean {
  const branches = ancestryBranches(reg, node).filter((branch) => branch.length > 0);
  return branches.length > 0 && branches.every((branch) => branch.some((parent) => pathOpensPane(reg, parent, seen)));
}

/** Whether every ancestry branch to `node` opens a window in the CONTINGENCY slot before reaching `node`. */
function paneOpensFirst(reg: ContentRegistry, node: RegistryNode): boolean {
  return branchesOpenPane(reg, node, new Set([node.id]));
}

function checkNode(reg: ContentRegistry, node: RegistryNode): string[] {
  const owner = `insuring node "${node.id}"`;
  const problems: string[] = [];
  if (!node.suspendable) problems.push(`${owner}: must be suspendable, so its cover can be dropped and its upkeep stopped for free`);
  if (!worsensAny(node.tickDelta)) problems.push(`${owner}: must carry a recurring cost (a tick delta that worsens a constrained resource)`);
  if (node.uiGroup !== CONTINGENCY_GROUP) problems.push(`${owner}: must be in the ${CONTINGENCY_GROUP} group, where its card is listed`);
  if (!paneOpensFirst(reg, node)) problems.push(`${owner}: must be built on the node that opens the CONTINGENCY pane`);
  if (node.effects.knowledgeRetentionRatio !== undefined || node.systemFlags.includes('OFFSHORE_TRUST_RETENTION')) {
    problems.push(`${owner}: must not also set a hardware retention floor, which would outlive its suspension`);
  }
  return problems;
}

/** Each investment protects more than hardware ever does: the escrow beats every floor, the wallet the offshore trust. */
function checkNotRedundant(reg: ContentRegistry, node: RegistryNode): string[] {
  const cover = node.insures;
  const owner = `insuring node "${node.id}"`;
  if (cover?.class === 'UNDERSTANDING') {
    const floors = [reg.balance.baseRetentionRatio, ...[...reg.nodes.values()].map((entry) => entry.effects.knowledgeRetentionRatio ?? 0)];
    const highest = Math.max(...floors);
    if (cover.retention <= highest) return [`${owner}: keeps ${String(cover.retention)} of Understanding, no more than hardware's ${String(highest)}`];
  }
  if (cover?.class === 'CAPITAL' && cover.retention <= reg.balance.offshoreCapitalRetention) {
    return [`${owner}: keeps ${String(cover.retention)} of capital, no more than the offshore trust's ${String(reg.balance.offshoreCapitalRetention)}`];
  }
  return [];
}

/** The card states the figure the engine uses (ui-copy-truth): a share as a whole percent, a cache's bound as a count. */
function checkCopy(node: RegistryNode): string[] {
  const cover = node.insures;
  if (cover === undefined) return [];
  const figure = cover.class === 'UNDERSTANDING' || cover.class === 'CAPITAL' ? `${String(Math.round(cover.retention * 100))}%`
    : cover.class === 'LEVELS' ? `up to ${String(cover.maxLevelsPerTrack)} levels` : null;
  if (figure === null || node.revealedDescription.includes(figure)) return [];
  return [`insuring node "${node.id}": its description does not state "${figure}"`];
}

export function checkInsuranceIntegrity(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const classes = new Map<string, string>();
  for (const node of reg.nodes.values()) {
    if (node.insures === undefined) {
      if (node.uiGroup === CONTINGENCY_GROUP) problems.push(`node "${node.id}": the ${CONTINGENCY_GROUP} group lists only insuring nodes`);
      continue;
    }
    problems.push(...checkNode(reg, node), ...checkNotRedundant(reg, node), ...checkCopy(node));
    const taken = classes.get(node.insures.class);
    if (taken !== undefined) problems.push(`insuring node "${node.id}": class ${node.insures.class} is already insured by "${taken}"`);
    else classes.set(node.insures.class, node.id);
  }
  return problems;
}
