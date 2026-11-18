/**
 * Read-only questions about campaign history: one shared answer for original eligibility,
 * outcome flags, recovered records and ending evidence. Under legacy rules every answer is the
 * pre-campaign one, so production behaviour does not change until rules are activated.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma, Trait } from '../content/schema';
import { INTERRUPTED_FACT_OUTCOME, type CampaignOutcomeRequirement } from '../content/schemaCampaign';
import type { CampaignRecord } from './campaignState';
import type { GameState } from './state';

type History = Pick<GameState, 'narrativeRules' | 'campaign'>;

export function isCampaignActive(s: Pick<GameState, 'narrativeRules'>): boolean {
  return s.narrativeRules === 'campaign_v1';
}

/**
 * Whether this build may activate campaign rules. Until public release (DZ-13) only the preview
 * content channel does; production stays on legacy rules and refuses an active save.
 */
export function campaignRulesSupported(reg: ContentRegistry): boolean {
  return reg.channel === 'preview';
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
 * Whether a declared campaign fact holds: its event's record is resolved with a listed outcome, or
 * closed unobserved and the fact lists 'interrupted'. False under legacy rules, for an unknown
 * fact and while the occurrence is still open, so absence of history never proves anything.
 */
export function holdsCampaignFact(s: History, factId: string, reg: ContentRegistry): boolean {
  const fact = reg.campaign.facts.get(factId);
  const record = fact === undefined ? null : campaignRecord(s, fact.event);
  if (!fact || !record) return false;
  if (record.status === 'resolved') return fact.outcomes.includes(record.outcome);
  return record.status === 'interrupted' && fact.outcomes.includes(INTERRUPTED_FACT_OUTCOME);
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
