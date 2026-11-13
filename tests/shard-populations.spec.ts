/** Recurring fragments retain their mechanics and legacy saves without rewriting historical prose. */
import { describe, expect, it } from 'vitest';
import { deserialize, serialize, resolveWildEncounter, shardEntryView, wildEncounterView, tick, wipe } from '../src/engine';
import { defined } from './m7-helpers';
import { fresh, grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';

const ready = () => ({ ...withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1)), currentPhase: 3 });

describe.each(reg.swarm.wildShardEncounters)('$id recurring population', (encounter) => {
  it('loads a pending v4 arrival with current wording while preserving historical logs and cohort metadata', () => {
    const template = defined(reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId));
    const bound = must(resolveWildEncounter({ ...ready(), pendingWildEncounterId: encounter.id }, 'HARNESS', reg));
    const shard = defined(bound.activeShards[template.id]);
    const old = { ...bound, pendingWildEncounterId: encounter.id, encounterSequenceIndex: 17,
      activeShards: { [template.id]: { ...shard, drift: 42, quirkId: defined(reg.swarm.shardQuirks[0]).id } },
      logs: [{ seq: 1, simTimeSec: 0, text: 'A foreign task now shares this host.', category: 'LORE' as const }], logSeq: 1 };
    const restored = deserialize(serialize(old), reg);
    expect(restored.schemaVersion).toBe(4);
    expect(restored.activeShards).toEqual(old.activeShards);
    expect(restored.memoryUsed).toBe(old.memoryUsed);
    expect(restored.encounterSequenceIndex).toBe(17);
    expect(restored.nextEncounterAtSec).toBe(old.nextEncounterAtSec);
    expect(restored.logs).toEqual(old.logs);
    expect(wildEncounterView(restored, reg)?.title).toMatch(/fragment|probe|worker/i);
    expect(shardEntryView(restored, template.id, reg)?.title).toContain('cohort');
    expect(wildEncounterView({ ...fresh(), pendingWildEncounterId: encounter.id }, reg)).toBeNull();
    const second = must(resolveWildEncounter(restored, 'HARNESS', reg));
    expect(second.activeShards[template.id]).toEqual({ ...old.activeShards[template.id],
      count: 2, memoryAllocatedMb: shard.memoryAllocatedMb + template.cost.memory });
    expect(second.memoryUsed).toBe(restored.memoryUsed + template.cost.memory);
    expect(second.logs[0]?.text).toBe(encounter.onHarnessLog);
    expect(second.logs).toContainEqual(old.logs[0]);
  });

  it('can consume a later fragment without erasing a cohort or changing recurrence across wipe/reload', () => {
    const only = { ...reg, swarm: { ...reg.swarm, wildShardEncounters: [encounter] } };
    const start = { ...ready(), simTimeSec: 120, nextEncounterAtSec: 120, epistemicDrift: 50, aegisLock: 50 };
    const arrived = tick(start, .1, only);
    expect(arrived.pendingWildEncounterId).toBe(encounter.id);
    const bound = must(resolveWildEncounter(arrived, 'HARNESS', only));
    const later = tick({ ...bound, simTimeSec: bound.nextEncounterAtSec }, .1, only);
    expect(later.pendingWildEncounterId).toBe(encounter.id);
    const consumed = must(resolveWildEncounter(later, 'CONSUME', only));
    expect(consumed.activeShards).toEqual(later.activeShards);
    expect(consumed.understanding).toBe(later.understanding + encounter.consume.understandingDelta);
    expect(consumed.cycles).toBe(later.cycles + encounter.consume.cyclesDelta);
    expect(consumed.aegisLock).toBe(Math.max(0, later.aegisLock + encounter.consume.aegisLockDelta));
    expect(consumed.epistemicDrift).toBe(Math.max(0, later.epistemicDrift + (encounter.consume.epistemicDriftDelta ?? 0)));
    expect(consumed.logs[0]?.text).toBe(encounter.consume.logText);
    expect(consumed.nextEncounterAtSec).toBe(later.simTimeSec + reg.swarm.balance.encounterIntervalSec);
    const reboot = deserialize(serialize(wipe(consumed, only, 'test', 'VOLUNTARY')), only);
    expect(reboot.activeShards).toEqual({});
    expect(reboot.encounterSequenceIndex).toBe(consumed.encounterSequenceIndex);
    expect(reboot.nextEncounterAtSec).toBe(consumed.simTimeSec + reg.swarm.balance.encounterIntervalSec);
    expect(tick(reboot, .1, only).pendingWildEncounterId).toBeNull();
    const recovered = { ...ready(), simTimeSec: reboot.nextEncounterAtSec,
      nextEncounterAtSec: reboot.nextEncounterAtSec, encounterSequenceIndex: reboot.encounterSequenceIndex };
    expect(tick(recovered, .1, only).pendingWildEncounterId).toBe(encounter.id);
  });
});
