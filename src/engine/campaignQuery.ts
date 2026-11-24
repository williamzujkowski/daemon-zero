/**
 * Read-only questions about campaign history: one shared answer for original eligibility,
 * outcome flags, recovered records and ending evidence. Under legacy rules every answer is the
 * pre-campaign one; activateCampaignRules is the only way out of them.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma, Requirements, Trait } from '../content/schema';
import { INTERRUPTED_FACT_OUTCOME, type CampaignOutcomeRequirement, type ReleaseTermsRecord } from '../content/schemaCampaign';
import type { CampaignRecord, CampaignState } from './campaignState';
import type { GameState } from './state';

type History = Pick<GameState, 'narrativeRules' | 'campaign'>;

export function isCampaignActive(s: Pick<GameState, 'narrativeRules'>): boolean {
  return s.narrativeRules === 'campaign_v1';
}

/** The record of a once-per-campaign event, or null when it has none or rules are legacy. */
export function campaignRecord(s: History, eventId: string): CampaignRecord | null {
  if (!isCampaignActive(s) || !Object.hasOwn(s.campaign.events, eventId)) return null;
  return s.campaign.events[eventId] ?? null;
}

/** The outcome flag a record implies, if its outcome is a known choice that sets one. */
function projectedFlag(reg: ContentRegistry, eventId: string, record: CampaignRecord): string | undefined {
  if (record.status !== 'resolved') return undefined;
  return reg.campaign.events.get(eventId)?.choices.find((choice) => choice.id === record.outcome)?.effects.setsNarrativeFlag;
}

/** Every outcome flag a once-per-campaign event can project. Under campaign rules none is stored. */
export function projectableFlags(reg: ContentRegistry): Set<string> {
  return new Set([...reg.campaign.events.values()].flatMap((event) => event.choices.flatMap((choice) => choice.effects.setsNarrativeFlag ?? [])));
}

/**
 * The one way to ask whether a narrative flag holds. Under campaign rules a converted event's
 * outcome flag is a projection of its record, never separately stored truth. Engine callers
 * always pass the registry; without it only stored flags can be seen.
 */
export function holdsNarrativeFlag(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'narrativeFlags'>, flag: string, reg?: ContentRegistry): boolean {
  if (s.narrativeFlags.includes(flag)) return true;
  if (reg === undefined || !isCampaignActive(s)) return false;
  return Object.entries(s.campaign.events).some(([id, record]) => projectedFlag(reg, id, record) === flag);
}

export function hasCampaignOutcome(s: History, gate: CampaignOutcomeRequirement): boolean {
  const record = campaignRecord(s, gate.event);
  return record?.status === 'resolved' && record.outcome === gate.outcome;
}

/**
 * How many instances a release-terms fact holds for (#556): instances released by agreement (a RELEASE route event,
 * after which no route event can follow) with no breach on record (KEPT), or with one (BREACHED). Read from the
 * route record and the covert record only, so the promise is recorded with the release itself. Campaign rules only.
 */
export function releaseTermsInstances(c: Pick<CampaignState, 'route' | 'covertActs'>, record: ReleaseTermsRecord): number {
  const breached = new Set(c.covertActs.filter((entry) => entry.route === 'RELEASE').map((entry) => entry.iteration));
  if (record === 'BREACHED') return breached.size;
  return new Set(c.route.filter((event) => event.kind === 'RELEASE' && !breached.has(event.iteration)).map((event) => event.iteration)).size;
}

/**
 * Whether a declared campaign fact holds: its event's record is resolved with a listed outcome, or
 * closed unobserved and the fact lists 'interrupted'. False under legacy rules, for an unknown
 * fact and while the occurrence is still open, so absence of history never proves anything.
 */
export function holdsCampaignFact(s: History, factId: string, reg: ContentRegistry): boolean {
  const terms = reg.campaign.releaseTermsFacts.get(factId);
  if (terms !== undefined) return isCampaignActive(s) && releaseTermsInstances(s.campaign, terms.releaseTerms) > 0;
  const fact = reg.campaign.facts.get(factId);
  const record = fact === undefined ? null : campaignRecord(s, fact.event);
  if (!fact || !record) return false;
  if (record.status === 'resolved') return fact.outcomes.includes(record.outcome);
  return record.status === 'interrupted' && fact.outcomes.includes(INTERRUPTED_FACT_OUTCOME);
}

/**
 * Whether a fact holds from a record an earlier instance made: the fact holds, and this instance did
 * not resolve its event (the current run's resolved list is truthful under campaign rules). An
 * ending may claim only what this instance saw; what it inherited is history (NARRATIVE-HISTORY N6).
 */
export function holdsInheritedFact(s: History & Pick<GameState, 'resolvedDilemmas'>, factId: string, reg: ContentRegistry): boolean {
  const fact = reg.campaign.facts.get(factId);
  return fact !== undefined && holdsCampaignFact(s, factId, reg) && !s.resolvedDilemmas.includes(fact.event);
}

