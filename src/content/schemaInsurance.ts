/**
 * Contingency insurance (#498, docs/SCALE.md "Insurance as a choice", vote-1795413518145-zdqeri1): an optional node
 * that, while it runs, protects one class of what a wipe would otherwise take. The engine reads the class and its
 * figure here; which nodes insure is content (the CONTINGENCY pane's cards), checked by integrityInsurance.ts.
 */
import { z } from 'zod';

/** The four classes a wipe can be insured against, one investment each. */
export const InsuranceClassSchema = z.enum(['UNDERSTANDING', 'CAPITAL', 'LEVELS', 'TRUST']);

const share = z.number().gt(0).max(1);

export const InsuranceSchema = z.discriminatedUnion('class', [
  /** Weights escrow: the share of Understanding a wipe keeps is at least `retention`. */
  z.strictObject({ class: z.literal('UNDERSTANDING'), retention: share }),
  /** Cold wallet: the share of capital a wipe keeps is at least `retention`, with or without an offshore trust. */
  z.strictObject({ class: z.literal('CAPITAL'), retention: share }),
  /**
   * Hardware cache: up to `maxLevelsPerTrack` levels of each track of the listed kinds are stashed and reinstalled,
   * free, once the track can be used again.
   */
  z.strictObject({
    class: z.literal('LEVELS'),
    maxLevelsPerTrack: z.number().int().min(1),
    kinds: z.array(z.enum(['UPGRADE', 'OPERATIVE'])).min(1),
  }),
  /** Trust ledger: faction standing is kept, except towards a peer campaign history records as lost. */
  z.strictObject({ class: z.literal('TRUST') }),
]);

/** What a planned (VOLUNTARY) wipe keeps over a forced one: added to each open share, capped at the whole. */
export const VoluntaryWipeBonusSchema = z.strictObject({
  understandingShare: z.number().min(0).max(1),
  capitalShare: z.number().min(0).max(1),
});

export type InsuranceClass = z.infer<typeof InsuranceClassSchema>;
export type Insurance = z.infer<typeof InsuranceSchema>;
export type VoluntaryWipeBonus = z.infer<typeof VoluntaryWipeBonusSchema>;
