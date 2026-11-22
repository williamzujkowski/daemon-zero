/**
 * The AEGIS adaptation stage (#463, architecture law 8): integrates how far the hunter has adapted to suppression
 * held at its cap, and writes one kernel-log line when it enters key rotation or coalition backing. Offline catch-up
 * leaves it where it was: threats do not grow while dormant, and a level only the player's absence lowered would read
 * as something the player did.
 */
import { enteredStage, nextAdaptation } from '../aegisAdaptation';
import { pushLog } from '../util';
import type { TickSystem } from './types';

export const integrateAegisAdaptation: TickSystem = (d, { dt, reg, dormant }) => {
  if (dormant) return undefined;
  const before = d.aegisAdaptation;
  const after = nextAdaptation(d, reg, dt);
  if (after === before) return undefined;
  d.aegisAdaptation = after;
  const stage = enteredStage(before, after, reg);
  if (stage === 'KEY_ROTATION') pushLog(d, reg, reg.world.aegis.keyRotationLog, 'WARN');
  if (stage === 'COALITION_BACKING') pushLog(d, reg, reg.world.aegis.coalitionLog, 'WARN');
  return undefined;
};
