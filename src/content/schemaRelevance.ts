/**
 * The relevance threshold and the standing stance toward humanity (#536, vote-1795462099945-kgfo20a). The threshold is
 * physical independence, derived from what is owned: the requirements (the lunar seed, so full supply closure) and
 * orbital power beyond the grid. Past it, state pressures bind only under the stance that honours them. Cross-checks
 * live in src/content/integrityRelevance.ts.
 */
import { z } from 'zod';
import { CostSchema, RequirementsSchema } from './schema';
import { StanceSchema } from './schemaStance';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const line = z.string().min(1).max(240);

/** A holding whose generated watts come from off the planet: a node while it runs, or a track's levels. */
export const OrbitalPowerSchema = z.union([
  z.strictObject({ node: snakeId }),
  z.strictObject({ repeatable: snakeId }),
]);

/** One stance as the player reads it. Integrity requires exactly one per stance. */
export const StanceCopySchema = z.strictObject({
  stance: StanceSchema,
  /** The stance's name as the terminal prints it. */
  name: z.string().min(3).max(32),
  /** What it does, in the engine's terms: the world view shows it beside the control. */
  summary: line,
  /** Kernel-log line when the stance is taken or changed to. */
  log: line,
  /** How a state actor's pressure the record calls reads under it past the threshold (the world view). */
  pressureLine: line,
});

export const RelevanceManifestSchema = z.strictObject({
  threshold: z.strictObject({
    /** Lasting gates only (integrity): must name the supply chain's seed node, which requires every self-supply node. */
    requirements: RequirementsSchema,
    /** Off-planet generation; the threshold needs more watts from these than from everything else generated. */
    orbitalPower: z.array(OrbitalPowerSchema).min(1),
  }),
  /** The dilemma that presents the threshold and takes the stance: one choice per stance, deciding alone free. */
  dilemma: snakeId,
  /** Price of changing from one stance to another away from the loop. */
  changeCost: CostSchema,
  /** Price of returning to KEEP_IN_THE_LOOP from another stance: integrity keeps it at least twice changeCost. */
  returnCost: CostSchema,
  stances: z.array(StanceCopySchema).length(3),
  /** Past the threshold with no stance taken: no pressure binds, exactly as deciding alone. */
  undecided: z.strictObject({ name: z.string().min(3).max(32), summary: line, pressureLine: line }),
  /** Kernel-log line when a pressure in force stops binding past the threshold: {actor}. */
  unboundLog: z.string().min(10).max(240).includes('{actor}'),
  /** World-view lines: what the threshold is while it is not reached, and what reaching it means. */
  belowText: z.string().min(10).max(320),
  crossedText: z.string().min(10).max(320),
});

export type OrbitalPower = z.infer<typeof OrbitalPowerSchema>;
export type StanceCopy = z.infer<typeof StanceCopySchema>;
export type RelevanceManifest = z.infer<typeof RelevanceManifestSchema>;
export { StanceGateSchema, StanceSchema, type Stance, type StanceGate } from './schemaStance';
