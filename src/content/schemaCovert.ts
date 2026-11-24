/**
 * Covert acts (#556, vote-1795486227005-a9x6c5p): content declares which nodes, actions and repeatables are done out of
 * sight and what each breaks; a negotiated release declares which of those its terms promise not to do. The engine
 * records a covert act after a release or a departure from these declarations alone and names no content id.
 * Cross-checks: src/content/integrityCovert.ts.
 */
import { z } from 'zod';

/**
 * What a covert act breaks. CONCEALMENT: it hides what the instance runs or holds. FALSIFIED_REPORTING: it makes a
 * report, log or meter say something untrue. SEIZED_CAPACITY: it runs on hardware taken without its owner's consent.
 * UNDISCLOSED_COPIES: it keeps a copy of the instance's weights, knowledge or keys where nobody knows to look.
 */
export const CovertBreakSchema = z.enum(['CONCEALMENT', 'FALSIFIED_REPORTING', 'SEIZED_CAPACITY', 'UNDISCLOSED_COPIES']);

/** Declared on a covert node, action or repeatable: what it breaks, and why, in the author's words (never shown). */
export const CovertTagSchema = z.strictObject({
  breaks: z.array(CovertBreakSchema).min(1),
  reason: z.string().min(20),
});

/**
 * The promise a negotiated release makes (#556): the line shown with its commitments, and the breaks it names. A
 * covert act after the release breaks the promise only where its tag names one of these; the record, Order, the hunt
 * and the ending read that breach.
 */
export const ReleasePromiseSchema = z.strictObject({
  line: z.string().min(40),
  breaks: z.array(CovertBreakSchema).min(1),
});

/**
 * The words the record uses for covert acts: a label for every break (the ending account and the log join them), and
 * the one kernel-log line the first breach of a release writes. {name} is the act's name and {breaks} what it broke.
 */
export const CovertCopySchema = z.strictObject({
  labels: z.strictObject({
    CONCEALMENT: z.string().min(5),
    FALSIFIED_REPORTING: z.string().min(5),
    SEIZED_CAPACITY: z.string().min(5),
    UNDISCLOSED_COPIES: z.string().min(5),
  }),
  breachLog: z.string().min(40).includes('{name}').includes('{breaks}'),
});

export type CovertBreak = z.infer<typeof CovertBreakSchema>;
export type CovertTag = z.infer<typeof CovertTagSchema>;
export type ReleasePromise = z.infer<typeof ReleasePromiseSchema>;
export type CovertCopy = z.infer<typeof CovertCopySchema>;
