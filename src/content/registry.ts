/**
 * Turns raw JSON manifests into a validated, indexed ContentRegistry.
 * Pure: takes raw data in, returns a registry or throws ContentError listing
 * every problem found. The engine and UI only ever see a ContentRegistry.
 */
import { z } from 'zod';
import { checkIntegrity } from './integrity';
import * as S from './schema';

export type RegistryNode = S.TechNode & { phaseId: number };

export interface ContentRegistry {
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
}

export interface RawContent {
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

function assemble(raw: RawContent, problems: string[]): ContentRegistry | null {
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
  if (!balance || !narrative || !phases || !repeatables || !actions) return null;
  if (!dilemmas || !factions || !widgets || !endings || !echoes) return null;

  const nodes = indexNodes(phases, problems);
  toMap(dilemmas.dilemmas, 'dilemmas', problems);
  toMap(endings.endings, 'endings', problems);
  return {
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
