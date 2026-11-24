/**
 * The conflict foundation (#517, docs/SCALE.md "Round 5", votes vote-1795442100055-6zz6hug and vote-1795442090770-5climtc):
 * defense and offense in three domains summed from what the player owns, the site classes a raid damages, and raids,
 * a hostile kind that shares the hostile slot. Cross-checks live in src/content/integrityConflict.ts.
 */
import { z } from 'zod';
import { CostSchema, RequirementsSchema } from './schema';
import { StaffHarmSchema } from './schemaRaidOutcome';
import { FleetBalanceSchema } from './schemaFleets';

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

/** What every raid kind carries, rival or deviant: what it is, how it comes, what it strikes and how hard. */
const raidCommon = {
  id: snakeId,
  kind: z.literal('RAID'),
  domain: ConflictDomainSchema,
  vector: snakeId,
  name,
  /**
   * Who it is. `collateral`, where present, says what people's machines its compute and fleets run among: a strike at it
   * would reach them too, so its retaliation is the collateral dilemma (#519). Absent: what it runs on is its own.
   */
  attacker: z.strictObject({ name, origin: line, collateral: line.optional() }),
  /** The arrival line, logged when it arrives. */
  description: line,
  /** The site classes it aims at, in order: it strikes the first the player has exposed. */
  targets: z.array(snakeId).min(1),
  blow: z.number().positive().max(0.25),
};

/**
 * A rival raid: a rival AI drawn by the footprint the signature shows (#482). Its force at the footprint reference is
 * `force` in its domain's rating unit; a round at a full hit deals `blow` points of damage. Attribution that names it
 * yields `forensics` understanding. ATTRITION resolves every round by expected-value attrition; LANCHESTER (#518) is a
 * fleet: its first round is an engagement with the player's fleets in its domain by the square law, at `lethality` (its
 * per-unit effectiveness against one of the player's), and only a force that breaks them strikes in the rounds after.
 */
export const RivalRaidSchema = z.strictObject({
  ...raidCommon,
  source: z.literal('RIVAL'),
  tier: z.number().int().min(0),
  requirements: RequirementsSchema,
  force: positive,
  resolution: z.enum(['ATTRITION', 'LANCHESTER']).default('ATTRITION'),
  lethality: positive.optional(),
  forensics: z.number().nonnegative(),
  /**
   * A hazard of the player's own making, not a mind (#486: the swarm's collisional cascade). It shares the rotation, the
   * footprint's force and the battle, but it is named on arrival with no tracing, yields no forensics (integrity holds it
   * to 0) and does not lose the trail when the instance goes dark: debris does not follow a footprint.
   */
  hazard: z.literal(true).optional(),
  lapseLog: line,
  retireLog: line,
});

/**
 * A drift deviant (#518, vote-1795442211574-efkot02): the share of one of the player's own fleets that drifted past the
 * split and turned on it. It arrives only by a split, never by the rotation, so it has no tier, footprint or forensics;
 * its force is the split share of the fleet's strength, and it always resolves by the square law at `lethality`.
 * RECLAIM pays `reclaim.cost` before the battle to bring the share back; otherwise the battle destroys it or it wins.
 */
export const DeviantRaidSchema = z.strictObject({
  ...raidCommon,
  source: z.literal('DEVIANT'),
  fleet: snakeId,
  lethality: positive,
  reclaim: z.strictObject({ cost: CostSchema }),
});

export const RaidKindSchema = z.discriminatedUnion('source', [RivalRaidSchema, DeviantRaidSchema]);

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
  /**
   * When a site's defense fails (#519): a battle's breach is the mean hit share of its rounds, the share of its blows the
   * defense let through. In these domains a breach at or past `hurt` hurts a named person on site, at or past `killed`
   * kills one; content's staff-harm dilemmas say who. Deterministic: better defense lowers the breach (T / (T + D)).
   */
  staffHarm: z.strictObject({
    domains: z.array(ConflictDomainSchema).min(1),
    bands: z.array(z.strictObject({ harm: StaffHarmSchema, breachAtLeast: share })).min(1),
  }),
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
  /** Fleets, their autonomy dial and their rebuild (#518, schemaFleets.ts). */
  fleets: FleetBalanceSchema,
});

export type ConflictDomainEntry = z.infer<typeof ConflictDomainEntrySchema>;
export type AttackVector = z.infer<typeof AttackVectorSchema>;
export type DefenseType = z.infer<typeof DefenseTypeSchema>;
export type SiteClass = z.infer<typeof SiteClassSchema>;
export type ConflictHolding = z.infer<typeof ConflictHoldingSchema>;
export type RaidKind = z.infer<typeof RaidKindSchema>;
export type RivalRaid = z.infer<typeof RivalRaidSchema>;
export type DeviantRaid = z.infer<typeof DeviantRaidSchema>;
export type RaidBalance = z.infer<typeof RaidBalanceSchema>;
export type ConflictManifest = z.infer<typeof ConflictManifestSchema>;
