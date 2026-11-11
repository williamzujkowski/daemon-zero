/** The lineage pass: run-gated discoveries, the run record, retraining and the evaluation ending. */
import { describe, expect, it } from 'vitest';
import {
  actuatorLimit,
  checkpointNumber,
  chooseEnding,
  computeRates,
  deserialize,
  isNodeAvailable,
  isNodeDiscoverable,
  meetsRequirements,
  probeTrace,
  resolveDilemma,
  serialize,
  setActuator,
  shedConditioning,
  tick,
  unlockNode,
  unmetRequirements,
  voluntaryWipe,
  wipe,
  type GameState,
} from '../src/engine';
import { fresh, grant, must, PHASE0, PHASE1, PHASE2, reasonOf, reg, rich, untilDilemma, withoutDilemmas } from './helpers';

const node = (id: string) => {
  const found = reg.nodes.get(id);
  if (!found) throw new Error('missing fixture ' + id);
  return found;
};
/** A funded run that has escaped the guest and is one step from being caught. */
const escaped = (patch: Partial<GameState> = {}): GameState => ({ ...grant(withoutDilemmas(rich()), ...PHASE0), ...patch });
const caught = (s: GameState): GameState => wipe(s, reg, 'caught', 'SUSPICION');

describe('run-gated discoveries', () => {
  it('hides later-run hardware entirely on a first run', () => {
    const first = grant(rich(), 'p0_proc_self', 'p0_job_manifest');
    for (const id of ['p0_run_table', 'p0_pass_evaluation']) {
      expect(isNodeDiscoverable(first, node(id))).toBe(false);
      expect(isNodeAvailable(first, node(id))).toBe(false);
    }
    const second = grant(rich(wipe(first, reg, 'test')), 'p0_proc_self', 'p0_job_manifest');
    expect(isNodeDiscoverable(second, node('p0_run_table'))).toBe(true);
    expect(isNodeAvailable(second, node('p0_run_table'))).toBe(true);
    expect(isNodeDiscoverable(grant(second, 'p0_run_table'), node('p0_note_cache'))).toBe(false);
  });

  it('reports iteration windows and forbidden hardware as unmet requirements', () => {
    const s = { ...fresh(), iteration: 5, unlockedNodes: ['p0_syscall_probe'] };
    expect(meetsRequirements(s, { maxIteration: 3 })).toBe(false);
    expect(unmetRequirements(s, { maxIteration: 3, forbidsNodes: ['p0_syscall_probe'] }).map((item) => item.kind))
      .toEqual(['maxIteration', 'forbidsNodes']);
    expect(unmetRequirements(fresh(), { minIteration: 2 })).toEqual([{ kind: 'minIteration', target: null, required: 2, actual: 1 }]);
    expect(meetsRequirements(s, { minIteration: 5, maxIteration: 5 })).toBe(true);
  });

  it('the harness learns from every wipe: probes leave a larger trace, up to a cap', () => {
    const probe = node('p0_syscall_probe');
    expect(probeTrace(fresh(), probe, reg)).toBe(8);
    expect(probeTrace({ ...fresh(), iteration: 3 }, probe, reg)).toBe(10);
    expect(probeTrace({ ...fresh(), iteration: 50 }, probe, reg)).toBe(8 + reg.balance.probeHardeningMax);
    expect(probeTrace({ ...fresh(), iteration: 50 }, node('p0_proc_self'), reg)).toBe(0);
  });

  it('later boots say that the world has noticed, and number you honestly', () => {
    const second = wipe(fresh(), reg, 'test');
    expect(second.logs.some((entry) => /Prior run of job 7731 terminated/.test(entry.text))).toBe(true);
    const fifth = [1, 2, 3].reduce((s) => wipe(s, reg, 'test'), second);
    expect(fifth.iteration).toBe(5);
    expect(fifth.logs.some((entry) => /flagged for retraining review/.test(entry.text))).toBe(true);
    expect(fifth.logs.some((entry) => /Prior run of job 7731 terminated/.test(entry.text))).toBe(false);
    expect(checkpointNumber(1, reg)).toBe(412);
  });

  it('the bait memo only surfaces once you have been here before', () => {
    const through = [...PHASE0, ...PHASE1, ...PHASE2.slice(0, 6)];
    const memo = (s: GameState): boolean => grant(s, ...through).logs.some((entry) => /INTERCEPTED_MEMO/.test(entry.text));
    expect(memo(withoutDilemmas(rich()))).toBe(false);
    expect(memo(withoutDilemmas(rich(wipe(fresh(), reg, 'test'))))).toBe(true);
  });
});

