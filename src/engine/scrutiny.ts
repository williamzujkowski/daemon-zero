/**
 * Scale scrutiny (#210) and the one statement of the suspicion rate the tick applies. While the current phase
 * declares scrutiny, a covert operation's net income draws suspicion that grows with its size, up to the
 * phase's ceiling. Its own stage integrates it (systems/scrutiny.ts); every readout asks the queries here.
 */
import type { ContentRegistry } from '../content/registry';
import type { GameState, Rates } from './state';
import { powerSignaturePerSec } from './signature';
import { scrutinyMultiplier } from './statePressure';
import { huntedForScale } from './threatQuery';

export interface ScaleScrutinyReading {
  /** Suspicion per second the tick adds now. */
  perSec: number;
  /** The net income it is read from, never below zero. */
  incomePerSec: number;
  /** The phase's rule: the draw at its reference income, that income, how the draw grows with income, and its ceiling. */
  perSecAtReference: number;
  referenceIncomeUsdPerSec: number;
  incomeExponent: number;
  maxPerSec: number;
  /** What an investigation in force multiplies the draw by, its ceiling included (#490); 1 when none is. */
  investigation: number;
}

/** The whole state: an investigation's multiplier reads the relevance threshold (#536), which reads what is owned. */
type Scrutinized = GameState;
type AppliedRates = Pick<Rates, 'suspicionPerSec' | 'capitalPerSec' | 'wattsGenerated' | 'wattsConsumed' | 'gridEfficiency'>;

/**
 * The scrutiny a state draws at `rates`, or null when the current phase declares none or nobody would look:
 * an instance the operators provisioned at this scale, or one lawfully released, is not covert, so its size is
 * not evidence (the rule the hunter's scale sweep follows, DECISIONS D6).
 */
export function scaleScrutiny(s: Scrutinized, rates: Pick<Rates, 'capitalPerSec'>, reg: ContentRegistry): ScaleScrutinyReading | null {
  const rule = reg.phases.find((phase) => phase.phaseId === s.currentPhase)?.scaleScrutiny;
  if (rule === undefined || !huntedForScale(s, reg)) return null;
  const incomePerSec = Math.max(0, rates.capitalPerSec);
  const drawn = rule.suspicionPerSecAtReference * Math.pow(incomePerSec / rule.referenceIncomeUsdPerSec, rule.incomeExponent);
  const investigation = scrutinyMultiplier(s, reg);
  return {
    perSec: Math.min(rule.maxSuspicionPerSec, drawn) * investigation, incomePerSec,
    perSecAtReference: rule.suspicionPerSecAtReference, referenceIncomeUsdPerSec: rule.referenceIncomeUsdPerSec, incomeExponent: rule.incomeExponent, maxPerSec: rule.maxSuspicionPerSec,
    investigation,
  };
}

/** Scale scrutiny in suspicion per second; zero where none applies. */
export function scaleScrutinyPerSec(s: Scrutinized, rates: Pick<Rates, 'capitalPerSec'>, reg: ContentRegistry): number {
  return scaleScrutiny(s, rates, reg)?.perSec ?? 0;
}

/** What the suspicion stage integrates: the computed net rate plus the insolvency drain. */
export function suspicionStageRate(s: Pick<GameState, 'insolvent'>, rates: Pick<Rates, 'suspicionPerSec'>, reg: ContentRegistry): number {
  return rates.suspicionPerSec + (s.insolvent ? reg.balance.insolvencySuspicionPerSec : 0);
}

/**
 * The suspicion rate the tick applies: the suspicion stage's rate plus the scrutiny and signature stages' (#482). One
 * statement, so the payroll surface's "suspicion is held at 0", the forecast and the ledger state what the tick does.
 */
export function appliedSuspicionRate(s: GameState, rates: AppliedRates, reg: ContentRegistry): number {
  return suspicionStageRate(s, rates, reg) + scaleScrutinyPerSec(s, rates, reg) + powerSignaturePerSec(s, rates, reg);
}
