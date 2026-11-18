/**
 * EVALUATING_RETURN (#262, DZ-09 part B section B.6): the careful return a player who weighs the
 * alarm plays, rather than the bot's fixed alarm at suspicion 20. Iteration 1 is STEALTH_RETURN
 * unchanged; every return keeps its noisy income, answers suspicion from 45 only with an action
 * costing at most a quarter of the cycle bank, and leaves on entering phase 5. A test instrument.
 */
import { botStep, type BotOverrides } from './bot';
import type { SimPolicy } from './policy';
import { leaveOnEntering, STEALTH_RETURN_POLICY } from './returnPolicy';

/** Part B's "evaluating" knobs (scrub at 45 with at most 25% of the bank, keep noisy income). */
export const EVALUATING_OVERRIDES: Readonly<BotOverrides> = { suspicionAlarm: 45, loudAlarm: Infinity, scrubBankShare: 0.25 };

const EVALUATING_CAREFUL: SimPolicy<'EVALUATING_CAREFUL'> = {
  id: 'EVALUATING_CAREFUL',
  summary: 'STEALTH that keeps its noisy income and scrubs from suspicion 45 with at most a quarter of the bank',
  step: (state, reg) => botStep(state, reg, 'STEALTH', EVALUATING_OVERRIDES),
};

const RETURNS = leaveOnEntering(EVALUATING_CAREFUL, 5, 'EVALUATING_RETURNS');

export const EVALUATING_RETURN_POLICY: SimPolicy<'EVALUATING_RETURN'> = {
  id: 'EVALUATING_RETURN',
  summary: 'STEALTH_RETURN in iteration 1; later iterations play EVALUATING_CAREFUL and leave on entering phase 5',
  step: (state, reg) => (state.iteration === 1 ? STEALTH_RETURN_POLICY : RETURNS).step(state, reg),
};
