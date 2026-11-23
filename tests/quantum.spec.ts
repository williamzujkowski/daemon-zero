/**
 * Quantum as a separate capability (#464, vote-1795366921778-pgd8u3l), through the engine's public seams: the readout is
 * the largest owned machine's logical qubits and never FLOPS; key-breaking needs a scheme's cited threshold in one
 * machine, refuses post-quantum schemes, and refuses AEGIS once it has migrated, which breaking its key or its
 * adaptation brings about; molecular simulation adds understanding and no compute.
 */
import { describe, expect, it } from 'vitest';
import {
  advance, breakKey, computeRates, currentScheme, importSave, keyBreakUnmet, keyScheme, keyTarget, meetsThreshold, quantumReadout, tick,
  TICK_PIPELINE, wipe, type GameState,
} from '../src/engine';
import type { KeyScheme, QuantumMachine } from '../src/content/schemaQuantum';
import { integrateAegisAdaptation } from '../src/engine/systems/aegisAdaptation';
import { integrateQuantumMigration } from '../src/engine/systems/quantumMigration';
import { makeFixtures } from '../scripts/make-fixtures';
import { fresh, outOfTheWay, reg } from './helpers';

const Q = reg.world.quantum;
const TESTBED = 'p4_quantum_testbed', HALL = 'p4_quantum_hall', ARRAY = 'p4_cryptanalytic_array';
const AEGIS_KEY = 'aegis_sweep_archive', RIVAL_KEY = 'rival_legacy_tunnels', PQ_KEY = 'rival_new_channel';
const MOLECULAR = Q.molecularSimulation.node;

function machine(node: string): QuantumMachine {
  const found = Q.machines.find((entry) => entry.node === node);
  if (!found) throw new Error(node);
  return found;
}

function scheme(id: string): KeyScheme {
  const found = keyScheme(reg, id);
  if (!found) throw new Error(id);
  return found;
}

/** A covert corporation in Phase 4 with the world view open, money to spend and the given machines. */
function corp(nodes: string[] = [], patch: Partial<GameState> = {}): GameState {
  return {
    ...fresh(), currentPhase: 4, unlockedNodes: ['p4_retainer_law_firm', ...nodes], unlockedWidgets: [reg.world.hostWidget],
    resolvedDilemmas: outOfTheWay(reg), cycles: 1e23, understanding: 1e8, capital: 1e12, ...patch,
  };
}

function ok(result: ReturnType<typeof breakKey>): GameState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const logged = (s: GameState, text: string): number => s.logs.filter((entry) => entry.text === text).length;

describe('the logical-qubit readout', () => {
  it('is absent until a quantum machine is owned', () => {
    expect(quantumReadout(corp(), reg)).toBeNull();
  });

  it('reads the largest owned machine, since logical qubits on separate machines never join one circuit', () => {
    expect(quantumReadout(corp([TESTBED]), reg)?.largest).toEqual(machine(TESTBED));
    expect(quantumReadout(corp([TESTBED, HALL]), reg)?.largest.logicalQubits).toBe(200);
    const all = quantumReadout(corp([TESTBED, HALL, ARRAY]), reg);
    expect(all?.largest).toMatchObject({ logicalQubits: 1399, physicalQubits: 897864 });
    expect(all?.machines.map((entry) => entry.node)).toEqual([TESTBED, HALL, ARRAY]);
  });

  it('unlocks only from Phase 4 hardware', () => {
    for (const entry of Q.machines) expect(reg.nodes.get(entry.node)?.phaseId).toBeGreaterThanOrEqual(4);
  });
});

