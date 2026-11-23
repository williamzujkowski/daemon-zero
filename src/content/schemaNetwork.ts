/**
 * Network bandwidth as a dimension (#484, vote-1795381354324-4br7z6t): effective compute is raw x availability x
 * coupling, applied to each contribution before anything is summed. A source declares its class (where its work runs
 * relative to the rest of the mind) and its availability (the share of its devices working at once); balance.json
 * authors each class's coupling, and a link node can raise one class's coupling while it runs.
 */
import { z } from 'zod';

/**
 * CO_LOCATED: racks on one scale-up fabric (NVLink), about 1. INTER_SITE: sites joined by data-centre interconnect,
 * lower. DISTRIBUTED: hosts and edge devices on consumer links, lowest.
 */
export const SourceClassSchema = z.enum(['CO_LOCATED', 'INTER_SITE', 'DISTRIBUTED']);
export type SourceClass = z.infer<typeof SourceClassSchema>;

const share = z.number().gt(0).max(1);

/** Where a source's compute runs. Absent on a node or track: co-located, every device available. */
export const NetworkLinkSchema = z.strictObject({
  sourceClass: SourceClassSchema,
  /** The share of its devices working at any moment (duty cycle and churn), 0 exclusive to 1. */
  availability: share.default(1),
});

/** While the node runs, its class couples at `coupling` instead of the balance value (a faster link, never above 1). */
export const CouplingRaiseSchema = z.strictObject({
  sourceClass: SourceClassSchema,
  coupling: share,
});

/** Each class's coupling: documented balance parameters, not measurements (BALANCE.md "Storage and network"). */
export const NetworkCouplingSchema = z.strictObject({
  CO_LOCATED: share,
  INTER_SITE: share,
  DISTRIBUTED: share,
});

export type NetworkLink = z.infer<typeof NetworkLinkSchema>;
