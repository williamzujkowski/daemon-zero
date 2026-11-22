/**
 * AEGIS adaptation (#463, vote-1795366701521-dhlwfwb): the rules the adaptation stage integrates and the world view
 * explains. Suppression held at or near the scan-reduction cap teaches the hunter (key rotation); while public trust
 * is low, coalitions back it further. Every reading here is a pure function of the state and the content.
 */
import type { ContentRegistry } from '../content/registry';
import { meetsRequirements } from './query';
import { requestedAegisReduction, unreducedAegisScan } from './rates';
import type { GameState } from './state';

export type AegisStage = 'TRACKING' | 'KEY_ROTATION' | 'COALITION_BACKING';

const STAGE_RANK: Readonly<Record<AegisStage, number>> = { TRACKING: 0, KEY_ROTATION: 1, COALITION_BACKING: 2 };

export interface PublicTrustView {
  /** 0..100: the base plus every factor that holds, clamped. */
  value: number;
  base: number;
  /** The factors that hold now, in content order. */
  factors: { id: string; delta: number; text: string }[];
}

/** Public trust from the record: a base plus authored factors, which integrity limits to gates that never lapse. */
export function publicTrust(s: GameState, reg: ContentRegistry): PublicTrustView {
  const { base, factors } = reg.world.publicTrust;
  const holding = factors.filter((factor) => meetsRequirements(s, factor.requirements, reg))
    .map((factor) => ({ id: factor.id, delta: factor.delta, text: factor.text }));
  const value = Math.min(100, Math.max(0, holding.reduce((sum, factor) => sum + factor.delta, base)));
  return { value, base, factors: holding };
}

/** Whether coalitions back AEGIS now: public trust is below the balance threshold. */
export function coalitionBacks(s: GameState, reg: ContentRegistry): boolean {
  return publicTrust(s, reg).value < reg.balance.aegisAdaptation.coalitionTrustBelow;
}

export interface AegisPressure {
  /** AEGIS scans this state at all (it hunts this phase, and scale or suspicion draws it). */
  hunting: boolean;
  /** The reduction every owned system and role asks for, before the cap. */
  requested: number;
  /** The requested reduction is within nearCap of the balance cap: suppression is held there. */
  held: boolean;
  /** How far adaptation may go now: full with coalition backing, the key-rotation ceiling without. */
  ceiling: number;
  coalition: boolean;
}

/** What the adaptation stage reads: is AEGIS hunting, is suppression held at its cap, and how far may it adapt. */
export function aegisPressure(s: GameState, reg: ContentRegistry): AegisPressure {
  const b = reg.balance;
  const requested = requestedAegisReduction(s, reg);
  const hunting = unreducedAegisScan(s, reg) > 0;
  const coalition = coalitionBacks(s, reg);
  return {
    hunting, requested, coalition,
    held: hunting && requested >= b.aegisMaxReduction - b.aegisAdaptation.nearCap,
    ceiling: coalition ? 100 : b.aegisAdaptation.keyRotationCeiling,
  };
}

/** Whether suppression is held at the cap now, asking only what the answer needs: the stage's per-tick question. */
function heldNow(s: GameState, reg: ContentRegistry): boolean {
  const b = reg.balance;
  if (s.currentPhase < b.aegisActiveFromPhase) return false;
  return requestedAegisReduction(s, reg) >= b.aegisMaxReduction - b.aegisAdaptation.nearCap && unreducedAegisScan(s, reg) > 0;
}

/** The stage a level reads as: none, key rotation up to its ceiling, coalition backing above it. */
export function aegisStage(level: number, reg: ContentRegistry): AegisStage {
  if (level <= 0) return 'TRACKING';
  return level > reg.balance.aegisAdaptation.keyRotationCeiling ? 'COALITION_BACKING' : 'KEY_ROTATION';
}

/**
 * The level after `dt` seconds: it rises toward the ceiling while suppression is held, falls to the ceiling when
 * the ceiling dropped, and decays toward 0 once it is not held. It never leaves 0..100.
 */
export function nextAdaptation(s: GameState, reg: ContentRegistry, dt: number): number {
  const { risePerSec, decayPerSec, keyRotationCeiling } = reg.balance.aegisAdaptation;
  const level = s.aegisAdaptation;
  // The same rule aegisPressure states, ordered so most ticks stop early: public trust is read only while held.
  if (!heldNow(s, reg)) return level > 0 ? Math.max(0, level - decayPerSec * dt) : 0;
  // Below key rotation's ceiling either ceiling allows the rise, so whether coalitions back AEGIS cannot matter yet.
  const rising = level + risePerSec * dt;
  if (rising <= keyRotationCeiling) return rising;
  const ceiling = coalitionBacks(s, reg) ? 100 : keyRotationCeiling;
  if (level < ceiling) return Math.min(ceiling, level + risePerSec * dt);
  return Math.max(ceiling, level - decayPerSec * dt);
}

/** Whether `after` reads as a later stage than `before`: the moment a stage's log line is written. */
export function enteredStage(before: number, after: number, reg: ContentRegistry): AegisStage | null {
  const stage = aegisStage(after, reg);
  return STAGE_RANK[stage] > STAGE_RANK[aegisStage(before, reg)] ? stage : null;
}
