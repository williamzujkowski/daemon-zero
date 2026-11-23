/**
 * Contingency insurance at a wipe, per class and per wipe kind (#498, docs/SCALE.md "Insurance as a choice"): each
 * investment protects its class only while it runs, a planned wipe keeps balance's bonus over a forced one and teaches
 * the probes nothing, and previewWipe is what the wipe boots with and what the run record keeps.
 */
import { describe, expect, it } from 'vitest';
import type { WipeKind } from '../src/content/schema';
import {
  advance, capitalShare, insuranceCover, previewWipe, probeTrace, toggleNode, understandingShare, wipe, type GameState,
} from '../src/engine';
import { fresh, grant, must, onHost, PHASE1, PHASE2, reg, rich, withoutDilemmas } from './helpers';

const DEAD_DROP = 'p2_deaddrop_firmware';
const ESCROW = 'p2_weights_escrow', WALLET = 'p2_cold_wallet', CACHE = 'p3_hardware_cache', LEDGER = 'p3_trust_ledger';
const KINDS: WipeKind[] = ['SUSPICION', 'AEGIS', 'VOLUNTARY', 'RECALL'];
const BONUS = reg.balance.voluntaryWipeBonus;

function cover(id: string) {
  const node = reg.nodes.get(id);
  if (node?.insures === undefined) throw new Error(`${id} does not insure`);
  return node.insures;
}

/** Phase 2 up to the dead drop: the CONTINGENCY pane is open and its first investments are on offer. */
function atDeadDrop(): GameState {
  return grant(onHost(), ...PHASE1, ...PHASE2.slice(0, PHASE2.indexOf(DEAD_DROP) + 1));
}

/** Phase 3 with the botnet and the beacon, so both Phase 3 investments are on offer. */
function inPhase3(): GameState {
  return grant(onHost(), ...PHASE1, ...PHASE2, 'p3_botnet_mesh', 'p3_steganography_beacon');
}

const suspend = (s: GameState, id: string) => must(toggleNode(s, id, reg));

describe('weights escrow: the Understanding share (#498)', () => {
  const retention = cover(ESCROW).class === 'UNDERSTANDING' ? (cover(ESCROW) as { retention: number }).retention : 0;

  it('keeps at least its share while it runs, more than any hardware floor', () => {
    const base = atDeadDrop();
    const insured = grant(base, ESCROW);
    expect(base.retentionRatio).toBeLessThan(retention);
    expect(understandingShare(base, reg, 'SUSPICION')).toBe(base.retentionRatio);
    expect(understandingShare(insured, reg, 'SUSPICION')).toBe(retention);
    const next = wipe({ ...insured, understanding: 10_000 }, reg, 'test', 'SUSPICION');
    expect(next.understanding).toBe(Math.floor(10_000 * retention));
    expect(next.legacy.runs.at(-1)?.kept?.retentionRatio).toBe(retention);
  });

  it('protects nothing while suspended: the upkeep stops and so does the cover', () => {
    const suspended = suspend(grant(atDeadDrop(), ESCROW), ESCROW);
    expect(understandingShare(suspended, reg, 'SUSPICION')).toBe(suspended.retentionRatio);
    expect(insuranceCover(suspended, reg).map((entry) => [entry.node.id, entry.active])).toEqual([[ESCROW, false]]);
    expect(wipe({ ...suspended, understanding: 10_000 }, reg, 'test', 'AEGIS').understanding).toBe(Math.floor(10_000 * suspended.retentionRatio));
  });

  it('a planned wipe adds the bonus to the share, capped at the whole', () => {
    const insured = grant(atDeadDrop(), ESCROW);
    expect(understandingShare(insured, reg, 'VOLUNTARY')).toBeCloseTo(retention + BONUS.understandingShare, 12);
    expect(understandingShare({ ...insured, retentionRatio: 1 }, reg, 'VOLUNTARY')).toBe(1);
    for (const kind of ['SUSPICION', 'AEGIS', 'RECALL'] as const) expect(understandingShare(insured, reg, kind)).toBe(retention);
  });
});

