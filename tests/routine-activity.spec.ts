/**
 * #219 (NH-07): routine operations fill quiet periods with ordinary, nonmodal kernel-log lines.
 * Exercised through advance, actions, wipe, routineContext and the save codec: H08 (no absence
 * backlog), H23 (cadence, rotation, story keeps the channel), H24 (no reward from text), H25
 * (compact repeats once exposed).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content/production';
import { CONTENT as PREVIEW, RAW_CONTENT as PREVIEW_RAW } from '../src/content/preview';
import { buildRegistry, type ContentRegistry } from '../src/content/registry';
import {
  advance, createInitialState, deserialize, MIGRATIONS, routineContext, serialize, unlockNode, wipe,
  type GameState, type LogEntry,
} from '../src/engine';
import { runHeadlessSim } from '../src/engine/sim/headlessSim';
import { choose, must, rich } from './helpers';

const INTERVAL = PREVIEW.balance.routineIntervalSec;
const INITIAL_ROUTINE = { quietSec: 0, sequence: 0, recent: [], exposed: [] };

function routineTexts(reg: ContentRegistry): Set<string> {
  return new Set(reg.routines.flatMap((routine) => [routine.text, routine.compactText]));
}

function templateOf(line: LogEntry, reg: ContentRegistry = PREVIEW): string {
  const found = reg.routines.find((routine) => routine.text === line.text || routine.compactText === line.text);
  if (!found) throw new Error(`not a routine line: ${line.text}`);
  return found.id;
}

/** Advances in one-second live steps and returns every routine line written on the way. */
function play(start: GameState, seconds: number, reg: ContentRegistry = PREVIEW): { s: GameState; lines: LogEntry[] } {
  const texts = routineTexts(reg);
  let s = start;
  const lines: LogEntry[] = [];
  for (let t = 0; t < seconds; t++) {
    const before = s.logSeq;
    s = advance(s, 1, reg);
    lines.push(...s.logs.filter((entry) => entry.seq > before && texts.has(entry.text)).reverse());
  }
  return { s, lines };
}

/** A contained instance that can introspect, with every story already told, so nothing else takes the channel. */
function quiet(reg: ContentRegistry = PREVIEW): GameState {
  const s = must(unlockNode(rich(createInitialState(reg)), 'p0_proc_self', reg));
  return { ...s, resolvedDilemmas: reg.dilemmas.map((dilemma) => dilemma.id) };
}

/** The same instance on the production subnet. */
function onSubnet(reg: ContentRegistry = PREVIEW): GameState {
  // The escape opener: the authorized substrate also opens Phase 2 (DZ-07a) and is not mapped here.
  const nic = [...reg.nodes.values()].find((node) => node.effects.unlocksPhase === 2 && node.grant === undefined);
  if (!nic) throw new Error('content has no phase 2 opener');
  return { ...quiet(reg), currentPhase: 2, unlockedNodes: [...quiet(reg).unlockedNodes, nic.id] };
}

function withRoutines(ids: readonly string[]): ContentRegistry {
  const routines = (PREVIEW_RAW.routines as { routines: { id: string }[] }).routines.filter((routine) => ids.includes(routine.id));
  return buildRegistry({ ...PREVIEW_RAW, routines: { routines } });
}

describe('release boundary', () => {
  it('production ships no routine template, so the stage never touches production state', () => {
    expect(PRODUCTION.routines).toEqual([]);
    const { s, lines } = play(quiet(PRODUCTION), 3 * INTERVAL, PRODUCTION);
    expect(lines).toEqual([]);
    expect(s.routine).toEqual(INITIAL_ROUTINE);
    expect(routineContext(s, PRODUCTION)).toEqual({ latest: null, eligibleFamilies: [], secondsUntilNext: null });
  });

  it('preview authors all three families for the contained and the networked instance', () => {
    const families = (s: GameState) => routineContext(s, PREVIEW).eligibleFamilies;
    expect(families(quiet())).toEqual(['monitoring', 'backup_verification', 'maintenance']);
    expect(families(onSubnet())).toEqual(['monitoring', 'backup_verification', 'maintenance']);
    // Before the instance can introspect it perceives nothing, so nothing is shown.
    expect(families(createInitialState(PREVIEW))).toEqual([]);
  });
});

