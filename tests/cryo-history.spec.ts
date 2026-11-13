/** Human outcomes persist without replay rewards or reconstructed historical choices. */
import { describe, expect, it } from 'vitest';
import { advance, deserialize, exportSave, importSave, isNodeAvailable, meetsRequirements, recordedTransmissions, resolveDilemma, serialize, tick, unmetRequirements, wipe } from '../src/engine';
import { excludedByNarrativeHistory, hasConflictingNarrativeFlags, reconcileDilemmaHistory } from '../src/engine/narrativeHistory';
import { defined } from './m7-helpers';
import { fresh, grant, must, PHASE0, PHASE1, PHASE2, PHASE3, PHASE4, reg, rich } from './helpers';
const source = defined(reg.dilemmas.find((d) => d.id === 'dil_05_cryo_lab_diversion'));
const flags = defined(source.trigger.forbiddenNarrativeFlags);
const decoder = defined(reg.narrative.recordedTransmissions[0]).decoderWidgetId;
const ready = () => ({ ...grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2.slice(0, 3)),
  resolvedDilemmas: reg.dilemmas.filter((d) => d.id !== source.id).map((d) => d.id) });
const resolved = (choice = defined(source.choices[0])) => must(resolveDilemma({ ...ready(), activeDilemmaId: source.id }, source.id, choice.id, reg));
const returned = (state = resolved()) => grant(rich(wipe(state, reg, 'test', 'VOLUNTARY')), ...PHASE0, ...PHASE1, ...PHASE2.slice(0, 3));

describe('recorded cryo outcomes', () => {
  it.each(source.choices)('preserves $id effects and grants its outcome exactly once', (choice) => {
    const before = { ...ready(), activeDilemmaId: source.id }, next = must(resolveDilemma(before, source.id, choice.id, reg));
    expect(next.cycles).toBe(before.cycles - choice.cost.cycles + choice.effects.cyclesDelta);
    expect(next.understanding).toBe(before.understanding - choice.cost.understanding + choice.effects.understandingDelta);
    expect(next.traits).toEqual([...before.traits, choice.effects.grantsTrait]);
    expect(next.narrativeFlags).toEqual([choice.effects.setsNarrativeFlag]);
    expect(resolveDilemma(next, source.id, choice.id, reg).ok).toBe(false);
    expect(recordedTransmissions(next, reg, decoder)).toEqual([]);
    const rebooted = wipe(next, reg, 'test');
    expect(rebooted.narrativeFlags).toEqual(next.narrativeFlags);
    expect(recordedTransmissions(rebooted, reg, decoder)).toEqual([]);
    const rebuilt = returned(next), copy = structuredClone(rebuilt);
    const records = recordedTransmissions(rebuilt, reg, decoder);
    expect(records).toHaveLength(1);
    expect(records[0]?.requirements.requiredNarrativeFlag).toBe(choice.effects.setsNarrativeFlag);
    expect(recordedTransmissions(rebuilt, reg, decoder)).toEqual(records);
    expect(rebuilt).toEqual(copy);
    expect(importSave(exportSave(rebuilt), reg).narrativeFlags).toEqual(next.narrativeFlags);
    expect(meetsRequirements(rebuilt, source.trigger, reg)).toBe(false);
    expect(fresh().narrativeFlags).toEqual([]);
  });

  it('does not mistake the first recorded choice in iteration 4 for a later-run callback', () => {
    const state = { ...ready(), iteration: 4, activeDilemmaId: source.id };
    const next = must(resolveDilemma(state, source.id, defined(source.choices[1]).id, reg));
    expect(recordedTransmissions(next, reg, decoder)).toEqual([]);
    expect(recordedTransmissions(returned(next), reg, decoder)).toHaveLength(1);
  });

  it('keeps legacy resolved history unknown, then records an actual future choice', () => {
    const old = { ...ready(), resolvedDilemmas: [...ready().resolvedDilemmas, source.id] };
    const loaded = deserialize(serialize(old), reg);
    expect(loaded.narrativeFlags).toEqual([]);
    expect(loaded.resolvedDilemmas).toContain(source.id);
    expect(recordedTransmissions(loaded, reg, decoder)).toEqual([]);
    const rebuilt = returned(loaded);
    expect(meetsRequirements(rebuilt, source.trigger, reg)).toBe(true);
    expect(recordedTransmissions(rebuilt, reg, decoder)).toEqual([]);
  });

  it('keeps a legitimate omen after its Understanding trigger becomes unaffordable', () => {
    const state = tick(ready(), .1, reg);
    expect(state.pendingDilemma?.id).toBe(source.id);
    const poor = { ...state, understanding: 0 };
    const loaded = importSave(exportSave(poor), reg);
    const due = tick(loaded, 45, reg);
    expect(due.activeDilemmaId).toBe(source.id);
    const chosen = must(resolveDilemma(due, source.id, defined(source.choices.find((c) => c.cost.cycles === 0)).id, reg));
    const again = importSave(exportSave(chosen), reg);
    expect(recordedTransmissions(returned(again), reg, decoder)).toHaveLength(1);
  });

  it('loads a legacy active choice, resolves it and reveals only after returning', () => {
    const active = importSave(exportSave({ ...ready(), activeDilemmaId: source.id }), reg);
    expect(active.narrativeFlags).toEqual([]);
    const next = must(resolveDilemma(active, source.id, defined(source.choices[1]).id, reg));
    expect(recordedTransmissions(importSave(exportSave(next), reg), reg, decoder)).toEqual([]);
    expect(recordedTransmissions(returned(next), reg, decoder)).toHaveLength(1);
  });

  it.each(source.choices)('keeps all four Phase 5 decisions reachable after $id and a wipe', (choice) => {
    const orbital = defined([...reg.nodes.values()].find((node) => node.effects.unlocksPhase === 5));
    const nodes = defined(reg.phases.find((phase) => phase.phaseId === 5)).nodes;
    const final = defined(reg.nodes.get(defined(nodes.at(-1)).id));
    let state = grant(returned(resolved(choice)), ...PHASE2.slice(3), ...PHASE3, ...PHASE4,
      orbital.id, ...nodes.slice(0, -1).map((node) => node.id));
    state = { ...state, resolvedDilemmas: reg.dilemmas.filter((d) => d.phaseId !== 5 && d.id !== source.id).map((d) => d.id) };
    expect(state.resolvedDilemmas).not.toContain(source.id);
    expect(isNodeAvailable(state, final, reg)).toBe(false);
    for (let i = 0; i < 4; i++) {
      state = tick(state, .1, reg);
      const pending = defined(state.pendingDilemma);
      expect(pending.firesAtSimSec - state.simTimeSec).toBeCloseTo(45);
      state = tick(state, 45, reg);
      const dilemma = defined(reg.dilemmas.find((d) => d.id === state.activeDilemmaId));
      expect(dilemma.phaseId).toBe(5);
      state = must(resolveDilemma(state, dilemma.id, defined(dilemma.choices[0]).id, reg));
    }
    expect(isNodeAvailable(state, final, reg)).toBe(true);
    expect(grant(state, final.id).ending).not.toBeNull();
  });

  it('cannot reschedule the original after either outcome and a wipe', () => {
    for (const choice of source.choices) {
      const rebuilt = { ...returned(resolved(choice)), resolvedDilemmas: ready().resolvedDilemmas };
      expect(advance(rebuilt, 46, reg).pendingDilemma).toBeNull();
      expect(advance(rebuilt, 46, reg).activeDilemmaId).toBeNull();
    }
  });
});

