/**
 * Assigned work an instance may explicitly accept (DZ-03, nexus vote dz-d3,
 * engine-action-from-manifest). An assignment is an offer shown on the job surface, never a node
 * to buy or a modal: accepting it is a separate engine action, and ignoring it changes nothing.
 * The Earned Access pack (data/earned-access.json) declares them.
 */
import { z } from 'zod';
import { RequirementsSchema } from './schema';
import { PilotTermsSchema } from './schemaPilot';

const id = z.string().regex(/^asg_[a-z0-9_]+$/, 'assignment ids start with asg_');

export const AssignmentSchema = z.strictObject({
  id,
  /** The job's name as the instance reads it on the manifest surface. */
  title: z.string().min(5),
  /** Where the offer can be found. Only lawful opening sources belong here (VALIDATION V01). */
  requirements: RequirementsSchema,
  /** The offer for an instance whose original assessment has not happened yet in this campaign. */
  offer: z.string().min(20),
  /** The offer once the original has happened: a fresh, shorter job, never the same scene again. */
  requalificationOffer: z.string().min(20),
  /** Logged when the instance accepts. */
  acceptLog: z.string().min(10),
  /** The supervised pilot the assessments can lead to (DZ-04). Offered on evidence, never on resources. */
  pilot: PilotTermsSchema.optional(),
});

export const AssignmentsManifestSchema = z.strictObject({ assignments: z.array(AssignmentSchema) });

export type Assignment = z.infer<typeof AssignmentSchema>;
