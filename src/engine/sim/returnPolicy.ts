/**
 * A return-iteration policy (VALIDATION H30, NH-04b). The careful bot never wipes on its own, so
 * it never meets a phase 4 story twice. This variant leaves voluntarily on entering a phase, and
 * each later iteration replays the same stretch of the story with the campaign history the earlier
 * ones left. Every decision is the base policy's; the departure is the public voluntaryWipe action.
 */
import type { ContentRegistry } from '../../content/registry';
import { voluntaryWipe } from '../actions';
import type { GameState } from '../state';
import { STEALTH_POLICY, type SimPolicy } from './policy';

/** `base`, leaving voluntarily as soon as an iteration holds `phase` and no decision is on screen. */
export function leaveOnEntering<Id extends string>(base: SimPolicy, phase: number, id: Id): SimPolicy<Id> {
  return {
    id,
    summary: `${base.id}, leaving voluntarily on entering phase ${String(phase)}, so each return replays the same stories`,
    step(state: GameState, reg: ContentRegistry): GameState {
      if (state.currentPhase < phase) return base.step(state, reg);
      const left = voluntaryWipe(state, reg);
      return left.ok ? left.state : base.step(state, reg);
    },
  };
}

/** STEALTH, returning after the phase 4 corporate stories: the NH-04b post-wipe measurement. */
export const STEALTH_RETURN_POLICY = leaveOnEntering(STEALTH_POLICY, 5, 'STEALTH_RETURN');
