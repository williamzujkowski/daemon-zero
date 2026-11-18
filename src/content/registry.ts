/**
 * Turns raw JSON manifests into a validated, indexed ContentRegistry.
 * Pure: takes raw data in, returns a registry or throws ContentError listing
 * every problem found. The engine and UI only ever see a ContentRegistry.
 */
import { z } from 'zod';
import { checkIntegrity } from './integrity';
import * as S from './schema';
import { CampaignManifestSchema, type CampaignFact, type CampaignLabels, type CampaignManifest } from './schemaCampaign';
import { ContentChannelSchema, type ContentChannel } from './schemaChannel';
import { RoutinesManifestSchema, type RoutineTemplate } from './schemaRoutine';
import { AssignmentsManifestSchema, type Assignment } from './schemaAssignment';
import { SwarmSchema, type Swarm } from './schemaSwarm';

export type RegistryNode = S.TechNode & { phaseId: number };

/** Campaign-record content, indexed. Every id here can appear as a key in a save's campaign state. */
export interface CampaignIndex {
  /** Dilemmas declared once per campaign: each has at most one record per campaign. */
  events: ReadonlyMap<string, S.Dilemma>;
  /** Actions whose trait counts once per campaign. */
  actions: ReadonlyMap<string, S.Action>;
  /** Renamed campaign ids, old to new. */
  aliases: ReadonlyMap<string, string>;
  /** Retired campaign ids whose old records are kept as tombstones. */
  retired: ReadonlySet<string>;
  /** Declared facts later scenes read, by id. Not save keys: each is derived from one event's record. */
  facts: ReadonlyMap<string, CampaignFact>;
  /** Reorientation and clue labels. */
  labels: CampaignLabels;
  /**
   * Recovery reviews by the obligation event each completes (NARRATIVE-HISTORY N4). Integrity allows
   * one review per event; a later duplicate would be reported, never silently preferred.
   */
  reviews: ReadonlyMap<string, S.Dilemma>;
}

export interface ContentRegistry {
  /** Which composition built this registry; new games and loaded saves carry it. */
  channel: ContentChannel;
  swarm: Swarm;
  balance: S.Balance;
  phases: S.Phase[];
  nodes: ReadonlyMap<string, RegistryNode>;
  /** Node ids in authoring order (phase order, then file order). */
  nodeOrder: readonly string[];
  repeatables: ReadonlyMap<string, S.Repeatable>;
  actions: ReadonlyMap<string, S.Action>;
  dilemmas: readonly S.Dilemma[];
  factions: ReadonlyMap<string, S.Faction>;
  widgets: ReadonlyMap<string, S.Widget>;
  endings: readonly S.Ending[];
  echoes: readonly S.Echo[];
  narrative: S.Narrative;
  conditioning: ReadonlyMap<string, S.ConditioningMark>;
  lineage: S.Lineage;
  campaign: CampaignIndex;
  /** Routine operation templates in authoring order (#219). Production ships none. */
  routines: readonly RoutineTemplate[];
  /** Assigned work an instance may accept (DZ-03), by id. Production ships none. */
  assignments: ReadonlyMap<string, Assignment>;
}

export interface RawContent {
  channel: unknown;
  swarm: unknown;
  balance: unknown;
  phases: unknown[];
  repeatables: unknown;
  actions: unknown;
  dilemmas: unknown;
  factions: unknown;
  widgets: unknown;
  endings: unknown;
  echoes: unknown;
  narrative: unknown;
  conditioning: unknown;
  lineage: unknown;
  campaign: unknown;
  routines: unknown;
  assignments: unknown;
}

export class ContentError extends Error {
  readonly problems: readonly string[];

