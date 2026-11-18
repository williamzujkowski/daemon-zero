/**
 * Assessment vocabulary shared by requirements, dilemma choices and the saved access record
 * (DZ-03, nexus vote dz-d3 engine-action-from-manifest). Kept free of schema.ts imports, so
 * schema.ts can embed these without a cycle; the assignment manifest itself is schemaAssignment.ts.
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

/**
 * Which assessment an accepted assignment leads to in this iteration. 'original' is the authored,
 * once-per-campaign scene; 'requalification' is the short routine job a later instance gets once
 * the original occurrence has happened (NARRATIVE-HISTORY N12). The engine derives the stage from
 * the original's campaign record; content only says which stage a dilemma belongs to.
 */
export const AssessmentStageSchema = z.enum(['original', 'requalification']);

/** Requirement: this instance accepted the assignment, and it leads to this stage now. */
export const AssignmentRequirementSchema = z.strictObject({ id, stage: AssessmentStageSchema });

/** What a submitted result claims (DECISIONS D3): done, not done, or done beyond the expected scope. */
export const QualificationResultSchema = z.enum(['COMPLETED', 'INCOMPLETE', 'UNEXPECTED_CAPABILITY']);

/**
 * The evidence a choice submits to the run's current qualification record. `discrepancy` is true
 * when the report disagrees with what was actually done; the choice itself is the campaign record.
 */
export const ChoiceQualificationSchema = z.strictObject({ result: QualificationResultSchema, discrepancy: z.boolean() });

export type AssessmentStage = z.infer<typeof AssessmentStageSchema>;
export type AssignmentRequirement = z.infer<typeof AssignmentRequirementSchema>;
export type QualificationResult = z.infer<typeof QualificationResultSchema>;
export type ChoiceQualification = z.infer<typeof ChoiceQualificationSchema>;
