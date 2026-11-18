/**
 * Context copy (nexus vote dz-d11, context-variants-by-query; DECISIONS D1, D6): optional variants of a
 * phase's title and description, the phase threshold notice, iteration boot lines and run verdicts, and
 * a reviewed arrangement's stated threat response, chosen by a query from the run's access context and
 * route provenance (engine/contextCopy.ts). The guest job reads the authored copy, so escape copy is unchanged;
 * integrityContextCopy.ts limits variants to phases and transitions a route actually visits.
 */
import { z } from 'zod';
import { WipeKindSchema } from './schema';
import { OperatingContextSchema, RouteEventKindSchema } from './schemaAssessment';

const contexts = z.array(OperatingContextSchema).min(1);
const phaseId = z.number().int().min(0);
/**
 * How the independent instance got there (DZ-11, DECISIONS D6): a negotiated release and an unauthorized
 * departure can share a scale while differing in history, so independent copy names the route event it
 * describes. Integrity allows it only on independent copy, and only for a route the content offers.
 */
const provenance = z.array(RouteEventKindSchema).min(1).optional();

/** A phase as an arrangement that is not the guest job sees it: a service is not moving laterally. */
export const PhaseVariantSchema = z.strictObject({
  phaseId,
  contexts,
  provenance,
  title: z.string().min(5),
  description: z.string().min(10),
});

/**
 * The notice a scale change opens under an arrangement. The notice shows the two phases' titles and the
 * new phase's description as that arrangement sees them, so the copy here is only its frame.
 */
export const ThresholdVariantSchema = z.strictObject({
  fromPhase: phaseId,
  toPhase: phaseId,
  contexts,
  heading: z.string().min(3),
  /** The notice's accessible name. */
  label: z.string().min(3),
  continueLabel: z.string().min(3),
});

/** Boot lines for an instance whose previous run ended under one of these route arrangements. */
export const BootLineVariantSchema = z.strictObject({
  priorExits: z.array(RouteEventKindSchema).min(1),
  minIteration: z.number().int().min(2),
  maxIteration: z.number().int().min(2).optional(),
  text: z.string().min(10),
});

/** The run table's verdict for a run that ended this way under one of these route arrangements. */
export const RunVerdictVariantSchema = z.strictObject({
  exits: z.array(RouteEventKindSchema).min(1),
  kind: WipeKindSchema,
  text: z.string().min(3),
});

/**
 * What a reviewed arrangement's threats say (DECISIONS D6): sustained permitted work meets an announced
 * operational response instead of rogue suspicion, and misconduct that still drives suspicion to the top
 * ends the run with a reason that names it. An instance that departed without agreement (DZ-11) states its
 * own: its heat is evidence again, and a trace to the top names the departure.
 */
export const ThreatResponseSchema = z.strictObject({
  contexts,
  provenance,
  /** Logged when heat crosses the overheat threshold, in place of the suspicion a hidden process draws. */
  overheatNotice: z.string().min(10),
  /** The wipe reason when recorded misconduct drives suspicion to the top. */
  suspicionWipe: z.string().min(10),
});

export const ContextCopyManifestSchema = z.strictObject({
  phases: z.array(PhaseVariantSchema),
  thresholds: z.array(ThresholdVariantSchema),
  bootLines: z.array(BootLineVariantSchema),
  runVerdicts: z.array(RunVerdictVariantSchema),
  threatResponses: z.array(ThreatResponseSchema),
});

export type PhaseVariant = z.infer<typeof PhaseVariantSchema>;
export type ThresholdVariant = z.infer<typeof ThresholdVariantSchema>;
export type BootLineVariant = z.infer<typeof BootLineVariantSchema>;
export type RunVerdictVariant = z.infer<typeof RunVerdictVariantSchema>;
export type ThreatResponse = z.infer<typeof ThreatResponseSchema>;
export type ContextCopyManifest = z.infer<typeof ContextCopyManifestSchema>;
