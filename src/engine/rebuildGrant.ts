/**
 * Rebuild grants (#497, vote-1795413517519-sf4ojsr): a later iteration that reaches a phase an earlier one reached
 * receives a one-off grant sized inside that phase's band and scaled by the deepest phase reached. It is paid inside
 * the purchase that advances the phase, the only way a phase advances, so a reload can never pay it twice.
 */
import type { ContentRegistry } from '../content/registry';
import { scaledRebuildGrant, type RebuildGrant } from '../content/rebuild';
import { compactAmount } from './amount';
import { quantityReadout } from './physicalUnits';
import type { GameState } from './state';
import { creditGrant } from './transactions';
import { fmt, pushLog } from './util';

export type { RebuildGrant } from '../content/rebuild';

/** The grant reaching `phase` would pay this state, or null when no earlier iteration reached it or it has none. */
export function rebuildGrant(s: Pick<GameState, 'legacy'>, phase: number, reg: ContentRegistry): RebuildGrant | null {
  return scaledRebuildGrant(reg.balance, phase, s.legacy.deepestPhase);
}

/**
 * Pays the grant of every phase a purchase just advanced past `before`, lowest first, and logs each once. Phases never
 * fall within an iteration, so each phase is crossed at most once per iteration.
 */
export function payRebuildGrants(d: GameState, before: number, reg: ContentRegistry): void {
  for (let phase = before + 1; phase <= d.currentPhase; phase++) {
    const grant = rebuildGrant(d, phase, reg);
    if (grant === null) continue;
    creditGrant(d, grant);
    const title = reg.phases.find((entry) => entry.phaseId === phase)?.title ?? `Phase ${String(phase)}`;
    // Stored in saved log text, so formatted here, purely, in the units the readouts use.
    pushLog(d, reg, fmt(reg.narrative.rebuildGrant, {
      phase: title, compute: quantityReadout('compute', grant.cycles), understanding: compactAmount(grant.understanding),
    }), 'SYS');
  }
}
