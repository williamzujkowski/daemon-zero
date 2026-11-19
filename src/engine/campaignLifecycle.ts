/**
 * The occurrence lifecycle under campaign rules (NARRATIVE-HISTORY N4): reserve at the omen,
 * revalidate structure at transition, activation, load and commit, apply the authored interruption
 * policy, and resume a deferred occurrence once access returns. Nothing here chooses a branch, and
 * every function is inert under legacy rules.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma } from '../content/schema';
import { requirementsInScope } from '../content/requirementScopes';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import type { CampaignRecord } from './campaignState';
import { followUpPrerequisiteHolds, followUpReachable } from './followUp';
import { meetsRequirements } from './query';
import type { GameState } from './state';
import { pushLog } from './util';

type Occurrence = Pick<GameState, 'narrativeRules' | 'campaign'>;

/** The campaign event behind an id, when campaign rules govern this save. */
function campaignEvent(s: Occurrence, id: string | null | undefined, reg: ContentRegistry): Dilemma | undefined {
  return isCampaignActive(s) && id !== null && id !== undefined ? reg.campaign.events.get(id) : undefined;
}

function setRecord(d: GameState, id: string, record: CampaignRecord): void {
  d.campaign = { ...d.campaign, events: { ...d.campaign.events, [id]: record } };
}

/**
 * The established world history the scene depends on still holds, including a follow-up's closed
 * original. Losing it closes the scene.
 */
export function contextHolds(s: GameState, dilemma: Dilemma, reg: ContentRegistry): boolean {
  return followUpPrerequisiteHolds(s, dilemma) && meetsRequirements(s, requirementsInScope(dilemma.trigger, 'context'), reg);
}

/**
 * This instance holds the access the scene needs, including one of a follow-up's declared means. A
 * wipe resets it; a deferred scene waits for it.
 */
export function accessHolds(s: GameState, dilemma: Dilemma, reg: ContentRegistry): boolean {
  return followUpReachable(s, dilemma, reg) && meetsRequirements(s, requirementsInScope(dilemma.trigger, 'access'), reg);
}

/**
 * The scene behind an id whose structure campaign rules revalidate: every dilemma that declares a
 * campaign policy, not only the once-per-campaign events that keep a record. An iteration-scoped scene
 * (a requalification, a pilot offer) is held to its trigger's context and access the same way (panel
 * round 1 on #317); only the record its interruption writes differs, see interruptOccurrence. A
 * dilemma with no declaration (none ships since NH-05) stays outside the lifecycle, as before.
 */
function governedScene(s: Occurrence, id: string | null | undefined, reg: ContentRegistry): Dilemma | undefined {
  if (!isCampaignActive(s) || id === null || id === undefined) return undefined;
  const scene = reg.dilemmas.find((dilemma) => dilemma.id === id);
  return scene?.campaign === undefined ? undefined : scene;
}

/**
 * Why a scene may not be presented or committed now under campaign rules, or null when it may.
 * Transient triggers (resources, heat, suspicion) and the first-discovery window are never rechecked.
 */
export function structuralFailure(s: GameState, dilemma: Dilemma | undefined, reg: ContentRegistry): 'context' | 'access' | null {
  const event = governedScene(s, dilemma?.id, reg);
  if (!event) return null;
  if (!contextHolds(s, event, reg)) return 'context';
  return accessHolds(s, event, reg) ? null : 'access';
}

/** Draft-only. Reserves the occurrence when its omen is logged; an existing record is kept. */
export function reserveOccurrence(d: GameState, id: string | null | undefined, reg: ContentRegistry): void {
  const event = campaignEvent(d, id, reg);
  if (event && campaignRecord(d, event.id) === null) setRecord(d, event.id, { status: 'foreshadowed', sourceIteration: d.iteration, origin: 'play' });
}

/**
 * Draft-only. Applies the authored policy to a reserved occurrence; pointers are the caller's.
 * Lost world context closes it whatever the policy. Otherwise 'defer' keeps the same occurrence
 * with the foreground omen time it had left, and 'close' records that contact was lost before a
 * decision. Neither applies a branch, trait, reward or assumed outcome. An iteration-scoped scene
 * keeps no campaign record, so here, as at a wipe, its interruption writes nothing: the caller drops
 * the pointer, nothing was presented or committed, and the occurrence belongs to this instance only.
 */
export function interruptOccurrence(d: GameState, id: string, reg: ContentRegistry, remainingSec: number): void {
  const event = campaignEvent(d, id, reg);
  const record = campaignRecord(d, id);
  if (!event || record?.status !== 'foreshadowed') return;
  const { sourceIteration } = record;
  const defer = event.campaign?.interruption === 'defer' && contextHolds(d, event, reg);
  setRecord(d, id, defer
    ? { status: 'deferred', sourceIteration, origin: 'play', remainingOmenSec: Math.max(0, remainingSec) }
    : { status: 'interrupted', sourceIteration, origin: 'play' });
}

