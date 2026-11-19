/** A Phase 4 payroll past the AEGIS cap with suspicion at 0 (#210), shared by the payroll and large-text specs. */
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';

const operatives = [...CONTENT.repeatables.values()].filter((rep) => rep.kind === 'OPERATIVE');
/** Roles that reduce AEGIS scanning, strongest share first. */
export const AEGIS_ROLES = operatives.filter((rep) => rep.perLevelEffects.aegisScanReduction > 0)
  .sort((left, right) => right.perLevelEffects.aegisScanReduction - left.perLevelEffects.aegisScanReduction);
export const AEGIS_CAP = String(Math.round(CONTENT.balance.aegisMaxReduction * 100)) + '%';

/** The strongest AEGIS role one level from its own maximum, which with the owned systems is past the cap. */
export function cappedPayroll(game: GameState): GameState {
  const strongest = AEGIS_ROLES[0];
  if (!strongest) throw new Error('Missing AEGIS role');
  return { ...game, suspicion: 0, capital: 1e15, levels: { ...game.levels, [strongest.id]: strongest.maxLevel - 1 } };
}
