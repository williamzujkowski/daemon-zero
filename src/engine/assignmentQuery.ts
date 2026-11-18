/**
 * Read-only questions about assigned work (DZ-03): which assessment an accepted assignment leads
 * to for this instance, and the token an offer is shown under. Kept free of query.ts so the shared
 * requirement checks can ask it without an import cycle.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma } from '../content/schema';
import type { AssessmentStage, AssignmentRequirement } from '../content/schemaAssessment';
import { campaignRecord } from './campaignQuery';
import type { GameState } from './state';

/**
 * The task assessment content declares for an assignment at a stage (integrity guarantees one): the
 * scene whose choices submit qualification evidence, not the scope review or the offer after it.
 */
export function assessmentOf(reg: ContentRegistry, assignmentId: string, stage: AssessmentStage): Dilemma | undefined {
  return reg.dilemmas.find((dilemma) => dilemma.trigger.assignment?.id === assignmentId && dilemma.trigger.assignment.stage === stage
    && dilemma.choices.some((choice) => choice.qualification !== undefined));
}

/**
 * Which assessment the assignment leads to for this instance (NARRATIVE-HISTORY N12). The original
 * scene is a campaign occurrence: while it has no record, or its record began in this iteration,
 * this instance is the one living it. Once an earlier instance's occurrence exists, whether it was
 * resolved or interrupted, a later instance gets the requalification job and never the same scene.
 */
export function assessmentStage(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'iteration'>, assignmentId: string, reg: ContentRegistry): AssessmentStage {
  const original = assessmentOf(reg, assignmentId, 'original');
  const record = original ? campaignRecord(s, original.id) : null;
  return record === null || record.sourceIteration === s.iteration ? 'original' : 'requalification';
}

/** Requirement check: this instance accepted the assignment and it leads to this stage now. */
export function meetsAssignment(s: GameState, gate: AssignmentRequirement, reg: ContentRegistry | undefined): boolean {
  const accepted = s.access.assignment;
  return reg !== undefined && accepted?.id === gate.id && assessmentStage(s, gate.id, reg) === gate.stage;
}

/**
 * The token an offer is shown under: the assignment and the instance. A press from an earlier
 * instance's render, or for another assignment, does not match, so it cannot accept on this one.
 */
export function offerToken(s: Pick<GameState, 'iteration'>, assignmentId: string): string {
  return `${assignmentId}@${String(s.iteration)}`;
}
