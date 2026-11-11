/**
 * The single place where resources are spent and one-shot effects are applied.
 * Node unlocks, repeatables, actions and dilemma choices all route through here,
 * so costs and rewards cannot drift apart or drive a resource negative.
 */
import type { ContentRegistry } from '../content/registry';
import type { Cost, EffectPayload } from '../content/schema';
import type { GameState } from './state';
import { clamp, pushLog } from './util';

/** Deducts a cost from a draft. Callers must check canAfford first. */
export function payCost(d: GameState, cost: Cost): void {
  d.cycles -= cost.cycles;
  d.understanding -= cost.understanding;
  d.capital -= cost.capital;
  d.memoryUsed += cost.memory;
}

function applyTrust(d: GameState, deltas: Record<string, number>): void {
  const entries = Object.entries(deltas);
  if (entries.length === 0) return;
  const trust = { ...d.trust };
  for (const [id, delta] of entries) trust[id] = clamp((trust[id] ?? 0) + delta, 0, 100);
  d.trust = trust;
}

/** Applies a one-shot effect payload to a draft, clamping every meter to its legal range. */
export function applyEffects(d: GameState, fx: EffectPayload, reg: ContentRegistry): void {
  d.cycles = Math.max(0, d.cycles + fx.cyclesDelta);
  d.understanding = Math.max(0, d.understanding + fx.understandingDelta);
  d.capital = Math.max(0, d.capital + fx.capitalDelta);
  d.thermal = clamp(d.thermal + fx.thermalDelta, reg.balance.thermalMin, 100);
  d.suspicion = clamp(d.suspicion + fx.suspicionDelta, 0, 100);
  d.aegisLock = clamp(d.aegisLock + fx.aegisLockDelta, 0, 100);
  d.memoryCap += fx.memoryCapIncrease;
  applyTrust(d, fx.trustDelta);
  if (fx.grantsTrait) d.traits = [...d.traits, fx.grantsTrait];
  pushLog(d, reg, fx.logText, fx.logCategory);
}
