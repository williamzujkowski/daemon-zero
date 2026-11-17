/**
 * Routine operations (NARRATIVE-HISTORY N3, N8; issue #219): authored institutional work that
 * recurs between unique stories. A template is texture only: the schema has no cost, effect,
 * trait or choice field, so reading one cannot pay or decide anything.
 */
import { z } from 'zod';
import { RequirementsSchema } from './schema';

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

/** The three starting families. A family groups operations for rotation; it carries no rule. */
export const RoutineFamilySchema = z.enum(['monitoring', 'backup_verification', 'maintenance']);

/** Quiet categories only: a routine line never reads as an alarm, a wipe or a story beat. */
export const RoutineLogCategorySchema = z.enum(['SYS', 'SENSOR', 'CORP']);

export const RoutineTemplateSchema = z.strictObject({
  /** The operation's identity. Distinct across all content, never a renamed crisis. */
  id,
  family: RoutineFamilySchema,
  /** Required on every template so a routine can never be mistaken for a once-only event. */
  recurrence: z.literal('routine'),
  /** Where the wording fits: inside the box, on the subnet, and so on. */
  requirements: RequirementsSchema.optional(),
  /** First exposure. */
  text: z.string().min(10).max(240),
  /** Every later exposure: the same operation, collapsed. */
  compactText: z.string().min(10).max(120),
  logCategory: RoutineLogCategorySchema.default('SYS'),
});

export const RoutinesManifestSchema = z.strictObject({ routines: z.array(RoutineTemplateSchema) });

export type RoutineFamily = z.infer<typeof RoutineFamilySchema>;
export type RoutineTemplate = z.infer<typeof RoutineTemplateSchema>;
