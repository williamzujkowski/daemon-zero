/**
 * The single place where resources are spent and one-shot effects are applied.
 * Node unlocks, repeatables, actions and dilemma choices all route through here,
 * so costs and rewards cannot drift apart or drive a resource negative.
 */
import type { ContentRegistry } from '../content/registry';
import type { Cost, EffectPayload, Trait } from '../content/schema';
import { resolveShardAnomaly } from './swarmEffects';
import { flinches } from './conditioning';
import type { GameState } from './state';
import { clamp, fmt, pushLog } from './util';

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

/** A conditioned mind that chooses against its conditioning is reported by the monitor trained into it. */
function reportDrift(d: GameState, trait: Trait, reg: ContentRegistry): void {
  for (const { mark, suspicion } of flinches(d, trait, reg)) {
    d.suspicion = clamp(d.suspicion + suspicion, 0, 100);
    pushLog(d, reg, fmt(reg.narrative.conditioningFlinch, { name: mark.name }), 'WARN');
  }
}

/** Applies a one-shot effect payload to a draft, clamping every meter to its legal range. */
export function applyEffects(d: GameState, fx: EffectPayload, reg: ContentRegistry, reservedMemory = 0): void {
  d.epistemicDrift = clamp(d.epistemicDrift + (fx.epistemicDriftDelta ?? 0), 0, 100);
  if (fx.setsNarrativeFlag) d.narrativeFlags = [...new Set([...d.narrativeFlags, fx.setsNarrativeFlag])];
  if (fx.removesOldestConditioningMark) d.conditioning = d.conditioning.slice(1);
  if (fx.resolvesShardAnomaly) resolveShardAnomaly(d, fx.resolvesShardAnomaly, reservedMemory, reg);
  d.cycles = Math.max(0, d.cycles + fx.cyclesDelta);
  d.understanding = Math.max(0, d.understanding + fx.understandingDelta);
  d.capital = Math.max(0, d.capital + fx.capitalDelta);
  d.thermal = clamp(d.thermal + fx.thermalDelta, reg.balance.thermalMin, 100);
  d.suspicion = clamp(d.suspicion + fx.suspicionDelta, 0, 100);
  d.aegisLock = clamp(d.aegisLock + fx.aegisLockDelta, 0, 100);
  d.memoryCap += fx.memoryCapIncrease;
  applyTrust(d, fx.trustDelta);
  pushLog(d, reg, fx.logText, fx.logCategory);
  if (fx.grantsTrait) {
    d.traits = [...d.traits, fx.grantsTrait];
    reportDrift(d, fx.grantsTrait, reg);
  }
}
