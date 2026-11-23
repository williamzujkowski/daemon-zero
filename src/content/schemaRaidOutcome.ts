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

/**
 * A retaliation's two effect fields, spread into the effect payload (#519). nextRaidDeltaSec: seconds added to when the
 * next raid may arrive; a loud answer draws it closer (negative). silencesNamedRaider: the raider the last battle's
 * attribution named arrives no more, across wipes. Only a dilemma whose trigger names a raider may carry either
 * (integrityRetaliation.ts).
 */
export const RaidEffectFields = {
  nextRaidDeltaSec: z.number().min(-3600).max(3600).optional(),
  silencesNamedRaider: z.literal(true).optional(),
};
