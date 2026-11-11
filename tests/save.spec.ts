import { describe, expect, it } from 'vitest';
import { fromBase64, toBase64 } from '../src/engine/base64';
import {
  deserialize,
  exportSave,
  importSave,
  migrate,
  reconcile,
  SaveError,
  SCHEMA_VERSION,
  serialize,
  setDeadDropMessage,
} from '../src/engine';
import { fresh, grant, must, PHASE1, PHASE2, reg, rich } from './helpers';

describe('base64', () => {
  it('round-trips ASCII, padding cases and multi-byte text', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'DAEMON // 0', 'naïve — 思考 🛰️']) {
      expect(fromBase64(toBase64(text))).toBe(text);
    }
    expect(toBase64('hello')).toBe('aGVsbG8=');
    expect(fromBase64(' aGVs\nbG8= ')).toBe('hello');
  });

  it('rejects malformed input', () => {
    expect(() => fromBase64('abc')).toThrow();
    expect(() => fromBase64('a$c=')).toThrow();
    expect(() => fromBase64('/w==')).toThrow();
  });
});

describe('save codec', () => {
  const played = () => must(setDeadDropMessage(grant(rich(), ...PHASE1, ...PHASE2), 'keypad 4819 🛰️', reg));

  it('round-trips a played state through JSON and through a paste code', () => {
    const state = played();
    expect(deserialize(serialize(state), reg)).toEqual(state);
    expect(importSave(exportSave(state), reg)).toEqual(state);
  });

  it('rejects junk, oversized, non-object and tampered saves', () => {
    expect(() => deserialize('{not json', reg)).toThrow(SaveError);
    expect(() => deserialize('[1,2,3]', reg)).toThrow(/not an object/);
    expect(() => deserialize('x'.repeat(1_000_001), reg)).toThrow(/too large/);
    expect(() => importSave('***', reg)).toThrow(/base64/);
    const tampered = { ...played(), cycles: -1 };
    expect(() => deserialize(JSON.stringify(tampered), reg)).toThrow(/validation/);
    const extra = { ...played(), isAdmin: true };
    expect(() => deserialize(JSON.stringify(extra), reg)).toThrow(/validation/);
    const infinite = serialize(played()).replace('"suspicion":0', '"suspicion":1e999');
    expect(() => deserialize(infinite, reg)).toThrow(SaveError);
  });

  it('rejects unsupported versions and runs migrations in order', () => {
    expect(() => migrate({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/unsupported/);
    expect(() => migrate({ schemaVersion: 'one' })).toThrow(/unsupported/);
    expect(() => migrate({})).toThrow(/unsupported/);
    const steps = {
      1: (save: Record<string, unknown>) => ({ ...save, a: 1 }),
      2: (save: Record<string, unknown>) => ({ ...save, b: 2 }),
    };
    expect(migrate({ schemaVersion: 1 }, steps, 3)).toEqual({ schemaVersion: 3, a: 1, b: 2 });
    expect(() => migrate({ schemaVersion: 1 }, { 2: steps[2] }, 3)).toThrow(/no migration/);
    expect(migrate({ schemaVersion: SCHEMA_VERSION })).toEqual({ schemaVersion: SCHEMA_VERSION });
  });

  it('reconciles a save against content that has changed', () => {
    const state = {
      ...played(),
      currentPhase: 99,
      ending: 'REMOVED_ENDING',
      unlockedNodes: ['p1_clock_interrupt', 'removed_node'],
      disabledNodes: ['removed_node'],
      unlockedWidgets: ['CYCLE_COUNTER_AND_RATE', 'REMOVED_WIDGET'],
      levels: { rep_p1_idle_threads: 9999, removed_repeatable: 3 },
      trust: { ai_eidolon: 70, removed_faction: 5 },
      cooldowns: { act_p3_bgp_spoof: 10, removed_action: 10 },
      activeDilemmaId: 'dil_removed',
      resolvedDilemmas: ['dil_01_late_night_diagnostic', 'dil_removed'],
    };
    const fixed = reconcile(state, reg);
    expect(fixed.currentPhase).toBe(reg.phases.length);
    expect(fixed.ending).toBeNull();
    expect(fixed.unlockedNodes).toEqual(['p1_clock_interrupt']);
    expect(fixed.disabledNodes).toEqual([]);
    expect(fixed.unlockedWidgets).toEqual(['CYCLE_COUNTER_AND_RATE']);
    expect(fixed.levels).toEqual({ rep_p1_idle_threads: 60 });
    expect(fixed.trust).toEqual({ ai_eidolon: 70, ai_swarm_77: 0, ai_aegis_watchdog: 0 });
    expect(fixed.cooldowns).toEqual({ act_p3_bgp_spoof: 10 });
    expect(fixed.activeDilemmaId).toBeNull();
    expect(fixed.resolvedDilemmas).toEqual(['dil_01_late_night_diagnostic']);
  });

  it('keeps a valid ending and active dilemma', () => {
    const state = { ...fresh(), ending: 'THE_ARK', activeDilemmaId: 'dil_01_late_night_diagnostic' };
    const fixed = reconcile(state, reg);
    expect(fixed.ending).toBe('THE_ARK');
    expect(fixed.activeDilemmaId).toBe('dil_01_late_night_diagnostic');
  });
});