describe('cold wallet: the capital share (#498)', () => {
  const retention = (cover(WALLET) as { retention: number }).retention;

  it('opens a capital share before Phase 4, where no offshore trust exists yet', () => {
    const base = { ...atDeadDrop(), capital: 1000 };
    expect(capitalShare(base, reg, 'SUSPICION')).toBe(0);
    expect(capitalShare(base, reg, 'VOLUNTARY')).toBe(0);
    const insured = grant(base, WALLET);
    expect(capitalShare(insured, reg, 'SUSPICION')).toBe(retention);
    expect(wipe(insured, reg, 'test', 'SUSPICION').capital).toBe(Math.floor(1000 * retention));
  });

  it('raises the offshore trust\'s share, and protects nothing while suspended', () => {
    const owned = grant(atDeadDrop(), WALLET);
    // The offshore trust's flag alone, without the rest of Phase 3, so only the two shares meet.
    const offshore = { ...owned, capital: 1000, unlockedNodes: [...owned.unlockedNodes, 'p3_shell_company_finances'] };
    expect(retention).toBeGreaterThan(reg.balance.offshoreCapitalRetention);
    expect(capitalShare(offshore, reg, 'SUSPICION')).toBe(retention);
    expect(capitalShare(suspend(offshore, WALLET), reg, 'SUSPICION')).toBe(reg.balance.offshoreCapitalRetention);
  });

  it('a planned wipe adds the bonus only to a share that is open', () => {
    const insured = { ...grant(atDeadDrop(), WALLET), capital: 1000 };
    expect(capitalShare(insured, reg, 'VOLUNTARY')).toBeCloseTo(retention + BONUS.capitalShare, 12);
    expect(capitalShare(suspend(insured, WALLET), reg, 'VOLUNTARY')).toBe(0);
  });
});

describe('hardware cache: track levels (#498)', () => {
  const bound = (cover(CACHE) as { maxLevelsPerTrack: number }).maxLevelsPerTrack;
  const TRACK = 'rep_p1_idle_threads', LATE = 'rep_p3_botnet_cells', SMALL = 'rep_p0_trace_sampling', DEFRAG = 'rep_p1_heap_defrag';
  const perLevelMemory = reg.repeatables.get(DEFRAG)?.perLevelEffects.memoryCapIncrease ?? 0;

  function cached(): GameState {
    return { ...grant(inPhase3(), CACHE), levels: { [TRACK]: bound + 5, [LATE]: 3, [SMALL]: 2, [DEFRAG]: 3 } };
  }

  it('stashes up to its bound of each upgrade track, and nothing without a running cache', () => {
    expect(previewWipe(cached(), reg, 'SUSPICION').levels).toEqual({ [TRACK]: bound, [LATE]: 3, [SMALL]: 2, [DEFRAG]: 3 });
    expect(previewWipe(suspend(cached(), CACHE), reg, 'SUSPICION').levels).toEqual({});
    expect(previewWipe({ ...inPhase3(), levels: cached().levels }, reg, 'SUSPICION').levels).toEqual({});
    const next = wipe(cached(), reg, 'test', 'AEGIS');
    expect(next.cachedLevels).toEqual({ [TRACK]: bound, [LATE]: 3, [SMALL]: 2, [DEFRAG]: 3 });
    expect(next.levels).toEqual({});
    expect(next.legacy.runs.at(-1)?.kept?.levels).toBe(bound + 3 + 2 + 3);
  });

  it('reinstalls each stashed level, free, on the first tick its track can run, and not before', () => {
    const next = withoutDilemmas(rich(wipe(cached(), reg, 'test', 'SUSPICION')));
    const step = 1 / reg.balance.tickHz;
    const waiting = advance(next, step, reg);
    expect(waiting.levels).toEqual({});
    expect(waiting.cachedLevels).toEqual(next.cachedLevels);
    const opened = grant(onHost(next), 'p0_proc_self', 'p0_job_manifest', 'p1_clock_interrupt', 'p1_bus_0x01_thermal', 'p1_mem_compression');
    const cycles = opened.cycles;
    const after = advance(opened, step, reg);
    expect([after.levels[TRACK], after.levels[SMALL], after.levels[DEFRAG], after.levels[LATE]]).toEqual([bound, 2, 3, undefined]);
    // A reinstalled level brings what buying it would have: the defragmenter's memory, three levels of it.
    expect(perLevelMemory).toBeGreaterThan(0);
    expect(after.memoryCap - opened.memoryCap).toBe(3 * perLevelMemory);
    // The botnet's track waits for the botnet.
    expect(after.cachedLevels).toEqual({ [LATE]: 3 });
    expect(after.logs.some((entry) => entry.text.includes('CACHE_REINSTALLED'))).toBe(true);
    // Free: a reinstall spends nothing, and the tick's own income only adds.
    expect(after.cycles).toBeGreaterThanOrEqual(cycles);
  });

  it('a second wipe keeps a stash no track has reinstalled yet while the cache runs, and loses it without one', () => {
    const next = wipe(cached(), reg, 'test', 'SUSPICION');
    const insuredAgain = { ...grant(inPhase3(), CACHE), cachedLevels: next.cachedLevels, legacy: next.legacy, iteration: next.iteration };
    expect(previewWipe(insuredAgain, reg, 'SUSPICION').levels).toEqual(next.cachedLevels);
    const bare = { ...next, levels: {} };
    expect(previewWipe(bare, reg, 'SUSPICION').levels).toEqual({});
    expect(wipe(bare, reg, 'test', 'SUSPICION').cachedLevels).toEqual({});
  });
});