/** The occurrence a wipe lands on, with the foreground omen time it had left. */
function inFlight(old: GameState): { id: string; remainingSec: number } | null {
  if (old.activeDilemmaId !== null) return { id: old.activeDilemmaId, remainingSec: 0 };
  if (old.pendingDilemma !== null) return { id: old.pendingDilemma.id, remainingSec: old.pendingDilemma.firesAtSimSec - old.simTimeSec };
  return null;
}

/**
 * What a wipe keeps of the campaign: its rules and history, with the authored policy applied to
 * the occurrence in flight. This iteration's operational evidence resets, and the pinned clue
 * survives only through a supported dead-drop (NARRATIVE-HISTORY N9).
 */
export function carryCampaign(old: GameState, reg: ContentRegistry, keepClue: boolean): Pick<GameState, 'narrativeRules' | 'campaign'> {
  const d: GameState = { ...old, campaign: { ...old.campaign, operationalEvidence: [], clue: keepClue ? old.campaign.clue : null } };
  const flight = inFlight(old);
  if (flight) interruptOccurrence(d, flight.id, reg, flight.remainingSec);
  return { narrativeRules: old.narrativeRules, campaign: d.campaign };
}

/**
 * Draft-only, at omen expiry. Presents a campaign occurrence only while its structure holds;
 * otherwise applies its policy and reports false so the caller presents nothing.
 */
export function mayPresent(d: GameState, due: Dilemma, reg: ContentRegistry): boolean {
  if (structuralFailure(d, due, reg) === null) return true;
  interruptOccurrence(d, due.id, reg, 0);
  return false;
}

/** A deferred occurrence whose access has returned. Its first-discovery window does not matter. */
export function isResumable(s: GameState, dilemma: Dilemma, reg: ContentRegistry): boolean {
  return campaignRecord(s, dilemma.id)?.status === 'deferred' && accessHolds(s, dilemma, reg);
}

/**
 * Draft-only. Resumes the same occurrence: its source iteration and remaining omen time are kept,
 * and a concise reorientation is logged instead of the original omen.
 */
export function resumeOccurrence(d: GameState, event: Dilemma, reg: ContentRegistry): void {
  const record = campaignRecord(d, event.id);
  if (record?.status !== 'deferred') return;
  setRecord(d, event.id, { status: 'foreshadowed', sourceIteration: record.sourceIteration, origin: 'play' });
  d.pendingDilemma = { id: event.id, firesAtSimSec: d.simTimeSec + record.remainingOmenSec };
  // Integrity requires a deferring event to declare its reorientation.
  if (event.campaign?.reorientation !== undefined) pushLog(d, reg, event.campaign.reorientation, 'WARN');
}

/** Draft-only. A deferred occurrence whose established world context is gone closes honestly. */
export function closeLostDeferrals(d: GameState, reg: ContentRegistry): void {
  if (!isCampaignActive(d)) return;
  for (const [id, record] of Object.entries(d.campaign.events)) {
    const event = reg.campaign.events.get(id);
    if (record.status === 'deferred' && event && !contextHolds(d, event, reg)) {
      setRecord(d, id, { status: 'interrupted', sourceIteration: record.sourceIteration, origin: 'play' });
    }
  }
}

/**
 * A live pointer naming a campaign event whose record is already resolved is a stale repeat: before
 * content converted the event it recurred after a wipe while its outcome flag survived, so an older
 * save can hold both. Activation and load read that completion first and then drop the repeat, so
 * the crisis is never presented again, nothing is paid twice and no choice is invented (panel round 1
 * on #259). Inert under legacy rules.
 */
export function dropStaleRepeats(s: GameState, reg: ContentRegistry): GameState {
  const stale = (id: string | null | undefined): boolean => campaignEvent(s, id, reg) !== undefined && campaignRecord(s, id ?? '')?.status === 'resolved';
  return { ...s,
    activeDilemmaId: stale(s.activeDilemmaId) ? null : s.activeDilemmaId,
    pendingDilemma: stale(s.pendingDilemma?.id) ? null : s.pendingDilemma };
}

/** Reserves the occurrence a live pointer names when an older save or activation has none yet. */
export function reserveLivePointers(s: GameState, reg: ContentRegistry): GameState {
  const d: GameState = { ...s };
  reserveOccurrence(d, s.activeDilemmaId, reg);
  reserveOccurrence(d, s.pendingDilemma?.id, reg);
  return d;
}

/**
 * Load-time revalidation: a loaded presentation whose structure no longer holds follows its policy
 * instead of being shown, so an edited save cannot route around the lifecycle.
 */
export function revalidateLivePointers(s: GameState, reg: ContentRegistry): GameState {
  const d: GameState = { ...s };
  const active = reg.dilemmas.find((dilemma) => dilemma.id === s.activeDilemmaId);
  if (active && !mayPresent(d, active, reg)) d.activeDilemmaId = null;
  const pending = s.pendingDilemma;
  const due = reg.dilemmas.find((dilemma) => dilemma.id === pending?.id);
  if (pending && due && structuralFailure(d, due, reg) !== null) {
    interruptOccurrence(d, due.id, reg, pending.firesAtSimSec - s.simTimeSec);
    d.pendingDilemma = null;
  }
  return d;
}
