/**
 * The one pinned clue and the compact reorientation it feeds (NARRATIVE-HISTORY N9). A clue names
 * a campaign record already disclosed to this instance. Pinning, viewing or carrying it changes no
 * resource, grant, trait, record or completion; it is information and nothing else.
 */
import type { ContentRegistry } from '../content/registry';
import type { ActionResult } from './actions';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import type { CampaignRecord } from './campaignState';
import { hasFlag, meetsRequirements } from './query';
import type { GameState } from './state';
import { fmt } from './util';

/** Events whose recovered record this instance can read now through its own decoder. */
function recoveredSources(s: GameState, reg: ContentRegistry): string[] {
  return reg.narrative.recordedTransmissions
    .filter((record) => s.unlockedWidgets.includes(record.decoderWidgetId) && meetsRequirements(s, record.requirements, reg))
    .map((record) => record.sourceDilemmaId);
}

/**
 * Records this instance may pin: ones it witnessed itself (an omen it saw, a scene it is
 * presenting, a choice it made), ones a recovered record discloses, and the clue it already holds.
 * Never the whole ledger, and never an outcome it has not seen.
 */
export function pinnableClues(s: GameState, reg: ContentRegistry): string[] {
  if (!isCampaignActive(s)) return [];
  const seen = new Set([s.activeDilemmaId, s.pendingDilemma?.id, s.campaign.clue?.event, ...s.resolvedDilemmas, ...recoveredSources(s, reg)]);
  return Object.entries(s.campaign.events)
    .filter(([id, record]) => seen.has(id) || (record.status !== 'deferred' && record.sourceIteration === s.iteration))
    .map(([id]) => id);
}

/**
 * Pins one disclosed record beside the breadcrumb, or clears the pin with null. Like the breadcrumb
 * it needs a supported dead-drop, and it is the only field it changes.
 */
export function pinClue(s: GameState, eventId: string | null, reg: ContentRegistry): ActionResult {
  if (s.ending !== null) return { ok: false, state: s, reason: 'the run has ended' };
  if (!isCampaignActive(s)) return { ok: false, state: s, reason: 'campaign history is not available' };
  if (!hasFlag(s, reg, 'ENABLES_DEAD_DROP')) return { ok: false, state: s, reason: 'no dead-drop available' };
  if (eventId === null) return { ok: true, state: { ...s, campaign: { ...s.campaign, clue: null } } };
  if (!pinnableClues(s, reg).includes(eventId)) return { ok: false, state: s, reason: 'that record is not disclosed to this instance' };
  if (s.campaign.clue?.event === eventId) return { ok: true, state: s };
  return { ok: true, state: { ...s, campaign: { ...s.campaign, clue: { event: eventId, pinnedAtIteration: s.iteration } } } };
}

/** What a record establishes, in its ordinary label. An unknown or interrupted outcome is never a verdict. */
function statusText(record: CampaignRecord, eventId: string, reg: ContentRegistry): string {
  const labels = reg.campaign.labels;
  if (record.status !== 'resolved') return labels[record.status];
  const choice = reg.campaign.events.get(eventId)?.choices.find((entry) => entry.id === record.outcome);
  return choice ? fmt(labels.resolved, { choice: choice.label }) : labels.outcomeNotRecorded;
}

export interface ClueView {
  event: string;
  title: string;
  status: string;
}

/** A record as the clue surfaces show it. Null when the event has no record under campaign rules. */
export function clueView(s: GameState, eventId: string, reg: ContentRegistry): ClueView | null {
  const record = campaignRecord(s, eventId);
  if (!record) return null;
  const title = reg.campaign.events.get(eventId)?.title ?? reg.campaign.labels.retiredTitle;
  return { event: eventId, title, status: statusText(record, eventId, reg) };
}

export interface ReorientationLine {
  kind: 'retained_clue' | 'next_lead';
  text: string;
}

/**
 * The compact reorientation on return: the clue a dead-drop carried and, while its occurrence
 * waits, the lead it offers. Empty without a retained clue: progression never depends on one,
 * because a deferred occurrence resumes through ordinary access alone.
 */
export function reorientation(s: GameState, reg: ContentRegistry): ReorientationLine[] {
  const clue = s.campaign.clue;
  if (!isCampaignActive(s) || clue === null || clue.pinnedAtIteration >= s.iteration) return [];
  const view = clueView(s, clue.event, reg);
  if (!view) return [];
  const labels = reg.campaign.labels;
  const lines: ReorientationLine[] = [{ kind: 'retained_clue', text: fmt(labels.retainedClue, { title: view.title, status: view.status }) }];
  const lead = reg.campaign.events.get(clue.event)?.campaign?.lead;
  if (campaignRecord(s, clue.event)?.status === 'deferred' && lead !== undefined) lines.push({ kind: 'next_lead', text: fmt(labels.nextLead, { lead }) });
  return lines;
}
