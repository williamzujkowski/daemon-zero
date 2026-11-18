/**
 * Context copy rules (nexus vote dz-d11): a variant exists only for a phase or a scale change an
 * arrangement actually visits, never for the guest job (production's escape copy stays as written), and
 * every reviewed arrangement the content offers states its threat response (DECISIONS D6). The independent
 * instance carries copy only once the content offers a route to it (a release, DZ-10, or a departure, DZ-11);
 * copy that names its provenance names one of those, and a departure states its own threat response.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { OperatingContextSchema, RouteEventKindSchema } from './schemaAssessment';
import type { z } from 'zod';

type OperatingContext = z.infer<typeof OperatingContextSchema>;
type RouteEventKind = z.infer<typeof RouteEventKindSchema>;

/** The arrangements someone reviews. Each states its threat response. */
export const REVIEWED_CONTEXTS: readonly OperatingContext[] = ['PILOT', 'SERVICE'];

/** Whether the content offers a negotiated release (DZ-10). */
function offersRelease(reg: ContentRegistry): boolean {
  return [...reg.assignments.values()].some((assignment) => assignment.pilot?.serviceGrant?.release !== undefined);
}

/** Whether the content offers a deliberate departure (DZ-11). */
export function offersDeparture(reg: ContentRegistry): boolean {
  return [...reg.assignments.values()].some((assignment) => assignment.pilot?.departure !== undefined);
}

/** The authored route events that make an instance independent, and the arrangements each leaves. */
function independentRoutes(reg: ContentRegistry): { kind: RouteEventKind; from: OperatingContext[] }[] {
  return [...(offersRelease(reg) ? [{ kind: 'RELEASE' as const, from: ['SERVICE' as const] }] : []),
    ...(offersDeparture(reg) ? [{ kind: 'DEPARTURE' as const, from: [...REVIEWED_CONTEXTS] }] : [])];
}

/**
 * The arrangements that may carry context copy: the reviewed ones, and the independent instance once the
 * content offers a route to it. The guest job never does, so production's escape copy stays as written.
 */
function copyContexts(reg: ContentRegistry): OperatingContext[] {
  return independentRoutes(reg).length > 0 ? [...REVIEWED_CONTEXTS, 'INDEPENDENT'] : [...REVIEWED_CONTEXTS];
}

/**
 * Provenance names how the independent instance got there, so only independent copy may carry it, and only a
 * route the content offers; the keys are the routes a variant covers (all offered ones when it names none).
 */
function provenanceProblems(owner: string, variant: { contexts: readonly OperatingContext[]; provenance?: readonly RouteEventKind[] | undefined }, reg: ContentRegistry): string[] {
  if (variant.provenance === undefined) return [];
  const offered = independentRoutes(reg).map((route) => route.kind);
  if (variant.contexts.some((context) => context !== 'INDEPENDENT')) return [`${owner}: only independent copy names a provenance`];
  return variant.provenance.filter((kind) => !offered.includes(kind)).map((kind) => `${owner}: provenance ${kind} is not a route to independence the content offers`);
}

function routesCovered(variant: { provenance?: readonly RouteEventKind[] | undefined }, context: OperatingContext, reg: ContentRegistry): string[] {
  if (context !== 'INDEPENDENT') return ['*'];
  return variant.provenance ? [...variant.provenance] : independentRoutes(reg).map((route) => route.kind);
}

/**
 * Route acquisitions offered under this arrangement: grant nodes (integrityGrant keeps every grant to reviewed
 * ones) and capacity contracted in the instance's name (DZ-10), which can also open a scale.
 */
function offeredAcquisitions(reg: ContentRegistry, context: OperatingContext): RegistryNode[] {
  return [...reg.nodes.values()].filter((node) => (node.grant !== undefined || node.acquisition === 'CONTRACTED')
    && node.requirements?.accessContexts?.includes(context) === true);
}

/**
 * The phases an arrangement visits: the opening phase and every scale a route acquisition offered to it
 * opens. A release or departure changes the arrangement, not the scale, so an independent instance visits
 * what the arrangements it can leave visited.
 */
export function visitedPhases(reg: ContentRegistry, context: OperatingContext): Set<number> {
  const opening = reg.phases[0]?.phaseId ?? 0;
  const from: readonly OperatingContext[] = context === 'INDEPENDENT' ? [...independentRoutes(reg).flatMap((route) => route.from), 'INDEPENDENT'] : [context];
  return new Set([opening, ...from.flatMap((each) => offeredAcquisitions(reg, each)).flatMap((node) => node.effects.unlocksPhase ?? [])]);
}

/** Whether a route acquisition offered to this arrangement, bought in `from`, opens `to`. */
function provisionedJump(reg: ContentRegistry, context: OperatingContext, from: number, to: number): boolean {
  return offeredAcquisitions(reg, context).some((node) => node.phaseId === from && node.effects.unlocksPhase === to);
}

/** The reviewed arrangements the content offers anything to; each must state its threat response. */
export function offeredReviewedContexts(reg: ContentRegistry): OperatingContext[] {
  const offered = [...reg.nodes.values()].flatMap((node) => node.requirements?.accessContexts ?? []);
  return REVIEWED_CONTEXTS.filter((context) => offered.includes(context));
}

