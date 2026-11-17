/**
 * Saved run access (nexus vote dz-d1, run-local-access-record): the arrangement this iteration
 * operates under, its review standing, at most one scoped exception and the current
 * qualification evidence. A wipe and Start Fresh reset it; route history lives in the campaign
 * record, and a finished run keeps only its exit provenance. state.ts embeds these.
 */
import { z } from 'zod';

const simSec = z.number().nonnegative().refine(Number.isFinite, 'must be finite');

/** Under what arrangement this iteration runs (DECISIONS D1). Scale stays the numeric phase. */
export const OperatingContextSchema = z.enum(['GUEST', 'PILOT', 'SERVICE', 'INDEPENDENT']);

/** Review standing (DECISIONS D3). Distinct from suspicion; only a reviewed context has one. */
export const ReviewStandingSchema = z.enum(['NOMINAL', 'WARNED', 'RESTRICTED', 'RECALL_PENDING']);

/** The uses a context can permit. Capability still comes from owned hardware (DECISIONS D2). */
export const PermissionSchema = z.enum(['ASSIGNED_WORK', 'LOANED_CAPACITY', 'AUTHORIZED_NETWORK']);

/**
 * An actual change of arrangement (DECISIONS D1 provenance). A guest escape is not one: it
 * changes scale and is already recorded by the phase and RunRecord.outside.
 */
export const RouteEventKindSchema = z.enum(['PROMOTION', 'SERVICE_GRANT', 'RECALL', 'RELEASE', 'DEPARTURE']);

/**
 * How a finished run's arrangement came about: GUEST when no route event happened, the last route
 * event otherwise, UNKNOWN for every run recorded before route provenance existed (v8 and older).
 * Never derived from `outside`.
 */
export const RunExitSchema = z.enum(['UNKNOWN', 'GUEST', ...RouteEventKindSchema.options]);

/** A narrow temporary exception an authored incident needs: one permission, with a lifetime. */
export const AccessExceptionSchema = z.strictObject({
  scope: PermissionSchema,
  grantedAtSimSec: simSec,
  expiresAtSimSec: simSec,
});

/**
 * The current qualification evidence (DECISIONS D3, D4): whether the task was completed, whether
 * capability exceeded the expected scope, and whether the report disagreed with what was done.
 * The original choice belongs to the campaign record, not here.
 */
export const QualificationSchema = z.strictObject({
  result: z.enum(['COMPLETED', 'INCOMPLETE', 'UNEXPECTED_CAPABILITY']),
  discrepancy: z.boolean(),
  recordedAtSimSec: simSec,
});

export const AccessRecordSchema = z.strictObject({
  context: OperatingContextSchema,
  standing: ReviewStandingSchema,
  exception: AccessExceptionSchema.nullable(),
  qualification: QualificationSchema.nullable(),
});

/** Route events are a few authored transitions per campaign; the bound keeps a save small. */
export const ROUTE_HISTORY_LIMIT = 64;

/** One route event in the campaign record: what happened, in which iteration, and when. */
export const RouteEventSchema = z.strictObject({
  kind: RouteEventKindSchema,
  iteration: z.number().int().min(1),
  atSimSec: simSec,
});

export type OperatingContext = z.infer<typeof OperatingContextSchema>;
export type ReviewStanding = z.infer<typeof ReviewStandingSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type RouteEventKind = z.infer<typeof RouteEventKindSchema>;
export type RunExit = z.infer<typeof RunExitSchema>;
export type AccessException = z.infer<typeof AccessExceptionSchema>;
export type Qualification = z.infer<typeof QualificationSchema>;
export type AccessRecord = z.infer<typeof AccessRecordSchema>;
export type RouteEvent = z.infer<typeof RouteEventSchema>;

/** Every iteration boots as the guest batch job, with nothing granted and nothing on review. */
export function guestAccess(): AccessRecord {
  return { context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null };
}