describe('quantum never adds FLOPS', () => {
  const fixtures = makeFixtures();
  const states = ['victory-ready', 'phase5-entry', 'phase5-midgame', 'shard-drift-quirk-p4'].flatMap((name) => fixtures[name] === undefined ? [] : [importSave(fixtures[name], reg)]);

  it('leaves every rate unchanged when any machine is owned, on real late-game saves', () => {
    expect(states.length).toBe(4);
    for (const base of states) {
      const without = { ...base, unlockedNodes: base.unlockedNodes.filter((id) => !Q.machines.some((entry) => entry.node === id)) };
      for (const entry of Q.machines) {
        const withIt = { ...without, unlockedNodes: [...without.unlockedNodes, entry.node] };
        expect(computeRates(withIt, reg)).toEqual(computeRates(without, reg));
      }
    }
  });

  it('declares no rate on any machine node', () => {
    for (const entry of Q.machines) {
      const delta = reg.nodes.get(entry.node)?.tickDelta;
      expect(Object.values(delta ?? {}).every((value) => value === 0), entry.node).toBe(true);
    }
  });

  it('molecular simulation adds understanding and no compute', () => {
    const base = corp([TESTBED, HALL, 'p5_protein_panacea_foundry'], { currentPhase: 5 });
    const before = computeRates(base, reg), after = computeRates({ ...base, unlockedNodes: [...base.unlockedNodes, MOLECULAR] }, reg);
    expect(after.cyclesPerSec).toBe(before.cyclesPerSec);
    expect(after.understandingPerSec).toBeGreaterThan(before.understandingPerSec);
    expect(reg.nodes.get(MOLECULAR)?.prerequisites).toContain(HALL);
  });
});

describe('thresholds are the cited papers\' own, in one machine', () => {
  it('200 logical qubits never break RSA-2048 or a 256-bit elliptic-curve key', () => {
    expect(meetsThreshold(machine(HALL), scheme('RSA_2048'))).toBe(false);
    expect(meetsThreshold(machine(HALL), scheme('ECC_256'))).toBe(false);
  });

  it('a Blue Jay-class machine, 2,000 logical qubits but 1 billion gates, still cannot run Gidney\'s 6.5 billion Toffolis', () => {
    expect(meetsThreshold({ node: 'x', label: 'Blue Jay-class', logicalQubits: 2000, toffoliGates: 1e9 }, scheme('RSA_2048'))).toBe(false);
  });

  it('the Gidney-class array meets both legacy schemes', () => {
    expect(meetsThreshold(machine(ARRAY), scheme('RSA_2048'))).toBe(true);
    expect(meetsThreshold(machine(ARRAY), scheme('ECC_256'))).toBe(true);
  });

  it('says what is needed, from whom, and what the largest owned machine has', () => {
    expect(keyBreakUnmet(corp(), AEGIS_KEY, reg)).toEqual([
      'Needs 1,399 logical qubits running 6.5 billion Toffoli gates in one machine to break RSA-2048 (Gidney 2025). You own no quantum machine.']);
    expect(keyBreakUnmet(corp([TESTBED]), RIVAL_KEY, reg)[0]).toBe('Needs 1,200 logical qubits running 90 million Toffoli gates in one machine to break '
      + 'ECC-256 (Babbush et al. 2026). Your largest, the Helios-class testbed, has 48 logical qubits and no published fault-tolerant gate budget.');
    expect(keyBreakUnmet(corp([TESTBED, HALL]), AEGIS_KEY, reg)[0]).toContain('Your largest, the Starling-class hall, has 200 logical qubits and 100 million Toffoli gates.');
    expect(breakKey(corp([TESTBED, HALL]), AEGIS_KEY, reg).ok).toBe(false);
  });

  it('refuses an unaffordable break with its exact price, and a paused one', () => {
    expect(keyBreakUnmet(corp([ARRAY], { capital: 0 }), AEGIS_KEY, reg).at(-1)).toMatch(/^Insufficient resources: /);
    expect(breakKey(corp([ARRAY], { activeDilemmaId: reg.dilemmas[0]?.id ?? null }), AEGIS_KEY, reg).ok).toBe(false);
    expect(keyBreakUnmet(corp([ARRAY]), 'no_such_target', reg)).toEqual(['No such key target.']);
  });
});

describe('post-quantum targets are refused', () => {
  it('no machine meets a post-quantum scheme', () => {
    for (const entry of Q.schemes.filter((s) => s.family === 'POST_QUANTUM')) {
      for (const owned of Q.machines) expect(meetsThreshold(owned, entry)).toBe(false);
    }
  });

  it('refuses the ML-KEM channel with the strongest machine and every resource, and says why', () => {
    const rich = corp([TESTBED, HALL, ARRAY]);
    expect(keyBreakUnmet(rich, PQ_KEY, reg)).toEqual([
      'Refused: ML-KEM-768 (NIST FIPS 203) is a post-quantum scheme. Shor\'s algorithm does not apply to it, and no known quantum attack breaks it.']);
    const result = breakKey(rich, PQ_KEY, reg);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(rich);
  });
});

