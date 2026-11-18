/**
 * Route copy (DZ-12, extending nexus vote dz-d11's context-variants-by-query to the late corporate chain): a
 * node's or scene's text as an arrangement other than the guest job reads it, and the ending account, the
 * lines an ending may add about what the campaign record actually holds. Production ships none, so escape
 * copy and every production ending read exactly as before; integrityRouteCopy.ts keeps each variant to an
 * item that arrangement can meet and each account line to recorded history.
 */
import { z } from 'zod';
import { RequirementsSchema } from './schema';
import { OperatingContextSchema, RouteEventKindSchema } from './schemaAssessment';

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const contexts = z.array(OperatingContextSchema).min(1);
const prose = z.string().min(10);

/**
 * The evidence a variant's claims rest on, besides the arrangement (panel round 2 on #296): `requirements` for what
 * the instance holds or the world records (a charter owned, a fact), never resources, and `route` for how this
 * iteration got here (its last route event). Copy that asserts a charter needs the charter; copy that asserts a
 * negotiated release needs the release. An instance without the evidence reads the authored text.
 */
const evidence = {
  requirements: RequirementsSchema.optional(),
  route: RouteEventKindSchema.optional(),
};

/** A node's descriptions and unlock log under these arrangements. Names stay as authored (DECISIONS D10). */
export const NodeCopySchema = z.strictObject({
  node: id,
  contexts,
  ...evidence,
  blindDescription: prose.optional(),
  revealedDescription: prose.optional(),
  onUnlockLog: prose.optional(),
});

/** One choice's words under the scene's variant. Costs, effects and gates are the authored choice's. */
export const ChoiceCopySchema = z.strictObject({
  id,
  label: z.string().min(3).optional(),
  description: prose.optional(),
  logText: prose.optional(),
});

/** A scene's omen, context and choice words under these arrangements; the event and its record are unchanged. */
export const DilemmaCopySchema = z.strictObject({
  dilemma: z.string().regex(/^dil_[a-z0-9_]+$/),
  contexts,
  ...evidence,
  omen: prose.optional(),
  context: z.string().min(20).optional(),
  choices: z.array(ChoiceCopySchema).default([]),
});

/** Whose answer a contact line reads: the instance that reached the ending, or one before it. */
export const ContactBySchema = z.enum(['THIS_INSTANCE', 'EARLIER_INSTANCE']);

/**
 * One line of the ending account. Exactly one gate (integrity): world history (`requirements`, context scope
 * only), how the ending instance got where it is (`route`, the last route event of its iteration), or an
 * answer on record through a support channel (`contact`). A line states the record and nothing more.
 */
export const AccountLineSchema = z.strictObject({
  id,
  requirements: RequirementsSchema.optional(),
  route: RouteEventKindSchema.optional(),
  contact: z.strictObject({ encounter: id, response: z.enum(['REFERRED', 'HOSTED']), by: ContactBySchema }).optional(),
  text: z.string().min(20),
});

export const RouteCopyManifestSchema = z.strictObject({
  nodes: z.array(NodeCopySchema),
  dilemmas: z.array(DilemmaCopySchema),
  account: z.array(AccountLineSchema),
});

export type NodeCopy = z.infer<typeof NodeCopySchema>;
export type DilemmaCopy = z.infer<typeof DilemmaCopySchema>;
export type AccountLine = z.infer<typeof AccountLineSchema>;
export type RouteCopyManifest = z.infer<typeof RouteCopyManifestSchema>;
