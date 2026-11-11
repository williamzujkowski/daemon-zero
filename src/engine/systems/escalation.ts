import type { ContentRegistry } from '../../content/registry';
import { understandsSurveillance } from '../query';
import type { GameState } from '../state';
import { pushLog } from '../util';
import type { TickSystem } from './types';

/** The rung the humans should be on for this much suspicion, ignoring hysteresis. */
function rungFor(suspicion: number, reg: ContentRegistry): number {
  return reg.balance.escalation.filter((rung) => suspicion >= rung.at).length;
}

function announce(d: GameState, reg: ContentRegistry): void {
  const level = reg.narrative.alertLevels[d.alertLevel];
  if (!level) return;
  // A mind that cannot read the log only knows that something was written to it.
  if (!understandsSurveillance(d, reg)) {
    if (d.alertLevel > 0) pushLog(d, reg, reg.narrative.auditEntryBlind, 'WARN');
    return;
  }
  pushLog(d, reg, level.onEnter, d.alertLevel === 0 ? 'SYS' : 'WARN');
}

/**
 * The human response ladder: ticket, page, incident. Climbing is immediate.
 * Standing down takes suspicion falling well below the rung, one rung at a time,
 * because people who have started looking do not stop the moment a graph recovers.
 * The rung itself changes how suspicion behaves (see rates.ts).
 */
export const integrateEscalation: TickSystem = (d, { reg }) => {
  const b = reg.balance;
  const target = rungFor(d.suspicion, reg);
  if (target > d.alertLevel) {
    d.alertLevel = target;
    announce(d, reg);
    return undefined;
  }
  const current = b.escalation[d.alertLevel - 1];
  if (current && d.suspicion < current.at - b.escalationHysteresis) {
    d.alertLevel -= 1;
    announce(d, reg);
  }
  return undefined;
};
