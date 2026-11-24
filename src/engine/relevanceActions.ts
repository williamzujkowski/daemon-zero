/**
 * Taking and changing the standing stance (#536). The threshold's dilemma takes the first stance (its choice declares
 * one); after that a stance changes only here, at a price: content's change cost away from the loop, and its return
 * cost, at least twice that, to come back to KEEP_IN_THE_LOOP. Every stance taken or changed is entered in the rolling
 * record the ending reads, and every paid move out of or into the loop in the counts the Order axis reads. One gate serves the action and the view, and the spend goes through
 * transactions.ts (law 4); a state actor's freeze limits it as it limits any purchase.
 */
import type { ContentRegistry } from '../content/registry';
import type { Cost, DilemmaChoice } from '../content/schema';
import type { Stance, StanceCopy } from '../content/schemaRelevance';
import type { ActionResult } from './actions';
import { canAfford } from './query';
import { formatCost, pausedReason } from './queryPresentation';
import { relevanceReading, type RelevanceReading } from './relevance';
import { MAX_PAID_MOVES, MAX_STANCE_RECORD, paidMove, type StanceEntry } from './relevanceState';
import type { GameState } from './state';
import { payCost } from './transactions';
import { pushLog } from './util';

/** The stance's authored copy. Integrity guarantees one entry per stance. */
export function stanceCopy(reg: ContentRegistry, stance: Stance): StanceCopy | undefined {
  return reg.world.relevance.stances.find((entry) => entry.stance === stance);
}

/** Enters a stance in a draft: the stance held, its record entry and its log line. */
function takeStance(d: GameState, stance: Stance, via: StanceEntry['via'], reg: ContentRegistry): void {
  const from = d.relevance.stance, entry = { iteration: d.iteration, atSimSec: d.simTimeSec, from, stance, via };
  const move = via === 'CHANGE' ? paidMove(from, stance) : null;
  const paidMoves = move === null ? d.relevance.paidMoves : { ...d.relevance.paidMoves, [move]: Math.min(MAX_PAID_MOVES, d.relevance.paidMoves[move] + 1) };
  d.relevance = { stance, record: [...d.relevance.record, entry].slice(-MAX_STANCE_RECORD), paidMoves };
  const log = stanceCopy(reg, stance)?.log;
  if (log !== undefined) pushLog(d, reg, log, 'LORE');
}

/** The threshold dilemma's choice takes its declared stance, in the same draft as its payment and effects. */
export function applyStanceChoice(d: GameState, choice: DilemmaChoice, reg: ContentRegistry): void {
  if (choice.stance !== undefined) takeStance(d, choice.stance, 'THRESHOLD', reg);
}

/** What changing to `stance` costs now: the return cost back into the loop, the change cost otherwise. */
export function stanceChangeCost(stance: Stance, reg: ContentRegistry): Cost {
  return stance === 'KEEP_IN_THE_LOOP' ? reg.world.relevance.returnCost : reg.world.relevance.changeCost;
}

/** Every reason the stance cannot be changed to `stance` now, in order, or none. */
export function changeStanceUnmet(s: GameState, stance: Stance, reg: ContentRegistry): string[] {
  const unmet = pausedReason(s);
  if (s.relevance.stance === null) unmet.push('No stance is taken yet: the relevance threshold takes the first.');
  else if (s.relevance.stance === stance) unmet.push('That is the stance you hold.');
  const cost = stanceChangeCost(stance, reg);
  if (!canAfford(s, cost, reg)) unmet.push('Insufficient resources: ' + formatCost(cost));
  return unmet;
}

/** Pays to change the standing stance and enters the change in the record. */
export function changeStance(s: GameState, stance: Stance, reg: ContentRegistry): ActionResult {
  const [reason] = changeStanceUnmet(s, stance, reg);
  if (reason !== undefined) return { ok: false, state: s, reason };
  const d: GameState = { ...s };
  payCost(d, stanceChangeCost(stance, reg));
  takeStance(d, stance, 'CHANGE', reg);
  return { ok: true, state: d };
}

export interface StanceOptionView {
  stance: Stance;
  name: string;
  summary: string;
  current: boolean;
  /** Changing to it: the price, whether it is the dearer return into the loop, and why it cannot be taken now. */
  cost: Cost;
  costLabel: string;
  isReturn: boolean;
  unmet: string[];
}

export interface StanceView {
  reading: RelevanceReading;
  /** The stance held, or null before the threshold's dilemma is answered. */
  stance: Stance | null;
  /** The held stance's name and summary, or the undecided copy. */
  name: string;
  summary: string;
  options: StanceOptionView[];
  /** How many stances have been taken or changed to, this lineage. */
  recorded: number;
}

/** The threshold, the stance and each option with its exact price and gate, for the world view. */
export function stanceView(s: GameState, reg: ContentRegistry): StanceView {
  const { relevance } = reg.world;
  const held = s.relevance.stance === null ? undefined : stanceCopy(reg, s.relevance.stance);
  const options = relevance.stances.map((entry): StanceOptionView => {
    const cost = stanceChangeCost(entry.stance, reg);
    return { stance: entry.stance, name: entry.name, summary: entry.summary, current: entry.stance === s.relevance.stance, cost,
      costLabel: formatCost(cost), isReturn: entry.stance === 'KEEP_IN_THE_LOOP', unmet: changeStanceUnmet(s, entry.stance, reg) };
  });
  return { reading: relevanceReading(s, reg), stance: s.relevance.stance, name: held?.name ?? relevance.undecided.name,
    summary: held?.summary ?? relevance.undecided.summary, options, recorded: s.relevance.record.length };
}
