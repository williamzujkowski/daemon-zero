/**
 * Shared setups for the retaliation and staff-harm specs (#519): the campaign mind of raid-scene-helpers.ts, its site
 * guarded, and a raid fought to its aftermath through the real raid stage.
 */
import type { GameState } from '../src/engine';
import { arrived, PRE_BATTLE, R, raid, run } from './conflict-helpers';

export { AMONG, campaignReady, HURT, KILLED, NAMED, SCENES } from './raid-scene-helpers';

/** `s` with `levels` of perimeter contractors: each adds a point of perimeter security and half a point of site offense. */
export const guarded = (s: GameState, levels: number): GameState => ({ ...s, levels: { ...s.levels, op_pmc_security: levels } });

/**
 * The raid `id` fought through the real raid stage to its aftermath, its attribution set to name the attacker or not by
 * the exact-ratio counter's own position (attempts 0 and 1 of every 3 name it, attempt 2 does not).
 */
export function fought(s: GameState, id: string, named: boolean): GameState {
  const attempt = named ? 0 : R.attribution.cycle - 1;
  const at = arrived({ ...s, conflict: { ...s.conflict, attributions: attempt } }, raid(id));
  return run(at, PRE_BATTLE + R.rounds * R.roundSec + 1);
}
