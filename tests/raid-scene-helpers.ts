/**
 * Setups for the scenes that answer a raid (#519) that need no test runner, so the browser specs can build saves with
 * them too: a decoded mind on campaign rules at rest in a raided phase, with every other story out of the way as the
 * codec would record it.
 */
import { createInitialState, type GameState } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
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
