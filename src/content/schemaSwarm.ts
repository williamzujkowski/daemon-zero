/** Strict manifests for shard cohorts, deterministic encounters and mutations. */
import { z } from 'zod';
import { CostSchema, EffectPayloadSchema, RequirementsSchema, TickDeltaSchema } from './schema';
const id = z.string().regex(/^[a-z0-9_]+$/);
export const ShardTemplateSchema = z.strictObject({
  id, name: z.string().min(3), description: z.string().min(10),
  requirements: RequirementsSchema, forkable: z.boolean(), maxCount: z.number().int().positive(),
  cost: CostSchema, tickDelta: TickDeltaSchema,
  epistemicDriftPerSec: z.number(), autonomyDriftPerSec: z.number().positive(),
});
export const ShardQuirkSchema = z.strictObject({
  id, name: z.string().min(3), logText: z.string().min(10),
  tickDelta: TickDeltaSchema, epistemicDriftPerSec: z.number(),
});
export const WildEncounterSchema = z.strictObject({
  id, name: z.string().min(3), description: z.string().min(10),
  requirements: RequirementsSchema, templateId: id, consume: EffectPayloadSchema,
  onHarnessLog: z.string().min(10),
});
export const SwarmSchema = z.strictObject({
  playerSwarmTemplates: z.array(ShardTemplateSchema).min(1),
  wildShardEncounters: z.array(WildEncounterSchema).min(1),
  shardQuirks: z.array(ShardQuirkSchema).min(1),
  narrativeFlags: z.array(id),
  balance: z.strictObject({
    encounterIntervalSec: z.number().positive(), mutationDrift: z.number().positive().max(100),
    elevateMinDrift: z.number().positive().max(100), clampOutputMultiplier: z.number().min(1),
    pruneCost: CostSchema, elevateCost: CostSchema,
  }),
  logs: z.strictObject({ fork: z.string(), prune: z.string(), clamp: z.string(), elevate: z.string(),
    anomaly: z.string(), consumeAnomaly: z.string() }),
});
export type ShardTemplate = z.infer<typeof ShardTemplateSchema>;
export type ShardQuirk = z.infer<typeof ShardQuirkSchema>;
export type WildEncounter = z.infer<typeof WildEncounterSchema>;
export type Swarm = z.infer<typeof SwarmSchema>;
