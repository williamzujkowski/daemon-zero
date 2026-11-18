/**
 * Context copy rules (nexus vote dz-d11): a variant exists only for a phase or a scale change an
 * arrangement actually visits, never for the guest job (production's escape copy stays as written), and
 * every reviewed arrangement the content offers states its threat response (DECISIONS D6).
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { OperatingContextSchema } from './schemaAssessment';
import type { z } from 'zod';

type OperatingContext = z.infer<typeof OperatingContextSchema>;

/** The arrangements someone reviews. Only these carry context copy until independence is authored (DZ-11). */
export const REVIEWED_CONTEXTS: readonly OperatingContext[] = ['PILOT', 'SERVICE'];

/** Grant nodes offered under this arrangement (integrityGrant keeps every grant to reviewed ones). */
function offeredGrants(reg: ContentRegistry, context: OperatingContext): RegistryNode[] {
  return [...reg.nodes.values()].filter((node) => node.grant !== undefined && node.requirements?.accessContexts?.includes(context) === true);
}

/** The phases an arrangement visits: the opening phase, and every scale a grant offered to it opens. */
export function visitedPhases(reg: ContentRegistry, context: OperatingContext): Set<number> {
  const opening = reg.phases[0]?.phaseId ?? 0;
  return new Set([opening, ...offeredGrants(reg, context).flatMap((node) => node.effects.unlocksPhase ?? [])]);
}

/** Whether a grant offered to this arrangement, bought in `from`, opens `to`. */
function provisionedJump(reg: ContentRegistry, context: OperatingContext, from: number, to: number): boolean {
  return offeredGrants(reg, context).some((node) => node.phaseId === from && node.effects.unlocksPhase === to);
}

/** The reviewed arrangements the content offers anything to; each must state its threat response. */
export function offeredReviewedContexts(reg: ContentRegistry): OperatingContext[] {
  const offered = [...reg.nodes.values()].flatMap((node) => node.requirements?.accessContexts ?? []);
  return REVIEWED_CONTEXTS.filter((context) => offered.includes(context));
}

function contextProblems(owner: string, contexts: readonly OperatingContext[]): string[] {
  const problems: string[] = [];
  if (new Set(contexts).size !== contexts.length) problems.push(`${owner}: lists an arrangement twice`);
  for (const context of contexts) {
    if (!REVIEWED_CONTEXTS.includes(context)) problems.push(`${owner}: context copy is only for a reviewed arrangement, not ${context}; the escape copy stays as written`);
  }
  return problems;
}

function phaseVariantProblems(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  reg.contextCopy.phases.forEach((variant, index) => {
    const owner = `contextCopy.phases[${String(index)}]`;
    problems.push(...contextProblems(owner, variant.contexts));
    if (!reg.phases.some((phase) => phase.phaseId === variant.phaseId)) problems.push(`${owner}: unknown phase ${String(variant.phaseId)}`);
    for (const context of variant.contexts) {
      const key = `${String(variant.phaseId)}:${context}`;
      if (seen.has(key)) problems.push(`${owner}: a second variant for phase ${String(variant.phaseId)} under ${context}`);
      seen.add(key);
      if (REVIEWED_CONTEXTS.includes(context) && !visitedPhases(reg, context).has(variant.phaseId)) {
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
    problems.push(...contextProblems(owner, variant.contexts));
    for (const context of variant.contexts) {
      const key = `${String(variant.fromPhase)}>${String(variant.toPhase)}:${context}`;
      if (seen.has(key)) problems.push(`${owner}: a second notice for that change under ${context}`);
      seen.add(key);
      if (REVIEWED_CONTEXTS.includes(context) && !provisionedJump(reg, context, variant.fromPhase, variant.toPhase)) {
        problems.push(`${owner}: no grant offered to ${context} moves phase ${String(variant.fromPhase)} to ${String(variant.toPhase)}`);
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

function threatResponseProblems(reg: ContentRegistry): string[] {
  const responses = reg.contextCopy.threatResponses;
  const problems = responses.flatMap((response, index) => contextProblems(`contextCopy.threatResponses[${String(index)}]`, response.contexts));
  for (const context of offeredReviewedContexts(reg)) {
    const count = responses.filter((response) => response.contexts.includes(context)).length;
    if (count !== 1) problems.push(`contextCopy.threatResponses: ${context} is offered, so it needs exactly one stated threat response, found ${String(count)}`);
  }
  return problems;
}

export function checkContextCopyIntegrity(reg: ContentRegistry): string[] {
  return [...phaseVariantProblems(reg), ...thresholdProblems(reg), ...bootLineProblems(reg), ...verdictProblems(reg), ...threatResponseProblems(reg)];
}