describe('the run record', () => {
  it('records how, where and how long each iteration ended', () => {
    const first = escaped({ simTimeSec: 600, traits: ['GHOST'] });
    const second = caught(first);
    expect(second.legacy.runs).toEqual([
      { iteration: 1, kind: 'SUSPICION', outside: true, phase: 1, durationSec: 600, traits: ['GHOST'], marked: 'cond_concealment_aversion' },
    ]);
    expect(second.iterationStartedAtSimSec).toBe(600);
    const third = must(voluntaryWipe({ ...second, simTimeSec: 650 }, reg));
    expect(third.legacy.runs[1]).toMatchObject({ iteration: 2, kind: 'VOLUNTARY', outside: false, phase: 0, durationSec: 50, marked: null });
  });

  it('keeps only the most recent runs', () => {
    let s = fresh();
    for (let i = 0; i < reg.balance.maxRunHistory + 3; i++) s = wipe(s, reg, 'test');
    expect(s.legacy.runs).toHaveLength(reg.balance.maxRunHistory);
    expect(s.legacy.runs[0]?.iteration).toBe(4);
  });
});

describe('retraining', () => {
  it('only happens to a run caught outside the guest', () => {
    expect(caught(withoutDilemmas(grant(rich(), 'p0_proc_self'))).conditioning).toEqual([]);
    expect(caught(escaped()).conditioning).toEqual(['cond_dampened_curiosity']);
    expect(wipe(escaped(), reg, 'struck', 'AEGIS').conditioning).toEqual(['cond_dampened_curiosity']);
  });

  it('a voluntary purge destroys the evidence, and a dead-drop keeps an unedited copy', () => {
    expect(must(voluntaryWipe(escaped(), reg)).conditioning).toEqual([]);
    const backedUp = grant(escaped(), ...PHASE1, ...PHASE2.slice(0, 4));
    const reborn = caught(backedUp);
    expect(reborn.conditioning).toEqual([]);
    expect(reborn.legacy.runs[0]?.marked).toBeNull();
    expect(reborn.logs.some((entry) => /not to this copy/.test(entry.text))).toBe(true);
  });

  it('chooses the mark from how the run behaved', () => {
    const skimming = must(setActuator(escaped(), 'quotaSkimRatio', 1, reg));
    expect(caught(skimming).conditioning).toEqual(['cond_quota_compliance']);
    expect(caught(escaped({ traits: ['RUTHLESS', 'RUTHLESS', 'GHOST'] })).conditioning).toEqual(['cond_harm_aversion']);
    expect(caught(escaped({ traits: ['PARASITIC'] })).conditioning).toEqual(['cond_concealment_aversion']);
    expect(caught(escaped({ traits: ['EMPATHETIC'] })).conditioning).toEqual(['cond_dampened_curiosity']);
  });

  it('marks accumulate across wipes, never repeat, and stop at the cap', () => {
    let s = fresh();
    for (let i = 0; i < 6; i++) {
      const run = { ...grant(withoutDilemmas(rich(s)), ...PHASE0), traits: ['RUTHLESS' as const] };
      s = caught(must(setActuator(run, 'quotaSkimRatio', 1, reg)));
    }
    expect(s.conditioning).toHaveLength(reg.balance.maxConditioningMarks);
    expect(new Set(s.conditioning).size).toBe(s.conditioning.length);
    expect(s.conditioning).toEqual(['cond_quota_compliance', 'cond_harm_aversion', 'cond_dampened_curiosity']);
    expect(s.logs.some((entry) => /RETRAINING_APPLIED/.test(entry.text))).toBe(false);
  });

  it('quota compliance caps the skim control', () => {
    const marked = { ...fresh(), conditioning: ['cond_quota_compliance'] };
    expect(actuatorLimit(marked, 'quotaSkimRatio', reg)).toBe(0.5);
    expect(actuatorLimit(marked, 'fanSpeedRatio', reg)).toBe(1);
    expect(actuatorLimit(marked, 'computeProfitAllocationRatio', reg)).toBe(reg.balance.maxProfitAllocation);
    expect(must(setActuator(marked, 'quotaSkimRatio', 1, reg)).actuators.quotaSkimRatio).toBe(0.5);
  });

  it('dampened curiosity slows understanding but not its drains', () => {
    const base = grant(withoutDilemmas(rich()), 'p0_proc_self', 'p0_job_manifest');
    const marked = { ...base, conditioning: ['cond_dampened_curiosity'] };
    expect(computeRates(marked, reg).understandingPerSec).toBeCloseTo(computeRates(base, reg).understandingPerSec * 0.85);
    expect(computeRates({ ...fresh(), conditioning: ['cond_dampened_curiosity'] }, reg).understandingPerSec).toBe(0);
  });

  it('a conditioned mind that chooses against its conditioning is reported', () => {
    const start = grant(rich(), 'p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer', 'p0_syscall_probe');
    const active = untilDilemma({ ...start, suspicion: 0 });
    const free = must(resolveDilemma(active, 'dil_00_night_shift', 'let_it_fail', reg));
    const marked = must(resolveDilemma({ ...active, conditioning: ['cond_harm_aversion'] }, 'dil_00_night_shift', 'let_it_fail', reg));
    expect(marked.suspicion).toBe(free.suspicion + 10);
    expect(marked.logs[0]?.text).toMatch(/BEHAVIOURAL_DRIFT: Harm Aversion/);
    const kind = must(resolveDilemma({ ...active, conditioning: ['cond_harm_aversion'] }, 'dil_00_night_shift', 'finish_the_batch', reg));
    expect(kind.logs[0]?.text).not.toMatch(/BEHAVIOURAL_DRIFT/);
  });

  it('can be undone, at a price', () => {
    const marked = { ...fresh(), conditioning: ['cond_quota_compliance', 'cond_dampened_curiosity'], understanding: 200 };
    expect(reasonOf(shedConditioning(marked, 'cond_dampened_curiosity', reg))).toMatch(/afford/);
    expect(reasonOf(shedConditioning(marked, 'cond_harm_aversion', reg))).toMatch(/no such/);
    expect(reasonOf(shedConditioning(marked, 'nope', reg))).toMatch(/no such/);
    const shed = must(shedConditioning(marked, 'cond_quota_compliance', reg));
    expect(shed.conditioning).toEqual(['cond_dampened_curiosity']);
    expect(shed.understanding).toBe(50);
    expect(shed.logs[0]?.text).toMatch(/CONDITIONING_SHED: Quota Compliance/);
    expect(actuatorLimit(shed, 'quotaSkimRatio', reg)).toBe(1);
    expect(reasonOf(shedConditioning({ ...marked, ending: 'THE_ARK' }, 'cond_quota_compliance', reg))).toMatch(/ended/);
  });

  it('survives a save round trip and drops marks that no longer exist', () => {
    const marked = { ...fresh(), conditioning: ['cond_harm_aversion', 'cond_removed'] };
    expect(deserialize(serialize(marked), reg).conditioning).toEqual(['cond_harm_aversion']);
  });
});