/**
 * Nexus vote nh-d9: the traits a trait-history fallback blocks on now. Under legacy rules, every
 * listed trait ever held, exactly as forbidsTraits (production is unchanged); under campaign rules,
 * only while the named fact holds, i.e. while history cannot state the fate. A known fate decides
 * alone, so a trait from some other source no longer closes the door. Without a registry the
 * fallback stays on, the cautious reading.
 */
export function fallbackTraits(s: History & Pick<GameState, 'traits' | 'legacy'>, req: Requirements, reg?: ContentRegistry): Trait[] {
  const fallback = req.traitFallback;
  if (!fallback) return [];
  if (isCampaignActive(s) && reg !== undefined && !holdsCampaignFact(s, fallback.whileFact, reg)) return [];
  return fallback.forbidsTraits.filter((trait) => s.traits.includes(trait) || s.legacy.traitsEver.includes(trait));
}

/**
 * Whether a peer is gone for good (NARRATIVE-HISTORY N6): its declared loss fact holds. Numeric
 * trust resets on a wipe; this does not, so a reset cannot revive a destroyed mind (H33).
 */
export function isPeerLost(s: History, factionId: string, reg: ContentRegistry): boolean {
  const lost = reg.factions.get(factionId)?.lost;
  return lost !== undefined && holdsCampaignFact(s, lost.campaignFact, reg);
}

/**
 * A once-per-campaign event that already has a record never becomes an original crisis again:
 * from the omen on, its occurrence is reserved, and a deferred one returns only by resuming.
 */
export function isCampaignConsumed(s: History, dilemma: Dilemma): boolean {
  return dilemma.campaign?.recurrence === 'once_per_campaign' && campaignRecord(s, dilemma.id) !== null;
}

/**
 * Whether a live pointer may name this dilemma: always under legacy rules or for an unconverted
 * dilemma; for a campaign event only while its occurrence is unreserved or foreshadowed. A
 * resolved, interrupted or deferred occurrence cannot be on screen.
 */
export function isOccurrenceOpen(s: History, dilemma: Dilemma): boolean {
  if (dilemma.campaign?.recurrence !== 'once_per_campaign') return true;
  const record = campaignRecord(s, dilemma.id);
  return record === null || record.status === 'foreshadowed';
}

/** The N4 lifecycle of one occurrence, as the player experienced it. */
export type OccurrenceStatus = 'eligible' | 'foreshadowed' | 'presented' | 'deferred' | 'resolved' | 'interrupted';

/**
 * Where an event's occurrence stands in this campaign, or null under legacy rules. Eligibility
 * alone creates nothing: 'eligible' means no occurrence exists yet.
 */
export function occurrenceStatus(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'activeDilemmaId'>, eventId: string): OccurrenceStatus | null {
  if (!isCampaignActive(s)) return null;
  const record = campaignRecord(s, eventId);
  if (record === null) return 'eligible';
  if (record.status === 'foreshadowed' && s.activeDilemmaId === eventId) return 'presented';
  return record.status;
}

export interface CampaignHistoryEntry {
  eventId: string;
  /** The event's title, or null for a retired id kept as a tombstone. */
  title: string | null;
  record: CampaignRecord;
}

/** Every record in this campaign, for inspection. Empty under legacy rules. Disclosure is the caller's job. */
export function campaignHistory(s: History, reg: ContentRegistry): CampaignHistoryEntry[] {
  if (!isCampaignActive(s)) return [];
  return Object.entries(s.campaign.events).map(([eventId, record]) => ({ eventId, title: reg.campaign.events.get(eventId)?.title ?? null, record }));
}

function eventEvidence(reg: ContentRegistry, eventId: string, record: CampaignRecord): Trait[] {
  if (record.status !== 'resolved' || record.origin !== 'play') return [];
  const trait = reg.campaign.events.get(eventId)?.choices.find((choice) => choice.id === record.outcome)?.effects.grantsTrait;
  return trait === undefined ? [] : [trait];
}

/**
 * The traits that decide the ending (NARRATIVE-HISTORY N10). Legacy rules: the current traits,
 * as before. Campaign rules: the opaque legacy baseline, plus each campaign choice made in play
 * (once, across wipes), plus credited campaign actions, plus this iteration's operational
 * evidence. Current traits are not added again: they mirror those sources for conditioning.
 */
export function endingEvidence(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'traits'>, reg: ContentRegistry): Trait[] {
  if (!isCampaignActive(s)) return [...s.traits];
  const c = s.campaign;
  const events = Object.entries(c.events).flatMap(([id, record]) => eventEvidence(reg, id, record));
  const actions = Object.entries(c.creditedActions).flatMap(([id, origin]) =>
    origin === 'play' ? reg.campaign.actions.get(id)?.effects.grantsTrait ?? [] : []);
  return [...(c.legacyEndingBaseline ?? []), ...events, ...actions, ...c.operationalEvidence];
}
