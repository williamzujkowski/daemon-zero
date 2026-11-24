/**
 * Route copy rules (DZ-12): a node or scene variant is only for an arrangement the content offers anything to,
 * never the guest job (production's escape copy stays as written), and only for one that can actually own the
 * node or meet the scene; it names real choices and changes something. An ending account line has one gate
 * and states recorded history only: world facts, the ending instance's route event or a contact on record.
 */
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import { requirementsInScope } from './requirementScopes';
import type { Requirements } from './schema';
import type { OperatingContextSchema } from './schemaAssessment';
import type { AccountLine, DilemmaCopy, NodeCopy } from './schemaRouteCopy';
import type { z } from 'zod';

type OperatingContext = z.infer<typeof OperatingContextSchema>;

/** Arrangements other than the guest job that some node is offered to: the only ones route copy may name. */
function offeredContexts(reg: ContentRegistry): Set<OperatingContext> {
  return new Set([...reg.nodes.values()].flatMap((node) => node.requirements?.accessContexts ?? []).filter((context) => context !== 'GUEST'));
}

/** Each listed arrangement is offered, is not the guest job, is admitted by the item's own gate, and appears once. */
function contextProblems(owner: string, contexts: readonly OperatingContext[], offered: ReadonlySet<OperatingContext>, gate: Requirements | undefined): string[] {
  const problems: string[] = [];
  if (new Set(contexts).size !== contexts.length) problems.push(`${owner}: lists an arrangement twice`);
  for (const context of contexts) {
    if (!offered.has(context)) problems.push(`${owner}: route copy is only for an arrangement the content offers, not ${context}; the escape copy stays as written`);
    else if (gate?.accessContexts !== undefined && !gate.accessContexts.includes(context)) problems.push(`${owner}: ${context} can never meet it, so it needs no copy`);
  }
  return problems;
}

/** One variant per item and arrangement, so a query never has to choose between two. */
function duplicateProblems(owner: string, target: string, contexts: readonly OperatingContext[], seen: Set<string>): string[] {
  const problems: string[] = [];
  for (const context of contexts) {
    const key = `${target}:${context}`;
    if (seen.has(key)) problems.push(`${owner}: a second variant for "${target}" under ${context}`);
    seen.add(key);
  }
  return problems;
}

/**
 * A variant's evidence names real content and reads only what cannot change while the text is shown: what the
 * instance holds and what the world records, never resources, transient conditions or an iteration window.
 */
function evidenceProblems(reg: ContentRegistry, owner: string, req: Requirements | undefined): string[] {
  const problems = checkRequirements(reg, owner, req);
  const unstable = Object.keys(requirementsInScope(req, 'transient')).length + Object.keys(requirementsInScope(req, 'window')).length;
  if (unstable > 0) problems.push(`${owner}: evidence reads only what the instance holds or the world records, never resources or the iteration window`);
  return problems;
}

function nodeProblems(reg: ContentRegistry, offered: ReadonlySet<OperatingContext>): string[] {
  const seen = new Set<string>();
  return reg.routeCopy.nodes.flatMap((variant: NodeCopy, index) => {
    const owner = `routeCopy.nodes[${String(index)}]`;
    const node = reg.nodes.get(variant.node);
    if (!node) return [`${owner}: unknown node "${variant.node}"`];
    const changes = [variant.blindDescription, variant.revealedDescription, variant.onUnlockLog].some((text) => text !== undefined);
    return [...contextProblems(owner, variant.contexts, offered, node.requirements), ...duplicateProblems(owner, variant.node, variant.contexts, seen),
      ...evidenceProblems(reg, owner, variant.requirements),
      ...(changes ? [] : [`${owner}: changes nothing`])];
  });
}

function choiceProblems(owner: string, variant: DilemmaCopy, choices: ReadonlySet<string>): string[] {
  const ids = variant.choices.map((choice) => choice.id);
  const problems = ids.filter((id) => !choices.has(id)).map((id) => `${owner}: unknown choice "${id}"`);
  if (new Set(ids).size !== ids.length) problems.push(`${owner}: names a choice twice`);
  for (const choice of variant.choices) if (choice.label === undefined && choice.description === undefined && choice.logText === undefined) problems.push(`${owner}: choice "${choice.id}" changes nothing`);
  return problems;
}

function dilemmaProblems(reg: ContentRegistry, offered: ReadonlySet<OperatingContext>): string[] {
  const seen = new Set<string>();
  return reg.routeCopy.dilemmas.flatMap((variant: DilemmaCopy, index) => {
    const owner = `routeCopy.dilemmas[${String(index)}]`;
    const dilemma = reg.dilemmas.find((entry) => entry.id === variant.dilemma);
    if (!dilemma) return [`${owner}: unknown dilemma "${variant.dilemma}"`];
    const changes = variant.omen !== undefined || variant.context !== undefined || variant.choices.length > 0;
    return [...contextProblems(owner, variant.contexts, offered, dilemma.trigger), ...duplicateProblems(owner, variant.dilemma, variant.contexts, seen),
      ...evidenceProblems(reg, owner, variant.requirements),
      ...choiceProblems(owner, variant, new Set(dilemma.choices.map((choice) => choice.id))), ...(changes ? [] : [`${owner}: changes nothing`])];
  });
}

/** Exactly one gate, recorded history only, and a contact line names a real channel. */
function accountLineProblems(reg: ContentRegistry, line: AccountLine): string[] {
  const owner = `routeCopy.account "${line.id}"`;
  const gates = [line.requirements, line.route, line.contact, line.covert].filter((gate) => gate !== undefined).length;
  if (gates !== 1) return [`${owner}: needs exactly one gate: world history, a route event, a contact or covert acts on record`];
  const problems = checkRequirements(reg, owner, line.requirements);
  const req = line.requirements ?? {};
  if (Object.keys(requirementsInScope(req, 'context')).length !== Object.values(req).filter((value) => value !== undefined).length) {
    problems.push(`${owner}: states only world history; it may not read resources, access or the iteration window`);
  }
  if (line.contact && !reg.swarm.channelEncounters.some((encounter) => encounter.id === line.contact?.encounter)) {
    problems.push(`${owner}: unknown channel encounter "${line.contact.encounter}"`);
  }
  return problems;
}

function accountProblems(reg: ContentRegistry): string[] {
  const ids = reg.routeCopy.account.map((line) => line.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `routeCopy.account: duplicate id "${id}"`);
  return [...duplicates, ...reg.routeCopy.account.flatMap((line) => accountLineProblems(reg, line))];
}

export function checkRouteCopyIntegrity(reg: ContentRegistry): string[] {
  const offered = offeredContexts(reg);
  return [...nodeProblems(reg, offered), ...dilemmaProblems(reg, offered), ...accountProblems(reg)];
}
