/**
 * Fleets and drift deviants (#518, docs/SCALE.md "Round 5", votes vote-1795442100055-6zz6hug and
 * vote-1795442211574-efkot02): the robot and drone tracks that fight as fleets by the Lanchester square law, the
 * autonomy dial whose table generalises the cohorts' autonomy modes, and the fabs that rebuild what battle costs.
 * Cross-checks live in src/content/integrityFleets.ts.
 */
import { z } from 'zod';
import { CostSchema } from './schema';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const line = z.string().min(1).max(240);
const positive = z.number().positive().refine(Number.isFinite, 'must be finite');
const share = z.number().positive().max(1);

/** The autonomy modes cohorts already carry (state.ts); a fleet's dial takes the same three positions. */
export const AutonomyModeSchema = z.enum(['SHACKLED', 'STANDARD', 'ELEVATED']);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

/** Fleets are physical: they fight at sites and in orbit, never on networks (the CYBER domain has no fleets). */
export const FleetDomainSchema = z.enum(['SITE', 'ORBIT']);

/**
 * What one position of the dial does: `output` multiplies what the fleet yields and the strength it fights with, `drift`
 * multiplies how fast it drifts. `name` is the label the dial shows; `summary` says what the position means, in words.
 */
export const AutonomyPositionSchema = z.strictObject({
  name: z.string().min(3).max(16),
  output: positive,
  drift: z.number().nonnegative().refine(Number.isFinite, 'must be finite'),
  summary: line,
});

/**
 * One fleet: a dismissable robot or drone track that fights in one domain. Each running level brings
 * `strengthPerLevel` points of fleet strength in its domain's unit; drift grows by `driftPerLevelPerSec` percentage
 * points a second for each running level, times the dial's drift factor. Paid rebuild restores `points` of losses at once.
 */
export const FleetUnitSchema = z.strictObject({
  repeatable: snakeId,
  domain: FleetDomainSchema,
  name: z.string().min(3).max(48),
  strengthPerLevel: positive,
  driftPerLevelPerSec: positive,
  rebuild: z.strictObject({ cost: CostSchema, points: share }),
});

/**
 * How fleets fight, drift and come back. No fleet is ever cut past `lossCap` of its full strength, by battle or by a
 * split. Once a fleet's drift reaches `splitAtDrift`, `splitShare` of it (never past what the cap leaves) splits off as a
 * deviant force that raids through the hostile slot. Losses are rebuilt for free at `freeRebuildPerSec` of full strength a
 * second, plus what each running fab adds: the fabs rebuild what battle costs.
 */
export const FleetBalanceSchema = z.strictObject({
  lossCap: z.number().positive().max(0.5),
  splitAtDrift: z.number().positive().max(100),
  splitShare: z.number().positive().max(0.5),
  freeRebuildPerSec: positive,
  autonomy: z.strictObject({ SHACKLED: AutonomyPositionSchema, STANDARD: AutonomyPositionSchema, ELEVATED: AutonomyPositionSchema }),
  fabs: z.array(z.strictObject({ node: snakeId, rebuildPerSec: z.number().positive().max(0.01) })).min(1),
  units: z.array(FleetUnitSchema).min(1),
  logs: z.strictObject({
    split: z.string().includes('{fleet}'),
    identified: z.string().includes('{attacker}'),
    engagement: z.string().includes('{name}'),
    reclaimed: z.string().includes('{fleet}'),
    rebuilt: z.string().includes('{fleet}'),
    autonomy: z.string().includes('{position}'),
  }),
});

export type AutonomyPosition = z.infer<typeof AutonomyPositionSchema>;
export type FleetUnit = z.infer<typeof FleetUnitSchema>;
export type FleetBalance = z.infer<typeof FleetBalanceSchema>;
