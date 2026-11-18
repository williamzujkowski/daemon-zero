/**
 * Load-time checks for campaign history. A dropped record would make its event eligible again,
 * so unknown campaign ids are refused rather than filtered; renamed ids are read through content
 * aliases and retired ids are kept as tombstones (NARRATIVE-HISTORY N5, H28).
 */
import type { ContentRegistry } from '../content/registry';
import { LEGACY_UNKNOWN_OUTCOME } from '../content/schemaCampaign';
import { legacyRecord } from './campaign';
import { dropStaleRepeats, reserveLivePointers } from './campaignLifecycle';
import { obligationProblem } from './obligations';
import { isCampaignActive, projectableFlags } from './campaignQuery';
import type { CampaignRecord, CampaignState } from './campaignState';
import { followUpPrerequisiteHolds } from './followUp';
import type { GameState } from './state';

type Check<T> = (id: string, value: T) => string | null;

/** Re-keys entries through aliases, keeps tombstones verbatim and refuses anything unknown. */
function canonical<T>(entries: Record<string, T>, reg: ContentRegistry, check: Check<T>): Record<string, T> | string {
  const out: Record<string, T> = {};
  for (const [stored, value] of Object.entries(entries)) {
    if (reg.campaign.retired.has(stored)) { out[stored] = value; continue; }
    const id = reg.campaign.aliases.get(stored) ?? stored;
    if (Object.hasOwn(out, id)) return `save records campaign id "${id}" twice`;
    const problem = check(id, value);
    if (problem !== null) return problem;
    out[id] = value;
  }
  return out;
}

/**
 * An unresolved occurrence belongs to campaign play, and a foreshadowed one is named by a live
 * pointer. A deferred one may come from a wipe or from a structural failure in the iteration that
 * saw its omen (lost access at omen expiry or on load), so its source iteration may be the current one.
 */
function occurrenceProblem(s: GameState, id: string, record: Exclude<CampaignRecord, { status: 'resolved' }>): string | null {
  const at = record.sourceIteration;
  if (at < (s.campaign.activatedAtIteration ?? 0) || at > s.iteration) return `save records "${id}" outside campaign play`;
  const named = s.activeDilemmaId === id || s.pendingDilemma?.id === id;
  if (record.status === 'foreshadowed' && !named) return `save reserves "${id}" but nothing presents it`;
  return null;
}

function recordProblem(s: GameState, reg: ContentRegistry, id: string, record: CampaignRecord): string | null {
  const event = reg.campaign.events.get(id);
  if (!event) return `save records an unknown campaign event "${id}"`;
  if (record.status !== 'resolved') return occurrenceProblem(s, id, record);
  const exact = event.choices.some((choice) => choice.id === record.outcome);
  if (!exact && (record.outcome !== LEGACY_UNKNOWN_OUTCOME || record.origin === 'play')) return `save records an unknown outcome for "${id}"`;
  const activated = s.campaign.activatedAtIteration ?? 0;
  const at = record.sourceIteration;
  if (record.origin === 'play' && (at === null || at < activated || at > s.iteration)) return `save records "${id}" outside campaign play`;
  if (record.origin === 'legacy' && at !== null && at > activated) return `save records legacy history for "${id}" after activation`;
  return null;
}

function isInactive(c: CampaignState): boolean {
  return c.activatedAtIteration === null && c.legacyEndingBaseline === null && Object.keys(c.events).length === 0 &&
    Object.keys(c.creditedActions).length === 0 && c.operationalEvidence.length === 0 && c.clue === null && c.route.length === 0 && c.contacts.length === 0;
}

/** The clue must name a record this save holds, read through the same aliases. */
function canonicalClue(c: CampaignState, events: CampaignState['events'], reg: ContentRegistry, iteration: number): CampaignState['clue'] | string {
  if (c.clue === null) return null;
  const event = reg.campaign.retired.has(c.clue.event) ? c.clue.event : reg.campaign.aliases.get(c.clue.event) ?? c.clue.event;
  if (!Object.hasOwn(events, event)) return `save pins a clue to "${c.clue.event}", which has no record`;
  if (c.clue.pinnedAtIteration < (c.activatedAtIteration ?? 0) || c.clue.pinnedAtIteration > iteration) return 'save pins a clue outside campaign play';
  return { ...c.clue, event };
}

