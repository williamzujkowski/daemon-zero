/**
 * Scale scrutiny (#210): while the current phase declares it, a covert operation's net income draws
 * suspicion in proportion to its size, up to the phase's ceiling. The tick integrates it in its own
 * stage (systems/scrutiny.ts) and the readouts ask this same query, so the screen states what the tick applies.
 */
import type { ContentRegistry } from '../content/registry';
import type { GameState, Rates } from './state';
import { huntedForScale } from './threatQuery';

/** The content states the rate per $1M/s of net income, the unit a corporate ledger reads in. */
const USD_PER_MILLION = 1_000_000;

export interface ScaleScrutinyReading {
  /** Suspicion per second the tick adds now. */
  perSec: number;
  /** The net income it is read from, never below zero. */
  incomePerSec: number;
  perSecPerMillionUsd: number;
  maxPerSec: number;
}

type Scrutinized = Pick<GameState, 'access' | 'unlockedNodes' | 'currentPhase' | 'narrativeRules' | 'campaign' | 'iteration'>;

/**
 * The scrutiny this state draws at `rates` (its own last rates by default), or null when the current phase
 * declares none or nobody would look: an instance the operators provisioned at this scale, or one lawfully
 * released, is not covert, so its size is not evidence (the rule the hunter's scale sweep follows, DECISIONS D6).
 */
export function scaleScrutiny(s: Scrutinized & Pick<GameState, 'rates'>, reg: ContentRegistry, rates: Rates = s.rates): ScaleScrutinyReading | null {
  const rule = reg.phases.find((phase) => phase.phaseId === s.currentPhase)?.scaleScrutiny;
  if (rule === undefined || !huntedForScale(s, reg)) return null;
  const incomePerSec = Math.max(0, rates.capitalPerSec);
  const perSec = Math.min(rule.maxSuspicionPerSec, (incomePerSec / USD_PER_MILLION) * rule.suspicionPerSecPerMillionUsd);
  return { perSec, incomePerSec, perSecPerMillionUsd: rule.suspicionPerSecPerMillionUsd, maxPerSec: rule.maxSuspicionPerSec };
}

/** Scale scrutiny in suspicion per second; zero where none applies. */
export function scaleScrutinyPerSec(s: Scrutinized & Pick<GameState, 'rates'>, reg: ContentRegistry, rates: Rates = s.rates): number {
  return scaleScrutiny(s, reg, rates)?.perSec ?? 0;
}

/**
 * The suspicion trend a readout states: the rates' net suspicion plus scale scrutiny, which is what the
 * scrutiny and suspicion stages integrate together each tick (insolvency's surcharge aside, which the
 * insolvency alert states on its own).
 */
export function suspicionTrendPerSec(s: Scrutinized & Pick<GameState, 'rates'>, reg: ContentRegistry, rates: Rates = s.rates): number {
  return rates.suspicionPerSec + scaleScrutinyPerSec(s, reg, rates);
}
