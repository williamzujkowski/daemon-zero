/**
 * Return-iteration scaffolding for NH-05 (H14): plays STEALTH, with the same one-second decision and
 * fixed ticks as the wipe-sequence runner, until every campaign obligation of the victory purchase
 * is complete, so a report can wipe at that moment and measure the return. It reports; it never
 * gates, and the bot is unchanged.
 */
import type { ContentRegistry } from '../../content/registry';
import { obligationReceipt } from '../obligations';
import type { GameState } from '../state';
import { tick } from '../tick';
import { STEALTH_POLICY } from './policy';

/** The obligations of the purchase that chooses an ending (found by its effect, never by id). */
function victoryObligations(reg: ContentRegistry): string[] {
  const victory = [...reg.nodes.values()].find((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined);
  return victory?.requirements?.campaignObligations ?? [];
}

/**
 * The first state, between decisions, in which every obligation has its receipt and nothing is on
 * screen or pending, or null if the run ends or the budget runs out first. A decision step that
 * resolves a dilemma buys nothing, so the victory purchase cannot have happened yet.
 */
export function untilObligationsComplete(start: GameState, reg: ContentRegistry, maxSimSec: number): GameState | null {
  const obligations = victoryObligations(reg);
  let s = start;
  for (let second = 0; second < maxSimSec && s.ending === null; second++) {
    const settled = s.activeDilemmaId === null && s.pendingDilemma === null;
    if (settled && obligations.length > 0 && obligations.every((id) => obligationReceipt(s, id, reg) !== null)) return s;
    s = STEALTH_POLICY.step(s, reg);
    for (let i = 0; i < reg.balance.tickHz; i++) s = tick(s, 1 / reg.balance.tickHz, reg);
  }
  return null;
}
