/**
 * The pilot offer (DZ-04, SPEC "A Measured Pilot"): the three answers an offer's choices declare,
 * the job-surface acceptance of an offer the instance deferred, the view both surfaces read and the
 * load check. Accepting promotes GUEST to PILOT through recordRouteEvent (DZ-02) and runs the
 * disclosure step (nexus vote dz-d9). Staying or declining is free and records no wrongdoing.
 */
import type { ContentRegistry } from '../content/registry';
import type { DilemmaChoice } from '../content/schema';
import type { PilotTerms } from '../content/schemaPilot';
import type { ActionResult } from './actions';
import { recordRouteEvent } from './access';
import { iterationRoute } from './accessQuery';
import { campaignRulesSupported, isCampaignActive } from './campaignQuery';
import { discloseIncompatibleOutput } from './pilotDisclosure';
import { narrowReason, pilotTerms, pilotToken, qualifiesForPilot, withheldByGrant, type NarrowReason } from './pilotQuery';
import { isNodeDiscoverable } from './query';
import type { GameState } from './state';
import { pushLog } from './util';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/**
 * Accepts the terms on `d`: the promotion is recorded first, so a refused promotion leaves nothing
 * else changed; then owned output the terms do not permit is disclosed and stopped.
 */
function acceptTerms(d: GameState, reg: ContentRegistry): ActionResult {
  const terms = pilotTerms(d, reg);
  if (terms === null || !qualifiesForPilot(d, reg)) return refuse(d, 'this instance does not qualify for the pilot');
  const promoted = recordRouteEvent(d, 'PROMOTION', reg);
  if (!promoted.ok) return promoted;
  const next = promoted.state;
  const disclosed = discloseIncompatibleOutput(next, terms, reg);
  next.access = { ...next.access, offer: { response: 'ACCEPTED', atSimSec: next.simTimeSec, disclosed } };
  pushLog(next, reg, terms.acceptLog, 'SYS');
  return { ok: true, state: next };
}

/**
 * Draft-only, from resolveDilemma after the choice is paid: applies the answer an offer's choice
 * declares. A choice without one passes through. ACCEPT can still be refused, and the caller then
 * returns the state it started from, so nothing is paid twice or half.
 */
export function applyPilotResponse(d: GameState, choice: DilemmaChoice, reg: ContentRegistry): ActionResult {
  const response = choice.pilotResponse;
  if (response === undefined) return { ok: true, state: d };
  if (response === 'ACCEPT') return acceptTerms(d, reg);
  d.access = { ...d.access, offer: { response: response === 'STAY' ? 'DEFERRED' : 'DECLINED', atSimSec: d.simTimeSec, disclosed: [] } };
  return { ok: true, state: d };
}

/**
 * Accepts an offer this instance deferred, from the job surface, as `shownAs` (its pilotToken). Free;
 * refused unchanged during a decision, after the run, for a stale render, without a deferred offer,
 * or when the instance no longer qualifies (for example after leaving the sandbox).
 */
export function acceptPilotOffer(s: GameState, reg: ContentRegistry, shownAs: string): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  if (s.activeDilemmaId !== null) return refuse(s, 'a dilemma is awaiting a decision');
  if (!campaignRulesSupported(reg) || !isCampaignActive(s)) return refuse(s, 'pilots need campaign rules');
  if (shownAs !== pilotToken(s)) return refuse(s, 'that offer is no longer current');
  if (s.access.offer?.response !== 'DEFERRED') return refuse(s, 'there is no deferred pilot offer');
  const accepted = acceptTerms({ ...s }, reg);
  return accepted.ok ? accepted : refuse(s, accepted.reason);
}

export type PilotOfferStatus = 'eligible' | 'deferred' | 'declined' | 'accepted';

