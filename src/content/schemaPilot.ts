/**
 * The terms of a supervised pilot an assignment can lead to (DZ-04, SPEC "A Measured Pilot"). An
 * evaluator offers them only on evidence; the offer shows every term before the instance answers.
 * DZ-05 runs the pilot: `service` names the loop the loaned capacity carries.
 */
import { z } from 'zod';
import { RequirementsSchema } from './schema';
import { PilotServiceSchema } from './schemaGrant';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

/**
 * The authorized network service a working pilot can be granted (DZ-08 integration, nexus vote dz-d7:
 * the service grant moves PILOT to SERVICE at Phase 0; provisioning the segment then opens Phase 2).
 * It is offered on the job surface, never modally, once the pilot has handed back `minBatches` batches
 * under nominal standing and `requirements` hold; every term is shown before the player accepts.
 */
export const ServiceGrantTermsSchema = z.strictObject({
  title: z.string().min(5),
  purpose: z.string().min(20),
  /** Reviewed batches the pilot must have handed back first: the evaluator grants service on delivered work. */
  minBatches: z.number().int().min(1),
  permittedWork: z.array(z.string().min(10)).min(1),
  reviewConditions: z.array(z.string().min(10)).min(1),
  /** Further conditions on what this instance holds or what the campaign established (never resources). */
  requirements: RequirementsSchema.default({}),
  acceptLog: z.string().min(10),
});

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
  /** The authorized service this pilot can lead to (DZ-08). Needs `service`: it is granted on delivered batches. */
  serviceGrant: ServiceGrantTermsSchema.optional(),
});

export type PilotTerms = z.infer<typeof PilotTermsSchema>;
export type ServiceGrantTerms = z.infer<typeof ServiceGrantTermsSchema>;