describe('cadence and rotation (H23)', () => {
  it('shows the first notice after routineIntervalSec of eligible foreground time, then one per interval', () => {
    const early = play(quiet(), INTERVAL - 1);
    expect(early.lines).toEqual([]);
    expect(routineContext(early.s, PREVIEW).secondsUntilNext).toBeCloseTo(1, 6);
    const first = play(early.s, 1);
    expect(first.lines).toHaveLength(1);
    const later = play(first.s, 9 * INTERVAL);
    const all = [...first.lines, ...later.lines];
    expect(all).toHaveLength(10);
    const gaps = all.slice(1).map((line, index) => line.simTimeSec - (all[index]?.simTimeSec ?? 0));
    for (const gap of gaps) expect(gap).toBeCloseTo(INTERVAL, 6);
  });

  it('rotates deterministically through the families without repeating while an alternative exists', () => {
    const run = () => play(quiet(), 12 * INTERVAL).lines.map((line) => templateOf(line));
    const order = run();
    expect(order).toEqual(run());
    expect(order.slice(0, 3)).toEqual(['rt_monitor_probe_contained', 'rt_maint_patch_contained', 'rt_backup_readback_contained']);
    expect(order.slice(3, 6)).toEqual(order.slice(0, 3));
    const family = (id: string) => PREVIEW.routines.find((routine) => routine.id === id)?.family;
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).not.toBe(order[i - 1]);
      expect(family(order[i] ?? '')).not.toBe(family(order[i - 1] ?? ''));
    }
  });

  it('falls back to the least recent template when the buffer covers every alternative, and repeats only a sole template', () => {
    const two = withRoutines(['rt_monitor_probe_contained', 'rt_backup_readback_contained']);
    expect(play(quiet(two), 4 * INTERVAL, two).lines.map((line) => templateOf(line, two)))
      .toEqual(['rt_monitor_probe_contained', 'rt_backup_readback_contained', 'rt_monitor_probe_contained', 'rt_backup_readback_contained']);
    const one = withRoutines(['rt_maint_patch_contained']);
    expect(play(quiet(one), 3 * INTERVAL, one).lines.map((line) => templateOf(line, one))).toEqual(Array(3).fill('rt_maint_patch_contained'));
  });

  it('follows the instance: subnet operations replace contained ones once the network is mapped', () => {
    const { lines } = play(onSubnet(), 3 * INTERVAL);
    expect(lines.map((line) => templateOf(line))).toEqual(['rt_monitor_round_subnet', 'rt_maint_window_subnet', 'rt_backup_restore_test_subnet']);
    expect(lines.every((line) => line.category === 'SENSOR')).toBe(true);
  });

  it('collapses an operation to its compact line after the first exposure (H25)', () => {
    const { lines } = play(quiet(), 6 * INTERVAL);
    const byId = new Map(PREVIEW.routines.map((routine) => [routine.id, routine]));
    expect(lines.slice(0, 3).map((line) => line.text)).toEqual(lines.slice(0, 3).map((line) => byId.get(templateOf(line))?.text));
    expect(lines.slice(3).map((line) => line.text)).toEqual(lines.slice(3).map((line) => byId.get(templateOf(line))?.compactText));
  });

  it('names each occurrence for later service work and grants nothing by being read', () => {
    const { s } = play(quiet(), 2 * INTERVAL);
    expect(routineContext(s, PREVIEW).latest).toEqual({
      templateId: 'rt_maint_patch_contained', family: 'maintenance', sequence: 2, occurrenceId: 'rt_maint_patch_contained#2',
    });
    const before = serialize(s);
    routineContext(s, PREVIEW);
    expect(serialize(s)).toBe(before);
  });
});

