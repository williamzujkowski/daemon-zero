/**
 * Rewards for depth (#497, vote-1795413517519-sf4ojsr) as pure functions of the balance tables, shared by the engine,
 * which pays them, and integrity, which holds every value they can take inside its phase's band.
 */
import type { Balance } from './schemaBalance';

export interface RebuildGrant { phase: number; cycles: number; understanding: number }

/**
 * The one-off grant for reaching `phase` again when the deepest earlier iteration reached `deepest`, or null when the
 * phase has no grant or was never reached before. A content constant scaled by depth, never a share of any income.
 */
export function scaledRebuildGrant(balance: Balance, phase: number, deepest: number): RebuildGrant | null {
  const entry = balance.rebuildGrants.phases.find((grant) => grant.phase === phase);
  if (entry === undefined || deepest < phase) return null;
  const scale = balance.rebuildGrants.depthGrowth ** (deepest - phase);
  return { phase, cycles: entry.cycles * scale, understanding: entry.understanding * scale };
}

/** The share of a first price a remembered purchase costs, for the deepest phase an earlier iteration reached. */
export function rediscoveryShareAt(balance: Balance, deepest: number): number {
  let share = balance.rediscoveryByDepth[0]?.multiplier ?? 1;
  for (const row of balance.rediscoveryByDepth) if (row.deepestPhase <= deepest) share = row.multiplier;
  return share;
}
