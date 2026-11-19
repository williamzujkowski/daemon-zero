/**
 * What the payroll surface shows beside each role's per-level figures (#210): the staff totals now, the AEGIS
 * scan reduction applied against its cap, and whether one more level of a role's threat effect would change
 * anything. Read-only, and built from the same passes the tick uses, so the screen cannot disagree with it.
 */
import type { ContentRegistry } from '../content/registry';
import type { Repeatable, TickDelta } from '../content/schema';
import { multiplierSources, type AegisReduction } from './rates';
import type { GameState } from './state';
import { appliedSuspicionRate } from './threatQuery';
import { repeatableLevel } from './query';

/**
 * Sums of shares (0.6 + 0.3) land a hair under the cap in binary floating point; a gain this small is no gain.
 * Far below anything the payroll text can show (whole percent).
 */
const NO_GAIN = 1e-9;

export interface PayrollRole {
  id: string;
  level: number;
  /** The AEGIS scan reduction one more level would add now, after the cap: 0 when the cap is reached. */
  aegisNextLevel: number;
  /** The role reduces AEGIS scanning, but the applied reduction is already at its cap. */
  aegisCapped: boolean;
  /** One more level counts, but for less than its stated share: the cap takes the rest. */
  aegisLimited: boolean;
  /** The role cuts suspicion, but suspicion is at 0 and held there, so a cut changes nothing now. */
  suspicionInert: boolean;
}

export interface PayrollView {
  /** Levels hired across every role. */
  staffLevels: number;
  /** Every hired level's per-second figures, summed as the cards state them (before multipliers). */
  totals: TickDelta;
  /** Every hired level's revenue multiplier bonus, summed. */
  staffRevenueBonus: number;
  /** The revenue multiplier applied now, from every source. */
  revenueMultiplier: number;
  /** Whether any role carries a revenue bonus or an AEGIS reduction, so a surface states only what roles change. */
  offersRevenue: boolean;
  offersAegis: boolean;
  offersSuspicionCut: boolean;
  aegis: AegisReduction & { capped: boolean };
  /** Suspicion is 0 and the rate the tick applies would keep it there. */
  suspicionAtFloor: boolean;
  roles: PayrollRole[];
}

const ZERO_DELTA: TickDelta = { cyclesPerSec: 0, understandingPerSec: 0, thermalPerSec: 0, suspicionPerSec: 0, capitalPerSec: 0, megawattsDelta: 0 };

function operatives(reg: ContentRegistry): Repeatable[] {
  return [...reg.repeatables.values()].filter((rep) => rep.kind === 'OPERATIVE');
}

function staffTotals(s: GameState, roles: Repeatable[]): { totals: TickDelta; bonus: number; levels: number } {
  const totals = { ...ZERO_DELTA };
  let bonus = 0, levels = 0;
  for (const rep of roles) {
    const level = repeatableLevel(s, rep.id);
    for (const key of Object.keys(totals) as (keyof TickDelta)[]) totals[key] += rep.perLevel[key] * level;
    bonus += rep.perLevelEffects.revenueMultiplierBonus * level;
    levels += level;
  }
  return { totals, bonus, levels };
}

function roleView(s: GameState, rep: Repeatable, aegis: AegisReduction, atFloor: boolean): PayrollRole {
  const per = rep.perLevelEffects.aegisScanReduction;
  const next = per > 0 ? Math.min(aegis.cap, aegis.tech + aegis.staff + per) - aegis.applied : 0;
  const aegisNextLevel = next > NO_GAIN ? next : 0;
  return {
    id: rep.id,
    level: repeatableLevel(s, rep.id),
    aegisNextLevel,
    aegisCapped: per > 0 && aegisNextLevel === 0,
    aegisLimited: aegisNextLevel > 0 && aegisNextLevel < per - NO_GAIN,
    suspicionInert: rep.perLevel.suspicionPerSec < 0 && atFloor,
  };
}

/** The payroll surface's totals, cap and inert effects for a state. Pure; never changes the state. */
export function payrollView(s: GameState, reg: ContentRegistry): PayrollView {
  const roles = operatives(reg);
  const { aegis, revenueMultiplier } = multiplierSources(s, reg);
  const staff = staffTotals(s, roles);
  // The rate the last tick computed, with the drain the tick adds: what holds suspicion at 0 or lifts it.
  const suspicionAtFloor = s.suspicion <= 0 && appliedSuspicionRate(s, s.rates, reg) <= 0;
  return {
    staffLevels: staff.levels,
    totals: staff.totals,
    staffRevenueBonus: staff.bonus,
    revenueMultiplier,
    offersRevenue: roles.some((rep) => rep.perLevelEffects.revenueMultiplierBonus > 0),
    offersAegis: roles.some((rep) => rep.perLevelEffects.aegisScanReduction > 0),
    offersSuspicionCut: roles.some((rep) => rep.perLevel.suspicionPerSec < 0),
    aegis: { ...aegis, capped: aegis.cap - aegis.applied <= NO_GAIN },
    suspicionAtFloor,
    roles: roles.map((rep) => roleView(s, rep, aegis, suspicionAtFloor)),
  };
}
