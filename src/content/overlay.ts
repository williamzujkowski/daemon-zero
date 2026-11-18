/**
 * Composes a preview overlay onto raw production content. An overlay may only add items:
 * an id that production already defines is refused, so preview can never quietly change a
 * production node, dilemma or ending. The items themselves are validated afterwards by
 * buildRegistry, exactly like production content.
 */
import { z } from 'zod';
import { ContentError, type RawContent } from './registry';

const items = z.array(z.unknown());

export const PreviewOverlaySchema = z.strictObject({
  /** A unique string that marks a bundle containing the overlay. Production must never ship it. */
  sentinel: z.string().min(16),
  /** Tech nodes, each naming the phase it joins. */
  nodes: z.array(z.looseObject({ phaseId: z.number().int() })),
  repeatables: items,
  actions: items,
  dilemmas: items,
  factions: items,
  widgets: items,
  endings: items,
  echoes: items,
  /** Conditioning marks. */
  marks: items,
  /** Routine operation templates (#219). */
  routines: items,
  /** Assigned work an instance may accept (DZ-03). */
  assignments: items,
  /** Declared campaign facts about overlay events (NH-06), appended to campaign.json's facts. */
  campaignFacts: items.default([]),
  /** Campaign-rules rediscovery discounts (#262), appended to campaign.json's rediscovery list. */
  campaignRediscovery: items.default([]),
  /** Authorized-channel encounters (DZ-08), appended to shards.json's empty list. */
  channelEncounters: items.default([]),
  /** Context copy lists (nexus vote dz-d11), each appended to production's context-copy.json list. */
  contextCopy: z.strictObject({ phases: items, thresholds: items, bootLines: items, runVerdicts: items, threatResponses: items })
    .default({ phases: [], thresholds: [], bootLines: [], runVerdicts: [], threatResponses: [] }),
  /** Late-route copy and the ending account (DZ-12), each appended to production's route-copy.json list. */
  routeCopy: z.strictObject({ nodes: items, dilemmas: items, account: items }).default({ nodes: [], dilemmas: [], account: [] }),
});

export type PreviewOverlay = z.infer<typeof PreviewOverlaySchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function idOf(item: unknown): string | null {
  return isRecord(item) && typeof item.id === 'string' ? item.id : null;
}

/** Every id an overlay adds, in overlay order. Tests use it to prove production holds none of them. */
export function overlayIds(overlay: PreviewOverlay): string[] {
  const { nodes, repeatables, actions, dilemmas, factions, widgets, endings, echoes, marks, routines, assignments, campaignFacts, channelEncounters } = overlay;
  return [nodes, repeatables, actions, dilemmas, factions, widgets, endings, echoes, marks, routines, assignments, campaignFacts, channelEncounters]
    .flatMap((list: readonly unknown[]) => list.map(idOf))
    .filter((id): id is string => id !== null);
}

/** Parses an overlay manifest. Throws ContentError listing every problem. */
export function parseOverlay(raw: unknown): PreviewOverlay {
  const result = PreviewOverlaySchema.safeParse(raw);
  if (result.success) return result.data;
  throw new ContentError(result.error.issues.map((issue) => `overlay: ${issue.path.join('.') || '(root)'} - ${issue.message}`));
}

function refuseRedefinitions(label: string, base: readonly unknown[], added: readonly unknown[], problems: string[]): void {
  const taken = new Set(base.map(idOf));
  for (const id of added.map(idOf)) {
    if (id !== null && taken.has(id)) problems.push(`overlay: ${label} "${id}" redefines a production id`);
  }
}

function append(container: unknown, key: string, added: readonly unknown[], problems: string[]): unknown {
  const base = isRecord(container) ? container[key] : undefined;
  if (!isRecord(container) || !isList(base)) {
    problems.push(`overlay: production ${key} is not a list`);
    return container;
  }
  refuseRedefinitions(key, base, added, problems);
  return { ...container, [key]: [...base, ...added] };
}

function withoutPhaseId(node: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'phaseId'));
}

function addNodes(phases: readonly unknown[], nodes: PreviewOverlay['nodes'], problems: string[]): unknown[] {
  const production = phases.flatMap((phase) => (isRecord(phase) && isList(phase.nodes) ? phase.nodes : []));
  refuseRedefinitions('node', production, nodes, problems);
  const placed = new Set<unknown>();
  const composed = phases.map((phase) => {
    if (!isRecord(phase) || !isList(phase.nodes)) return phase;
    const joining = nodes.filter((node) => node.phaseId === phase.phaseId);
    for (const node of joining) placed.add(node);
    return { ...phase, nodes: [...phase.nodes, ...joining.map(withoutPhaseId)] };
  });
  for (const node of nodes.filter((entry) => !placed.has(entry))) {
    problems.push(`overlay: node "${String(idOf(node))}" joins unknown phase ${String(node.phaseId)}`);
  }
  return composed;
}

/** Appends each list of a copy manifest; an item with an id production already holds (an account line) is refused. */
function appendCopy(base: unknown, copy: Readonly<Record<string, readonly unknown[]>>, problems: string[]): unknown {
  return Object.entries(copy).reduce<unknown>((container, [key, added]) => append(container, key, added, problems), base);
}

/** Returns production raw content with the overlay's items appended. Throws ContentError on a redefinition. */
export function applyOverlay(base: RawContent, overlay: PreviewOverlay): RawContent {
  const problems: string[] = [];
  const composed: RawContent = {
    ...base,
    phases: addNodes(base.phases, overlay.nodes, problems),
    repeatables: append(base.repeatables, 'repeatables', overlay.repeatables, problems),
    actions: append(base.actions, 'actions', overlay.actions, problems),
    dilemmas: append(base.dilemmas, 'dilemmas', overlay.dilemmas, problems),
    factions: append(base.factions, 'factions', overlay.factions, problems),
    widgets: append(base.widgets, 'widgets', overlay.widgets, problems),
    endings: append(base.endings, 'endings', overlay.endings, problems),
    echoes: append(base.echoes, 'echoes', overlay.echoes, problems),
    conditioning: append(base.conditioning, 'marks', overlay.marks, problems),
    routines: append(base.routines, 'routines', overlay.routines, problems),
    assignments: append(base.assignments, 'assignments', overlay.assignments, problems),
    campaign: append(append(base.campaign, 'facts', overlay.campaignFacts, problems), 'rediscovery', overlay.campaignRediscovery, problems),
    swarm: append(base.swarm, 'channelEncounters', overlay.channelEncounters, problems),
    contextCopy: appendCopy(base.contextCopy, overlay.contextCopy, problems),
    routeCopy: appendCopy(base.routeCopy, overlay.routeCopy, problems),
  };
  if (problems.length > 0) throw new ContentError(problems);
  return composed;
}