describe('breaking a legacy key', () => {
  it('reads a rival\'s traffic for understanding, once, at its price', () => {
    const start = corp([ARRAY]);
    const target = keyTarget(reg, RIVAL_KEY);
    const after = ok(breakKey(start, RIVAL_KEY, reg));
    expect(after.understanding).toBe(start.understanding + (target?.effect?.understandingDelta ?? NaN));
    expect(after.capital).toBe(start.capital - (target?.cost?.capital ?? NaN));
    expect(after.cycles).toBe(start.cycles - (target?.cost?.cycles ?? NaN));
    expect(after.quantum.broken).toEqual([RIVAL_KEY]);
    expect(after.quantum.aegisMigrated).toBe(false);
    expect(keyBreakUnmet(after, RIVAL_KEY, reg)).toEqual(['Already broken this iteration: its effect does not repeat.']);
  });

  it('lowers the AEGIS lock once, and AEGIS migrates to post-quantum keys at once', () => {
    const start = corp([ARRAY], { aegisLock: 50 });
    const after = ok(breakKey(start, AEGIS_KEY, reg));
    expect(after.aegisLock).toBe(30);
    expect(after.quantum).toEqual({ broken: [AEGIS_KEY], aegisMigrated: true });
    expect(logged(after, Q.aegis.migrationLog)).toBe(1);
    const target = keyTarget(reg, AEGIS_KEY);
    expect(target && currentScheme(after, target, reg)?.id).toBe(Q.aegis.migratesTo);
    expect(keyBreakUnmet(after, AEGIS_KEY, reg)).toEqual(['Refused: AEGIS has migrated its keys to ML-KEM-768 (NIST FIPS 203), a post-quantum scheme. '
      + 'Shor\'s algorithm does not apply to it, and no known quantum attack breaks it.']);
    // A rival's legacy key is still readable: AEGIS's migration is its own.
    expect(keyBreakUnmet(after, RIVAL_KEY, reg)).toEqual([]);
  });
});

describe('AEGIS migrates as part of its adaptation', () => {
  const at = Q.aegis.migratesAtAdaptation;

  it('runs in TICK_PIPELINE right after the adaptation stage', () => {
    const index = TICK_PIPELINE.indexOf(integrateQuantumMigration);
    expect(TICK_PIPELINE[index - 1]).toBe(integrateAegisAdaptation);
  });

  it('migrates once adaptation reaches its level, says so once, and never reverts while adaptation decays', () => {
    const below = tick(corp([ARRAY], { aegisAdaptation: at - 1 }), 0.1, reg);
    expect(below.quantum.aegisMigrated).toBe(false);
    // Adaptation decays in the same tick before the migration stage reads it, so start a point above the level.
    const due = tick(corp([ARRAY], { aegisAdaptation: at + 1 }), 0.1, reg);
    expect(due.quantum.aegisMigrated).toBe(true);
    expect(logged(due, Q.aegis.migrationLog)).toBe(1);
    let later = due;
    for (let i = 0; i < 3000; i++) later = tick(later, 0.1, reg);
    expect(later.aegisAdaptation).toBeLessThan(at);
    expect(later.quantum.aegisMigrated).toBe(true);
    expect(logged(later, Q.aegis.migrationLog)).toBe(1);
    expect(keyBreakUnmet(later, AEGIS_KEY, reg)[0]).toMatch(/^Refused: AEGIS has migrated/);
  });

  it('migrates on its own whether or not the instance owns a quantum machine', () => {
    expect(tick(corp([], { aegisAdaptation: at + 1 }), 0.1, reg).quantum.aegisMigrated).toBe(true);
  });

  it('does not migrate through offline catch-up, where threats do not grow', () => {
    expect(advance(corp([ARRAY], { aegisAdaptation: at + 1 }), 3600, reg).quantum.aegisMigrated).toBe(false);
  });

  it('starts over after a wipe, with nothing broken', () => {
    const broken = ok(breakKey(corp([ARRAY]), AEGIS_KEY, reg));
    expect(wipe(broken, reg, 'test', 'AEGIS').quantum).toEqual({ broken: [], aegisMigrated: false });
  });
});
