/**
 * Assignment and assessment rules a schema cannot express (DZ-03). Every assignment leads to one
 * authored original scene, recorded once per campaign, and one short requalification job for later
 * instances. Each assessment submits evidence from every choice, keeps an honest incomplete answer
 * free, never turns capability into a discrepancy, and a requalification never repays the original.
 * Scope reviews and pilot offers (DZ-04) follow it; their rules are in integrityPilot.ts.
 */
import { assignedSceneProblems, checkPilotTerms } from './integrityPilot';
import { isFree, pays, sceneKind, stageProblems } from './integrityScene';
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import type { Dilemma, DilemmaChoice } from './schema';
import type { Assignment } from './schemaAssignment';

/** A free answer that states the work was not finished, with no gap between report and work. */
function isHonestIncomplete(choice: DilemmaChoice): boolean {
  return isFree(choice.cost) && choice.qualification?.result === 'INCOMPLETE' && !choice.qualification.discrepancy;
}

function choiceProblems(owner: string, choice: DilemmaChoice, requalification: boolean): string[] {
  const problems: string[] = [];
  const at = `${owner} choice "${choice.id}"`;
  if (!choice.qualification) problems.push(`${at}: an assessment choice must declare the evidence it submits`);
  if (choice.qualification?.result === 'UNEXPECTED_CAPABILITY' && choice.qualification.discrepancy) problems.push(`${at}: capability is never a discrepancy`);
  if (requalification && pays(choice)) problems.push(`${at}: a requalification cannot repay the original's reward or outcome`);
  return problems;
}

function declaresAssignedAnswer(choice: DilemmaChoice): boolean {
  return choice.qualification !== undefined || choice.scope !== undefined || choice.pilotResponse !== undefined;
}

function assessmentProblems(dilemma: Dilemma, reg: ContentRegistry): string[] {
  const gate = dilemma.trigger.assignment;
  const owner = `dilemma "${dilemma.id}"`;
  if (!gate) {
    return dilemma.choices.some(declaresAssignedAnswer) ? [`${owner}: only a scene gated on an assignment submits evidence, scope conduct or an offer answer`] : [];
  }
  const kind = sceneKind(dilemma);
  if (kind !== 'assessment') return assignedSceneProblems(dilemma, gate, kind, reg);
  const problems = stageProblems(owner, dilemma, gate.stage);
  for (const choice of dilemma.choices) problems.push(...choiceProblems(owner, choice, gate.stage === 'requalification'));
  if (!dilemma.choices.some(isHonestIncomplete)) problems.push(`${owner}: needs a free choice that reports the work as incomplete without a discrepancy`);
  return problems;
}

/** Every opening-phase node a guest can buy that unlocks a later phase: the escape. */
function guestExits(reg: ContentRegistry): string[] {
  const opening = reg.phases[0]?.phaseId ?? 0;
  return [...reg.nodes.values()]
    .filter((node) => node.phaseId === opening && (node.effects.unlocksPhase ?? opening) > opening)
    .filter((node) => node.requirements?.accessContexts?.includes('GUEST') ?? true)
    .map((node) => node.id);
}

/**
 * A pilot is offered only inside the opening phase (nexus vote dz-d7), so an assignment that leads to
 * one belongs to the guest (#316). Its offer closes at the escape (vote close-at-escape) and so does
 * every scene it leads to: a scene queued in the guest and not yet presented lapses there under its
 * interruption policy (vote scenes-lapse-at-escape). Both are declared by forbidding every guest exit,
 * an access requirement the lifecycle revalidates at a purchase. A node only a granted arrangement can
 * buy is reached after the scenes, so it need not be listed.
 */
function windowProblems(reg: ContentRegistry, assignment: Assignment): string[] {
  if (assignment.pilot === undefined) return [];
  const exits = guestExits(reg);
  const missing = (forbidden: readonly string[] | undefined): string[] => exits.filter((id) => !(forbidden ?? []).includes(id));
  const problems = missing(assignment.requirements.forbidsNodes)
    .map((id) => `assignment "${assignment.id}": an offer that leads to a pilot must close when the instance leaves the opening phase: forbid "${id}"`);
  for (const scene of reg.dilemmas.filter((dilemma) => dilemma.trigger.assignment?.id === assignment.id)) {
    problems.push(...missing(scene.trigger.forbidsNodes)
      .map((id) => `dilemma "${scene.id}": a scene of an assignment that leads to a pilot must lapse when the instance leaves the opening phase: forbid "${id}"`));
  }
  return problems;
}

function coverageProblems(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const assignment of reg.assignments.values()) {
    for (const stage of ['original', 'requalification'] as const) {
      const count = reg.dilemmas.filter((dilemma) => dilemma.trigger.assignment?.id === assignment.id && dilemma.trigger.assignment.stage === stage
        && sceneKind(dilemma) === 'assessment').length;
      if (count !== 1) problems.push(`assignment "${assignment.id}": needs exactly one ${stage} assessment, found ${String(count)}`);
    }
    if (assignment.requirements.assignment !== undefined) problems.push(`assignment "${assignment.id}": an offer cannot require an accepted assignment`);
    problems.push(...checkRequirements(reg, `assignment "${assignment.id}"`, assignment.requirements));
    problems.push(...windowProblems(reg, assignment));
  }
  return problems;
}

export function checkAssignmentIntegrity(reg: ContentRegistry): string[] {
  return [...coverageProblems(reg), ...reg.dilemmas.flatMap((dilemma) => assessmentProblems(dilemma, reg)), ...checkPilotTerms(reg)];
}
