/**
 * What the active hostile is, and the one part of its effect the rates read (#491). Kept apart from hostile.ts so
 * computeRates can ask it without importing the requirement rules.
 */
import type { ContentRegistry } from '../content/registry';
import type { HostileEncounter } from '../content/schemaHostile';
import type { GameState } from './state';

export function hostileEncounter(reg: ContentRegistry, id: string | undefined): HostileEncounter | undefined {
  return id === undefined ? undefined : reg.swarm.hostileEncounters.find((entry) => entry.id === id);
}

/** The hostile pressing this instance now, from content. */
export function activeHostile(s: GameState, reg: ContentRegistry): HostileEncounter | undefined {
  return hostileEncounter(reg, s.hostile.active?.id);
}

/** Whether the active hostile's effect runs now: a decoy holds it off. */
export function pressing(s: GameState): boolean {
  return s.hostile.active !== null && s.hostile.active.decoySec <= 0;
}

/** The share of positive net compute a feral cohort takes now, or 0. computeRates applies it after every other term. */
export function hostileComputeShare(s: GameState, reg: ContentRegistry): number {
  const encounter = activeHostile(s, reg);
  return encounter?.type === 'FERAL' && pressing(s) ? encounter.effect.share : 0;
}

/** The lock rise a hunter applies now, or null: a hunter pressing, no decoy out, and the lock under its ceiling. */
export function hunterRise(s: GameState, reg: ContentRegistry): { perSec: number; ceiling: number } | null {
  const encounter = activeHostile(s, reg);
  if (encounter?.type !== 'HUNTER' || !pressing(s) || s.aegisLock >= encounter.effect.ceiling) return null;
  return { perSec: encounter.effect.perSec, ceiling: encounter.effect.ceiling };
}
