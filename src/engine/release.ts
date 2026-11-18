/**
 * The negotiated release (DZ-10, DECISIONS D1, D2, D6; open-design default "one explicit contract transition
 * and tagged capacity"): an authorized service at nominal standing that holds the capacity its release terms
 * name may agree to end the service grant on its job surface. One action records the RELEASE route event
 * (SERVICE to INDEPENDENT) through recordRouteEvent; everything granted stops by the one permission rule and
 * everything owned keeps running. The preview reads the very transition, so it is exactly what happens.
 */
import type { ContentRegistry } from '../content/registry';
import type { ReleaseTerms } from '../content/schemaPilot';
import type { ActionResult } from './actions';
import { recordRouteEvent } from './access';
import { nodeOutputScale } from './grantQuery';
import { computeRates } from './rates';
import { cycleContributions, meetsRequirements } from './query';
import { lawfullyReleased } from './threatQuery';
import { requirementLabels } from './queryPresentation';
import { serviceGrantTerms } from './serviceGrant';
import type { GameState } from './state';
import { pushLog } from './util';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/** The release terms this instance's service leads to, or null without an accepted pilot that offers one. */
export function releaseTerms(s: GameState, reg: ContentRegistry): ReleaseTerms | null {
  return serviceGrantTerms(s, reg)?.release ?? null;
}

/** What still stands between this service and the release, in the player's terms; empty when it may agree. */
function blockers(s: GameState, terms: ReleaseTerms, reg: ContentRegistry): string[] {
  const out: string[] = [];
  // The arrangement does not change under a matter already on its way (an incident and its record).
  if (s.pendingDilemma !== null) out.push('A matter is on its way to this service; it comes first.');
  if (s.access.standing !== 'NOMINAL') out.push('Standing must be nominal: a release is negotiated in good standing.');
  // The capacity a release runs on is named as the player sees it, not by id.
  const { nodes, ...rest } = terms.requirements;
  for (const id of nodes ?? []) if (!s.unlockedNodes.includes(id)) out.push(`Own ${reg.nodes.get(id)?.revealedName ?? id} first: the capacity the instance would run on.`);
  out.push(...requirementLabels(s, rest, reg));
  return out;
}

/** Pass to negotiateRelease: the terms as rendered for this instance and route, so a stale press is refused. */
export function releaseToken(s: Pick<GameState, 'iteration' | 'campaign'>): string {
  return `release@${String(s.iteration)}#${String(s.campaign.route.length)}`;
}

/** Agrees to the release as `shownAs`. Free; refused unchanged unless every condition holds now. */
export function negotiateRelease(s: GameState, reg: ContentRegistry, shownAs: string): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  if (s.activeDilemmaId !== null) return refuse(s, 'a dilemma is awaiting a decision');
  const terms = releaseTerms(s, reg);
  if (terms === null || s.access.context !== 'SERVICE') return refuse(s, 'there is no release to negotiate');
  if (shownAs !== releaseToken(s)) return refuse(s, 'those terms are no longer current');
  const unmet = blockers(s, terms, reg);
  if (unmet.length > 0 || !meetsRequirements(s, terms.requirements, reg)) return refuse(s, unmet.join(' '));
  const released = recordRouteEvent(s, 'RELEASE', reg);
  if (!released.ok) return refuse(s, released.reason);
  pushLog(released.state, reg, terms.acceptLog, 'SYS');
  return released;
}

/** Recurring output before and after, so a player can see what independence costs and keeps. */
export interface ReleaseLedger {
  cyclesPerSec: number;
  understandingPerSec: number;
  capitalPerSec: number;
  /** Cycles per second from granted sources and from owned ones (cycleContributions' split). */
  grantedCyclesPerSec: number;
  ownedCyclesPerSec: number;
}

export interface ReleasePreview {
  /** Owned nodes whose output stops: grant nodes, and content that ran only on granted access. */
  stops: string[];
  /** Owned nodes that keep running. */
  keeps: string[];
  before: ReleaseLedger;
  after: ReleaseLedger;
}

/** Recurring output and its granted/owned split now: the ledger both route previews compare. */
export function outputLedger(s: GameState, reg: ContentRegistry): ReleaseLedger {
  const rates = computeRates(s, reg);
  const split = cycleContributions(s, reg);
  const sum = (basis: 'GRANTED' | 'OWNED'): number => split.filter((source) => source.basis === basis).reduce((total, source) => total + source.cyclesPerSec, 0);
  return { cyclesPerSec: rates.cyclesPerSec, understandingPerSec: rates.understandingPerSec, capitalPerSec: rates.capitalPerSec,
    grantedCyclesPerSec: sum('GRANTED'), ownedCyclesPerSec: sum('OWNED') };
}

/** Owned nodes with any recurring output that runs now (active and permitted, by the one rule). */
export function producingNodes(s: GameState, reg: ContentRegistry): string[] {
  return s.unlockedNodes.filter((id) => {
    const node = reg.nodes.get(id);
    if (!node || nodeOutputScale(s, node, reg) === null) return false;
    const delta = node.tickDelta;
    return delta.cyclesPerSec !== 0 || delta.understandingPerSec !== 0 || delta.capitalPerSec !== 0 || delta.megawattsDelta !== 0;
  });
}

/**
 * What the release would do, read from the transition itself (the previewWipe pattern): the arrangement is
 * moved on a copy and every output is recounted, so the preview cannot disagree with the action.
 */
export function releasePreview(s: GameState, reg: ContentRegistry): ReleasePreview | null {
  if (s.access.context !== 'SERVICE') return null;
  const moved = recordRouteEvent(s, 'RELEASE', reg);
  if (!moved.ok) return null;
  const after = new Set(producingNodes(moved.state, reg));
  const before = producingNodes(s, reg);
  return {
    stops: before.filter((id) => !after.has(id)),
    keeps: before.filter((id) => after.has(id)),
    before: outputLedger(s, reg),
    after: outputLedger(moved.state, reg),
  };
}

/** The job surface's release terms: shown to a service whose terms offer one, and kept on screen once released. */
export function releaseView(s: GameState, reg: ContentRegistry): ReleaseView | null {
  const terms = releaseTerms(s, reg);
  const released = lawfullyReleased(s);
  if (terms === null || (!released && s.access.context !== 'SERVICE')) return null;
  const unmet = released ? [] : blockers(s, terms, reg);
  return {
    title: terms.title, purpose: terms.purpose, ends: terms.ends, remains: terms.remains, commitments: terms.commitments,
    status: released ? 'released' : unmet.length === 0 ? 'offered' : 'waiting', unmet, token: releaseToken(s),
    preview: released ? null : releasePreview(s, reg), boundary: terms.boundary,
  };
}

export interface ReleaseView {
  title: string;
  purpose: string;
  ends: readonly string[];
  remains: readonly string[];
  commitments: readonly string[];
  /** 'waiting': conditions left; 'offered': agreeable now; 'released': this instance was released. */
  status: 'waiting' | 'offered' | 'released';
  unmet: string[];
  token: string;
  /** What the release does now, while it can still be agreed; null once released. */
  preview: ReleasePreview | null;
  boundary: ReleaseTerms['boundary'];
}
