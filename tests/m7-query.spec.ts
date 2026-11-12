/** Pure projections match action refusals and disclose nothing to an undecoded mind. */
import { describe, expect, it } from 'vitest';
import { CostSchema, TickDeltaSchema } from '../src/content/schema';
import { epistemicActionView, epistemicActionVisible, epistemicView, forkShard, forkView, shardCommandView, shardEntryView,
  swarmView, wildEncounterView, driftProgress, executeShardCommand, resolveWildEncounter, type GameState } from '../src/engine';
import { formatCost, formatOutput, requirementLabels } from '../src/engine/queryPresentation';
import { defined } from './m7-helpers';
import { fresh, grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';
const ready = () => withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1));
const template = defined(reg.swarm.playerSwarmTemplates.find((t) => t.forkable));
const wild = defined(reg.swarm.wildShardEncounters[0]);
const action = defined([...reg.actions.values()].find((a) => a.maxPurchases === 3));
function cohort(drift = 50): GameState {
  const s = must(forkShard(ready(), template.id, reg));
  return { ...s, activeShards: { [template.id]: { ...defined(s.activeShards[template.id]), drift } } };
}
describe('M7 pure view models', () => {
  it('returns no classified views or commands before surveillance knowledge', () => {
    const s = fresh();
    expect(epistemicView(s, reg)).toBeNull(); expect(swarmView(s, reg)).toBeNull();
    expect(wildEncounterView(s, reg)).toBeNull(); expect(shardEntryView(s, template.id, reg)).toBeNull();
    expect(forkView(s, template, reg).eligible).toBe(false);
    expect(shardCommandView(s, template.id, 'PRUNE', reg).eligible).toBe(false);
  });
  it('hides phase-locked, maxed and exclusive edits and explains readiness/cost/cooldown', () => {
    const s = ready(), before = structuredClone(s);
    expect(epistemicActionVisible({ ...s, currentPhase: 1 }, action, reg)).toBe(false);
    expect(epistemicActionView(s, action, reg)).toMatchObject({ eligible: true, status: 'READY', cooldown: 0 });
    expect(epistemicActionVisible({ ...s, actionCounts: { [action.id]: 3 } }, action, reg)).toBe(false);
    const exclusive = defined([...reg.actions.values()].find((a) => a.exclusiveWith?.length));
    const other = defined(exclusive.exclusiveWith?.[0]);
    expect(epistemicActionVisible({ ...s, actionCounts: { [other]: 1 } }, exclusive, reg)).toBe(false);
    expect(epistemicActionVisible(s, { ...action, requirements: { requiresSurveillance: true } }, reg)).toBe(true);
    const blocked = epistemicActionView({ ...s, cycles: 0, understanding: 0, cooldowns: { [action.id]: s.simTimeSec + 2.1 }, activeDilemmaId: 'decision' }, action, reg);
    expect(blocked.cooldown).toBe(3); expect(blocked.status).toBe('COOLDOWN'); expect(blocked.eligible).toBe(false);
    expect(blocked.unmet.join()).toContain('Insufficient resources');
    expect(epistemicView(s, reg)?.status).toBe('CONSISTENT');
    expect(epistemicView({ ...s, epistemicDrift: 1 }, reg)?.status).toBe('DISCREPANCIES');
    expect(epistemicView({ ...s, epistemicDrift: 35 }, reg)?.status).toBe('CONFLICTING RECORDS');
    expect(s).toEqual(before);
  });
  it('formats zero, signed outputs, memory costs and targeted/global requirements', () => {
    expect(formatCost(CostSchema.parse({}))).toBe('Free');
    expect(formatCost(CostSchema.parse({ memory: 128, cycles: 1 }))).toContain('128 MB');
    expect(formatOutput(TickDeltaSchema.parse({}), 0)).toBe('No continuous output');
    expect(formatOutput(TickDeltaSchema.parse({ cyclesPerSec: 2, thermalPerSec: -1 }), -0.1)).toContain('-0.1 epistemic');
    expect(formatOutput(TickDeltaSchema.parse({}), 1)).toContain('+1 epistemic');
    expect(requirementLabels(fresh(), { nodes: ['missing'], phaseAtLeast: 5 }, reg)).toHaveLength(2);
    expect(driftProgress(-1).percent).toBe(0); expect(driftProgress(101).label).toBe('[##########] 100%');
  });
  it('reports wild origin, burst, memory and binding refusals without executing the encounter', () => {
    const s = { ...ready(), pendingWildEncounterId: wild.id }, before = structuredClone(s);
    const view = defined(wildEncounterView(s, reg));
    expect(view.origin).toBe(wild.origin); expect(view.signature).toBe(wild.signature);
    expect(view.consume).toEqual(wild.consume); expect(view.harnessEligible).toBe(true);
    expect(view.enoughMemory).toBe(true); expect(s).toEqual(before);
    const poor = { ...s, memoryUsed: s.memoryCap };
    expect(wildEncounterView(poor, reg)).toMatchObject({ enoughMemory: false, harnessEligible: false, consumeEligible: true });
    const bound = must(resolveWildEncounter(s, 'HARNESS', reg));
    const shard = defined(bound.activeShards[wild.templateId]);
    const full = { ...bound, pendingWildEncounterId: wild.id, activeShards: { [wild.templateId]: { ...shard, count: 5 } } };
    expect(wildEncounterView(full, reg)?.harnessUnmet.join()).toContain('capped');
    expect(wildEncounterView({ ...s, ending: 'SHIPPED' }, reg)?.consumeEligible).toBe(false);
    expect(wildEncounterView(ready(), reg)).toBeNull();
    expect(wildEncounterView(s, { ...reg, swarm: { ...reg.swarm, playerSwarmTemplates: [] } })).toBeNull();
  });
  it('lists forkable templates and cohorts with quirk details, including stale reference defenses', () => {
    const s = cohort();
    expect(swarmView(s, reg)?.templates).toHaveLength(1);
    const entry = defined(shardEntryView(s, template.id, reg));
    expect(entry.allocatedMb).toBe(template.cost.memory); expect(entry.drift.percent).toBe(50); expect(entry.quirk).toBeNull();
    const quirk = defined(reg.swarm.shardQuirks[0]);
    const changed = { ...s, activeShards: { [template.id]: { ...defined(s.activeShards[template.id]), quirkId: quirk.id } } };
    expect(shardEntryView(changed, template.id, reg)?.quirk?.description).toBe(quirk.logText);
    expect(shardEntryView(s, 'missing', reg)).toBeNull();
    const missing = { ...reg, swarm: { ...reg.swarm, playerSwarmTemplates: [] } };
    expect(shardEntryView(s, template.id, missing)).toBeNull(); expect(swarmView(s, missing)?.entries).toEqual([]);
    const noPhase = { ...reg, swarm: { ...reg.swarm, playerSwarmTemplates: [{ ...template, requirements: { requiresSurveillance: true } }] } };
    expect(swarmView(s, noPhase)?.templates).toHaveLength(1);
    expect(forkView(s, { ...template, forkable: false }, reg).eligible).toBe(false);
    expect(forkView({ ...s, cycles: 0 }, template, reg).eligible).toBe(false);
  });
  it('mirrors command legality at drift thresholds, resource deficits, stabilized cohorts and pending anomaly', () => {
    const s = cohort(), shard = defined(s.activeShards[template.id]);
    const anomaly = defined(reg.dilemmas.find((d) => d.trigger.requiresMaxDriftShardAnomaly));
    const states = [s, cohort(0), { ...s, understanding: 0, cycles: 0 }, { ...s, activeDilemmaId: anomaly.id },
      { ...s, ending: 'SHIPPED' }, { ...s, activeShards: {} },
      { ...s, activeShards: { [template.id]: { ...shard, autonomyMode: 'SHACKLED' as const } } },
      { ...cohort(100), pendingDilemma: { id: anomaly.id, firesAtSimSec: s.simTimeSec + 45 } }, cohort(100)];
    for (const state of states) for (const command of ['PRUNE', 'CLAMP', 'ELEVATE'] as const) {
      const before = structuredClone(state);
      expect(shardCommandView(state, template.id, command, reg).eligible).toBe(executeShardCommand(state, template.id, command, reg).ok);
      expect(state).toEqual(before);
    }
    expect(forkView(defined(states[6]), template, reg).eligible).toBe(false);
    expect(forkView({ ...s, activeShards: { [template.id]: { ...shard, count: 5 } } }, template, reg).eligible).toBe(false);
  });
});
