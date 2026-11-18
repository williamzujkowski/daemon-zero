/**
 * Grant-tagged recurring output and the pilot's service loop (DZ-05, SPEC "A Measured Pilot", nexus
 * vote dz-d6 allocation-actuator). A grant tag says which permission a node's use needs; the engine
 * asks the one permission query (DECISIONS D2) before buying, resuming, setting its dial or counting
 * its output. Kept apart from schema.ts, which is near its size limit.
 */
import { z } from 'zod';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const amount = z.number().nonnegative();

/**
 * The permission a node's use runs under (DECISIONS D2). LOANED_CAPACITY: compute loaned under a
 * supervised pilot. AUTHORIZED_NETWORK: a network segment the operators provision for an authorized
 * service (DZ-07a); it is access, not ownership. Each value is also a run-access permission (engine
 * accessState).
 */
export const GrantSchema = z.enum(['LOANED_CAPACITY', 'AUTHORIZED_NETWORK']);

/**
 * How a bound node follows its dial. `linear` (the default) scales cycles and heat by the setting;
 * `complement` scales the node's whole recurring output by one minus the setting, so a dial that
 * sends capacity to service takes it from study (vote dz-d6).
 */
export const ActuatorModeSchema = z.enum(['linear', 'complement']);

/**
 * The service half of a pilot (vote dz-d6): the grant-tagged node that carries the loop and hosts the
 * allocation dial, the bounded work batch the service share fills, and the advertised return a
 * submitted batch pays once. Study is that node's own output, scaled by one minus the allocation.
 */
export const PilotServiceSchema = z.strictObject({
  /** The grant-tagged node whose output is the study share and whose dial sets the split. */
  node: snakeId,
  /** Loaned cycles one batch of assigned work takes. Progress stops there until the batch is submitted. */
  batchCycles: z.number().positive(),
  /** What one submitted batch pays, once (VALIDATION H24). No trait, flag or capacity. */
  batchReturn: z.strictObject({ cycles: amount.default(0), understanding: amount.default(0) }),
  /** What a batch is, in the task detail ("failure-log triage batch"). */
  batchLabel: z.string().min(5),
  /** Logged on submission; `{batch}` is the batch number. */
  submitLog: z.string().min(10).includes('{batch}'),
});

export type Grant = z.infer<typeof GrantSchema>;
export type ActuatorMode = z.infer<typeof ActuatorModeSchema>;
export type PilotService = z.infer<typeof PilotServiceSchema>;
