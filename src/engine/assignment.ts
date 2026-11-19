/**
 * Assigned work (DZ-03, nexus vote dz-d3, engine-action-from-manifest): the explicit acceptance
 * offered on the job surface, the view that surface shows, the evidence an assessment choice
 * submits and the load check that keeps an assessment tied to an acceptance. Ignoring an offer
 * changes nothing; accepting it lets the declared assessment schedule like any other dilemma.
 */
import type { ContentRegistry } from '../content/registry';
import type { Cost, Dilemma, DilemmaChoice } from '../content/schema';
import type { AssessmentStage } from '../content/schemaAssessment';
import type { Assignment } from '../content/schemaAssignment';
import type { ActionResult } from './actions';
import { holdsQualification, isPermitted } from './accessQuery';
import type { Qualification } from './accessState';
import { assessmentOf, assessmentStage, meetsAssignment, offerToken } from './assignmentQuery';
import { accessHolds } from './campaignLifecycle';
import { isCampaignActive } from './campaignQuery';
import { meetsRequirements } from './query';
import type { GameState } from './state';
import { pushLog } from './util';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/** Whether this instance is shown the offer now: not yet accepting anything, and taking assigned work. */
function offered(s: GameState, assignment: Assignment, reg: ContentRegistry): boolean {
  return s.access.assignment === null && isPermitted(s, 'ASSIGNED_WORK') && meetsRequirements(s, assignment.requirements, reg);
}

function blocked(s: GameState): string | null {
  if (s.ending !== null) return 'the run has ended';
  if (s.activeDilemmaId !== null) return 'a dilemma is awaiting a decision';
  if (!isCampaignActive(s)) return 'assignments need campaign rules';
  return null;
}

/**
 * Accepts the offer shown under `offer` (its offerToken). Free, once per instance; a duplicate, a
 * stale render or an offer never shown is refused unchanged. It schedules nothing directly: the
 * assessment's trigger now holds, so the ordinary scheduler brings its omen and interrupt.
 */
export function acceptAssignment(s: GameState, assignmentId: string, reg: ContentRegistry, offer: string): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const assignment = reg.assignments.get(assignmentId);
  if (!assignment) return refuse(s, 'unknown assignment');
  if (offer !== offerToken(s, assignmentId)) return refuse(s, 'that offer is no longer current');
  if (s.access.assignment !== null) return refuse(s, 'an assignment is already accepted');
  if (!offered(s, assignment, reg)) return refuse(s, 'that assignment has not been offered');
  const d: GameState = { ...s, access: { ...s.access, assignment: { id: assignmentId, acceptedAtSimSec: s.simTimeSec } } };
  pushLog(d, reg, assignment.acceptLog, 'SYS');
  return { ok: true, state: d };
}

/**
 * 'lapsed': accepted, but the assessment can no longer reach this instance (its declared access ended, as at
 * the escape, nexus vote scenes-lapse-at-escape) and nothing was submitted. A wipe brings a fresh offer.
 */
export type AssignmentStatus = 'offered' | 'accepted' | 'lapsed' | 'submitted';

export interface AssignmentView {
  id: string;
  title: string;
  stage: AssessmentStage;
  /** The offer text for this stage: a later instance reads the requalification job, not the original. */
  offer: string;
  status: AssignmentStatus;
  /** Pass to acceptAssignment. */
  token: string;
  /** The current qualification evidence, once this instance has submitted any. */
  qualification: Qualification | null;
  /** What accepting leads to, read from the assessment this stage queues; null when there is none. */
  assessment: AssessmentPreview | null;
}

/**
 * The wait and price an offer should state before it is accepted (#276): the assessment's omen, and
 * its fullest honest answer (a completed result with no discrepancy, the dearest if several), whose
 * price may need compute banked first because the clock pauses when the assessment arrives.
 */
export interface AssessmentPreview {
  omenSec: number;
  fullest: { label: string; cost: Cost } | null;
}

function costTotal(cost: Cost): number {
  return cost.cycles + cost.understanding + cost.capital + cost.memory;
}

function assessmentPreview(assessment: Dilemma | undefined, reg: ContentRegistry): AssessmentPreview | null {
  if (assessment === undefined) return null;
  const honest = assessment.choices.filter((choice) => choice.qualification?.result === 'COMPLETED' && !choice.qualification.discrepancy);
  const fullest = honest.reduce<DilemmaChoice | undefined>((best, choice) => best === undefined || costTotal(choice.cost) > costTotal(best.cost) ? choice : best, undefined);
  return { omenSec: assessment.omenSec ?? reg.balance.dilemmaOmenSec, fullest: fullest === undefined ? null : { label: fullest.label, cost: fullest.cost } };
}

function inFlight(s: GameState, id: string): boolean {
  return s.pendingDilemma?.id === id || s.activeDilemmaId === id;
}

/** The assignment on the job surface: the one accepted, or the first one offered. Null when none. */
export function assignmentView(s: GameState, reg: ContentRegistry): AssignmentView | null {
  if (!isCampaignActive(s)) return null;
  for (const assignment of reg.assignments.values()) {
    const accepted = s.access.assignment?.id === assignment.id;
    if (!accepted && !offered(s, assignment, reg)) continue;
    const stage = assessmentStage(s, assignment.id, reg);
    const assessment = assessmentOf(reg, assignment.id, stage);
    const submitted = accepted && assessment !== undefined && s.resolvedDilemmas.includes(assessment.id);
    const lapsed = accepted && !submitted && assessment !== undefined && !inFlight(s, assessment.id) && !accessHolds(s, assessment, reg);
    return {
      id: assignment.id, title: assignment.title, stage, offer: stage === 'original' ? assignment.offer : assignment.requalificationOffer,
      status: submitted ? 'submitted' : lapsed ? 'lapsed' : accepted ? 'accepted' : 'offered', token: offerToken(s, assignment.id), qualification: s.access.qualification,
      assessment: assessmentPreview(assessment, reg),
    };
  }
  return null;
}

/**
 * Draft-only. Writes the evidence an assessment or scope-review choice submits as this run's current
 * evidence (DECISIONS D4); the choice itself is the campaign record. Inert under legacy rules, so it
 * can never write evidence the loader refuses.
 */
export function recordSubmittedEvidence(d: GameState, choice: DilemmaChoice): void {
  if (!isCampaignActive(d) || !holdsQualification(d.access.context)) return;
  if (choice.qualification) d.access = { ...d.access, qualification: { ...choice.qualification, recordedAtSimSec: d.simTimeSec } };
  if (choice.scope) d.access = { ...d.access, scope: { conduct: choice.scope, recordedAtSimSec: d.simTimeSec } };
}

/**
 * Why a save's assignment must be refused, or null. An accepted id must exist, and an assessment
 * on screen or on its way needs the acceptance that led to it, so an edited save cannot reach an
 * assessment, or the evidence it submits, without accepting.
 */
export function assignmentProblem(s: GameState, reg: ContentRegistry): string | null {
  const accepted = s.access.assignment;
  if (accepted !== null && !reg.assignments.has(accepted.id)) return 'save accepts an unknown assignment';
  for (const id of [s.activeDilemmaId, s.pendingDilemma?.id]) {
    const gate = reg.dilemmas.find((dilemma) => dilemma.id === id)?.trigger.assignment;
    if (gate && !meetsAssignment(s, gate, reg)) return 'save holds an assessment this instance never accepted';
  }
  return null;
}
