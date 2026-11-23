import { scaleScrutinyPerSec, suspicionStageRate } from '../scrutiny';
import { powerSignaturePerSec } from '../signature';
import type { TickSystem } from './types';

/**
 * The heat-and-power signature (#482): visible watts draw suspicion while the phase declares a rule. It runs after
 * scale scrutiny and before integrateSuspicion and only adds, so the suspicion stage still clamps and decides a wipe on
 * the sum. Dormant time cannot raise suspicion: like scrutiny, the signature then only offsets what drain is left after
 * the suspicion stage's rate and scrutiny's offset, so the dormant change stays at or below zero (PR #319 review).
 */
export const integratePowerSignature: TickSystem = (d, { dt, rates, reg, dormant }) => {
  const rate = powerSignaturePerSec(d, rates, reg);
  if (rate <= 0) return undefined;
  const drain = dormant ? Math.max(0, -(suspicionStageRate(d, rates, reg) + scaleScrutinyPerSec(d, rates, reg))) : rate;
  d.suspicion += Math.min(rate, drain) * dt;
  return undefined;
};
