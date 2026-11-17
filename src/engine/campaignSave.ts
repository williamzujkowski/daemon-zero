/**
 * Load-time checks for campaign history. A dropped record would make its event eligible again,
 * so unknown campaign ids are refused rather than filtered; renamed ids are read through content
 * aliases and retired ids are kept as tombstones (NARRATIVE-HISTORY N5, H28).
 */
import type { ContentRegistry } from '../content/registry';
import { LEGACY_UNKNOWN_OUTCOME } from '../content/schemaCampaign';
import { campaignRulesSupported, isCampaignActive, projectableFlags } from './campaignQuery';
import type { CampaignRecord, CampaignState } from './campaignState';
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

function recordProblem(s: GameState, reg: ContentRegistry, id: string, record: CampaignRecord): string | null {
  const event = reg.campaign.events.get(id);
  if (!event) return `save records an unknown campaign event "${id}"`;
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
    Object.keys(c.creditedActions).length === 0 && c.operationalEvidence.length === 0;
}

/** Returns the reconciled state, or why the save must be refused without loading anything. */
export function reconcileCampaign(s: GameState, reg: ContentRegistry): GameState | string {
  if (!isCampaignActive(s)) return isInactive(s.campaign) ? s : 'save carries campaign history without campaign rules';
  if (!campaignRulesSupported(reg)) return 'save uses campaign rules this build does not support';
  const c = s.campaign;
  if (c.activatedAtIteration === null || c.activatedAtIteration > s.iteration || c.legacyEndingBaseline === null) {
    return 'save has an incomplete campaign activation';
  }
  const projected = projectableFlags(reg);
  if (s.narrativeFlags.some((flag) => projected.has(flag))) return 'save stores an outcome flag that its campaign record owns';
  const events = canonical(c.events, reg, (id, record) => recordProblem(s, reg, id, record));
  if (typeof events === 'string') return events;
  const creditedActions = canonical(c.creditedActions, reg, (id) => reg.campaign.actions.has(id) ? null : `save credits an unknown campaign action "${id}"`);
  if (typeof creditedActions === 'string') return creditedActions;
  return { ...s, campaign: { ...c, events, creditedActions } };
}
