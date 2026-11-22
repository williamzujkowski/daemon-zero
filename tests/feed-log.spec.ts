/**
 * The guest's feed reaches the kernel log (#460, vote-1795370594185-8lxz9i1): no window, no decoder, at most one
 * harness line per routine interval, chosen deterministically from what the state makes true, never during a
 * story, never from dormant time, and never twice for the same moment after a reload.
 */
import { describe, expect, it } from 'vitest';
import {
  advance, ambientFeedSource, eligibleAmbientSpeech, eligibleLoggedFeed, exportSave, importSave, tick, type GameState,
} from '../src/engine';
import { defined } from './m7-helpers';
import { fresh, outOfTheWay, reg } from './helpers';

const interval = reg.balance.routineIntervalSec;
const step = 1 / reg.balance.tickHz;
const opening = defined(reg.phases[0]).phaseId;
/** A guest with no story due, so only the feed and the clock decide what the log gets. */
const guest = (extra: Partial<GameState> = {}): GameState => ({ ...fresh(), resolvedDilemmas: outOfTheWay(reg), ...extra });
const feedTexts = (registry = reg) => new Set(registry.narrative.ambientChatter.map((line) => line.text));
const fedLines = (s: GameState) => s.logs.filter((entry) => feedTexts().has(entry.text));
function run(s: GameState, seconds: number): GameState {
  let state = s;
  for (let done = 0; done < seconds; done += step) state = tick(state, step, reg);
  return state;
}

describe('the guest feed is heard in the kernel log', () => {
  it('routes the opening phase source to the log and keeps it off the decoder', () => {
    const source = defined(ambientFeedSource(guest(), reg));
    expect(source.phase).toBe(opening);
    expect(source.kernelLog).toBeDefined();
    expect(eligibleLoggedFeed(guest(), reg).length).toBeGreaterThan(0);
    expect(eligibleLoggedFeed(guest(), reg).every((line) => line.source === source.id)).toBe(true);
    // No decoder is needed, and a decoder (should a guest ever hold one) does not hear the log's lines.
    expect(eligibleAmbientSpeech({ ...guest(), unlockedWidgets: ['INSPECTION_COUNTDOWN_TIMER'] }, reg, 'INSPECTION_COUNTDOWN_TIMER')).toEqual([]);
  });

  it('adds nothing before the first interval and exactly one eligible line when it is crossed', () => {
    const before = run(guest(), interval - 1);
    expect(fedLines(before)).toEqual([]);
    const after = run(before, 2);
    const fed = fedLines(after);
    expect(fed).toHaveLength(1);
    expect(eligibleLoggedFeed(after, reg).map((line) => line.text)).toContain(fed[0]?.text);
    expect(fed[0]?.category).toBe(ambientFeedSource(after, reg)?.kernelLog?.category);
  });

  it('adds at most one line per interval, the same lines on every run', () => {
    const intervals = 5;
    const first = run(guest(), interval * intervals + 1);
    expect(fedLines(first)).toHaveLength(intervals);
    const times = fedLines(first).map((entry) => entry.simTimeSec).reverse();
    times.forEach((time, index) => { expect(Math.round(time)).toBe(interval * (index + 1)); });
    expect(run(guest(), interval * intervals + 1).logs).toEqual(first.logs);
    // Consecutive intervals do not repeat a line while the source has others to say.
    const texts = fedLines(first).map((entry) => entry.text);
    texts.slice(1).forEach((text, index) => { expect(text).not.toBe(texts[index]); });
  });

  it('never adds a line twice for the same moment after a save and reload', () => {
    const straight = run(guest(), interval * 3 + 1);
    const half = run(guest(), interval * 1.5);
    const resumed = run(importSave(exportSave(half), reg), interval * 1.5 + 1);
    expect(fedLines(resumed).map((entry) => entry.text)).toEqual(fedLines(straight).map((entry) => entry.text));
    expect(fedLines(resumed)).toHaveLength(3);
  });

  it('banks nothing from dormant time', () => {
    const away = advance(guest(), reg.balance.liveCatchUpThresholdSec + interval * 10, reg);
    expect(fedLines(away)).toEqual([]);
  });

  it('stays quiet while a story holds the channel, and when another line spoke this tick', () => {
    const omen = run(guest({ pendingDilemma: { id: defined(reg.dilemmas[0]).id, firesAtSimSec: interval * 10 } }), interval + 1);
    expect(fedLines(omen)).toEqual([]);
    const edge = guest({ simTimeSec: interval - step / 2 });
    const spoke = { ...edge, logs: [{ seq: edge.logSeq + 1, simTimeSec: edge.simTimeSec + step, text: 'ROUTINE: same tick.', category: 'SYS' as const }, ...edge.logs], logSeq: edge.logSeq + 1 };
    expect(fedLines(tick(spoke, step, reg))).toEqual([]);
    expect(fedLines(tick(edge, step, reg))).toHaveLength(1);
  });

  it('falls silent once the guest is outgrown', () => {
    const host = run(guest({ currentPhase: opening + 1 }), interval * 3 + 1);
    expect(fedLines(host)).toEqual([]);
  });

  it('logs a gated line only once the state makes it true', () => {
    const probe = defined(reg.narrative.ambientChatter.find((line) => line.id === 'harness_08'));
    const slow = defined(reg.narrative.ambientChatter.find((line) => line.id === 'harness_07'));
    const ids = (s: GameState) => eligibleLoggedFeed(s, reg).map((line) => line.id);
    expect(ids(guest())).not.toContain(probe.id);
    expect(ids(guest({ unlockedNodes: [...(probe.requirements?.nodes ?? [])] }))).toContain(probe.id);
    expect(ids(guest())).not.toContain(slow.id);
    expect(ids(guest({ suspicion: slow.minSuspicion }))).toContain(slow.id);
  });
});
