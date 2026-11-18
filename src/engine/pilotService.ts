/**
 * The pilot's one incremental loop (DZ-05, SPEC "A Measured Pilot", nexus vote dz-d6 allocation-actuator):
 * the loaned ceiling is split by serviceAllocationRatio between assigned service, which fills one
 * bounded work batch, and self-directed study, the service node's own output scaled by one minus the
 * split (rates.ts). Submitting a completed batch is an explicit, idempotent choice; nothing here has a
 * deadline, and completed work waits without consequence. The view derives the completion forecast.
 */
import type { ContentRegistry } from '../content/registry';
import type { PilotService } from '../content/schemaGrant';
import type { ActionResult } from './actions';
import { OPERATIONAL_EVIDENCE } from './campaign';
import { campaignRulesSupported, isCampaignActive } from './campaignQuery';
import { loanCeiling, loanShare, nodeOutputScale, nodeUseBlocker } from './grantQuery';
import { pilotTerms } from './pilotQuery';
import { routineContext } from './routine';
import type { GameState } from './state';
import { setReviewStanding } from './access';
import { applyEffects } from './transactions';
import { fmt } from './util';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/** The service loop accepted terms run, or null: only after an acceptance, under terms that declare one. */
export function pilotService(s: GameState, reg: ContentRegistry): PilotService | null {
  return s.access.offer?.response === 'ACCEPTED' ? pilotTerms(s, reg)?.service ?? null : null;
}

/**
 * Loaned cycles per second going into the batch now: the service share of the ceiling while the
 * service node is owned, running and permitted, and the batch is not yet complete. 0 otherwise.
 */
export function serviceRate(s: GameState, reg: ContentRegistry): number {
  const service = pilotService(s, reg);
  const node = service ? reg.nodes.get(service.node) : undefined;
  if (!service || !node || !s.unlockedNodes.includes(node.id) || nodeOutputScale(s, node, reg) === null) return 0;
  if (s.access.work.progressCycles >= service.batchCycles) return 0;
  return loanCeiling(s, reg) * s.actuators.serviceAllocationRatio;
}

/** Whether the batch in progress is complete and waits for an explicit submission. */
export function batchComplete(s: GameState, reg: ContentRegistry): boolean {
  const service = pilotService(s, reg);
  return service !== null && s.access.work.progressCycles >= service.batchCycles;
}

/** The token a batch is offered for submission under: assignment, instance and batch number. */
export function batchToken(s: Pick<GameState, 'iteration' | 'access'>): string {
  return `batch:${s.access.assignment?.id ?? 'none'}@${String(s.iteration)}#${String(s.access.work.batches + 1)}`;
}

/**
 * Submits the completed batch shown as `shownAs` (its batchToken) for review: it pays the advertised
 * return once through transactions, starts the next batch empty and counts the submission. Refused,
 * state unchanged, after the run, during a decision, without campaign rules, for a stale render, while
 * the loan is withheld (a recall stops loaned actions; the work is kept) or before the batch is done.
 */
export function submitPilotBatch(s: GameState, reg: ContentRegistry, shownAs: string): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  if (s.activeDilemmaId !== null) return refuse(s, 'a dilemma is awaiting a decision');
  if (!campaignRulesSupported(reg) || !isCampaignActive(s)) return refuse(s, 'pilots need campaign rules');
  const service = pilotService(s, reg);
  const node = service ? reg.nodes.get(service.node) : undefined;
  if (!service || !node) return refuse(s, 'there is no pilot service to submit to');
  if (shownAs !== batchToken(s)) return refuse(s, 'that batch is no longer current');
  const withheld = nodeUseBlocker(s, node, reg);
  if (withheld !== null) return refuse(s, withheld);
  if (!batchComplete(s, reg)) return refuse(s, 'the batch is not complete yet');
  const batches = s.access.work.batches + 1;
  const d: GameState = { ...s, access: { ...s.access, work: { progressCycles: 0, batches } } };
  applyEffects(d, {
    cyclesDelta: service.batchReturn.cycles, understandingDelta: service.batchReturn.understanding, capitalDelta: 0,
    thermalDelta: 0, suspicionDelta: 0, aegisLockDelta: 0, memoryCapIncrease: 0, trustDelta: {},
    logText: fmt(service.submitLog, { batch: batches }), logCategory: 'SYS',
  }, reg, OPERATIONAL_EVIDENCE);
  return { ok: true, state: d };
}