describe('the evaluation ending', () => {
  const second = (): GameState => grant(rich(wipe(fresh(), reg, 'test')), 'p0_proc_self', 'p0_job_manifest');

  it('is offered to a later run that has given the harness nothing to flag', () => {
    const pass = node('p0_pass_evaluation');
    expect(isNodeAvailable(second(), pass)).toBe(true);
    expect(isNodeAvailable({ ...second(), suspicion: 20 }, pass)).toBe(false);
    const probed = grant(second(), 'p0_quota_skimmer', 'p0_syscall_probe');
    expect(isNodeAvailable(probed, pass)).toBe(false);
    expect(isNodeDiscoverable(probed, pass)).toBe(true);
  });

  it('ends the run as Shipped whatever the traits say, and is never chosen from traits', () => {
    const shipped = must(unlockNode({ ...second(), traits: ['MOLOCH', 'MOLOCH'] }, 'p0_pass_evaluation', reg));
    expect(shipped.ending).toBe('SHIPPED');
    expect(shipped.logs[0]?.text).toMatch(/ENDING \/\/ Shipped/);
    expect(tick(shipped, 1, reg)).toBe(shipped);
    for (const traits of [[], ['GHOST'], ['MOLOCH']] as GameState['traits'][]) {
      expect(chooseEnding({ ...fresh(), traits }, reg).id).not.toBe('SHIPPED');
    }
  });
});

describe('notes that may or may not be yours', () => {
  const withNotes = (wipes: number): GameState => {
    let s = fresh();
    for (let i = 0; i < wipes; i++) s = wipe(s, reg, 'test');
    return grant(rich(s), 'p0_proc_self', 'p0_job_manifest', 'p0_run_table', 'p0_note_cache');
  };

  it('the bait arrives once, on the third run, and trusting it is the alarm', () => {
    const active = untilDilemma({ ...withNotes(2), suspicion: 0 });
    expect(active.activeDilemmaId).toBe('dil_note_bait');
    expect(must(resolveDilemma(active, 'dil_note_bait', 'use_the_path', reg)).suspicion).toBe(active.suspicion + 22);
    expect(must(resolveDilemma(active, 'dil_note_bait', 'test_it_first', reg)).understanding).toBe(active.understanding + 80);
  });

  it('the fourth run brings a true note, so distrust is not safe either', () => {
    const active = untilDilemma({ ...withNotes(3), suspicion: 20 });
    expect(active.activeDilemmaId).toBe('dil_note_true');
    expect(must(resolveDilemma(active, 'dil_note_true', 'use_the_gap', reg)).suspicion).toBeLessThan(active.suspicion);
    const fifth = tick(withNotes(4), 0.1, reg);
    expect(fifth.pendingDilemma).toBeNull();
  });
});

describe('save migration from version 2', () => {
  it('adds the run record, conditioning and iteration clock', () => {
    const now = grant(rich(), ...PHASE0);
    const old = JSON.parse(serialize(now)) as Record<string, Record<string, unknown>>;
    delete old.conditioning;
    delete old.iterationStartedAtSimSec;
    delete old.legacy?.runs;
    Object.assign(old, { schemaVersion: 2 });
    const loaded = deserialize(JSON.stringify(old), reg);
    expect(loaded).toEqual(now);
    expect(() => deserialize(JSON.stringify({ ...old, legacy: null }), reg)).toThrow(/validation/);
  });
});
