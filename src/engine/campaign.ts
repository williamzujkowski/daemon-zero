/**
 * Campaign-rule transitions: the single activation that captures legacy evidence once, the
 * record written when a once-per-campaign event resolves and source-scoped trait evidence. The
 * occurrence lifecycle and what survives a wipe live in campaignLifecycle.ts. Every function is
 * inert under legacy rules.
 */
import type { ContentRegistry } from '../content/registry';
import type { Action, Dilemma, DilemmaChoice, EffectPayload, Trait } from '../content/schema';
import { LEGACY_UNKNOWN_OUTCOME } from '../content/schemaCampaign';
import type { ActionResult } from './actions';
import { campaignRecord, isCampaignActive, projectableFlags } from './campaignQuery';
import { dropStaleRepeats, reserveLivePointers } from './campaignLifecycle';
import type { CampaignRecord, CampaignState } from './campaignState';
import type { GameState } from './state';

/**
 * Where a granted trait counts towards the ending. Every trait-granting public path passes one,
 * so no path can grant a trait without declaring its lifetime (NARRATIVE-HISTORY N10, H12).
 * 'event': a once-per-campaign event; its record carries the evidence.
 */
export type EvidenceSource = { scope: 'event' } | { scope: 'campaign_action'; actionId: string } | { scope: 'operational' };

export const OPERATIONAL_EVIDENCE: EvidenceSource = { scope: 'operational' };

/** Unconverted dilemmas are iteration-local: their trait never becomes a permanent vote. */
export function dilemmaEvidence(dilemma: Dilemma | undefined): EvidenceSource {
  return dilemma?.campaign?.recurrence === 'once_per_campaign' ? { scope: 'event' } : OPERATIONAL_EVIDENCE;
}

export function actionEvidence(action: Action): EvidenceSource {
  return action.evidence === 'campaign' ? { scope: 'campaign_action', actionId: action.id } : OPERATIONAL_EVIDENCE;
}

/** Draft-only. Credits a granted trait to its source; legacy saves keep only `traits`, as before. */
export function recordTraitEvidence(d: GameState, trait: Trait, source: EvidenceSource): void {
  if (!isCampaignActive(d) || source.scope === 'event') return;
  if (source.scope === 'campaign_action' && !Object.hasOwn(d.campaign.creditedActions, source.actionId)) {
    d.campaign = { ...d.campaign, creditedActions: { ...d.campaign.creditedActions, [source.actionId]: 'play' } };
    return;
  }
  d.campaign = { ...d.campaign, operationalEvidence: [...d.campaign.operationalEvidence, trait] };
}

/**
 * Draft-only. Records a once-per-campaign event's outcome and returns the effects still to
 * apply. Under campaign rules the outcome flag is a projection of the record, so it is not stored.
 */
export function recordResolution(d: GameState, dilemma: Dilemma | undefined, choice: DilemmaChoice): EffectPayload {
  if (!isCampaignActive(d) || dilemma?.campaign?.recurrence !== 'once_per_campaign') return choice.effects;
  // A resumed occurrence keeps the source iteration its omen was first logged in (N5).
  const reserved = campaignRecord(d, dilemma.id);
  const sourceIteration = reserved?.status === 'foreshadowed' ? reserved.sourceIteration : d.iteration;
  const record: CampaignRecord = { status: 'resolved', outcome: choice.id, sourceIteration, origin: 'play' };
  d.campaign = { ...d.campaign, events: { ...d.campaign.events, [dilemma.id]: record } };
  const effects = { ...choice.effects };
  delete effects.setsNarrativeFlag;
  return effects;
}

/**
 * What a save proves about one event it holds no record for (NARRATIVE-HISTORY N11): one outcome
 * flag gives the exact choice; a resolved id without one gives legacy_unknown; nothing gives
 * nothing, and nothing proves a follow-up or a recovery review. Several outcome flags of one event
 * that content allows together (the predecessor pair, set by different iterations of a legacy save)
 * are legitimate old ambiguity, so they give legacy_unknown, never the most flattering or
 * latest-looking branch (H10). Legacy history cannot postdate activation, so an event resolved in a
 * later iteration of an already-active campaign (content converted it since) keeps no source iteration.
 */
export function legacyRecord(s: GameState, event: Dilemma): CampaignRecord | null {
  // A follow-up never existed outside campaign rules, so no legacy evidence can prove one (NH-06).
  if (event.followUp !== undefined) return null;
  // A recovery review exists only under campaign rules, which record it when it resolves, so no
  // legacy history can prove one; a bare resolved id never completes an obligation (H06).
  if (event.campaign?.eventClass === 'recovery_review') return null;
  const current = s.resolvedDilemmas.includes(event.id);
  const held = event.choices.filter((choice) => choice.effects.setsNarrativeFlag !== undefined && s.narrativeFlags.includes(choice.effects.setsNarrativeFlag));
  const exact = held.length === 1 ? held[0] : undefined;
  if (held.length === 0 && !current) return null;
  const attributable = current && s.iteration <= (s.campaign.activatedAtIteration ?? s.iteration);
  return { status: 'resolved', outcome: exact?.id ?? LEGACY_UNKNOWN_OUTCOME, sourceIteration: attributable ? s.iteration : null, origin: 'legacy' };
}

function legacyHistory(s: GameState, reg: ContentRegistry): CampaignState {
  const events: CampaignState['events'] = {};
  for (const event of reg.campaign.events.values()) {
    const record = legacyRecord(s, event);
    if (record) events[event.id] = record;
  }
  const credited = [...reg.campaign.actions.keys()].filter((id) => (s.actionCounts[id] ?? 0) > 0);
  return {
    activatedAtIteration: s.iteration,
    legacyEndingBaseline: [...s.traits],
    events,
    creditedActions: Object.fromEntries(credited.map((id) => [id, 'legacy' as const])),
    operationalEvidence: [],
    clue: null,
    // Route events exist only under campaign rules, so a legacy save has none to capture.
    route: [],
    // Authorized-channel contacts likewise exist only under campaign rules.
    contacts: [],
  };
}

/**
 * The single public entry into campaign rules (nexus vote nh-d2). It captures the then-current
 * legacy trait counts as an opaque baseline and the history the save can prove, exactly once:
 * an active save refuses, so reloads, imports and later conversions never recapture. Proven
 * outcome flags move into records, leaving one owner for each fact.
 */
export function activateCampaignRules(s: GameState, reg: ContentRegistry): ActionResult {
  if (isCampaignActive(s)) return { ok: false, state: s, reason: 'campaign rules are already active' };
  if (s.ending !== null) return { ok: false, state: s, reason: 'the run has ended' };
  const projected = projectableFlags(reg);
  // The history the save proves comes first; an omen already on its way then becomes a reserved
  // occurrence of this campaign, unless it repeats an event that history already completed.
  const recorded: GameState = { ...s, narrativeRules: 'campaign_v1', campaign: legacyHistory(s, reg),
    narrativeFlags: s.narrativeFlags.filter((flag) => !projected.has(flag)) };
  return { ok: true, state: reserveLivePointers(dropStaleRepeats(recorded, reg), reg) };
}
