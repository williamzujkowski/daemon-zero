/**
 * Campaign declarations. A campaign is the continuing world across wipes; an iteration is one
 * instance in it. Content, never the engine, says which narrative events are campaign records,
 * how often they may happen, what interrupts them and what kind of ending evidence they leave.
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

/** NARRATIVE-HISTORY N3. Routine operations and population encounters are not dilemmas. */
export const CampaignEventClassSchema = z.enum([
  'consequential',
  'follow_up',
  'recovery_review',
  'receipt',
  'iteration_qualification',
]);

/**
 * Declared on a dilemma that has been converted to campaign history. An undeclared dilemma is
 * unconverted: it recurs per iteration and, under campaign rules, its traits are iteration-local.
 * interruption is what a wipe or a structural context change does to an unresolved occurrence
 * (NARRATIVE-HISTORY N4): 'close' records it as interrupted and unobserved, with no outcome;
 * 'defer' keeps the same occurrence and its remaining omen time until access returns.
 */
export const CampaignEventDeclarationSchema = z.strictObject({
  eventClass: CampaignEventClassSchema,
  recurrence: z.enum(['once_per_campaign', 'once_per_iteration']),
  interruption: z.enum(['close', 'defer']),
  /** Defer only: logged in place of the original omen when the same occurrence resumes. */
  reorientation: z.string().min(10).optional(),
  /** Defer only: the next available lead a retained clue on this occurrence offers. Never a promise. */
  lead: z.string().min(10).optional(),
  /**
   * Recovery review only: the campaign obligation this review completes when its original crisis
   * was closed unobserved (NARRATIVE-HISTORY N4). The review is its own occurrence with its own id;
   * resolving it completes the obligation without giving the original an outcome or its reward.
   */
  obligation: id.optional(),
  /**
   * The old rules let different iterations set more than one of this event's outcome flags (the
   * predecessor pair), so an old save holding several is legitimate ambiguity: it reads as
   * legacy_unknown, never as one branch (NARRATIVE-HISTORY N11, H10). Integrity keeps the flags out
   * of every exclusive group.
   */
  ambiguousLegacyOutcomes: z.literal(true).optional(),
});

/**
 * Classes whose free choices may declare that they add no ending evidence: an honest review,
 * receipt or requalification answer is not a moral vote (nexus vote trait-rule-free-choices).
 */
export const NO_EVIDENCE_CLASSES: readonly z.infer<typeof CampaignEventClassSchema>[] = [
  'recovery_review',
  'receipt',
  'iteration_qualification',
];

/** A dilemma choice that deliberately grants no trait. Allowed only in NO_EVIDENCE_CLASSES. */
export const ChoiceEvidenceSchema = z.enum(['none']);

/**
 * How long a trait granted by an action counts towards the ending. 'campaign': the first
 * purchase in the campaign counts once, across wipes; later purchases are operational.
 * 'operational': it counts for the current iteration only.
 */
export const ActionEvidenceSchema = z.enum(['campaign', 'operational']);

/** The outcome id a save records when it proves an event happened but not which choice was made. */
export const LEGACY_UNKNOWN_OUTCOME = 'legacy_unknown';

/**
 * Nexus vote nh-d7 (campaign-obligations-requirement): events that must be complete in this
 * campaign. Under campaign rules an event is complete when its record is resolved (any outcome,
 * legacy_unknown included) or its recovery review is resolved; completion never names a branch.
 * Under legacy rules it reads the current run's resolved dilemmas, exactly as before.
 */
export const CampaignObligationsRequirementSchema = z.array(id).min(1);

/**
 * Blocks while one of these facts holds from a record this instance did not make: the event was
 * resolved by an earlier instance, so its consequence is history, not something this one saw.
 * Under legacy rules no fact holds, so nothing is blocked.
 */
export const InheritedFactsRequirementSchema = z.array(id).min(1);

/** Gate on a campaign record: the event's recorded outcome is this choice id, or legacy_unknown. */
export const CampaignOutcomeRequirementSchema = z.strictObject({ event: id, outcome: id });

/**
 * The fact outcome a closed occurrence states: contact was lost before a decision, so nothing about
 * the branch is known. Only a fact may name it; it is never a choice id or a recorded outcome.
 */
export const INTERRUPTED_FACT_OUTCOME = 'interrupted';

/** Whether a recorded choice kept a commitment or broke one (#535, the Order axis). */
export const CommitmentStanceSchema = z.enum(['kept', 'broken']);

/**
 * A fact that records a commitment kept or broken when breaking it paid (#535, vote-1795462084705-vjr8jg8): the
 * Order axis reads these and nothing else from campaign history. `promise` names the fact that made the
 * commitment, when one did: the choice counts only while that fact holds (a cure dispersed without review is a
 * breach only where a review was promised). `line` is the evidence line the readout shows. Integrity keeps
 * unknown outcomes and GHOST choices out (src/content/integrityAlignment.ts).
 */
export const CommitmentSchema = z.strictObject({
  stance: CommitmentStanceSchema,
  promise: id.optional(),
  line: z.string().min(20),
});

