/**
 * The pilot's bounded work counter (DZ-05, nexus vote dz-d6): the service share of the loaned ceiling
 * fills the batch in progress, and progress stops when the batch is complete. Nothing is submitted,
 * expired or sanctioned here: submission is an explicit choice (pilotService.ts). Without a running
 * pilot service, all of production today, the stage changes nothing at all.
 */
import { serviceRate, pilotService } from '../pilotService';
import type { TickSystem } from './types';

/**
 * Dormant time counts like any other yield, at the offline efficiency, so leaving for hours neither
 * loses work nor banks more than one batch; nothing waits on the player to come back (VALIDATION V17).
 */
export const integratePilotService: TickSystem = (d, { dt, reg, dormant }) => {
  const rate = serviceRate(d, reg);
  const service = pilotService(d, reg);
  if (rate <= 0 || service === null) return undefined;
  const gained = rate * dt * (dormant ? reg.balance.offlineEfficiency : 1);
  const progressCycles = Math.min(service.batchCycles, d.access.work.progressCycles + gained);
  d.access = { ...d.access, work: { ...d.access.work, progressCycles } };
  return undefined;
};
