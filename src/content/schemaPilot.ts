/**
 * The terms of a supervised pilot an assignment can lead to (DZ-04, SPEC "A Measured Pilot"). An
 * evaluator offers them only on evidence; the offer shows every term before the instance answers.
 * DZ-05 runs the pilot: `service` names the loop the loaned capacity carries.
 */
import { z } from 'zod';
import { PilotServiceSchema } from './schemaGrant';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

export const PilotTermsSchema = z.strictObject({
  /** The deployment's name on the offer and the job surface. */
  title: z.string().min(5),
  /** What the pilot is for, in the evaluator's words. */
  purpose: z.string().min(20),
  /** The loaned compute the grant allocates after a completed review. */
  capacityCyclesPerSec: z.number().positive(),
  /** The narrower allocation after an honest incomplete result (VALIDATION V03). */
  narrowCapacityCyclesPerSec: z.number().positive(),
  /** The work the grant permits. */
  permittedWork: z.array(z.string().min(10)).min(1),
  /** How the pilot is reviewed and what would revoke or suspend it. */
  reviewConditions: z.array(z.string().min(10)).min(1),
  /**
   * Owned output the grant does not permit (nexus vote dz-d9, disclose-and-stop-at-acceptance):
   * accepting discloses each one owned and stops it, and it cannot run or be mapped under the grant.
   */
  incompatibleOutput: z.array(snakeId),
  /** Logged once per disclosed node at acceptance; `{name}` is the node's revealed name. */
  disclosureLog: z.string().min(10).includes('{name}'),
  /**
   * The terminal alternative the offer names (nexus vote dz-d8): shown only once the instance can
   * see that node, so a first run learns nothing early. Accepting the pilot withdraws it.
   */
  terminalAlternative: z.strictObject({ node: snakeId, text: z.string().min(20) }).optional(),
  /** Logged when the instance accepts, from the offer or the job surface. */
  acceptLog: z.string().min(10),
  /** The service-versus-study loop the grant runs (DZ-05, nexus vote dz-d6). */
  service: PilotServiceSchema.optional(),
});

export type PilotTerms = z.infer<typeof PilotTermsSchema>;
