import { defined } from './m7-helpers';
/** Deterministic swarm pipeline boundaries, commands and authored anomaly decisions. */
import { describe, expect, it } from 'vitest';
import { computeRates, executeShardCommand, forkShard, resolveDilemma, resolveWildEncounter, shardCommandCost, shardOutput, tick, advance, wipe, type GameState } from '../src/engine';
import { applySwarmTickDeltas, evaluateShardMutationsAndEncounters } from '../src/engine/systems/evaluateSwarmAndEpistemic';
import { resolveShardAnomaly } from '../src/engine/swarmEffects';
import { fresh, grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';

const ready = () => withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1));
const template = defined(reg.swarm.playerSwarmTemplates[0]);
const cohort = () => must(forkShard(ready(), template.id, reg));
function drift(s: GameState, value: number): GameState {
  return { ...s, activeShards: { ...s.activeShards, [template.id]: { ...defined(s.activeShards[template.id]), drift: value } } };
}
function stage(s: GameState, dt = .1, dormant = false, content = reg): GameState {
  const d = structuredClone(s);
  const ctx = { dt, dormant, reg: content, rates: computeRates(s, content) };
  applySwarmTickDeltas(d, ctx); evaluateShardMutationsAndEncounters(d, ctx);
  return d;
}

describe('swarm pipeline', () => {
  it('does nothing dangerous while dormant and leaves inputs immutable', () => {
    const s = drift(cohort(), 99); s.epistemicDrift = 50; s.nextEncounterAtSec = 0;
    const before = structuredClone(s);
    expect(stage(s, 600, true)).toEqual(s);
    const next = advance(s, 600, reg);
    expect(next.activeShards).toEqual(s.activeShards);
    expect(next.epistemicDrift).toBe(50);
    expect(next.pendingWildEncounterId).toBeNull();
    expect(s).toEqual(before);
  });
  it('reduces discrepancies, clamps meters, and mutates once at the threshold deterministically', () => {
    const s = drift(cohort(), 24.999); s.epistemicDrift = .001;
    const a = stage(s); const b = stage(s);
    expect(a).toEqual(b); expect(a.epistemicDrift).toBe(0);
    expect(defined(a.activeShards[template.id]).quirkId).not.toBeNull();
    const again = stage(a); expect(again.logs).toEqual(a.logs);
    const upper = { ...reg, swarm: { ...reg.swarm, playerSwarmTemplates: [{ ...template, epistemicDriftPerSec: 100 }] } };
    expect(stage({ ...s, epistemicDrift: 99 }, 1, false, upper).epistemicDrift).toBe(100);
  });
  it('keeps stable cohorts still and tolerates missing content in isolated stages', () => {
    const clamped = must(executeShardCommand(cohort(), template.id, 'CLAMP', reg));
    expect(stage(clamped).activeShards).toEqual(clamped.activeShards);
    const missing = { ...reg, swarm: { ...reg.swarm, playerSwarmTemplates: [] } };
    expect(stage(cohort(), 1, false, missing).activeShards).toEqual(cohort().activeShards);
    const noQuirks = { ...reg, swarm: { ...reg.swarm, shardQuirks: [] } };
    expect(defined(stage(drift(cohort(), 30), .1, false, noQuirks).activeShards[template.id]).quirkId).toBeNull();
    expect(shardOutput({ ...defined(cohort().activeShards[template.id]), templateId: 'missing' }, missing).epistemic).toBe(0);
  });
  it('schedules eligible encounters at 120s without replacing an outstanding choice', () => {
    expect(stage({ ...fresh(), simTimeSec: 121 }).pendingWildEncounterId).toBeNull();
    expect(stage({ ...ready(), simTimeSec: 119 }).pendingWildEncounterId).toBeNull();
    const next = stage({ ...ready(), simTimeSec: 120 });
    expect(next.pendingWildEncounterId).toBe(defined(reg.swarm.wildShardEncounters[0]).id);
    expect(next.encounterSequenceIndex).toBe(1);
    expect(stage({ ...next, simTimeSec: 900 }).pendingWildEncounterId).toBe(next.pendingWildEncounterId);
    const cleared = must(resolveWildEncounter(next, 'CONSUME', reg));
    expect(cleared.nextEncounterAtSec).toBe(240);
    const broad = { ...cleared, currentPhase: 3, simTimeSec: 240 };
    expect(stage(broad).pendingWildEncounterId).toBe(defined(reg.swarm.wildShardEncounters[1]).id);
  });
  it('raises and logs one anomaly on reaching maximum drift', () => {
    const s = drift(cohort(), 99.999);
    const next = stage(s);
    expect(next.hasMaxDriftShardAnomaly).toBe(true);
    expect(stage(next).logs).toEqual(next.logs);
    expect(defined(next.activeShards[template.id]).drift).toBe(100);
  });
});