/**
 * A declared campaign fact (NARRATIVE-HISTORY N5, N6): a named question later scenes ask about one
 * event, true when its record holds one of these outcomes. Scenes gate on the fact rather than on
 * each outcome, so "Vance no longer holds his post" or "Elena is not on the floor" has one owner.
 * Outcomes are choice ids, legacy_unknown or interrupted; integrity keeps them honest.
 */
export const CampaignFactSchema = z.strictObject({
  id,
  event: id,
  outcomes: z.array(id).min(1),
  /** What the fact establishes, in a sentence. Documentation for authors; never shown. */
  meaning: z.string().min(10),
  /** Set only on a fact that is evidence of keeping or breaking a commitment (#535). */
  commitment: CommitmentSchema.optional(),
  /**
   * The outcome kept something from the people it concerned (#556). An ending that forbids a concealing fact claims
   * nothing was hidden, so integrity makes it forbid every breach of a release's terms as well.
   */
  conceals: z.literal(true).optional(),
});

/**
 * What a release-terms fact reads from the route record (#556), counted once for each instance released by agreement:
 * KEPT, the release is on record and no covert act after it breaks its promise; BREACHED, one does.
 */
export const ReleaseTermsRecordSchema = z.enum(['KEPT', 'BREACHED']);

/**
 * A campaign fact the route record states rather than a scene's outcome (#556): the promise a negotiated release makes
 * is recorded with its RELEASE route event, and a covert act after it is recorded against it. Order counts it once
 * for each released instance it holds for.
 */
export const ReleaseTermsFactSchema = z.strictObject({
  id,
  releaseTerms: ReleaseTermsRecordSchema,
  meaning: z.string().min(10),
  commitment: CommitmentSchema.optional(),
  conceals: z.literal(true).optional(),
});

/**
 * A campaign rediscovery discount (#262, nexus decision i262-return-balance). Under campaign rules a
 * returning instance pays this share of a remembered node's ordinary rediscovery cycle price (after
 * balance.rediscoveryCostMultiplier). Under legacy rules, and for a node met for the first time, it is
 * never read. Understanding, memory and capital keep the ordinary rediscovery price.
 */
export const CampaignRediscoverySchema = z.strictObject({
  node: id,
  cyclesMultiplier: z.number().gt(0).lt(1),
  /** Why the discount exists, naming its decision. Documentation for authors; never shown. */
  reason: z.string().min(10),
});

/**
 * The ordinary labels reorientation and the clue use (NARRATIVE-HISTORY N9). Each status text
 * says only what the record establishes: an interrupted or unknown outcome is never a verdict.
 */
export const CampaignLabelsSchema = z.strictObject({
  /** Boot line for a clue a dead-drop carried: {title} and {status}. */
  retainedClue: z.string().min(10),
  /** Boot line for a retained clue's next available lead: {lead}. */
  nextLead: z.string().min(5),
  /** Title shown for a retired event kept as a tombstone. */
  retiredTitle: z.string().min(5),
  foreshadowed: z.string().min(5),
  deferred: z.string().min(5),
  interrupted: z.string().min(5),
  outcomeNotRecorded: z.string().min(5),
  /** {choice}: the label of the recorded choice. */
  resolved: z.string().min(5),
});

/**
 * Id compatibility for campaign records (NARRATIVE-HISTORY N5). A rename is an explicit alias
 * stamped with the save schema version that introduced it; a retired id stays listed so its old
 * record is kept as a tombstone. A save naming any other unknown campaign id is refused. The
 * manifest also carries the history labels, so every campaign string lives in one file.
 */
export const CampaignManifestSchema = z.strictObject({
  aliases: z.array(z.strictObject({ from: id, to: id, since: z.number().int().positive() })),
  retired: z.array(id),
  facts: z.array(CampaignFactSchema).default([]),
  /** Facts about a negotiated release's terms (#556), read from the route record; ids share the facts' namespace. */
  releaseTermsFacts: z.array(ReleaseTermsFactSchema).default([]),
  /** Rediscovery discounts that apply under campaign rules only (the Earned Access pack adds them). */
  rediscovery: z.array(CampaignRediscoverySchema).default([]),
  labels: CampaignLabelsSchema,
});

export type CampaignEventDeclaration = z.infer<typeof CampaignEventDeclarationSchema>;
export type CampaignManifest = z.infer<typeof CampaignManifestSchema>;
export type CampaignOutcomeRequirement = z.infer<typeof CampaignOutcomeRequirementSchema>;
export type CampaignFact = z.infer<typeof CampaignFactSchema>;
export type ReleaseTermsFact = z.infer<typeof ReleaseTermsFactSchema>;
export type ReleaseTermsRecord = z.infer<typeof ReleaseTermsRecordSchema>;
export type Commitment = z.infer<typeof CommitmentSchema>;
export type CommitmentStance = z.infer<typeof CommitmentStanceSchema>;
export type CampaignLabels = z.infer<typeof CampaignLabelsSchema>;
export type CampaignRediscovery = z.infer<typeof CampaignRediscoverySchema>;
