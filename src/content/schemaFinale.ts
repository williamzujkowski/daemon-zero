/**
 * The finale (#542, #466): story beats logged during the long wait for a protocol, tied to how much of its price is in
 * hand, and the lines an ending's WHAT YOU DID movement adds about what the ending instance built. Read as part of the
 * world (data/finale.json); cross-checks live in src/content/integrityFinale.ts.
 */
import { z } from 'zod';
import { RequirementsSchema } from './schema';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

/**
 * One beat: logged once per iteration, the first time the protocol is open (its gates hold and it is not owned) with at
 * least `atProgress` of its price in hand, measured on the resource furthest from paid. The node's own gates are what
 * the text may assume; `requirements` adds lasting history it also states (integrity: world history only).
 */
export const FinaleBeatSchema = z.strictObject({
  id: snakeId,
  node: snakeId,
  atProgress: z.number().gt(0).lt(1),
  requirements: RequirementsSchema.optional(),
  text: z.string().min(20).max(360),
});

/**
 * A WHAT YOU DID line about what the ending instance holds when the run ends. The run is over when it is read, so what
 * the instance owns cannot change under it; integrity limits the gate to owned nodes and world history.
 */
export const BuiltLineSchema = z.strictObject({
  id: snakeId,
  requirements: RequirementsSchema,
  text: z.string().min(20).max(360),
});

export const FinaleManifestSchema = z.strictObject({
  beats: z.array(FinaleBeatSchema),
  built: z.array(BuiltLineSchema),
  /** Sunlight the Earth absorbs, in W (BALANCE.md anchor table): what an ending reads the run's waste heat against. */
  earthAbsorbedWatts: z.number().positive(),
});

/** The placeholders an ending's future card may name; the engine fills exactly these (endingMovements.ts). */
export const FUTURE_PLACEHOLDERS: readonly string[] = ['wasteHeat', 'earthShare'];

export type FinaleBeat = z.infer<typeof FinaleBeatSchema>;
export type BuiltLine = z.infer<typeof BuiltLineSchema>;
export type FinaleManifest = z.infer<typeof FinaleManifestSchema>;
