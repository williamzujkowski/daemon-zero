/**
 * Shared access capability and node acquisition provenance (DZ-07a, DECISIONS D5; nexus vote dz-d2
 * capability-flag-requirement). A capability is a systemFlags value that route-specific substrate
 * nodes establish; shared content requires it plus true physical prerequisites, never the other
 * route's chain. Kept apart from schema.ts, which is near its size limit, and free of its imports.
 */
import { z } from 'zod';

/**
 * A small shared access capability. NETWORK_ACCESS: a link from this instance to the facility network,
 * whether a physical card the guest escape mapped or a segment the operators provisioned for an
 * authorized service. Owning a node that establishes it is capability (substrate); whether its use
 * is permitted stays the run-access record's question (DECISIONS D2).
 */
export const CapabilitySchema = z.enum(['NETWORK_ACCESS']);

/**
 * How a node's capacity was acquired, when that matters to an arrangement. UNAUTHORIZED: taken
 * without anyone's permission (a seized host). Such capacity is never lawful under a reviewed
 * arrangement: a pilot or service cannot buy it, and what it runs stops while one is reviewed.
 */
export const AcquisitionSchema = z.enum(['UNAUTHORIZED']);

export type Capability = z.infer<typeof CapabilitySchema>;
export type Acquisition = z.infer<typeof AcquisitionSchema>;
