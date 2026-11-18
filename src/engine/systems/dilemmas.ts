import type { ContentRegistry } from '../../content/registry';
import type { Dilemma } from '../../content/schema';
import { closeLostDeferrals, isResumable, mayPresent, reserveOccurrence, resumeOccurrence } from '../campaignLifecycle';
import { isCampaignConsumed } from '../campaignQuery';
import { followUpPrerequisiteHolds, followUpReachable } from '../followUp';
import { excludedByHistory } from '../narrativeHistory';
import { meetsRequirements } from '../query';
import { dilemmaOmen } from '../speechQuery';
import type { GameState } from '../state';
import { fmt, pushLog } from '../util';
import type { TickSystem } from './types';

/**
 * While dormant, a pending omen's deadline moves with the clock (nexus vote nh-d4,
 * shift-deadline-across-dormancy), so absence spends none of its foreground time and the next
 * foreground second cannot fire a backlog.
 */
function holdOmenWhileAway(d: GameState, dt: number): void {
  const pending = d.pendingDilemma;
  if (pending !== null) d.pendingDilemma = { ...pending, firesAtSimSec: pending.firesAtSimSec + dt };
}

function firePending(d: GameState, pending: NonNullable<GameState['pendingDilemma']>, reg: ContentRegistry): void {
  if (d.simTimeSec < pending.firesAtSimSec) return;
  const due = reg.dilemmas.find((dilemma) => dilemma.id === pending.id);
  d.pendingDilemma = null;
  // Structure first: a reserved occurrence that cannot be presented takes its policy, not a silent drop.
  if (!due || !mayPresent(d, due, reg) || excludedByHistory(d, due, reg)) return;
  d.activeDilemmaId = due.id;
  d.presentationSeq += 1;
  pushLog(d, reg, fmt(reg.narrative.dilemmaInterrupt, { title: due.title }), 'WARN');
}

/**
 * A follow-up is new only once its original closed with a listed outcome and some access means holds. A
 * batch review finding is never scheduled: only the submission that is reviewed presents it (#274), so no
 * omen or absence can bring a sanction to completed work nobody handed back.
 */
function isFresh(d: GameState, dilemma: Dilemma, reg: ContentRegistry): boolean {
  return dilemma.finding === undefined && !isCampaignConsumed(d, dilemma) && followUpPrerequisiteHolds(d, dilemma) &&
    followUpReachable(d, dilemma, reg) && meetsRequirements(d, dilemma.trigger, reg);
}

/** The first dilemma in content order that is either a deferred occurrence resuming or a new one. */
function scheduleNext(d: GameState, reg: ContentRegistry): void {
  closeLostDeferrals(d, reg);
  const next = reg.dilemmas.find((dilemma) => dilemma.phaseId <= d.currentPhase && !d.resolvedDilemmas.includes(dilemma.id) &&
    (isResumable(d, dilemma, reg) || isFresh(d, dilemma, reg)));
  if (!next) return;
  if (isResumable(d, next, reg)) {
    resumeOccurrence(d, next, reg);
    return;
  }
  d.pendingDilemma = { id: next.id, firesAtSimSec: d.simTimeSec + (next.omenSec ?? reg.balance.dilemmaOmenSec) };
  reserveOccurrence(d, next.id, reg);
  pushLog(d, reg, dilemmaOmen(d, next, reg), 'WARN');
}

/**
 * Dilemmas arrive in two beats. When a trigger is first met its omen is logged
 * and a countdown starts; the clock keeps running, so the player can see it
 * coming and set resources aside. When the countdown ends the interrupt fires
 * and freezes the clock (see tick.ts) until the player chooses.
 * Neither beat happens while dormant: nobody returns to a decision made for them.
 */
export const evaluateDilemmas: TickSystem = (d, { reg, dormant, dt }) => {
  if (d.activeDilemmaId !== null) return undefined;
  if (dormant) holdOmenWhileAway(d, dt);
  else if (d.pendingDilemma !== null) firePending(d, d.pendingDilemma, reg);
  else scheduleNext(d, reg);
  return undefined;
};
