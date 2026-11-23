/**
 * Shared setups for the retaliation and staff-harm specs (#519): a decoded mind on campaign rules at rest in a raided
 * phase with every other story out of the way (as the codec would record it), a raid fought to its aftermath through
 * the raid stage, and the scene that answers it presented through the full tick.
 */
import { createInitialState, type GameState } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { arrived, PRE_BATTLE, R, raid, run } from './conflict-helpers';
import { grant, PHASE0, PHASE1, rich } from './helpers';
import { quiet } from './minds-helpers';

export const HURT = 'dil_16_site_staff_hurt', KILLED = 'dil_17_site_staff_killed';
export const NAMED = 'dil_18_raider_named', AMONG = 'dil_19_raider_among_people';
export const SCENES = [HURT, KILLED, NAMED, AMONG];

/** A decoded campaign mind in `phase` at rest: nothing draws a raid or a hostile, and only `keep` (default: the four scenes) can be presented. */
export function campaignReady(phase: number, keep: string[] = SCENES): GameState {
  const s = quiet(activeGame(grant(rich(createInitialState(preview)), ...PHASE0, ...PHASE1)), keep);
  return { ...s, currentPhase: phase, simTimeSec: 1000, nextEncounterAtSec: 1e9, suspicion: 0, alertLevel: 0, aegisLock: 0, memoryUsed: 0, memoryCap: 2 ** 50 };
}

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
