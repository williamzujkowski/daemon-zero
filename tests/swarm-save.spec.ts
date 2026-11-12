import { defined } from './m7-helpers';
/** Historical codec outputs and tampered cohort references exercise the v4 boundary. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserialize, serialize, forkShard, reconcile, understandsSurveillance } from '../src/engine';
import { fresh, grant, must, PHASE0, PHASE1, reg, rich } from './helpers';

describe('v4 migration and healing', () => {
  const samples = [
    ['v1', readFileSync('tests/fixtures/pre-second-pass-v1.json', 'utf8')],
    ['v2', readFileSync('tests/fixtures/pre-lineage-v2.json', 'utf8')],
    ['v3', readFileSync('tests/fixtures/pre-m7-v3.json', 'utf8')],
  ] as const;
  it.each(samples)('upgrades %s and preserves the old run', (file, raw) => {
    const old = JSON.parse(raw) as { unlockedNodes: string[]; conditioning?: string[]; currentPhase: number };
    const next = deserialize(raw, reg);
    expect(next.schemaVersion).toBe(4);
    expect(next.currentPhase).toBe(old.currentPhase);
    expect(next.unlockedNodes).toEqual(expect.arrayContaining(old.unlockedNodes));
    expect(next.conditioning).toEqual(old.conditioning ?? []);
    expect(next).toMatchObject({ epistemicDrift: 0, narrativeFlags: [], activeShards: {},
      pendingWildEncounterId: null, nextEncounterAtSec: 120, encounterSequenceIndex: 0,
      hasMaxDriftShardAnomaly: false, actionCounts: {}, actionEffectUntil: {} });
    expect(deserialize(serialize(next), reg)).toEqual(next);
    if (file !== 'v1') expect(understandsSurveillance(next, reg)).toBe(true);
  });
  it('rejects invalid and nonfinite v4 fields instead of silently granting benefits', () => {
    const s = fresh(); const template = defined(reg.swarm.playerSwarmTemplates[0]);
    const shard = { templateId: template.id, count: 1, drift: 0, quirkId: null, autonomyMode: 'STANDARD', memoryAllocatedMb: 128 };
    for (const patch of [{ epistemicDrift: -1 }, { epistemicDrift: 101 }, { encounterSequenceIndex: .5 },
      { nextEncounterAtSec: -1 }, { activeShards: { test: { ...shard, count: 0 } } },
      { activeShards: { test: { ...shard, drift: 101 } } }, { activeShards: { test: { ...shard, autonomyMode: 'GOD' } } }]) {
      expect(() => deserialize(JSON.stringify({ ...s, ...patch }), reg)).toThrow(/validation/);
    }
    expect(() => deserialize(serialize(s).replace('"epistemicDrift":0', '"epistemicDrift":1e999'), reg)).toThrow(/validation/);
  });
  it('heals removed content, invalid keys, quirk references and capped counts without leaking reserved memory', () => {
    const template = defined(reg.swarm.playerSwarmTemplates[0]);
    const s = must(forkShard(grant(rich(), ...PHASE0, ...PHASE1), template.id, reg));
    const shard = defined(s.activeShards[template.id]);
    const capped = defined([...reg.actions.values()].find((action) => action.maxPurchases === 3));
    const timed = defined([...reg.actions.values()].find((action) => action.durationSec));
    const corrupt = { ...s, memoryUsed: 2000, narrativeFlags: ['removed'], pendingWildEncounterId: 'removed',
      activeShards: { removed: { ...shard, templateId: 'removed', memoryAllocatedMb: 200 },
        alias: { ...shard, memoryAllocatedMb: 100 },
        [template.id]: { ...shard, count: 10, memoryAllocatedMb: 1000, quirkId: 'removed', autonomyMode: 'SHACKLED' as const, drift: 20 } },
      actionCounts: { removed: 10, [capped.id]: 99, [timed.id]: 3 }, actionEffectUntil: { removed: 10, [timed.id]: 50 } };
    const next = reconcile(corrupt, reg);
    expect(Object.keys(next.activeShards)).toEqual([template.id]);
    expect(next.activeShards[template.id]).toMatchObject({ count: 5, memoryAllocatedMb: 500, quirkId: null, drift: 0 });
    expect(next.memoryUsed).toBe(1200); expect(next.narrativeFlags).toEqual([]);
    expect(next.pendingWildEncounterId).toBeNull(); expect(next.actionCounts).toEqual({ [capped.id]: 3, [timed.id]: 3 });
    expect(next.actionEffectUntil).toEqual({ [timed.id]: 50 });
  });
  it('round-trips active cohorts, valid quirks, flags, pending encounters and action state', () => {
    const template = defined(reg.swarm.playerSwarmTemplates[0]);
    const s = must(forkShard(grant(rich(), ...PHASE0, ...PHASE1), template.id, reg));
    s.activeShards[template.id] = { ...defined(s.activeShards[template.id]), quirkId: defined(reg.swarm.shardQuirks[0]).id, drift: 100 };
    s.hasMaxDriftShardAnomaly = true;
    s.pendingWildEncounterId = defined(reg.swarm.wildShardEncounters[0]).id;
    s.narrativeFlags = [defined(reg.swarm.narrativeFlags[0])]; s.epistemicDrift = 45;
    expect(deserialize(serialize(s), reg)).toEqual(s);
  });
});
