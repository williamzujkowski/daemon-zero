/**
 * What the world view says about escalation by phase (#490): AEGIS's posture at this rung, and each state actor's
 * pressure with its effect, why the record calls it, where it lifts and which answers the engine would accept now. An
 * answer is offered only when its action would succeed this second (UI copy names a lever only when the engine acts).
 */
import type { ContentRegistry } from '../content/registry';
import type { AegisPosture, PressureAnswer, StatePressure } from '../content/schemaPressure';
import { buyRepeatable, toggleNode, unlockNode } from './actions';
import { repeatableLevel } from './query';
import { aegisPostureNow, answerHeld, frozenShare, pressureStatus, rungValue, scrutinyMultiplier, type PressureStatus } from './statePressure';
import type { GameState } from './state';

/** Where a rung stands down: suspicion under its threshold less the hysteresis. */
export function standDownBelow(rung: number, reg: ContentRegistry): number | null {
  const level = reg.balance.escalation[rung - 1];
  return level ? level.at - reg.balance.escalationHysteresis : null;
}

export interface AegisPostureView {
  posture: AegisPosture;
  /** The near-strike warning's lock; integrity keeps the strike above it. */
  warningAt: number;
  /** Below this suspicion the rung stands down one step, easing the posture. */
  easesBelow: number | null;
}

/** AEGIS's posture with what it means, or null on its standing budget. */
export function aegisPostureView(s: GameState, reg: ContentRegistry): AegisPostureView | null {
  const posture = aegisPostureNow(s, reg);
  return posture ? { posture, warningAt: reg.balance.aegisStrikeWarningAt, easesBelow: standDownBelow(s.alertLevel, reg) } : null;
}

/** BUY a node, RESUME a suspended one or HIRE the next level: the action an answer needs, or null when it is held. */
export type AnswerAction = 'BUY' | 'RESUME' | 'HIRE';

export interface AnswerView {
  answer: PressureAnswer;
  held: boolean;
  /** What would take it now, offered only when the engine accepts that action this second; null when held or refused. */
  action: AnswerAction | null;
  /** For a track: levels held, against the level that answers. */
  level?: { held: number; needed: number };
}

function answerView(s: GameState, answer: PressureAnswer, reg: ContentRegistry): AnswerView {
  if (answerHeld(s, answer)) return { answer, held: true, action: null };
  if ('repeatable' in answer) {
    const level = { held: repeatableLevel(s, answer.repeatable), needed: answer.minLevel };
    return { answer, held: false, action: buyRepeatable(s, answer.repeatable, reg).ok ? 'HIRE' : null, level };
  }
  if (s.unlockedNodes.includes(answer.node)) return { answer, held: false, action: toggleNode(s, answer.node, reg).ok ? 'RESUME' : null };
  return { answer, held: false, action: unlockNode(s, answer.node, reg).ok ? 'BUY' : null };
}

export interface PressureView {
  pressure: StatePressure;
  status: Exclude<PressureStatus, 'QUIET'>;
  /** In force now; false while an answer holds it off. */
  inForce: boolean;
  /** The investigation's multiplier or the freeze's share at this rung; null for the other kinds. */
  value: number | null;
  /** Whether this pressure's value is the one applied (the strongest of its kind in force); false while answered. */
  applied: boolean;
  /** Once suspicion falls below this, the rung under fromRung is reached and it lifts. */
  liftsBelow: number | null;
  answers: AnswerView[];
}

function valueOf(s: GameState, pressure: StatePressure): number | null {
  if (pressure.kind === 'INVESTIGATION') return rungValue(s, pressure.fromRung, pressure.scrutinyMultiplier);
  return pressure.kind === 'CAPITAL_FREEZE' ? rungValue(s, pressure.fromRung, pressure.frozenShare) : null;
}

function appliedNow(s: GameState, pressure: StatePressure, value: number | null, reg: ContentRegistry): boolean {
  if (pressure.kind === 'INVESTIGATION') return value === scrutinyMultiplier(s, reg);
  return pressure.kind === 'CAPITAL_FREEZE' ? value === frozenShare(s, reg) : true;
}

/** An actor's pressures the record calls now (in force or answered), in content order; a quiet one is not listed. */
export function pressureViews(s: GameState, pressures: readonly StatePressure[], reg: ContentRegistry): PressureView[] {
  return pressures.flatMap((pressure): PressureView[] => {
    const status = pressureStatus(s, pressure);
    if (status === 'QUIET') return [];
    const value = valueOf(s, pressure);
    return [{
      pressure, status, inForce: status === 'IN_FORCE', value, applied: status === 'IN_FORCE' && appliedNow(s, pressure, value, reg),
      liftsBelow: standDownBelow(pressure.fromRung, reg), answers: pressure.answers.map((answer) => answerView(s, answer, reg)),
    }];
  });
}
