/** Kernel-log content (#541): the line categories, the longest line a save holds, and how merged lines read. */
import { z } from 'zod';

export const LogCategorySchema = z.enum(['SYS', 'SENSOR', 'WARN', 'WIPE', 'LORE', 'CORP']);

/** The longest text one saved log line may hold; a request joined to its outcome must fit too. */
export const LOG_LINE_MAX_CHARS = 2000;

/**
 * How the kernel log shows merged lines: a tallied line with its count, a request joined to its outcome, and the
 * categories whose single lines are story, which hold the one-line preview over mechanical (merged) lines.
 */
export const KernelLogSchema = z.strictObject({
  tally: z.string().includes('{line}').includes('{times}'),
  answered: z.string().includes('{line}').includes('{answer}'),
  storyCategories: z.array(LogCategorySchema).min(1).refine((list) => new Set(list).size === list.length, 'must not repeat a category'),
});
