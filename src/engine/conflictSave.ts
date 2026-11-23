/**
 * Loading the conflict record (#517): a save is untrusted input, so a raid content no longer declares, a target that is
 * no longer a site class, a log longer than the battle, or a raid sharing the slot with a hostile mind is dropped, and
 * damage is kept only for classes content declares, never past the cap. A last raid or a silenced raider content no
 * longer declares is dropped (#519).
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
  // A raid's aftermath or a silenced raider content no longer declares is dropped (#519); a silenced raider is listed once.
  const known = new Set(raids.map((kind) => kind.id));
  const lastRaid = s.conflict.lastRaid !== null && known.has(s.conflict.lastRaid.id) ? s.conflict.lastRaid : null;
  const silenced = [...new Set(s.conflict.silenced.filter((id) => known.has(id)))];
  return { ...s, conflict: { ...s.conflict, raid: kept, damage, lastRaid, silenced } };
}