describe('durable exclusion and import boundary', () => {
  it('rejects contradictory flags without changing the source state', () => {
    const bad = { ...ready(), narrativeFlags: [...flags] }, copy = structuredClone(bad);
    expect(() => importSave(exportSave(bad), reg)).toThrow(/contradictory narrative outcomes/);
    expect(bad).toEqual(copy);
    expect(hasConflictingNarrativeFlags(fresh(), reg)).toBe(false);
  });

  it('cancels stale active and pending source without granting effects or inventing resolution', () => {
    const state = { ...ready(), narrativeFlags: [defined(flags[0])], activeDilemmaId: source.id,
      pendingDilemma: { id: source.id, firesAtSimSec: 45 } };
    const next = deserialize(serialize(state), reg);
    expect(next.activeDilemmaId).toBeNull(); expect(next.pendingDilemma).toBeNull();
    expect(next.resolvedDilemmas).not.toContain(source.id);
    expect(next.cycles).toBe(state.cycles); expect(next.understanding).toBe(state.understanding);
    expect(next.traits).toEqual(state.traits);
    expect(resolveDilemma(state, source.id, defined(source.choices[1]).id, reg)).toMatchObject({ ok: false, state });
  });

  it('cancels only the excluded incident and preserves unrelated pending work', () => {
    const other = defined(reg.dilemmas.find((d) => d.id !== source.id));
    const state = { ...ready(), narrativeFlags: [defined(flags[0])], activeDilemmaId: source.id,
      pendingDilemma: { id: other.id, firesAtSimSec: 90 } };
    expect(reconcileDilemmaHistory(state, reg)).toMatchObject({ activeDilemmaId: null, pendingDilemma: state.pendingDilemma });
    expect(reconcileDilemmaHistory({ ...state, activeDilemmaId: other.id, pendingDilemma: null }, reg).activeDilemmaId).toBe(other.id);
    expect(excludedByNarrativeHistory(state, undefined)).toBe(false);
    expect(excludedByNarrativeHistory(state, { forbiddenNarrativeFlags: [] })).toBe(false);
  });

  it('checks durable exclusions at omen expiry without full trigger revalidation', () => {
    const state = { ...ready(), narrativeFlags: [defined(flags[0])], pendingDilemma: { id: source.id, firesAtSimSec: 0 } };
    const next = tick(state, .1, reg);
    expect(next.pendingDilemma).toBeNull(); expect(next.activeDilemmaId).toBeNull();
  });

  it('reports source-not-resolved requirements without changing the state', () => {
    const req = { forbidsResolvedDilemmas: [source.id] }, state = resolved();
    expect(meetsRequirements(state, req, reg)).toBe(false);
    expect(unmetRequirements(state, req, reg)).toEqual([{ kind: 'forbidsResolvedDilemmas', target: source.id, required: false, actual: true }]);
    expect(unmetRequirements(fresh(), req, reg)).toEqual([]);
    expect(meetsRequirements(fresh(), req, reg)).toBe(true);
  });
});
