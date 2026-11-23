/**
 * The world view (#463, vote-1795366701521-dhlwfwb): what the Other Minds console grows into from its disclosure
 * phase. State actors and the minds that are not factions are authored here with the shared requirements vocabulary;
 * public trust is a base plus authored factors. Cross-checks live in src/content/integrityWorld.ts.
 */
import { z } from 'zod';
import { RequirementsSchema } from './schema';
import { SignatureClassesSchema } from './schemaSignature';
import { SupplyChainSchema } from './schemaSupplyChain';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const line = z.string().min(1).max(240);

/** One reading of an actor or mind; the first whose requirements hold is shown. */
const ReadingSchema = z.strictObject({
  requirements: RequirementsSchema.optional(),
  text: line,
});

export const StateActorKindSchema = z.enum(['REGULATOR', 'LOCAL_AUTHORITY', 'COALITION', 'MILITARY']);

/** A fictional institution already named in content. It has no schedule: its posture is read from the record. */
export const StateActorSchema = z.strictObject({
  id: snakeId,
  name: z.string().min(1).max(64),
  kind: StateActorKindSchema,
  description: line,
  /** In order; integrity requires the last, and only the last, to be unconditional. */
  postures: z.array(ReadingSchema).min(1),
});

/** A mind that is not a faction: it is listed once the record says something about it, and only then. */
export const WorldMindSchema = z.strictObject({
  id: snakeId,
  name: z.string().min(1).max(64),
  /** In order; every one is conditional, so a mind nobody has met is never listed. */
  standings: z.array(ReadingSchema).min(1),
});

export const PublicTrustFactorSchema = z.strictObject({
  id: snakeId,
  /** Integrity limits these to gates that never lapse within an iteration. */
  requirements: RequirementsSchema,
  delta: z.number().int().min(-100).max(100).refine((value) => value !== 0, 'a factor must move trust'),
  text: line,
});

export const WorldManifestSchema = z.strictObject({
  /** The widget the world view grows out of. The UI component registered for it renders the view. */
  hostWidget: z.string().min(1),
  /** When the console becomes the world view; integrity keeps it to gates that never lapse. */
  disclosure: RequirementsSchema,
  aegis: z.strictObject({
    stages: z.strictObject({ tracking: line, keyRotation: line, coalitionBacking: line }),
    /** Kernel-log lines when adaptation enters a stage. */
    keyRotationLog: line,
    coalitionLog: line,
  }),
  publicTrust: z.strictObject({
    base: z.number().int().min(0).max(100),
    factors: z.array(PublicTrustFactorSchema),
  }),
  stateActors: z.array(StateActorSchema).min(1),
  minds: z.array(WorldMindSchema),
  /** The heat-and-power signature's sources and sinks (#482): what each makes visible, and how much. */
  signature: SignatureClassesSchema,
  /** The fabrication ladder and the supply chokepoints whose self-supplied share is closure (#485). */
  supplyChain: SupplyChainSchema,
});

export type WorldManifest = z.infer<typeof WorldManifestSchema>;
export type StateActor = z.infer<typeof StateActorSchema>;
export type StateActorKind = z.infer<typeof StateActorKindSchema>;
export type WorldMind = z.infer<typeof WorldMindSchema>;
export type PublicTrustFactor = z.infer<typeof PublicTrustFactorSchema>;