/**
 * The shared upgrade path for an already-active campaign whose content has since converted more
 * events (panel round 1 on #242; NH-04 and NH-05 convert more). Activation cannot run twice, so a
 * converted event the save proves resolved but holds no record for gets one here, read exactly as
 * activation reads it: a guarded outcome flag gives the choice and moves into the record, otherwise
 * legacy_unknown. Origin 'legacy' adds no ending evidence and the baseline is not recaptured; the
 * trait already sits in this iteration's operational evidence. A recorded event is never touched,
 * so a flag stored beside its record is still refused, and a second load finds nothing to do. Two
 * stored outcomes that content declares exclusive are refused, never resolved by picking one: the
 * upgrade must not consume evidence a later check depends on. Outcomes content allows together
 * (set in different iterations under the old rules) are old ambiguity and become legacy_unknown.
 */
function upgradeConvertedEvents(s: GameState, reg: ContentRegistry, events: CampaignState['events']): (Pick<GameState, 'narrativeFlags'> & { events: CampaignState['events'] }) | string {
  const added: CampaignState['events'] = {};
  const claimed = new Set<string>();
  for (const event of reg.campaign.events.values()) {
    if (Object.hasOwn(events, event.id)) continue;
    // Two stored outcomes of one event are a contradiction, never a choice to make here.
    const stored = event.choices.flatMap((choice) => choice.effects.setsNarrativeFlag !== undefined && s.narrativeFlags.includes(choice.effects.setsNarrativeFlag) ? [choice.effects.setsNarrativeFlag] : []);
    if (reg.swarm.exclusiveNarrativeFlagGroups.some((group) => stored.filter((flag) => group.includes(flag)).length > 1)) return 'save contains contradictory narrative outcomes';
    const record = legacyRecord(s, event);
    if (!record) continue;
    added[event.id] = record;
    for (const choice of event.choices) if (choice.effects.setsNarrativeFlag) claimed.add(choice.effects.setsNarrativeFlag);
  }
  return { events: { ...events, ...added }, narrativeFlags: s.narrativeFlags.filter((flag) => !claimed.has(flag)) };
}

/** A follow-up record exists only after its original closed with a listed outcome (NH-06); an edited save cannot skip it. */
function followUpProblem(s: GameState, reg: ContentRegistry, events: CampaignState['events']): string | null {
  const history = { narrativeRules: s.narrativeRules, campaign: { ...s.campaign, events } };
  const orphan = Object.keys(events).find((id) => {
    const event = reg.campaign.events.get(id);
    return event !== undefined && !followUpPrerequisiteHolds(history, event);
  });
  return orphan === undefined ? null : `save records follow-up "${orphan}" before the original it follows closed`;
}

/** Returns the reconciled state, or why the save must be refused without loading anything. */
export function reconcileCampaign(loaded: GameState, reg: ContentRegistry): GameState | string {
  if (!isCampaignActive(loaded)) return isInactive(loaded.campaign) ? loaded : 'save carries campaign history without campaign rules';
  const c = loaded.campaign;
  if (c.activatedAtIteration === null || c.activatedAtIteration > loaded.iteration || c.legacyEndingBaseline === null) {
    return 'save has an incomplete campaign activation';
  }
  const checked = canonical(c.events, reg, (id, record) => recordProblem(loaded, reg, id, record));
  if (typeof checked === 'string') return checked;
  // Completion the save proves for newly converted events is read before any live occurrence is
  // reserved, so a stale repeat of a completed event (older saves recurred it after a wipe while its
  // flag survived) is dropped instead of being reserved and hiding the flag (panel round 1 on #259).
  const upgraded = upgradeConvertedEvents(loaded, reg, checked);
  if (typeof upgraded === 'string') return upgraded;
  const { events, narrativeFlags } = upgraded;
  // A v6 save could hold an omen with no reserved occurrence; reserve it once history is known.
  const s = reserveLivePointers(dropStaleRepeats({ ...loaded, narrativeFlags, campaign: { ...c, events } }, reg), reg);
  // Follow-ups are checked against the history as reserved, as before the round 1 reordering.
  const orphan = followUpProblem(s, reg, s.campaign.events);
  if (orphan !== null) return orphan;
  const projected = projectableFlags(reg);
  if (narrativeFlags.some((flag) => projected.has(flag))) return 'save stores an outcome flag that its campaign record owns';
  const twice = obligationProblem({ campaign: { ...c, events } }, reg);
  if (twice !== null) return twice;
  const creditedActions = canonical(c.creditedActions, reg, (id) => reg.campaign.actions.has(id) ? null : `save credits an unknown campaign action "${id}"`);
  if (typeof creditedActions === 'string') return creditedActions;
  const clue = canonicalClue(c, s.campaign.events, reg, s.iteration);
  if (typeof clue === 'string') return clue;
  return { ...s, campaign: { ...s.campaign, creditedActions, clue } };
}