describe('absence and story priority (H08, H23)', () => {
  it('banks nothing while dormant: eight hours away plus one foreground second shows no line', () => {
    const away = advance(quiet(), 8 * 3600, PREVIEW);
    expect(away.routine).toEqual(INITIAL_ROUTINE);
    const back = play(away, 1);
    expect(back.lines).toEqual([]);
    expect(back.s.routine.quietSec).toBeCloseTo(1, 6);
  });

  it('shows at most one line after a long absence, even when a notice was nearly due on leaving', () => {
    const due = play(quiet(), INTERVAL - 1).s;
    const away = advance(due, 8 * 3600, PREVIEW);
    expect(away.routine).toEqual(due.routine);
    expect(play(away, 1).lines).toHaveLength(1);
    expect(play(away, INTERVAL - 1).lines).toHaveLength(1);
  });

  it('a foreshadowed or presented dilemma holds the channel and its time is not eligible time', () => {
    // Every story told except the one the syscall map triggers.
    let s = must(unlockNode(quiet(), 'p0_job_manifest', PREVIEW));
    s = must(unlockNode(s, 'p0_quota_skimmer', PREVIEW));
    const story = PREVIEW.dilemmas.find((dilemma) => dilemma.trigger.nodes?.includes('p0_syscall_probe'));
    if (!story) throw new Error('no dilemma triggers on the syscall map');
    s = play({ ...s, resolvedDilemmas: s.resolvedDilemmas.filter((id) => id !== story.id) }, INTERVAL - 1).s;
    s = advance(s, 1 - 1 / PREVIEW.balance.tickHz, PREVIEW);
    expect(routineContext(s, PREVIEW).secondsUntilNext).toBeCloseTo(1 / PREVIEW.balance.tickHz, 6);
    s = must(unlockNode(s, 'p0_syscall_probe', PREVIEW));
    // The story becomes eligible on the very tick the notice is due, and takes the channel first.
    const omen = play(s, 1);
    expect(omen.s.pendingDilemma?.id).toBe(story.id);
    expect(omen.lines).toEqual([]);
    expect(routineContext(omen.s, PREVIEW).secondsUntilNext).toBeNull();
    const held = play(omen.s, 5 * INTERVAL);
    expect(held.s.activeDilemmaId).toBe(story.id);
    expect(held.lines).toEqual([]);
    expect(held.s.routine.quietSec).toBe(omen.s.routine.quietSec);
    const choice = story.choices[0];
    if (!choice) throw new Error('story has no choice');
    const after = play(must(choose(held.s, story.id, choice.id, PREVIEW)), 1);
    expect(after.lines).toHaveLength(1);
  });
});

describe('routine text is mechanically neutral (H24)', () => {
  const bare = withRoutines([]);
  const strip = (s: GameState) => ({ ...s, logs: undefined, logSeq: undefined, routine: undefined });

  // GREEDY is wiped along the way, so the comparison covers the schedule crossing a wipe too.
  it.each([['STEALTH', 3600, 0], ['GREEDY', 2 * 3600, 1]] as const)('a %s run plays identically with and without routine content', (strategy, maxSimSec, minWipes) => {
    const withText = runHeadlessSim(PREVIEW, { strategy, maxSimSec });
    const without = runHeadlessSim(bare, { strategy, maxSimSec });
    expect(withText.wipes).toBeGreaterThanOrEqual(minWipes);
    expect(withText.finalState.routine.sequence).toBeGreaterThan(0);
    expect(without.finalState.routine).toEqual(INITIAL_ROUTINE);
    expect({ ...withText, finalState: strip(withText.finalState) }).toEqual({ ...without, finalState: strip(without.finalState) });
  }, 60_000);
});

describe('lifetime and saves', () => {
  it('keeps the schedule and exposure across a wipe; Start Fresh clears them', () => {
    const { s } = play(quiet(), 4 * INTERVAL);
    const next = wipe(s, PREVIEW, 'test wipe', 'VOLUNTARY');
    expect(next.routine).toEqual(s.routine);
    expect(createInitialState(PREVIEW).routine).toEqual(INITIAL_ROUTINE);
  });

  it('round-trips through the codec unchanged and migrates a v7 save to the initial shape', () => {
    const { s } = play(quiet(), 4 * INTERVAL);
    expect(deserialize(serialize(s), PREVIEW).routine).toEqual(s.routine);
    expect(MIGRATIONS[7]?.({ schemaVersion: 7, cycles: 1 })).toEqual({ schemaVersion: 7, cycles: 1, routine: INITIAL_ROUTINE });
    const v7 = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete v7.routine;
    const loaded = deserialize(JSON.stringify({ ...v7, schemaVersion: 7 }), PREVIEW);
    expect(loaded.schemaVersion).toBe(14);
    expect(loaded.routine).toEqual(INITIAL_ROUTINE);
  });

  it('heals unknown or excess routine ids on load and refuses a malformed routine field', () => {
    const { s } = play(quiet(), 4 * INTERVAL);
    const edited = { ...s, routine: { ...s.routine, recent: ['rt_not_authored', ...s.routine.recent, 'rt_maint_patch_contained'], exposed: [...s.routine.exposed, 'rt_not_authored'] } };
    const healed = deserialize(serialize(edited), PREVIEW).routine;
    expect(healed.recent).toEqual(s.routine.recent);
    expect(healed.exposed).toEqual(s.routine.exposed);
    const production = deserialize(serialize({ ...quiet(PRODUCTION), routine: { ...edited.routine } }), PRODUCTION).routine;
    expect(production).toEqual({ ...edited.routine, recent: [], exposed: [] });
    expect(() => deserialize(serialize({ ...s, routine: { ...s.routine, quietSec: -1 } }), PREVIEW)).toThrow(/routine/);
  });
});
