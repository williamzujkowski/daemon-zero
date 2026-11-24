/**
 * A quieter kernel log (#541): repeated mechanical lines merge, a wild mind's request and its outcome read as one line,
 * nothing a merged line held is lost, and story lines hold the one-line preview over mechanical ones.
 */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import {
  buyRepeatable, computeRates, dismissRepeatable, importSave, isMechanicalLog, logLineText, previewLog, resolveWildEncounter,
  type GameState, type LogEntry,
} from '../src/engine';
import { evaluateShardMutationsAndEncounters } from '../src/engine/systems/evaluateSwarmAndEpistemic';
import { fmt, pushLog } from '../src/engine/util';
import { defined } from './m7-helpers';
import { grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';

const fixtures = makeFixtures();
const operative = defined([...reg.repeatables.values()].find((rep) => rep.kind === 'OPERATIVE' && rep.dismissable && rep.maxLevel >= 4));
const lex = defined(reg.swarm.wildShardEncounters.find((entry) => entry.tier === 2));
const { tally, answered } = reg.narrative.kernelLog;

function corporate(): GameState {
  return rich(importSave(defined(fixtures['victory-ready']), reg));
}

function hire(s: GameState, times: number): GameState {
  let next = s;
  for (let i = 0; i < times; i++) next = must(buyRepeatable(next, operative.id, reg));
  return next;
}

/** A Phase 2 state whose next wild arrival is due now. */
function arrivalDue(): GameState {
  return { ...withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1)), currentPhase: 2, simTimeSec: 1000, nextEncounterAtSec: 1000 };
}

function arrive(s: GameState): GameState {
  const d = structuredClone(s);
  evaluateShardMutationsAndEncounters(d, { dt: .1, dormant: false, reg, rates: computeRates(s, reg) });
  return d;
}

/** Arrivals consumed as they come, at their due times, until the first Phase 2 mind has been consumed once more. */
function consumeOnce(s: GameState): GameState {
  let next = s;
  for (let i = 0; i < reg.swarm.wildShardEncounters.length; i++) {
    next = arrive({ ...next, simTimeSec: next.nextEncounterAtSec });
    const id = next.pendingWildEncounterId;
    next = must(resolveWildEncounter(next, 'CONSUME', reg));
    if (id === lex.id) return next;
  }
  throw new Error('the first Phase 2 mind never arrived');
}

const linesWith = (s: GameState, text: string): LogEntry[] => s.logs.filter((entry) => entry.text.includes(text));
const hiredText = (count: number): string => fmt(reg.narrative.operativeHired, { name: operative.name, count });

describe('repeated hires merge into one counted line', () => {
  it('folds three hires of one role into one line that carries the newest count and how many hires it holds', () => {
    const before = corporate();
    const level = before.levels[operative.id] ?? 0;
    const after = hire(before, 3);
    const lines = linesWith(after, operative.name);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ text: hiredText(level + 3), times: 3, category: 'CORP' });
    expect(logLineText(defined(lines[0]), reg)).toBe(fmt(tally, { line: hiredText(level + 3), times: 3 }));
    // Still the newest entry, at this second: a merge writes what a fresh push would.
    expect(after.logs[0]?.seq).toBe(after.logSeq);
    expect(after.logs[0]?.simTimeSec).toBe(after.simTimeSec);
    expect(after.logSeq).toBe(before.logSeq + 3);
  });

  it('keeps a hire and a dismissal of one role apart, each counted, so neither fact is lost', () => {
    const after = must(dismissRepeatable(must(dismissRepeatable(hire(corporate(), 4), operative.id, reg)), operative.id, reg));
    const lines = linesWith(after, operative.name);
    expect(lines.map((entry) => entry.times)).toEqual([2, 4]);
    expect(lines[0]?.text).toBe(fmt(reg.narrative.operativeDismissed, { name: operative.name, count: (after.levels[operative.id] ?? 0) }));
  });

  it('never folds a line whose words differ, only one whose figures do', () => {
    const d = structuredClone(corporate());
    pushLog(d, reg, 'TALLY: alpha (active: 1).', 'CORP', { key: 'k', tally: true });
    pushLog(d, reg, 'TALLY: beta (active: 2).', 'CORP', { key: 'k', tally: true });
    pushLog(d, reg, 'TALLY: alpha (active: 3).', 'CORP', { key: 'k', tally: true });
    expect(d.logs.slice(0, 2).map((entry) => [entry.text, entry.times])).toEqual([['TALLY: alpha (active: 3).', 2], ['TALLY: beta (active: 2).', undefined]]);
  });

  it('never folds lines without a key, or with another key or category', () => {
    const d = structuredClone(corporate());
    pushLog(d, reg, 'SAME (1).', 'CORP');
    pushLog(d, reg, 'SAME (2).', 'CORP', { key: 'a', tally: true });
    pushLog(d, reg, 'SAME (3).', 'CORP', { key: 'b', tally: true });
    pushLog(d, reg, 'SAME (4).', 'SYS', { key: 'b', tally: true });
    pushLog(d, reg, 'SAME (5).', 'CORP');
    expect(d.logs.slice(0, 5).every((entry) => entry.times === undefined)).toBe(true);
  });
});

