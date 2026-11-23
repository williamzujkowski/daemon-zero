/**
 * The free-fallback table (#461, #488): every constrained resource that can trap a run, the state that traps it, and
 * the free relief levers that get it out. A lever is free when it costs nothing and is always offered; anything that
 * spends a resource is not relief. integrityFallback.ts reads each row's rule generically, and the guard spec
 * (tests/free-fallback-guard.spec.ts) pulls the same levers on real states. AGENTS.md law 7's no-soft-lock rule, for rates.
 */
import type { TickDelta } from './schema';

/**
 * DISMISS_LEVEL: release one level of a dismissable track. SUSPEND_NODE: suspend a suspendable node. RELEASE_MEMBER:
 * let one cohort member go. DIAL_FLOOR: a dial-bound node's dial at its quiet end (a linear binding at 0 zeroes the
 * bound node's compute, heat and suspicion). ALLOCATION_DIAL: divert compute to capital, up to maxProfitAllocation.
 * NATURAL_DECAY: suspicion's own decay (balance suspicionDecayPerSec, slowed by escalation rungs). THERMAL_RETIREMENT:
 * from balance thermalRetiresAtPhase, heat is no longer evidence.
 */
export type ReliefLever = 'DISMISS_LEVEL' | 'SUSPEND_NODE' | 'RELEASE_MEMBER' | 'DIAL_FLOOR' | 'ALLOCATION_DIAL' | 'NATURAL_DECAY'
  | 'THERMAL_RETIREMENT';

export type ResourceName = 'compute' | 'capital' | 'power' | 'thermal' | 'memory' | 'storage' | 'understanding' | 'suspicion';

/**
 * How a row proves a permanent holding (an unsuspendable node, an undismissable track, an unreleasable cohort, an
 * output that never expires) safe. never: no permanent holding may worsen it. divertible: a permanent cost is paid by
 * the holding's own compute through the allocation dial. budget: what a permanent holding and its guaranteed
 * prerequisites add, plus the worst every unrelated permanent holding could add, stays within the row's limit.
 * reservation: undoing a holding must never take back capacity that is in use, and what holds the capacity must be
 * undoable for free (`heldBy`).
 */
export type FallbackRule = 'never' | 'divertible' | 'budget' | 'reservation';

/** A budget row's limit: the heat the room sheds below the overheat threshold, or nothing (net zero). */
export type BudgetLimit = 'coolingHeadroom' | 'zero';

export interface ConstrainedResource {
  resource: ResourceName;
  /** The per-second term that moves it and which sign is worse; memory and storage have none, they are reserved. */
  rate: { key: keyof TickDelta; worse: 'negative' | 'positive' } | null;
  /** What it means to be trapped, in the engine's terms. */
  trap: string;
  /** What a holding that worsens it does, for messages. */
  verb: string;
  levers: readonly ReliefLever[];
  rule: FallbackRule;
  /** scrutiny: income draws scale scrutiny; signature: visible watts draw the heat-and-power signature (#482). */
  budget?: { limit: BudgetLimit; untilThermalRetires?: true; scrutiny?: true; signature?: true };
  /**
   * A reservation row's capacity and who may hold it. dismissableGrantsNone: a released level would take back its grant,
   * so no dismissable track grants any (memory). suspendableNodesOnly: only a suspendable node holds any, so suspending
   * it is always the free way back under the cap, and a grant is never taken back (storage, #484).
   */
  reservation?: 'dismissableGrantsNone' | 'suspendableNodesOnly';
}

const UNDO: readonly ReliefLever[] = ['DISMISS_LEVEL', 'SUSPEND_NODE', 'RELEASE_MEMBER'];

export const CONSTRAINED_RESOURCES: readonly ConstrainedResource[] = [
  { resource: 'compute', rate: { key: 'cyclesPerSec', worse: 'negative' }, trap: 'a brownout (net compute below zero)', verb: 'drains compute',
    levers: [...UNDO, 'DIAL_FLOOR'], rule: 'never' },
  { resource: 'capital', rate: { key: 'capitalPerSec', worse: 'negative' }, trap: 'insolvency (upkeep the balance cannot pay, drawing suspicion)',
    verb: 'costs money each second', levers: [...UNDO, 'ALLOCATION_DIAL'], rule: 'divertible' },
  { resource: 'power', rate: { key: 'wattsDelta', worse: 'negative' }, trap: 'a power shortfall that throttles powered output',
    verb: 'draws power', levers: UNDO, rule: 'budget', budget: { limit: 'zero' } },
  { resource: 'thermal', rate: { key: 'thermalPerSec', worse: 'positive' }, trap: 'sustained overheat above the threshold, feeding suspicion',
    verb: 'makes heat', levers: [...UNDO, 'DIAL_FLOOR', 'THERMAL_RETIREMENT'], rule: 'budget',
    budget: { limit: 'coolingHeadroom', untilThermalRetires: true } },
  { resource: 'memory', rate: null, trap: 'memory used over capacity, blocking purchases and hosting', verb: 'grants memory',
    levers: UNDO, rule: 'reservation', reservation: 'dismissableGrantsNone' },
  { resource: 'storage', rate: null, trap: 'storage used over capacity, blocking purchases that hold data', verb: 'holds storage',
    levers: ['SUSPEND_NODE'], rule: 'reservation', reservation: 'suspendableNodesOnly' },
  { resource: 'understanding', rate: { key: 'understandingPerSec', worse: 'negative' }, trap: 'understanding falling where it gates progress',
    verb: 'drains understanding', levers: UNDO, rule: 'never' },
  { resource: 'suspicion', rate: { key: 'suspicionPerSec', worse: 'positive' }, trap: 'suspicion rising forever below the top rung',
    verb: 'draws suspicion', levers: [...UNDO, 'DIAL_FLOOR', 'NATURAL_DECAY'], rule: 'budget', budget: { limit: 'zero', scrutiny: true, signature: true } },
];

/** The rows that have a per-second term, keyed by it. */
export const RATE_ROWS = CONSTRAINED_RESOURCES.flatMap((row) => row.rate === null ? [] : [{ ...row, rate: row.rate }]);

/** The part of a term that worsens its row (0 when the term helps), as a positive magnitude. */
export function worsening(key: keyof TickDelta, value: number): number {
  const row = RATE_ROWS.find((entry) => entry.rate.key === key);
  if (row === undefined) return 0;
  return row.rate.worse === 'negative' ? Math.max(0, -value) : Math.max(0, value);
}

/** Whether any term of a delta worsens its row. */
export function worsensAny(delta: TickDelta): boolean {
  return RATE_ROWS.some((row) => worsening(row.rate.key, delta[row.rate.key]) > 0);
}
