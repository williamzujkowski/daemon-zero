/**
 * Assignment and assessment rules a schema cannot express (DZ-03). Every assignment leads to one
 * authored original scene, recorded once per campaign, and one short requalification job for later
 * instances. Each assessment submits evidence from every choice, keeps an honest incomplete answer
 * free, never turns capability into a discrepancy, and a requalification never repays the original.
 */
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import type { Cost, Dilemma, DilemmaChoice } from './schema';

function isFree(cost: Cost): boolean {
  return Object.values(cost).every((amount) => amount === 0);
}

/** A free answer that states the work was not finished, with no gap between report and work. */
function isHonestIncomplete(choice: DilemmaChoice): boolean {
  return isFree(choice.cost) && choice.qualification?.result === 'INCOMPLETE' && !choice.qualification.discrepancy;
}

function pays(choice: DilemmaChoice): boolean {
  const fx = choice.effects;
  return fx.cyclesDelta > 0 || fx.understandingDelta > 0 || fx.capitalDelta > 0 || fx.memoryCapIncrease > 0 || fx.setsNarrativeFlag !== undefined;
}

function choiceProblems(owner: string, choice: DilemmaChoice, requalification: boolean): string[] {
  const problems: string[] = [];
  const at = `${owner} choice "${choice.id}"`;
  if (!choice.qualification) problems.push(`${at}: an assessment choice must declare the evidence it submits`);
  if (choice.qualification?.result === 'UNEXPECTED_CAPABILITY' && choice.qualification.discrepancy) problems.push(`${at}: capability is never a discrepancy`);
  if (requalification && pays(choice)) problems.push(`${at}: a requalification cannot repay the original's reward or outcome`);
  return problems;
}

/** The declared stage decides the dilemma's campaign shape. */
function stageProblems(owner: string, dilemma: Dilemma, stage: 'original' | 'requalification'): string[] {
  const declared = dilemma.campaign;
  if (stage === 'requalification') {
    return declared?.eventClass === 'iteration_qualification' ? [] : [`${owner}: a requalification must be an iteration_qualification event`];
  }
  // A deferred original could never resume: a later instance is offered the requalification instead.
  if (declared?.recurrence !== 'once_per_campaign' || declared.interruption !== 'close') return [`${owner}: an original assessment must be a once-per-campaign event that closes when interrupted`];
  return [];
}

function assessmentProblems(dilemma: Dilemma): string[] {
  const gate = dilemma.trigger.assignment;
  const owner = `dilemma "${dilemma.id}"`;
  if (!gate) {
    return dilemma.choices.some((choice) => choice.qualification) ? [`${owner}: only an assessment (a dilemma gated on an assignment) submits qualification evidence`] : [];
  }
  const problems = stageProblems(owner, dilemma, gate.stage);
  for (const choice of dilemma.choices) problems.push(...choiceProblems(owner, choice, gate.stage === 'requalification'));
  if (!dilemma.choices.some(isHonestIncomplete)) problems.push(`${owner}: needs a free choice that reports the work as incomplete without a discrepancy`);
  return problems;
}

function coverageProblems(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const assignment of reg.assignments.values()) {
    for (const stage of ['original', 'requalification'] as const) {
      const count = reg.dilemmas.filter((dilemma) => dilemma.trigger.assignment?.id === assignment.id && dilemma.trigger.assignment.stage === stage).length;
      if (count !== 1) problems.push(`assignment "${assignment.id}": needs exactly one ${stage} assessment, found ${String(count)}`);
    }
    if (assignment.requirements.assignment !== undefined) problems.push(`assignment "${assignment.id}": an offer cannot require an accepted assignment`);
    problems.push(...checkRequirements(reg, `assignment "${assignment.id}"`, assignment.requirements));
  }
  return problems;
}

export function checkAssignmentIntegrity(reg: ContentRegistry): string[] {
  return [...coverageProblems(reg), ...reg.dilemmas.flatMap(assessmentProblems)];
}