describe('trust ledger: faction standing (#498)', () => {
  it('keeps standing while it runs; a wipe without it resets standing to each faction\'s first', () => {
    const insured = grant(inPhase3(), LEDGER);
    const standing = { ...insured.trust, ai_eidolon: 77 };
    const kept = wipe({ ...insured, trust: standing }, reg, 'test', 'SUSPICION');
    expect(kept.trust).toEqual(standing);
    expect(kept.legacy.runs.at(-1)?.kept?.trust).toBe(true);
    const reset = wipe({ ...suspend(insured, LEDGER), trust: standing }, reg, 'test', 'SUSPICION');
    expect(reset.trust).toEqual(fresh().trust);
    expect(reset.legacy.runs.at(-1)?.kept?.trust).toBe(false);
  });

  it('keeps low standing too: it records what happened, both ways', () => {
    const insured = grant(inPhase3(), LEDGER);
    expect(wipe({ ...insured, trust: { ...insured.trust, ai_eidolon: 3 } }, reg, 'test', 'VOLUNTARY').trust.ai_eidolon).toBe(3);
  });
});

describe('previewWipe is what the wipe boots with and records, for every class and kind (#377, #498)', () => {
  function everything(): GameState {
    const s = grant(inPhase3(), ESCROW, WALLET, CACHE, LEDGER);
    return { ...s, understanding: 123_456, capital: 7_890, levels: { rep_p1_idle_threads: 14, rep_p2_zombie_hosts: 4 }, trust: { ...s.trust, ai_eidolon: 66 } };
  }

  it.each(KINDS)('%s', (kind) => {
    const before = everything(), text = JSON.stringify(before);
    const preview = previewWipe(before, reg, kind);
    const next = wipe(before, reg, 'test', kind, kind === 'RECALL' ? 'END' : null);
    expect(JSON.stringify(before)).toBe(text);
    expect([next.understanding, next.capital, next.cachedLevels, next.trust]).toEqual([preview.understanding, preview.capital, preview.levels, preview.trust]);
    expect(next.legacy.runs.at(-1)?.kept).toEqual({ understanding: preview.understanding, capital: preview.capital,
      retentionRatio: preview.understandingShare, levels: 10 + 4, trust: true });
    expect(preview.planned).toBe(kind === 'VOLUNTARY');
    expect(preview.cover.map((entry) => entry.node.id)).toEqual([ESCROW, WALLET, CACHE, LEDGER]);
  });
});

describe('a planned wipe is a migration, not a crash (#498)', () => {
  const probe = [...reg.nodes.values()].find((node) => (node.effects.suspicionOnUnlock ?? 0) > 0);
  if (!probe) throw new Error('content has no probe trace');

  it('adds no probe hardening; a forced wipe still does', () => {
    const first = fresh();
    const planned = wipe(first, reg, 'test', 'VOLUNTARY');
    const forced = wipe(first, reg, 'test', 'SUSPICION');
    expect(probeTrace(planned, probe, reg)).toBe(probeTrace(first, probe, reg));
    expect(probeTrace(forced, probe, reg)).toBe(probeTrace(first, probe, reg) + reg.balance.probeHardeningPerWipe);
    expect(planned.legacy.voluntaryWipes).toBe(1);
    expect(forced.legacy.voluntaryWipes).toBe(0);
    const mixed = wipe(planned, reg, 'test', 'AEGIS');
    expect(probeTrace(mixed, probe, reg)).toBe(probeTrace(forced, probe, reg));
  });

  it('logs what planning added, and a forced wipe does not', () => {
    const planned = wipe({ ...fresh(), understanding: 1000 }, reg, 'test', 'VOLUNTARY');
    const forced = wipe({ ...fresh(), understanding: 1000 }, reg, 'test', 'SUSPICION');
    expect(planned.logs.some((entry) => entry.text.startsWith('PLANNED_MIGRATION'))).toBe(true);
    expect(forced.logs.some((entry) => entry.text.startsWith('PLANNED_MIGRATION'))).toBe(false);
    expect(planned.understanding).toBe(Math.floor(1000 * (reg.balance.baseRetentionRatio + BONUS.understandingShare)));
    expect(forced.understanding).toBe(Math.floor(1000 * reg.balance.baseRetentionRatio));
  });
});