describe('a wild mind asking for a host and the outcome read as one line', () => {
  it('joins the request to its outcome, in the request\'s place at the top', () => {
    const offered = arrive(arrivalDue());
    const id = defined(offered.pendingWildEncounterId);
    const mind = defined(reg.swarm.wildShardEncounters.find((entry) => entry.id === id));
    expect(offered.logs[0]).toMatchObject({ text: mind.description, category: 'LORE' });
    const consumed = must(resolveWildEncounter(offered, 'CONSUME', reg));
    const joined = fmt(answered, { line: mind.description, answer: mind.consume.logText });
    expect(consumed.logs[0]).toMatchObject({ text: joined, category: 'LORE' });
    expect(consumed.logs.filter((entry) => entry.text === mind.description || entry.text === mind.consume.logText)).toEqual([]);
    expect(consumed.logs).toHaveLength(offered.logs.length);
  });

  it('joins a harnessed request the same way', () => {
    const offered = arrive(arrivalDue());
    const mind = defined(reg.swarm.wildShardEncounters.find((entry) => entry.id === offered.pendingWildEncounterId));
    const harnessed = must(resolveWildEncounter(offered, 'HARNESS', reg));
    expect(harnessed.logs[0]?.text).toBe(fmt(answered, { line: mind.description, answer: mind.onHarnessLog }));
  });

  it('counts the same request and outcome on one line when it comes again', () => {
    const twice = consumeOnce(consumeOnce(arrivalDue()));
    const joined = fmt(answered, { line: lex.description, answer: lex.consume.logText });
    const lines = twice.logs.filter((entry) => entry.text === joined);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.times).toBe(2);
  });

  it('logs an outcome alone when its request is no longer in the log', () => {
    const d = structuredClone(arrivalDue());
    pushLog(d, reg, lex.consume.logText, 'LORE', { key: 'encounter:' + lex.id, tally: true, answers: lex.description });
    expect(d.logs[0]).toMatchObject({ text: lex.consume.logText });
    expect(d.logs[0]?.times).toBeUndefined();
  });
});

describe('story lines hold the preview over mechanical lines', () => {
  it('keeps a story line in the preview while hires follow it, and shows every line in the history', () => {
    const d = structuredClone(corporate());
    pushLog(d, reg, 'A story line the player should read.', 'LORE');
    const after = hire(d, 2);
    expect(after.logs[0]?.text).toContain(operative.name);
    expect(previewLog(after, reg)?.text).toBe('A story line the player should read.');
    expect(isMechanicalLog(defined(after.logs[0]), reg)).toBe(true);
  });

  it('lets a later story line, or any unmerged line, take the preview', () => {
    const d = structuredClone(hire(corporate(), 1));
    pushLog(d, reg, 'SITE_FOUND: an ordinary purchase line.', 'CORP');
    expect(previewLog(d, reg)?.text).toBe('SITE_FOUND: an ordinary purchase line.');
  });

  it('shows a mind\'s first request in the preview, and not its repeats', () => {
    const once = consumeOnce(arrivalDue());
    const joined = fmt(answered, { line: lex.description, answer: lex.consume.logText });
    expect(previewLog(once, reg)?.text).toBe(joined);
    const d = structuredClone(once);
    pushLog(d, reg, 'An older story line.', 'WARN');
    const twice = consumeOnce(d);
    expect(twice.logs[0]?.times).toBe(2);
    expect(previewLog(twice, reg)?.text).not.toBe(joined);
  });

  it('keeps the story line while a repeated request is still pending, and the request stays in the history (panel on #551)', () => {
    // Only the first Phase 2 mind arrives, so every arrival after the first is a repeat of it.
    const only = { ...reg, swarm: { ...reg.swarm, wildShardEncounters: [lex] } };
    const arriveOnly = (s: GameState): GameState => {
      const d = structuredClone({ ...s, simTimeSec: s.nextEncounterAtSec });
      evaluateShardMutationsAndEncounters(d, { dt: .1, dormant: false, reg: only, rates: computeRates(s, only) });
      return d;
    };
    const first = arriveOnly(arrivalDue());
    expect(first.pendingWildEncounterId).toBe(lex.id);
    // The first time a mind asks, the request is story and takes the preview.
    expect(previewLog(first, only)?.text).toBe(lex.description);
    const d = structuredClone(must(resolveWildEncounter(first, 'CONSUME', only)));
    pushLog(d, only, 'A warning the player should read.', 'WARN');
    const again = arriveOnly(d);
    expect(again.pendingWildEncounterId).toBe(lex.id);
    expect(again.logs[0]?.text).toBe(lex.description);
    expect(isMechanicalLog(defined(again.logs[0]), only, again.logs.slice(1))).toBe(true);
    expect(previewLog(again, only)?.text).toBe('A warning the player should read.');
  });

  it('falls back to the newest line when every line is mechanical', () => {
    const d = structuredClone(corporate());
    d.logs = [];
    pushLog(d, reg, 'PAYROLL (1).', 'CORP', { key: 'k', tally: true });
    expect(previewLog(d, reg)?.text).toBe('PAYROLL (1).');
    expect(previewLog({ ...d, logs: [] }, reg)).toBeUndefined();
  });

  it('reads story from the content\'s categories, not from the engine', () => {
    const entry: LogEntry = { seq: 1, simTimeSec: 0, text: 'x', category: 'CORP', merge: 'k' };
    expect(isMechanicalLog(entry, reg)).toBe(!reg.narrative.kernelLog.storyCategories.includes('CORP'));
    const story = { ...reg, narrative: { ...reg.narrative, kernelLog: { ...reg.narrative.kernelLog, storyCategories: ['CORP' as const] } } };
    expect(isMechanicalLog(entry, story)).toBe(false);
    expect(isMechanicalLog({ ...entry, times: 2 }, story)).toBe(true);
  });
});