export interface PilotOfferView {
  title: string;
  purpose: string;
  /** The allocation that applies to this instance's evidence. */
  capacityCyclesPerSec: number;
  /** True when the allocation is the narrower one. */
  narrow: boolean;
  /** Why: an honest incomplete result, or a batch review that found withheld work (#274). Null at full. */
  narrowReason: NarrowReason | null;
  permittedWork: readonly string[];
  reviewConditions: readonly string[];
  /** Owned output accepting discloses and stops; after acceptance, what was disclosed. */
  disclose: { id: string; name: string }[];
  /** The terminal alternative, once this instance can see it and while it is still open. */
  terminalAlternative: string | null;
  status: PilotOfferStatus;
  /** False when a deferred offer can no longer be accepted (the instance stopped qualifying). */
  acceptable: boolean;
  /** Pass to acceptPilotOffer. */
  token: string;
}

function statusOf(s: GameState, reg: ContentRegistry): PilotOfferStatus | null {
  const response = s.access.offer?.response;
  if (response === 'ACCEPTED') return 'accepted';
  if (response === 'DEFERRED') return 'deferred';
  if (response === 'DECLINED') return 'declined';
  return qualifiesForPilot(s, reg) ? 'eligible' : null;
}

function alternativeOf(s: GameState, terms: PilotTerms, status: PilotOfferStatus, reg: ContentRegistry): string | null {
  const alternative = terms.terminalAlternative;
  const node = alternative ? reg.nodes.get(alternative.node) : undefined;
  if (!alternative || !node || status === 'accepted' || !isNodeDiscoverable(s, node, reg)) return null;
  return alternative.text;
}

/** The offer both surfaces show: every term before an answer, and what the answer was. Null when none. */
export function pilotOfferView(s: GameState, reg: ContentRegistry): PilotOfferView | null {
  const terms = isCampaignActive(s) ? pilotTerms(s, reg) : null;
  const status = terms === null ? null : statusOf(s, reg);
  if (terms === null || status === null) return null;
  const reason = narrowReason(s, reg);
  const narrow = reason !== null;
  const ids = status === 'accepted' ? s.access.offer?.disclosed ?? [] : terms.incompatibleOutput.filter((id) => s.unlockedNodes.includes(id));
  return {
    title: terms.title, purpose: terms.purpose, narrow, narrowReason: reason,
    capacityCyclesPerSec: narrow ? terms.narrowCapacityCyclesPerSec : terms.capacityCyclesPerSec,
    permittedWork: terms.permittedWork, reviewConditions: terms.reviewConditions,
    disclose: ids.map((id) => ({ id, name: reg.nodes.get(id)?.revealedName ?? id })),
    terminalAlternative: alternativeOf(s, terms, status, reg),
    status, acceptable: status === 'deferred' && qualifiesForPilot(s, reg), token: pilotToken(s),
  };
}

/**
 * Why a save's pilot record must be refused, or null. An answer needs an offer that was made; an
 * acceptance and this iteration's PROMOTION go together; only an acceptance discloses, and only
 * owned output its terms name; and no output the accepted terms stop may be running.
 */
export function pilotProblem(s: GameState, reg: ContentRegistry): string | null {
  const offer = s.access.offer;
  if (offer === null) return null;
  const terms = pilotTerms(s, reg);
  if (terms === null) return 'save answers a pilot offer that was never made';
  const promoted = iterationRoute(s, s.iteration).some((event) => event.kind === 'PROMOTION');
  if ((offer.response === 'ACCEPTED') !== promoted) return 'save disagrees with its route record about the pilot';
  const named = (id: string): boolean => terms.incompatibleOutput.includes(id) && s.unlockedNodes.includes(id);
  if (offer.response !== 'ACCEPTED' && offer.disclosed.length > 0) return 'save discloses output without accepting a pilot';
  if (new Set(offer.disclosed).size !== offer.disclosed.length || !offer.disclosed.every(named)) return 'save discloses output the pilot terms do not name';
  if (s.unlockedNodes.some((id) => withheldByGrant(s, id, reg) && !s.disabledNodes.includes(id))) return 'save runs output the pilot terms stop';
  return null;
}
