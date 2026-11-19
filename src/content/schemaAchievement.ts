/**
 * Distinctions (DESIGN.md backlog item 6, Nexus vote backlog-next): read-only achievements an ending
 * states from records the save already holds. A distinction may test only monotonic history, never a
 * per-iteration value, so a wipe cannot take one back or hand one out; the query is
 * src/engine/achievementQuery.ts and the checks src/content/integrityAchievement.ts.
 */
import { z } from 'zod';
import { TraitSchema } from './schema';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

/**
 * The record a distinction tests. Field names and meanings are the shared requirements vocabulary
 * (src/content/schema.ts RequirementsSchema), restricted to what never resets: trait history across
 * every iteration and a declared campaign fact. A strict object, so a per-iteration gate is rejected.
 */
export const AchievementRecordSchema = z.strictObject({
  /** Met only if no iteration in this lineage ever held one of these traits. */
  forbidsTraits: z.array(TraitSchema).min(1).optional(),
  /** Met only under campaign rules, when this declared fact holds on the campaign record. */
  campaignFact: snakeId.optional(),
});

export const AchievementSchema = z.strictObject({
  id: snakeId,
  title: z.string().min(1).max(48),
  /** What the record shows, stated as a fact, never as praise for an outcome the record cannot prove. */
  claim: z.string().min(1).max(200),
  requirements: AchievementRecordSchema,
  /** Met only if the harness recorded at most this many wipes before the ending. */
  maxWipes: z.number().int().min(0).optional(),
});

export const AchievementsManifestSchema = z.strictObject({ achievements: z.array(AchievementSchema) });

export type Achievement = z.infer<typeof AchievementSchema>;
