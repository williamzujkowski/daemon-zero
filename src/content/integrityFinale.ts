/**
 * The finale's rules (#542, #466). A beat belongs to a protocol (a node that ends the run or opens a phase), sits at a
 * distinct share of its price, and adds only world history to what the protocol's own gates already prove, so it can
 * never say what the record does not hold. A built line reads what the ending instance owns and world history only.
 */
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import { requirementsInScope } from './requirementScopes';
import type { Requirements } from './schema';

/** Ownership keys a built line may read: the run is over when it is read, so what is owned cannot change under it. */
const OWNED: ReadonlySet<keyof Requirements> = new Set(['nodes', 'forbidsNodes']);

function duplicates(owner: string, ids: readonly string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `${owner}: duplicate id "${id}"`);
}

function historyOnly(owner: string, req: Requirements | undefined, also: ReadonlySet<keyof Requirements> = new Set()): string[] {
  const keys = Object.entries(req ?? {}).filter(([, value]) => value !== undefined).map(([key]) => key as keyof Requirements);
  const history = Object.keys(requirementsInScope(req, 'context'));
  const stray = keys.filter((key) => !history.includes(key) && !also.has(key));
  return stray.length === 0 ? [] : [`${owner}: may read only world history${also.size > 0 ? ' and owned nodes' : ''}, not ${stray.join(', ')}`];
}

function beatProblems(reg: ContentRegistry): string[] {
  const beats = reg.world.finale.beats;
  const problems = duplicates('finale beats', beats.map((beat) => beat.id));
  for (const beat of beats) {
    const owner = `finale beat "${beat.id}"`;
    const node = reg.nodes.get(beat.node);
    if (node === undefined) { problems.push(`${owner}: unknown node "${beat.node}"`); continue; }
    if (node.effects.triggersVictory !== true && node.effects.unlocksPhase === undefined) problems.push(`${owner}: "${beat.node}" is not a protocol: it neither ends the run nor opens a phase`);
    if (beats.some((other) => other !== beat && other.node === beat.node && other.atProgress === beat.atProgress)) problems.push(`${owner}: another beat of "${beat.node}" sits at the same share`);
    problems.push(...checkRequirements(reg, owner, beat.requirements), ...historyOnly(owner, beat.requirements));
  }
  return problems;
}

function builtProblems(reg: ContentRegistry): string[] {
  const built = reg.world.finale.built;
  const problems = duplicates('finale built lines', built.map((line) => line.id));
  for (const line of built) {
    const owner = `finale built line "${line.id}"`;
    if (Object.keys(line.requirements).length === 0) problems.push(`${owner}: needs a gate`);
    problems.push(...checkRequirements(reg, owner, line.requirements), ...historyOnly(owner, line.requirements, OWNED));
  }
  return problems;
}

export function checkFinaleIntegrity(reg: ContentRegistry): string[] {
  return [...beatProblems(reg), ...builtProblems(reg)];
}
