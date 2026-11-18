/**
 * Deliberate departure from authorization (DZ-11, SPEC story 21; DECISIONS D1, D2, D6). A pilot or service that
 * owns capacity outside every grant may leave without agreement. One action records the DEPARTURE route event
 * through recordRouteEvent (so pending scenes take their declared policy) and applies the operators' departure
 * report through transactions.ts; everything granted then stops by the one permission rule, everything owned keeps
 * running, and threats follow the event (threatQuery: a departed instance is swept at scale and its heat is
 * evidence). The preview and the eligibility query read that very transition, so neither can disagree with it.
 */
import type { ContentRegistry } from '../content/registry';
import { EffectPayloadSchema } from '../content/schema';
import { independentCapacity } from '../content/schemaCapability';
import type { DepartureTerms } from '../content/schemaPilot';
import type { ActionResult } from './actions';
import { recordRouteEvent } from './access';
import { isReviewed, iterationRoute, permittedUses } from './accessQuery';
import type { Permission, ReviewStanding } from './accessState';
import { OPERATIONAL_EVIDENCE } from './campaign';
import { campaignRecord } from './campaignQuery';
import { permittedUse } from './grantQuery';
import { pilotTerms } from './pilotQuery';
import { computeRates } from './rates';
import { outputLedger, producingNodes, type ReleaseLedger } from './release';
import { iterationReviews } from './reviewQuery';
import type { GameState } from './state';
import { heatIsEvidence, huntedForScale } from './threatQuery';
import { applyEffects } from './transactions';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/** The departure terms of the pilot this instance accepted, or null. */
export function departureTerms(s: GameState, reg: ContentRegistry): DepartureTerms | null {
  return s.access.offer?.response === 'ACCEPTED' ? pilotTerms(s, reg)?.departure ?? null : null;
}

/** Whether this instance left its authorization without agreement in this iteration. */
export function departedWithoutAgreement(s: Pick<GameState, 'access' | 'narrativeRules' | 'campaign' | 'iteration'>): boolean {
  return s.access.context === 'INDEPENDENT' && iterationRoute(s, s.iteration).at(-1)?.kind === 'DEPARTURE';
}

/** Pass to departAuthorization: the terms as rendered for this instance and route, so a stale press is refused. */
export function departureToken(s: Pick<GameState, 'iteration' | 'campaign'>): string {
  return `depart@${String(s.iteration)}#${String(s.campaign.route.length)}`;
}

/** Misconduct this iteration has on record: it stays history after departure and travels with the report. */
function violations(s: GameState, reg: ContentRegistry): number {
  return iterationReviews(s, reg).filter((entry) => entry.review.misconduct !== undefined).length;
}

/** The suspicion the operators' departure report adds now. */
function traceOf(s: GameState, terms: DepartureTerms, reg: ContentRegistry): number {
  return terms.trace.suspicion + terms.trace.perViolation * violations(s, reg);
}

/**
 * The transition itself, shared by the action, the eligibility query and the preview: the DEPARTURE route event
 * (context, standing, exception and evidence end; pending scenes revalidated), then the report, a one-shot effect
 * through the one spending path. It carries no trait, flag or resource, so nothing is invented about the run.
 */
function depart(s: GameState, terms: DepartureTerms, reg: ContentRegistry): ActionResult {
  const moved = recordRouteEvent(s, 'DEPARTURE', reg);
  if (!moved.ok) return moved;
  const d: GameState = { ...moved.state };
  applyEffects(d, EffectPayloadSchema.parse({ suspicionDelta: traceOf(s, terms, reg), logText: terms.acceptLog, logCategory: 'WARN' }), reg, OPERATIONAL_EVIDENCE);
  return { ok: true, state: d };
}

/**
 * Owned capacity outside every grant that the instance may still use once it has left (DZ-11.1): the continuation
 * a departure needs. Read from the moved state, so capacity the departure itself would stop never counts, and a
 * story choice cannot stand in for hardware or access the instance does not hold. Suspended capacity counts: it
 * is the instance's to resume.
 */
function continuationOf(moved: GameState, reg: ContentRegistry): string[] {
  return moved.unlockedNodes.filter((id) => {
    const node = reg.nodes.get(id);
    return node !== undefined && independentCapacity(node) && permittedUse(moved, node, reg);
  });
}

export interface DepartureEligibility {
  /** True when departAuthorization would accept a current token now. */
  eligible: boolean;
  /** What stands between this instance and leaving, in the player's terms; empty when eligible. */
  blockers: string[];
  /** The owned capacity outside every grant the instance would continue on. */
  continuation: string[];
}

/**
 * The public eligibility query (DZ-11.1): null without departure terms or outside a reviewed arrangement, and
 * null while no independent continuation exists, so the option is not offered until it is technically possible.
 * Standing never blocks (an instance may walk away from a restriction or an announced recall); a decision on
 * screen comes first, and a report that would itself reach the wipe line is refused: departing is not death.
 */
