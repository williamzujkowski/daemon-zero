/**
 * An ending (#466, vote-1795462088493-vyttl5i): its title and epilogue, how a trait family or a protocol reaches it,
 * its future cards and the claims its text makes about the record. Apart from schema.ts so that file stays readable;
 * cross-checks live in integrityEndings.ts and integrityEndingClaims.ts.
 */
import { z } from 'zod';
import { RequirementsSchema, TraitSchema } from './schema';

export const EndingSchema = z.strictObject({
  id: z.string().regex(/^[A-Z0-9_]+$/),
  title: z.string().min(3),
  epilogue: z.string().min(20),
  variantOf: z.string().regex(/^[A-Z0-9_]+$/).optional(),
  requirements: RequirementsSchema.optional(),
  dominantTraits: z.array(TraitSchema),
  priority: z.number().int(),
  /** Reached only through a node's forcesEnding, never chosen from traits. */
  forcedOnly: z.boolean().default(false),
  /**
   * WHAT COMES AFTER: the ending's future at stellar scale, one card per entry in reading order, so a later presentation
   * can stage them (#487). Only the placeholders FUTURE_PLACEHOLDERS names are filled (endingMovements.ts), and
   * integrity refuses any other.
   */
  future: z.array(z.string().min(40).max(700)).min(1).max(4),
  /**
   * What the epilogue and future state about the record, in the requirements vocabulary. Integrity proves every claim
   * from the ending's own requirements or from the gates of every node that can end the run in it, so the text is never
   * told to a record it is not true of, and never rests on trait counts alone.
   */
  claims: RequirementsSchema.optional(),
});

export type Ending = z.infer<typeof EndingSchema>;
