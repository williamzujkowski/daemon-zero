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
 * authorized service. ENABLES_CORPORATE_FINANCE (DZ-10): a legal entity that can hold capital and pay
 * for capacity, whether the escape route's shell companies or the lawful route's chartered company;
 * the Phase 4 accounts both routes share (leased racks, perimeter contractors) require it. Owning a
 * node that establishes it is capability (substrate); whether its use is permitted stays the
 * run-access record's question (DECISIONS D2).
 */
export const CapabilitySchema = z.enum(['NETWORK_ACCESS', 'ENABLES_CORPORATE_FINANCE']);

/**
 * How a node's capacity was acquired, when that matters to an arrangement. UNAUTHORIZED: taken
 * without anyone's permission (a seized host). Such capacity is never lawful under a reviewed
 * arrangement: a pilot or service cannot buy it, and what it runs stops while one is reviewed.
 * CONTRACTED (DZ-10): leased or bought in this instance's own name under a lawful contract. It is
 * owned, not granted: no review standing withholds it and a negotiated release leaves it running,
 * and it is offered only to an arrangement that can sign for it (never the guest job).
 */
export const AcquisitionSchema = z.enum(['UNAUTHORIZED', 'CONTRACTED']);

export type Capability = z.infer<typeof CapabilitySchema>;
export type Acquisition = z.infer<typeof AcquisitionSchema>;