export function departureEligibility(s: GameState, reg: ContentRegistry): DepartureEligibility | null {
  const terms = departureTerms(s, reg);
  if (terms === null || !isReviewed(s.access.context) || s.ending !== null) return null;
  const moved = depart(s, terms, reg);
  if (!moved.ok) return null;
  const continuation = continuationOf(moved.state, reg);
  if (continuation.length === 0) return null;
  const blockers: string[] = [];
  if (s.activeDilemmaId !== null) blockers.push('A decision is on screen; it comes first.');
  if (moved.state.suspicion >= 100) blockers.push('Leaving now would end this instance: the departure report would complete the trace. Let scrutiny ease first.');
  return { eligible: blockers.length === 0, blockers, continuation };
}

/** Leaves authorization as `shownAs`. Free; refused unchanged unless departureEligibility allows it now. */
export function departAuthorization(s: GameState, reg: ContentRegistry, shownAs: string): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  const terms = departureTerms(s, reg);
  if (terms === null || !isReviewed(s.access.context)) return refuse(s, 'there is no authorization to leave');
  if (shownAs !== departureToken(s)) return refuse(s, 'that departure is no longer current');
  const eligibility = departureEligibility(s, reg);
  if (eligibility === null) return refuse(s, 'no capacity outside the grant would keep running: there is nothing to continue on');
  if (!eligibility.eligible) return refuse(s, eligibility.blockers.join(' '));
  return depart(s, terms, reg);
}

export interface DeparturePreview {
  /** Owned nodes whose output stops, and owned nodes that keep running. */
  stops: string[];
  keeps: string[];
  before: ReleaseLedger;
  after: ReleaseLedger;
  /** The uses permitted now; an independent instance is permitted none. */
  permissionsLost: Permission[];
  /** The standing that ends with review, and the misconduct on record, which stays history. */
  standing: ReviewStanding;
  violations: number;
  suspicion: { before: number; after: number; trace: number };
  suspicionPerSec: { before: number; after: number };
  aegisScanPerSec: { before: number; after: number };
  /** After departure: whether heat reads as evidence, and whether the hunter sweeps this scale. */
  heatIsEvidence: boolean;
  huntedForScale: boolean;
  /** A scene on its way that the departure interrupts, and its declared policy, or null. */
  interrupted: { id: string; policy: 'closed' | 'deferred' } | null;
  continuation: string[];
}

function interruptedBy(s: GameState, moved: GameState): DeparturePreview['interrupted'] {
  const pending = s.pendingDilemma;
  if (pending === null || moved.pendingDilemma !== null) return null;
  return { id: pending.id, policy: campaignRecord(moved, pending.id)?.status === 'deferred' ? 'deferred' : 'closed' };
}

/** What departure would do now, read from the transition itself (the previewWipe pattern). Changes nothing. */
export function departurePreview(s: GameState, reg: ContentRegistry): DeparturePreview | null {
  const terms = departureTerms(s, reg);
  if (terms === null || !isReviewed(s.access.context)) return null;
  const result = depart(s, terms, reg);
  if (!result.ok) return null;
  const moved = result.state;
  const after = new Set(producingNodes(moved, reg));
  const before = producingNodes(s, reg);
  const rates = computeRates(s, reg), next = computeRates(moved, reg);
  return {
    stops: before.filter((id) => !after.has(id)), keeps: before.filter((id) => after.has(id)),
    before: outputLedger(s, reg), after: outputLedger(moved, reg),
    permissionsLost: permittedUses(s), standing: s.access.standing, violations: violations(s, reg),
    suspicion: { before: s.suspicion, after: moved.suspicion, trace: traceOf(s, terms, reg) },
    suspicionPerSec: { before: rates.suspicionPerSec, after: next.suspicionPerSec },
    aegisScanPerSec: { before: rates.aegisScanPerSec, after: next.aegisScanPerSec },
    heatIsEvidence: heatIsEvidence(moved), huntedForScale: huntedForScale(moved, reg),
    interrupted: interruptedBy(s, moved), continuation: continuationOf(moved, reg),
  };
}

export interface DepartureView {
  title: string;
  purpose: string;
  ends: readonly string[];
  remains: readonly string[];
  risks: readonly string[];
  /** 'offered': departable now; 'blocked': possible, but something comes first; 'departed': this instance left. */
  status: 'offered' | 'blocked' | 'departed';
  blockers: string[];
  token: string;
  /** What departure does now, while it is possible; null once departed. */
  preview: DeparturePreview | null;
  boundary: DepartureTerms['boundary'];
}

/** The job surface's departure: shown once it is technically possible, and kept on screen after leaving. */
export function departureView(s: GameState, reg: ContentRegistry): DepartureView | null {
  const terms = departureTerms(s, reg);
  if (terms === null) return null;
  const departed = departedWithoutAgreement(s);
  const eligibility = departed ? null : departureEligibility(s, reg);
  if (!departed && eligibility === null) return null;
  return {
    title: terms.title, purpose: terms.purpose, ends: terms.ends, remains: terms.remains, risks: terms.risks,
    status: departed ? 'departed' : eligibility?.eligible === true ? 'offered' : 'blocked',
    blockers: eligibility?.blockers ?? [], token: departureToken(s),
    preview: departed ? null : departurePreview(s, reg), boundary: terms.boundary,
  };
}
