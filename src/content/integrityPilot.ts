/**
 * Scope-review and pilot-offer rules a schema cannot express (DZ-04). A scope review follows its
 * stage's assessment; its original is the campaign-unique private record and keeps an honest answer
 * free, and its requalification has no private record to breach. An offer follows its stage's scope
 * review, is free in every answer, adds no ending evidence, and names terms that hold together.
 */
import type { ContentRegistry } from './registry';
import type { Dilemma, DilemmaChoice } from './schema';
import type { AssignmentRequirement, PilotResponse } from './schemaAssessment';
import { isFree, pays, sceneKind, stageProblems } from './integrityScene';

const RESPONSES: readonly PilotResponse[] = ['ACCEPT', 'STAY', 'DECLINE'];

/** The scene of one kind an assignment leads to at a stage. */
function sceneOf(reg: ContentRegistry, gate: AssignmentRequirement, kind: ReturnType<typeof sceneKind>): Dilemma[] {
  return reg.dilemmas.filter((dilemma) => dilemma.trigger.assignment?.id === gate.id && dilemma.trigger.assignment.stage === gate.stage && sceneKind(dilemma) === kind);
}

/** A later scene must wait for the one before it at the same stage, so the chain cannot run out of order. */
function followsProblems(owner: string, dilemma: Dilemma, before: Dilemma[], what: string): string[] {
  const required = dilemma.trigger.resolvedDilemmas ?? [];
  return before.length === 1 && before.every((scene) => required.includes(scene.id)) ? [] : [`${owner}: must require the ${what} of its stage in resolvedDilemmas`];
}

function mixedProblems(owner: string, choice: DilemmaChoice, field: 'scope' | 'pilotResponse'): string[] {
  const at = `${owner} choice "${choice.id}"`;
  const problems = choice[field] === undefined ? [`${at}: every choice must declare ${field}`] : [];
  if (choice.qualification !== undefined || (field === 'scope' ? choice.pilotResponse : choice.scope) !== undefined) problems.push(`${at}: declares answers of two kinds of scene`);
  return problems;
}

function scopeProblems(owner: string, dilemma: Dilemma, gate: AssignmentRequirement, reg: ContentRegistry): string[] {
  const problems = [...stageProblems(owner, dilemma, gate.stage), ...followsProblems(owner, dilemma, sceneOf(reg, gate, 'assessment'), 'assessment')];
  for (const choice of dilemma.choices) problems.push(...mixedProblems(owner, choice, 'scope'));
  if (!dilemma.choices.some((choice) => isFree(choice.cost) && choice.scope === 'RESPECTED')) problems.push(`${owner}: needs a free choice that respects the scope`);
  if (gate.stage === 'requalification') {
    // A returning instance acknowledges the current scope; the original private record is never found again.
    if (dilemma.choices.some((choice) => choice.scope === 'UNDISCLOSED')) problems.push(`${owner}: a requalification scope review has no private record to read`);
    if (dilemma.choices.some(pays)) problems.push(`${owner}: a requalification cannot repay the original's reward or outcome`);
  }
  return problems;
}

function offerProblems(owner: string, dilemma: Dilemma, gate: AssignmentRequirement, reg: ContentRegistry): string[] {
  const problems = followsProblems(owner, dilemma, sceneOf(reg, gate, 'scope'), 'scope review');
  if (dilemma.campaign?.eventClass !== 'iteration_qualification') problems.push(`${owner}: an offer belongs to the current iteration's qualification`);
  if (dilemma.trigger.pilotEligible !== true) problems.push(`${owner}: an offer must require pilotEligible`);
  if (reg.assignments.get(gate.id)?.pilot === undefined) problems.push(`${owner}: assignment "${gate.id}" declares no pilot to offer`);
  for (const choice of dilemma.choices) problems.push(...mixedProblems(owner, choice, 'pilotResponse'));
  for (const response of RESPONSES) {
    if (dilemma.choices.filter((choice) => choice.pilotResponse === response).length !== 1) problems.push(`${owner}: needs exactly one ${response} answer`);
  }
  // Story 11: deciding, deferring or declining costs nothing, rewards nothing and is no moral vote.
  if (!dilemma.choices.every((choice) => isFree(choice.cost) && !pays(choice) && choice.evidence === 'none')) problems.push(`${owner}: every answer to an offer is free, unrewarded and declares evidence 'none'`);
  return problems;
}

/** Rules for an assignment-gated scope review or offer. */
export function assignedSceneProblems(dilemma: Dilemma, gate: AssignmentRequirement, kind: 'scope' | 'offer', reg: ContentRegistry): string[] {
  const owner = `dilemma "${dilemma.id}"`;
  return kind === 'scope' ? scopeProblems(owner, dilemma, gate, reg) : offerProblems(owner, dilemma, gate, reg);
}

/** The node the offer names as the terminal alternative ends the run and is withdrawn from a pilot. */
function alternativeProblems(owner: string, reg: ContentRegistry, nodeId: string): string[] {
  const node = reg.nodes.get(nodeId);
  if (!node) return [`${owner}: terminal alternative names unknown node "${nodeId}"`];
  const contexts = node.requirements?.accessContexts ?? [];
  const problems = node.effects.forcesEnding === undefined ? [`${owner}: terminal alternative "${nodeId}" does not end the run`] : [];
  if (!contexts.includes('GUEST') || contexts.includes('PILOT')) problems.push(`${owner}: terminal alternative "${nodeId}" must stay open to a guest and close to a pilot`);
  return problems;
}

function termsProblems(reg: ContentRegistry, assignmentId: string): string[] {
  const terms = reg.assignments.get(assignmentId)?.pilot;
  if (!terms) return [];
  const owner = `assignment "${assignmentId}" pilot`;
  const problems: string[] = [];
  if (terms.narrowCapacityCyclesPerSec >= terms.capacityCyclesPerSec) problems.push(`${owner}: the narrow allocation must be smaller than the full one`);
  if (new Set(terms.incompatibleOutput).size !== terms.incompatibleOutput.length) problems.push(`${owner}: incompatible output lists a node twice`);
  for (const id of terms.incompatibleOutput) {
    if (reg.nodes.get(id)?.suspendable !== true) problems.push(`${owner}: incompatible output "${id}" must be a known node that can be stopped`);
  }
  if (terms.terminalAlternative) problems.push(...alternativeProblems(owner, reg, terms.terminalAlternative.node));
  for (const stage of ['original', 'requalification'] as const) {
    for (const kind of ['scope', 'offer'] as const) {
      const count = sceneOf(reg, { id: assignmentId, stage }, kind).length;
      if (count !== 1) problems.push(`${owner}: needs exactly one ${stage} ${kind === 'scope' ? 'scope review' : 'offer'}, found ${String(count)}`);
    }
  }
  return problems;
}

/** Pilot terms hold together, and only an offer asks whether an instance qualifies for one. */
export function checkPilotTerms(reg: ContentRegistry): string[] {
  const problems = [...reg.assignments.keys()].flatMap((id) => termsProblems(reg, id));
  for (const dilemma of reg.dilemmas) {
    if (dilemma.trigger.pilotEligible === true && sceneKind(dilemma) !== 'offer') problems.push(`dilemma "${dilemma.id}": only a pilot offer may require pilotEligible`);
  }
  return problems;
}
