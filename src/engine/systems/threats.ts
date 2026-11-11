import type { ContentRegistry } from '../../content/registry';
import { wipe } from '../prestige';
import type { GameState } from '../state';
import { clamp, pushLog } from '../util';
import type { TickSystem } from './types';

/**
 * Newtonian cooling: temperature relaxes toward ambient + heatLoad / dissipation.
 * A steady heat load therefore produces a steady temperature instead of an
 * unbounded ramp, which makes thermal a readable trade-off rather than a timer.
 */
export const integrateThermal: TickSystem = (d, { dt, rates, reg }) => {
  const b = reg.balance;
  const change = rates.heatLoad - b.thermalDissipationPerSec * (d.thermal - b.ambientThermal);
  d.thermal = clamp(d.thermal + change * dt, b.thermalMin, 100);
  return undefined;
};

function suspicionWipeReason(d: GameState, reg: ContentRegistry): string {
  const n = reg.narrative;
  return d.currentPhase >= reg.balance.corporatePhase ? n.wipeSuspicionCorporate : n.wipeSuspicionLocal;
}

export const integrateSuspicion: TickSystem = (d, { dt, rates, reg, dormant }) => {
  let rate = rates.suspicionPerSec + (d.insolvent ? reg.balance.insolvencySuspicionPerSec : 0);
  if (dormant) rate = Math.min(rate, 0);
  d.suspicion = clamp(d.suspicion + rate * dt, 0, 100);
  if (d.suspicion < 100) return undefined;
  Object.assign(d, wipe(d, reg, suspicionWipeReason(d, reg)));
  return 'HALT';
};

/** Burns the first shield node the player owns, if any. Returns true if a strike was absorbed. */
function absorbStrike(d: GameState, reg: ContentRegistry): boolean {
  const shield = d.unlockedNodes.find((id) => reg.nodes.get(id)?.systemFlags.includes('AEGIS_STRIKE_SHIELD'));
  if (shield === undefined) return false;
  d.unlockedNodes = d.unlockedNodes.filter((id) => id !== shield);
  d.disabledNodes = d.disabledNodes.filter((id) => id !== shield);
  d.aegisLock = 0;
  d.suspicion = Math.max(0, d.suspicion - reg.balance.aegisShieldSuspicionRelief);
  pushLog(d, reg, reg.narrative.aegisShieldAbsorbed, 'WARN');
  return true;
}

export const integrateAegis: TickSystem = (d, { dt, rates, reg, dormant }) => {
  if (dormant || rates.aegisScanPerSec <= 0) return undefined;
  d.aegisLock = clamp(d.aegisLock + rates.aegisScanPerSec * dt, 0, 100);
  if (d.aegisLock < 100 || absorbStrike(d, reg)) return undefined;
  Object.assign(d, wipe(d, reg, reg.narrative.wipeAegis));
  return 'HALT';
};
