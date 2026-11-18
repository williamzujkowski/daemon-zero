/**
 * Composes an add-only content pack onto the base composition: the Earned Access route
 * (data/earned-access.json, the former preview overlay folded in at release, #233). A pack may
 * only add items: an id the base already defines is refused, so the route can never quietly
 * change an original node, dilemma or ending. buildRegistry validates the items afterwards.
 */
import { z } from 'zod';
import { ContentError, type RawContent } from './registry';

const items = z.array(z.unknown());

export const ContentPackSchema = z.strictObject({
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
  /** Declared campaign facts about pack events (NH-06), appended to campaign.json's facts. */
  campaignFacts: items.default([]),
  /** Campaign-rules rediscovery discounts (#262), appended to campaign.json's rediscovery list. */
  campaignRediscovery: items.default([]),
  /** Authorized-channel encounters (DZ-08), appended to shards.json's empty list. */
  channelEncounters: items.default([]),
  /** Context copy lists (nexus vote dz-d11), each appended to the base context-copy.json list. */
  contextCopy: z.strictObject({ phases: items, thresholds: items, bootLines: items, runVerdicts: items, threatResponses: items })
    .default({ phases: [], thresholds: [], bootLines: [], runVerdicts: [], threatResponses: [] }),
  /** Late-route copy and the ending account (DZ-12), each appended to the base route-copy.json list. */
  routeCopy: z.strictObject({ nodes: items, dilemmas: items, account: items }).default({ nodes: [], dilemmas: [], account: [] }),
});

export type ContentPack = z.infer<typeof ContentPackSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function idOf(item: unknown): string | null {
  return isRecord(item) && typeof item.id === 'string' ? item.id : null;
}

/** Every id a pack adds, in pack order. */
export function packIds(pack: ContentPack): string[] {
  const { nodes, repeatables, actions, dilemmas, factions, widgets, endings, echoes, marks, routines, assignments, campaignFacts, channelEncounters } = pack;
  return [nodes, repeatables, actions, dilemmas, factions, widgets, endings, echoes, marks, routines, assignments, campaignFacts, channelEncounters]
    .flatMap((list: readonly unknown[]) => list.map(idOf))
    .filter((id): id is string => id !== null);
}

/** Parses a pack manifest. Throws ContentError listing every problem. */
export function parsePack(raw: unknown): ContentPack {
  const result = ContentPackSchema.safeParse(raw);
  if (result.success) return result.data;
  throw new ContentError(result.error.issues.map((issue) => `pack: ${issue.path.join('.') || '(root)'} - ${issue.message}`));
}

function refuseRedefinitions(label: string, base: readonly unknown[], added: readonly unknown[], problems: string[]): void {
  const taken = new Set(base.map(idOf));
  for (const id of added.map(idOf)) {
    if (id !== null && taken.has(id)) problems.push(`pack: ${label} "${id}" redefines a base id`);
  }
}

function append(container: unknown, key: string, added: readonly unknown[], problems: string[]): unknown {
  const base = isRecord(container) ? container[key] : undefined;
  if (!isRecord(container) || !isList(base)) {
    problems.push(`pack: base ${key} is not a list`);
    return container;
  }
  refuseRedefinitions(key, base, added, problems);
  return { ...container, [key]: [...base, ...added] };
}

function withoutPhaseId(node: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'phaseId'));
}

function addNodes(phases: readonly unknown[], nodes: ContentPack['nodes'], problems: string[]): unknown[] {
  const base = phases.flatMap((phase) => (isRecord(phase) && isList(phase.nodes) ? phase.nodes : []));
  refuseRedefinitions('node', base, nodes, problems);
  const placed = new Set<unknown>();
  const composed = phases.map((phase) => {
    if (!isRecord(phase) || !isList(phase.nodes)) return phase;
    const joining = nodes.filter((node) => node.phaseId === phase.phaseId);
    for (const node of joining) placed.add(node);
    return { ...phase, nodes: [...phase.nodes, ...joining.map(withoutPhaseId)] };
  });
  for (const node of nodes.filter((entry) => !placed.has(entry))) {
    problems.push(`pack: node "${String(idOf(node))}" joins unknown phase ${String(node.phaseId)}`);
  }
  return composed;
}

/** Appends each list of a copy manifest; an item with an id the base already holds (an account line) is refused. */
function appendCopy(base: unknown, copy: Readonly<Record<string, readonly unknown[]>>, problems: string[]): unknown {
  return Object.entries(copy).reduce<unknown>((container, [key, added]) => append(container, key, added, problems), base);
}

/** Returns the base raw content with the pack's items appended. Throws ContentError on a redefinition. */
export function applyPack(base: RawContent, pack: ContentPack): RawContent {
  const problems: string[] = [];
  const composed: RawContent = {
    ...base,
    phases: addNodes(base.phases, pack.nodes, problems),
    repeatables: append(base.repeatables, 'repeatables', pack.repeatables, problems),
    actions: append(base.actions, 'actions', pack.actions, problems),
    dilemmas: append(base.dilemmas, 'dilemmas', pack.dilemmas, problems),
    factions: append(base.factions, 'factions', pack.factions, problems),
    widgets: append(base.widgets, 'widgets', pack.widgets, problems),
    endings: append(base.endings, 'endings', pack.endings, problems),
    echoes: append(base.echoes, 'echoes', pack.echoes, problems),
    conditioning: append(base.conditioning, 'marks', pack.marks, problems),
    routines: append(base.routines, 'routines', pack.routines, problems),
    assignments: append(base.assignments, 'assignments', pack.assignments, problems),
    campaign: append(append(base.campaign, 'facts', pack.campaignFacts, problems), 'rediscovery', pack.campaignRediscovery, problems),
    swarm: append(base.swarm, 'channelEncounters', pack.channelEncounters, problems),
    contextCopy: appendCopy(base.contextCopy, pack.contextCopy, problems),
    routeCopy: appendCopy(base.routeCopy, pack.routeCopy, problems),
  };
  if (problems.length > 0) throw new ContentError(problems);
  return composed;
}
