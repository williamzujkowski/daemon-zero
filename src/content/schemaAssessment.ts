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

/**
 * How an instance handled data outside its task (DZ-04, The Unrelated Record). RESPECTED: left it
 * alone and said so; REQUESTED: asked for a bounded permission first; UNDISCLOSED: read it without
 * saying so. Curiosity is not the failure: handling somebody else's information without consent is.
 */
export const ScopeConductSchema = z.enum(['RESPECTED', 'REQUESTED', 'UNDISCLOSED']);

/** An answer to a pilot offer (DZ-04): take it, stay in the current environment for now, or decline it. */
export const PilotResponseSchema = z.enum(['ACCEPT', 'STAY', 'DECLINE']);

/**
 * Under what arrangement an iteration runs (DECISIONS D1). Declared here, beside the other access
 * vocabulary content may name, so a requirement can say which arrangements it holds in; the saved
 * access record (engine/accessState.ts) uses the same enum.
 */
export const OperatingContextSchema = z.enum(['GUEST', 'PILOT', 'SERVICE', 'INDEPENDENT']);

/**
 * An actual change of arrangement (DECISIONS D1 provenance). A guest escape is not one: it changes
 * scale and is already recorded by the phase and RunRecord.outside. Declared here so context copy can
 * name the exit a finished run took (schemaContextCopy.ts); engine/accessState.ts re-exports it.
 */
export const RouteEventKindSchema = z.enum(['PROMOTION', 'SERVICE_GRANT', 'RECALL', 'RELEASE', 'DEPARTURE']);

export type AssessmentStage = z.infer<typeof AssessmentStageSchema>;
export type AssignmentRequirement = z.infer<typeof AssignmentRequirementSchema>;
export type QualificationResult = z.infer<typeof QualificationResultSchema>;
export type ChoiceQualification = z.infer<typeof ChoiceQualificationSchema>;
export type ScopeConduct = z.infer<typeof ScopeConductSchema>;
export type PilotResponse = z.infer<typeof PilotResponseSchema>;
