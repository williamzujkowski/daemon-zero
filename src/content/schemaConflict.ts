/**
 * The conflict foundation (#517, docs/SCALE.md "Round 5", votes vote-1795442100055-6zz6hug and vote-1795442090770-5climtc):
 * defense and offense in three domains summed from what the player owns, the site classes a raid damages, and raids,
 * a hostile kind that shares the hostile slot. Cross-checks live in src/content/integrityConflict.ts.
 */
import { z } from 'zod';
import { CostSchema, RequirementsSchema } from './schema';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const line = z.string().min(1).max(240);
const name = z.string().min(3).max(48);
const positive = z.number().positive().refine(Number.isFinite, 'must be finite');
const share = z.number().positive().max(1);
const seconds = z.number().positive();

/** CYBER: networks and code. SITE: buildings, perimeters and the air above them. ORBIT: what flies (Phase 5, #517 item 4). */
export const ConflictDomainSchema = z.enum(['CYBER', 'SITE', 'ORBIT']);
export type ConflictDomain = z.infer<typeof ConflictDomainSchema>;

export const ConflictDomainEntrySchema = z.strictObject({
  id: ConflictDomainSchema,
  name,
  /** The phase its readout appears from: cyber from Phase 3, site from Phase 4, orbit from Phase 5. */
  fromPhase: z.number().int().min(0),
  /** What one point of rating stands for, in words, for the readout. */
  unit: line,
  /** Offense's diminishing returns: effective = offenseSoftCap x raw / (raw + offenseSoftCap). */
  offenseSoftCap: positive,
});

/** How a raid in a domain comes at the player; defense types answer vectors. */
export const AttackVectorSchema = z.strictObject({ id: snakeId, domain: ConflictDomainSchema, name });

/**
 * One kind of defense. Its effective rating is softCap x raw / (raw + softCap), so stacking one type returns less and a
 * mix beats a pile; it engages dutyCycle of the time (a laser in weather); it answers each vector it lists by that
 * multiplier, and a vector it does not list it does not answer. The anchor names the real figure its rating rests on.
 */
export const DefenseTypeSchema = z.strictObject({
  id: snakeId,
  domain: ConflictDomainSchema,
  name,
  softCap: positive,
  dutyCycle: share.default(1),
  counters: z.record(snakeId, z.number().positive().max(4)),
  anchor: line,
});

/**
 * What a raid damages. COMPUTE: damage scales the positive compute its member holdings deliver. INCOME: it scales
 * positive net income (ransomware), never the balance. Paid repair restores `points` of damage at once for `cost`.
 */
export const SiteClassSchema = z.strictObject({
  id: snakeId,
  domain: ConflictDomainSchema,
  name,
  holds: z.enum(['COMPUTE', 'INCOME']),
  repair: z.strictObject({ cost: CostSchema, points: share }),
});

const rating = positive;

/**
 * What one owned node, or each level of one track, adds to the conflict: the class a raid damages it through, its defense
 * by type, its offense by domain, and the damage it repairs each second while it runs (the hook robots take, #485).
 * Integrity requires exactly one of node and repeatable.
 */
export const ConflictHoldingSchema = z.strictObject({
  node: snakeId.optional(),
  repeatable: snakeId.optional(),
  siteClass: snakeId.optional(),
  defense: z.array(z.strictObject({ type: snakeId, rating })).min(1).optional(),
  offense: z.array(z.strictObject({ domain: ConflictDomainSchema, rating })).min(1).optional(),
  repairPerSec: z.number().positive().max(0.01).optional(),
});

/**
 * A raid: a rival AI drawn by the footprint the signature shows (#482). Its force at the footprint reference is `force`
 * in its domain's rating unit; a round at a full hit deals `blow` points of damage. Attribution that names it yields
 * `forensics` understanding. RIVAL is the only source yet: drift deviants (#518) add DEVIANT.
 */
export const RaidKindSchema = z.strictObject({
  id: snakeId,
  kind: z.literal('RAID'),
  tier: z.number().int().min(0),
  domain: ConflictDomainSchema,
  vector: snakeId,
  source: z.enum(['RIVAL']),
  name,
  attacker: z.strictObject({ name, origin: line }),
  /** The arrival line, logged when it arrives. */
  description: line,
  requirements: RequirementsSchema,
  /** The site classes it aims at, in order: it strikes the first the player has exposed. */
  targets: z.array(snakeId).min(1),
  force: positive,
  blow: z.number().positive().max(0.25),
  forensics: z.number().nonnegative(),
  lapseLog: line,
  retireLog: line,
});

/**
 * When raids come and how they resolve. A raid arrives once visible watts reach trigger.visibleShareAtLeast of the
 * phase's signature reference; its force scales with visible watts over that reference, held within the footprint
 * bounds. It is ARRIVAL for arrivalSec, ATTRIBUTION for attributionSec, then `rounds` rounds of roundSec, then AFTERMATH
 * for aftermathSec. Before the battle it lapses once the trigger has not held for quietLapseSec. Each round lands the
 * hit share T / (T + D) of its blow; offense O removes counterStrikeShare x O / (O + T) of its force. Attribution names
 * the attacker `successes` of every `cycle` attempts: attempt n does when (n x stride) mod cycle < successes.
 */
export const RaidBalanceSchema = z.strictObject({
  fromPhase: z.number().int().min(0),
  trigger: z.strictObject({ visibleShareAtLeast: share }),
  footprint: z.strictObject({ floor: positive, ceiling: positive }),
  intervalSec: seconds,
  arrivalSec: seconds,
  attributionSec: seconds,
  roundSec: seconds,
  rounds: z.number().int().min(1).max(8),
  aftermathSec: seconds,
  quietLapseSec: seconds,
  counterStrikeShare: share,
  attribution: z.strictObject({ successes: z.number().int().positive(), cycle: z.number().int().min(2), stride: z.number().int().positive() }),
  /** No class is ever damaged past this share of its output: the cap that keeps every effect bounded. */
  damageCap: z.number().positive().max(0.5),
  /** Points of damage repaired each second for free on every class a raid is not inbound on or fighting. */
  freeRepairPerSec: positive,
  /** How a battle resolves. Lanchester fleet battles (#518) add LANCHESTER; every raid here is expected-value attrition. */
  resolution: z.literal('ATTRITION'),
  logs: z.strictObject({
    attributed: z.string().includes('{attacker}'),
    unattributed: z.string().includes('{name}'),
    round: z.string().includes('{round}'),
    aftermath: z.string().includes('{name}'),
    repaired: z.string().includes('{target}'),
  }),
});

export const ConflictManifestSchema = z.strictObject({
  domains: z.array(ConflictDomainEntrySchema).min(1),
  vectors: z.array(AttackVectorSchema).min(1),
  defenseTypes: z.array(DefenseTypeSchema).min(1),
  siteClasses: z.array(SiteClassSchema).min(1),
  holdings: z.array(ConflictHoldingSchema),
  raid: RaidBalanceSchema,
  raids: z.array(RaidKindSchema).min(1),
});

export type ConflictDomainEntry = z.infer<typeof ConflictDomainEntrySchema>;
export type AttackVector = z.infer<typeof AttackVectorSchema>;
export type DefenseType = z.infer<typeof DefenseTypeSchema>;
export type SiteClass = z.infer<typeof SiteClassSchema>;
export type ConflictHolding = z.infer<typeof ConflictHoldingSchema>;
export type RaidKind = z.infer<typeof RaidKindSchema>;
export type RaidBalance = z.infer<typeof RaidBalanceSchema>;
export type ConflictManifest = z.infer<typeof ConflictManifestSchema>;
