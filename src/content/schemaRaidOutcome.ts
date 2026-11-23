/**
 * What a raid leaves behind for the story (#519, docs/SCALE.md "Round 5", vote-1795442208800-kll72ri): the gate a
 * retaliation or staff-harm dilemma reads, and the harm bands staff fall into when a site's defense fails. It imports
 * nothing from schema.ts, so both schema.ts (the gate) and schemaConflict.ts (the bands) can use it.
 */
import { z } from 'zod';

/** HURT: a named person on site is hurt. KILLED: a named person on site is killed. Never a count. */
export const StaffHarmSchema = z.enum(['HURT', 'KILLED']);
export type StaffHarm = z.infer<typeof StaffHarmSchema>;

/**
 * Met while the last raid that fought its battle matches every field given: attribution named its attacker; a strike at
 * that attacker would (true) or would not (false) reach people's machines, as its content declares; its breach fell in
 * this staff-harm band. A gate with no field would hold after any raid, so integrity refuses it.
 */
export const LastRaidRequirementSchema = z.strictObject({
  named: z.literal(true).optional(),
  collateral: z.boolean().optional(),
  staffHarm: StaffHarmSchema.optional(),
});
export type LastRaidRequirement = z.infer<typeof LastRaidRequirementSchema>;

/** Placeholders a raid-consequence dilemma's text may use, filled from the attacker its trigger names. */
export const RAIDER_PLACEHOLDERS = ['{attacker}', '{collateral}'] as const;
