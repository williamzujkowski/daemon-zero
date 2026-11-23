/**
 * AEGIS's post-quantum migration stage (#464, architecture law 8): once AEGIS's adaptation reaches the authored level,
 * it re-keys under its post-quantum scheme for the rest of the iteration, with one kernel-log line. Breaking one of its
 * keys migrates it at once (quantum.ts). Offline catch-up leaves it alone, as it leaves the adaptation it reads.
 */
import { aegisMigrationDue, migrateAegis } from '../quantum';
import type { TickSystem } from './types';

export const integrateQuantumMigration: TickSystem = (d, { reg, dormant }) => {
  if (!dormant && aegisMigrationDue(d, reg)) migrateAegis(d, reg);
  return undefined;
};