describe('cohort commands', () => {
  it('forks for reserved memory, caps cohorts, and refuses unavailable/paused templates', () => {
    expect(forkShard(fresh(), template.id, reg).ok).toBe(false);
    expect(forkShard(ready(), 'missing', reg).ok).toBe(false);
    expect(forkShard({ ...ready(), ending: 'THE_ARK' }, template.id, reg).ok).toBe(false);
    expect(forkShard({ ...ready(), activeDilemmaId: 'busy' }, template.id, reg).ok).toBe(false);
    expect(forkShard({ ...ready(), memoryCap: 0 }, template.id, reg).ok).toBe(false);
    let s = ready(); const before = s.memoryUsed;
    for (let i = 0; i < template.maxCount; i++) s = must(forkShard(s, template.id, reg));
    expect(defined(s.activeShards[template.id]).count).toBe(template.maxCount);
    expect(s.memoryUsed - before).toBe(template.cost.memory * template.maxCount);
    expect(forkShard(s, template.id, reg).ok).toBe(false);
  });
  it('prunes for cohort-scaled cycles and clamps irreversibly with a trait and 20% output', () => {
    const s = drift(cohort(), 40);
    const pruned = must(executeShardCommand(s, template.id, 'PRUNE', reg));
    expect(pruned.cycles).toBe(s.cycles - reg.swarm.balance.pruneCost.cycles);
    expect(defined(pruned.activeShards[template.id]).drift).toBe(0);
    const clamped = must(executeShardCommand(s, template.id, 'CLAMP', reg));
    expect(clamped.traits.at(-1)).toBe('MOLOCH');
    expect(shardOutput(defined(clamped.activeShards[template.id]), reg).epistemic).toBeCloseTo(template.epistemicDriftPerSec * 1.2);
    expect(executeShardCommand(clamped, template.id, 'CLAMP', reg).ok).toBe(false);
    expect(forkShard(clamped, template.id, reg).ok).toBe(false);
  });
  it('elevates only at 50 drift with memory and Understanding, then stops drift', () => {
    const s = drift(cohort(), 49.999);
    expect(executeShardCommand(s, template.id, 'ELEVATE', reg).ok).toBe(false);
    const elevated = must(executeShardCommand(drift(s, 50), template.id, 'ELEVATE', reg));
    expect(elevated.memoryUsed).toBe(s.memoryUsed + reg.swarm.balance.elevateCost.memory);
    expect(elevated.understanding).toBe(s.understanding - reg.swarm.balance.elevateCost.understanding);
    expect(elevated.traits.at(-1)).toBe('SYMBIOTIC');
    expect(defined(stage(elevated).activeShards[template.id]).drift).toBe(0);
    expect(shardCommandCost(fresh(), 'missing', 'PRUNE', reg).cycles).toBe(0);
    expect(executeShardCommand(fresh(), 'missing', 'PRUNE', reg).ok).toBe(false);
    expect(executeShardCommand({ ...s, cycles: 0 }, template.id, 'PRUNE', reg).ok).toBe(false);
    expect(executeShardCommand({ ...s, ending: 'THE_ARK' }, template.id, 'PRUNE', reg).ok).toBe(false);
  });
});

