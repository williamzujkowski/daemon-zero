/** Strict manifests for shard cohorts, deterministic encounters and mutations. */
import { z } from 'zod';
import { CostSchema, EffectPayloadSchema, RequirementsSchema, TickDeltaSchema } from './schema';
import { GrantSchema } from './schemaGrant';
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
  origin: z.string().min(3), signature: z.string().min(3),
  id, name: z.string().min(3), description: z.string().min(10),
  requirements: RequirementsSchema, templateId: id, consume: EffectPayloadSchema,
  onHarnessLog: z.string().min(10),
});
/**
 * A mind that arrives through a channel this instance is authorized to use (DZ-08, SPEC "A Voice on
 * the Support Channel", nexus vote dz-d7 contact-by-channel). It reuses a population template, so it
 * is one more member of that population, never a named peer. The player may refer it onward (free,
 * no reward) or host it in stable memory it already has; nothing here consumes it. Every line a
 * player needs before choosing (consent, obligations, what each answer does) is declared, so the
 * contact surface shows it before any control. Production defines none.
 */
export const ChannelEncounterSchema = z.strictObject({
  id, name: z.string().min(3), origin: z.string().min(3), signature: z.string().min(3),
  description: z.string().min(10),
  /** Where and for whom the channel opens. Integrity keeps it to reviewed arrangements. */
  requirements: RequirementsSchema,
  templateId: id,
  /** The grant hosting runs under: refused while the arrangement withholds that permission. */
  grant: GrantSchema,
  /** What the fragment asks for, and that it asked. */
  consent: z.string().min(20),
  /** What hosting commits this instance to: memory, what a recall does and does not do, how it ends. */
  obligations: z.array(z.string().min(10)).min(1),
  referral: z.strictObject({ text: z.string().min(20), log: z.string().min(10) }),
  hosting: z.strictObject({ text: z.string().min(20), log: z.string().min(10) }),
  /** Said beside the contact when an earlier instance of this campaign already answered one here. */
  earlierContact: z.string().min(20),
  /** The note after the first authorized contact (DZ-08.6): what comes next and how to stop, honestly. */
  boundary: z.strictObject({ title: z.string().min(5), lines: z.array(z.string().min(10)).min(1) }),
});

export const SwarmSchema = z.strictObject({
  playerSwarmTemplates: z.array(ShardTemplateSchema).min(1),
  wildShardEncounters: z.array(WildEncounterSchema).min(1),
  /** Authorized-channel encounters (DZ-08). shards.json declares none; the Earned Access pack adds them. */
  channelEncounters: z.array(ChannelEncounterSchema),
  shardQuirks: z.array(ShardQuirkSchema).min(1),
  narrativeFlags: z.array(id),
  exclusiveNarrativeFlagGroups: z.array(z.array(id).min(2)).default([]),
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
export type ChannelEncounter = z.infer<typeof ChannelEncounterSchema>;
export type Swarm = z.infer<typeof SwarmSchema>;