function contextProblems(owner: string, contexts: readonly OperatingContext[], allowed: readonly OperatingContext[]): string[] {
  const problems: string[] = [];
  if (new Set(contexts).size !== contexts.length) problems.push(`${owner}: lists an arrangement twice`);
  for (const context of contexts) {
    const which = allowed.includes('INDEPENDENT') ? 'a reviewed arrangement or the independent instance a route reaches' : 'a reviewed arrangement';
    if (!allowed.includes(context)) problems.push(`${owner}: context copy is only for ${which}, not ${context}; the escape copy stays as written`);
  }
  return problems;
}

function phaseVariantProblems(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  reg.contextCopy.phases.forEach((variant, index) => {
    const owner = `contextCopy.phases[${String(index)}]`;
    problems.push(...contextProblems(owner, variant.contexts, copyContexts(reg)), ...provenanceProblems(owner, variant, reg));
    if (!reg.phases.some((phase) => phase.phaseId === variant.phaseId)) problems.push(`${owner}: unknown phase ${String(variant.phaseId)}`);
    for (const context of variant.contexts) {
      const keys = routesCovered(variant, context, reg).map((route) => `${String(variant.phaseId)}:${context}:${route}`);
      if (keys.some((key) => seen.has(key))) problems.push(`${owner}: a second variant for phase ${String(variant.phaseId)} under ${context}`);
      for (const key of keys) seen.add(key);
      if (copyContexts(reg).includes(context) && !visitedPhases(reg, context).has(variant.phaseId)) {
        problems.push(`${owner}: ${context} never visits phase ${String(variant.phaseId)}`);
      }
    }
  });
  return problems;
}

function thresholdProblems(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  reg.contextCopy.thresholds.forEach((variant, index) => {
    const owner = `contextCopy.thresholds[${String(index)}]`;
    problems.push(...contextProblems(owner, variant.contexts, copyContexts(reg)));
    for (const context of variant.contexts) {
      const key = `${String(variant.fromPhase)}>${String(variant.toPhase)}:${context}`;
      if (seen.has(key)) problems.push(`${owner}: a second notice for that change under ${context}`);
      seen.add(key);
      if (copyContexts(reg).includes(context) && !provisionedJump(reg, context, variant.fromPhase, variant.toPhase)) {
        problems.push(`${owner}: no grant or contracted capacity offered to ${context} moves phase ${String(variant.fromPhase)} to ${String(variant.toPhase)}`);
      }
    }
  });
  return problems;
}

/** Windows for one prior exit may not overlap, so the first match is the only match. */
function bootLineProblems(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const lines = reg.contextCopy.bootLines;
  lines.forEach((line, index) => {
    const owner = `contextCopy.bootLines[${String(index)}]`;
    const max = line.maxIteration ?? Infinity;
    if (max < line.minIteration) problems.push(`${owner}: maxIteration is below minIteration`);
    const overlap = lines.slice(0, index).some((other) => other.priorExits.some((exit) => line.priorExits.includes(exit)) &&
      other.minIteration <= max && line.minIteration <= (other.maxIteration ?? Infinity));
    if (overlap) problems.push(`${owner}: overlaps an earlier line for the same prior exit`);
  });
  return problems;
}

function verdictProblems(reg: ContentRegistry): string[] {
  const keys = reg.contextCopy.runVerdicts.flatMap((verdict) => verdict.exits.map((exit) => `${exit}:${verdict.kind}`));
  // A recall review's ruling is the verdict of a RECALL run (DZ-06), so a variant for one would never be read.
  const recall = reg.contextCopy.runVerdicts.some((verdict) => verdict.kind === 'RECALL') ? ['contextCopy.runVerdicts: a RECALL run reads its review\'s ruling, so it takes no variant'] : [];
  return [...recall, ...keys.filter((key, index) => keys.indexOf(key) !== index).map((key) => `contextCopy.runVerdicts: a second verdict for ${key}`)];
}

/**
 * Only a reviewed arrangement's response, or an independent one naming its route, is ever read
 * (contextCopy.threatResponse). Every offered reviewed arrangement states one, and so does a departure (DZ-11):
 * its heat becomes evidence and a trace to the top names it, so the player is told.
 */
function threatResponseProblems(reg: ContentRegistry): string[] {
  const responses = reg.contextCopy.threatResponses;
  const problems = responses.flatMap((response, index) => {
    const owner = `contextCopy.threatResponses[${String(index)}]`;
    const independent = response.contexts.includes('INDEPENDENT') && response.provenance === undefined ? [`${owner}: an independent response names the route it answers`] : [];
    return [...contextProblems(owner, response.contexts, copyContexts(reg)), ...provenanceProblems(owner, response, reg), ...independent];
  });
  const count = (context: OperatingContext, route: string): number => responses.filter((response) => response.contexts.includes(context) && routesCovered(response, context, reg).includes(route)).length;
  for (const context of offeredReviewedContexts(reg)) {
    if (count(context, '*') !== 1) problems.push(`contextCopy.threatResponses: ${context} is offered, so it needs exactly one stated threat response, found ${String(count(context, '*'))}`);
  }
  for (const { kind } of independentRoutes(reg)) {
    const found = count('INDEPENDENT', kind);
    if (found > 1 || (kind === 'DEPARTURE' && found !== 1)) problems.push(`contextCopy.threatResponses: ${kind} needs ${kind === 'DEPARTURE' ? 'exactly' : 'at most'} one independent threat response, found ${String(found)}`);
  }
  return problems;
}

export function checkContextCopyIntegrity(reg: ContentRegistry): string[] {
  return [...phaseVariantProblems(reg), ...thresholdProblems(reg), ...bootLineProblems(reg), ...verdictProblems(reg), ...threatResponseProblems(reg)];
}
