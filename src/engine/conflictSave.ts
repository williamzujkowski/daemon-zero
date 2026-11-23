/**
 * Loading the conflict record (#517): a save is untrusted input, so a raid content no longer declares, a target that is
 * no longer a site class, a log longer than the battle, or a raid sharing the slot with a hostile mind is dropped, and
 * damage is kept only for classes content declares, never past the cap.
 */
import type { ContentRegistry } from '../content/registry';
import type { GameState } from './state';

export function reconcileConflict(s: GameState, reg: ContentRegistry): GameState {
  const { raids, siteClasses, raid: balance } = reg.world.conflict;
  const classes = new Set(siteClasses.map((cls) => cls.id));
  const damage: Record<string, number> = {};
  for (const [id, value] of Object.entries(s.conflict.damage)) if (classes.has(id) && value > 0) damage[id] = Math.min(value, balance.damageCap);
  const raid = s.conflict.raid;
  const kept = raid !== null && s.hostile.active === null && raids.some((kind) => kind.id === raid.id) && classes.has(raid.target)
    && raid.rounds.length <= balance.rounds ? raid : null;
  return { ...s, conflict: { ...s.conflict, raid: kept, damage } };
}