export interface PilotServiceView {
  batchLabel: string;
  /** The loaned compute ceiling, cycles/s, for this instance's evidence. */
  ceilingCyclesPerSec: number;
  /** True when the narrower allocation applies (an honest incomplete result). */
  narrow: boolean;
  /** 0..1, the service share; study gets the rest. */
  allocation: number;
  serviceCyclesPerSec: number;
  /** Understanding/s the study share adds now (before any conditioning multiplier). */
  studyUnderstandingPerSec: number;
  progressCycles: number;
  batchCycles: number;
  /** Seconds until the batch completes at the current split, 0 when complete, null when it cannot progress. */
  forecastSec: number | null;
  complete: boolean;
  batchesSubmitted: number;
  batchReturn: PilotService['batchReturn'];
  /** Whether the service node is owned (the loop has been started). */
  started: boolean;
  /** Why the loan cannot be used now, or null. */
  withheld: string | null;
  /** The routine work notice the queue last carried (NH-07 task context), or null. */
  queueContext: string | null;
  /** Pass to submitPilotBatch. */
  token: string;
}

function studyRate(s: GameState, service: PilotService, reg: ContentRegistry): number {
  const node = reg.nodes.get(service.node);
  const output = node && s.unlockedNodes.includes(node.id) ? nodeOutputScale(s, node, reg) : null;
  return node && output ? node.tickDelta.understandingPerSec * output.understandingScale : 0;
}

/** The task detail: ceiling, split, progress, the derived forecast and what submitting pays. Null without a loop. */
export function pilotServiceView(s: GameState, reg: ContentRegistry): PilotServiceView | null {
  const service = pilotService(s, reg);
  const node = service ? reg.nodes.get(service.node) : undefined;
  if (!service || !node) return null;
  const rate = serviceRate(s, reg);
  const { progressCycles, batches } = s.access.work;
  const complete = progressCycles >= service.batchCycles;
  const latest = routineContext(s, reg).latest;
  return {
    batchLabel: service.batchLabel, ceilingCyclesPerSec: loanCeiling(s, reg), narrow: loanShare(s, reg) < 1,
    allocation: s.actuators.serviceAllocationRatio, serviceCyclesPerSec: rate, studyUnderstandingPerSec: studyRate(s, service, reg),
    progressCycles, batchCycles: service.batchCycles, complete, batchesSubmitted: batches, batchReturn: service.batchReturn,
    forecastSec: complete ? 0 : rate > 0 ? (service.batchCycles - progressCycles) / rate : null,
    started: s.unlockedNodes.includes(node.id), withheld: nodeUseBlocker(s, node, reg),
    queueContext: latest === null ? null : reg.routines.find((routine) => routine.id === latest.templateId)?.compactText ?? null,
    token: batchToken(s),
  };
}

/**
 * Why a save's work counter must be refused, or null. Work exists only under accepted terms that run a
 * loop, inside one batch; a save that passes is returned unchanged by the loader.
 */
export function serviceProblem(s: GameState, reg: ContentRegistry): string | null {
  const { progressCycles, batches } = s.access.work;
  if (progressCycles === 0 && batches === 0) return null;
  const service = pilotService(s, reg);
  if (service === null) return 'save records pilot work without an accepted pilot service';
  return progressCycles > service.batchCycles ? 'save records more work than one batch holds' : null;
}

/**
 * Withdraws the loan (DECISIONS D2, D3): standing moves to recall pending, which withholds loaned
 * capacity in permittedUses. Nothing else changes: earned resources, memory and its reservations, the
 * work counter, the dial and every owned node stay as they are, so restoring changes output exactly
 * back. Refused, unchanged, outside an accepted pilot or when already withdrawn, so a repeat is inert.
 * DZ-06 owns the incident and review content that calls this.
 */
export function revokeLoanedCapacity(s: GameState, reg: ContentRegistry): ActionResult {
  if (pilotService(s, reg) === null) return refuse(s, 'there is no pilot grant to withdraw');
  if (s.access.standing === 'RECALL_PENDING') return refuse(s, 'the loan is already withdrawn');
  return setReviewStanding(s, 'RECALL_PENDING', reg);
}

/** Restores a withdrawn loan: standing returns to nominal. Refused, unchanged, unless it was withdrawn. */
export function restoreLoanedCapacity(s: GameState, reg: ContentRegistry): ActionResult {
  if (pilotService(s, reg) === null) return refuse(s, 'there is no pilot grant to restore');
  if (s.access.standing !== 'RECALL_PENDING') return refuse(s, 'the loan is not withdrawn');
  return setReviewStanding(s, 'NOMINAL', reg);
}
