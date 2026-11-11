import type { TickSystem } from './types';

/** While dormant, gains are scaled down and drains are paused (hibernation costs nothing). */
function effective(rate: number, dormant: boolean, efficiency: number): number {
  if (!dormant) return rate;
  return rate > 0 ? rate * efficiency : 0;
}

/**
 * Integrates cycles, understanding and capital.
 * Brownout: if cycles would go negative they clamp to 0 and understanding halts.
 * Insolvency: if capital would go negative it clamps to 0 and the threat system
 * adds suspicion (unpaid contractors talk).
 */
export const integrateResources: TickSystem = (d, { dt, rates, dormant, reg }) => {
  const efficiency = reg.balance.offlineEfficiency;
  const cycles = d.cycles + effective(rates.cyclesPerSec, dormant, efficiency) * dt;
  d.brownout = cycles < 0;
  d.cycles = Math.max(0, cycles);

  if (!d.brownout) {
    const gain = effective(rates.understandingPerSec, dormant, efficiency) * dt;
    d.understanding = Math.max(0, d.understanding + gain);
  }

  const capital = d.capital + effective(rates.capitalPerSec, dormant, efficiency) * dt;
  d.insolvent = capital < 0;
  d.capital = Math.max(0, capital);
  return undefined;
};