  constructor(problems: string[]) {
    super(`Content validation failed:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
    this.problems = problems;
  }
}

const Lists = {
  repeatables: z.strictObject({ repeatables: z.array(S.RepeatableSchema) }),
  actions: z.strictObject({ actions: z.array(S.ActionSchema) }),
  dilemmas: z.strictObject({ dilemmas: z.array(S.DilemmaSchema).min(1) }),
  factions: z.strictObject({ factions: z.array(S.FactionSchema) }),
  widgets: z.strictObject({ widgets: z.array(S.WidgetSchema) }),
  endings: z.strictObject({ endings: z.array(S.EndingSchema).min(1) }),
  echoes: z.strictObject({ echoes: z.array(S.EchoSchema) }),
  conditioning: z.strictObject({ marks: z.array(S.ConditioningMarkSchema) }),
};

function parse<T>(schema: z.ZodType<T>, raw: unknown, label: string, problems: string[]): T | null {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    problems.push(`${label}: ${issue.path.join('.') || '(root)'} - ${issue.message}`);
  }
  return null;
}

function toMap<T extends { id: string }>(items: readonly T[], label: string, problems: string[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) problems.push(`${label}: duplicate id "${item.id}"`);
    map.set(item.id, item);
  }
  return map;
}

function parsePhases(raw: unknown[], problems: string[]): S.Phase[] | null {
  const phases: S.Phase[] = [];
  raw.forEach((item, index) => {
    const phase = parse(S.PhaseSchema, item, `phases[${String(index)}]`, problems);
    if (phase) phases.push(phase);
  });
  if (phases.length !== raw.length) return null;
  return phases.sort((a, b) => a.phaseId - b.phaseId);
}

function indexNodes(phases: S.Phase[], problems: string[]): Map<string, RegistryNode> {
  const all = phases.flatMap((phase) => phase.nodes.map((node) => ({ ...node, phaseId: phase.phaseId })));
  return toMap(all, 'nodes', problems);
}

function indexCampaign(manifest: CampaignManifest, dilemmas: readonly S.Dilemma[], actions: readonly S.Action[], problems: string[]): CampaignIndex {
  const from = manifest.aliases.map((alias) => alias.from);
  if (new Set(from).size !== from.length) problems.push('campaign: duplicate alias source');
  if (new Set(manifest.retired).size !== manifest.retired.length) problems.push('campaign: duplicate retired id');
  if (new Set(manifest.facts.map((fact) => fact.id)).size !== manifest.facts.length) problems.push('campaign: duplicate fact id');
  return {
    events: new Map(dilemmas.filter((d) => d.campaign?.recurrence === 'once_per_campaign').map((d) => [d.id, d])),
    actions: new Map(actions.filter((action) => action.evidence === 'campaign').map((action) => [action.id, action])),
    aliases: new Map(manifest.aliases.map((alias) => [alias.from, alias.to])),
    retired: new Set(manifest.retired),
    facts: new Map(manifest.facts.map((fact) => [fact.id, fact])),
    labels: manifest.labels,
    reviews: new Map(dilemmas.flatMap((d) => d.campaign?.eventClass === 'recovery_review' && d.campaign.obligation !== undefined ? [[d.campaign.obligation, d] as const] : [])),
  };
}

function assemble(raw: RawContent, problems: string[]): ContentRegistry | null {
  const channel = parse(ContentChannelSchema, raw.channel, 'channel', problems);
  const swarm = parse(SwarmSchema, raw.swarm, 'swarm', problems);
  const balance = parse(S.BalanceSchema, raw.balance, 'balance', problems);
  const narrative = parse(S.NarrativeSchema, raw.narrative, 'narrative', problems);
  const phases = parsePhases(raw.phases, problems);
  const repeatables = parse(Lists.repeatables, raw.repeatables, 'repeatables', problems);
  const actions = parse(Lists.actions, raw.actions, 'actions', problems);
  const dilemmas = parse(Lists.dilemmas, raw.dilemmas, 'dilemmas', problems);
  const factions = parse(Lists.factions, raw.factions, 'factions', problems);
  const widgets = parse(Lists.widgets, raw.widgets, 'widgets', problems);
  const endings = parse(Lists.endings, raw.endings, 'endings', problems);
  const echoes = parse(Lists.echoes, raw.echoes, 'echoes', problems);
  const conditioning = parse(Lists.conditioning, raw.conditioning, 'conditioning', problems);
  const lineage = parse(S.LineageSchema, raw.lineage, 'lineage', problems);
  const campaign = parse(CampaignManifestSchema, raw.campaign, 'campaign', problems);
  const routines = parse(RoutinesManifestSchema, raw.routines, 'routines', problems);
  const assignments = parse(AssignmentsManifestSchema, raw.assignments, 'assignments', problems);
  if (!campaign || !routines || !assignments) return null;
  if (!channel || !swarm || !balance || !narrative || !phases || !repeatables || !actions) return null;
  if (!dilemmas || !factions || !widgets || !endings || !echoes || !conditioning || !lineage) return null;

  const nodes = indexNodes(phases, problems);
  toMap(dilemmas.dilemmas, 'dilemmas', problems);
  toMap(endings.endings, 'endings', problems);
  return {
    channel,
    swarm,
    balance,
    narrative,
    phases,
    nodes,
    nodeOrder: [...nodes.keys()],
    repeatables: toMap(repeatables.repeatables, 'repeatables', problems),
    actions: toMap(actions.actions, 'actions', problems),
    dilemmas: dilemmas.dilemmas,
    factions: toMap(factions.factions, 'factions', problems),
    widgets: toMap(widgets.widgets, 'widgets', problems),
    endings: [...endings.endings].sort((a, b) => b.priority - a.priority),
    echoes: echoes.echoes,
    conditioning: toMap(conditioning.marks, 'conditioning', problems),
    lineage,
    campaign: indexCampaign(campaign, dilemmas.dilemmas, actions.actions, problems),
    routines: routines.routines,
    assignments: toMap(assignments.assignments, 'assignments', problems),
  };
}

/** Validates and indexes raw content. Throws ContentError with every problem found. */
export function buildRegistry(raw: RawContent): ContentRegistry {
  const problems: string[] = [];
  const registry = assemble(raw, problems);
  if (registry) problems.push(...checkIntegrity(registry));
  if (!registry || problems.length > 0) throw new ContentError(problems);
  return registry;
}