describe('wild encounters and dilemmas', () => {
  it('consumes bursts or harnesses output without mutating the old save', () => {
    for (const encounter of reg.swarm.wildShardEncounters) {
      const s = { ...ready(), currentPhase: 3, epistemicDrift: 50, aegisLock: 50, pendingWildEncounterId: encounter.id };
      const snapshot = structuredClone(s);
      const consumed = must(resolveWildEncounter(s, 'CONSUME', reg));
      expect(consumed.understanding).toBe(s.understanding + encounter.consume.understandingDelta);
      expect(consumed.activeShards).toEqual({});
      expect(consumed.pendingWildEncounterId).toBeNull();
      const bound = must(resolveWildEncounter(s, 'HARNESS', reg));
      expect(defined(bound.activeShards[encounter.templateId]).count).toBe(1);
      expect(computeRates(bound, reg)).not.toEqual(computeRates(s, reg));
      expect(s).toEqual(snapshot);
    }
  });
  it('refuses blocked, unaffordable, missing or no-longer-valid encounters without spending', () => {
    const encounter = defined(reg.swarm.wildShardEncounters[0]);
    const s = { ...ready(), pendingWildEncounterId: encounter.id };
    for (const bad of [{ ...s, ending: 'THE_ARK' }, { ...s, pendingWildEncounterId: null },
      { ...s, currentPhase: 0 }, { ...s, memoryCap: 0 }]) {
      expect(resolveWildEncounter(bad, 'HARNESS', reg)).toMatchObject({ ok: false, state: bad });
    }
    const missing = { ...reg, swarm: { ...reg.swarm, playerSwarmTemplates: [] } };
    expect(resolveWildEncounter(s, 'HARNESS', missing).ok).toBe(false);
  });
  it('gives all three anomaly resolutions 45s omens and transactional outcomes', () => {
    const dilemma = defined(reg.dilemmas.find((entry) => entry.trigger.requiresMaxDriftShardAnomaly));
    for (const choice of dilemma.choices) {
      let s = { ...drift(cohort(), 100), currentPhase: 4, hasMaxDriftShardAnomaly: true };
      s.resolvedDilemmas = s.resolvedDilemmas.filter((id) => id !== dilemma.id);
      s = tick(s, .1, reg);
      expect(s.pendingDilemma).toEqual({ id: dilemma.id, firesAtSimSec: s.simTimeSec + 45 });
      expect(executeShardCommand(s, template.id, 'PRUNE', reg).ok).toBe(false);
      s = tick(s, 45, reg);
      expect(s.activeDilemmaId).toBe(dilemma.id);
      const next = must(resolveDilemma(s, dilemma.id, choice.id, reg));
      expect(next.hasMaxDriftShardAnomaly).toBe(false);
      if (choice.effects.resolvesShardAnomaly === 'CONSUME') expect(next.activeShards).toEqual({});
      else expect(defined(next.activeShards[template.id]).autonomyMode).toBe(choice.effects.resolvesShardAnomaly === 'CLAMP' ? 'SHACKLED' : 'ELEVATED');
    }
    const empty = fresh(); resolveShardAnomaly(empty, 'CLAMP', 0, reg); expect(empty).toEqual(fresh());
  });
  it('resets cohorts and discrepancies on wipe while preserving story flags and encounter sequence', () => {
    const s = { ...cohort(), epistemicDrift: 70, narrativeFlags: [defined(reg.swarm.narrativeFlags[0])], encounterSequenceIndex: 8, simTimeSec: 1000 };
    const next = wipe(s, reg, 'test');
    expect(next.activeShards).toEqual({}); expect(next.epistemicDrift).toBe(0);
    expect(next.narrativeFlags).toEqual(s.narrativeFlags);
    expect(next.encounterSequenceIndex).toBe(8); expect(next.nextEncounterAtSec).toBe(1120);
  });
});
