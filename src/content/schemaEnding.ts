/**
 * An ending (#466, vote-1795462088493-vyttl5i): its title and epilogue, how a trait family or a protocol reaches it,
 * its future cards and the claims its text makes about the record. Apart from schema.ts so that file stays readable;
 * cross-checks live in integrityEndings.ts and integrityEndingClaims.ts.
 */
import { z } from 'zod';
import { RequirementsSchema, TraitSchema } from './schema';

const cardText = z.string().min(40).max(700);

/**
 * Promises (campaign facts a commitment names) the text says were kept (#564 panel pass 2). Integrity requires the gate
 * to hold the promise and forbid every breach of it the record can show, so a kept claim never sits beside a breach.
 */
const keeps = z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1).optional();

/**
 * One WHAT COMES AFTER card: plain text shown whenever the ending is, or text with the gate it depends on. Prose that
 * is true only under some stances, or only past the relevance threshold, carries that gate, so a paid change of stance
 * can never be contradicted by the future it reads (#564 panel). Integrity keeps the gate to lasting history.
 */
export const FutureCardSchema = z.union([cardText, z.strictObject({ requirements: RequirementsSchema, text: cardText, keeps })]);

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
   * can stage them (#487); a gated card shows only while its gate holds, and integrity requires at least one ungated.
   * Only the placeholders FUTURE_PLACEHOLDERS names are filled (endingMovements.ts), and integrity refuses any other.
   */
  future: z.array(FutureCardSchema).min(1).max(5),
  /**
   * What the epilogue and future state about the record, in the requirements vocabulary. Integrity proves every claim
   * from the ending's own requirements or from the gates of every node that can end the run in it, so the text is never
   * told to a record it is not true of, and never rests on trait counts alone.
   */
  claims: RequirementsSchema.optional(),
  /** Promises the epilogue or an ungated card says were kept, held to the ending's own requirements. */
  keeps,
});

export type Ending = z.infer<typeof EndingSchema>;
export type FutureCard = z.infer<typeof FutureCardSchema>;

/** A card's words, gated or not. */
export function futureCardText(card: FutureCard): string {
  return typeof card === 'string' ? card : card.text;
}
