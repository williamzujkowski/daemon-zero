/** The reading report's arithmetic (#540) on small hand-made runs, so each figure is checked against a hand count. */
import { describe, expect, it } from 'vitest';
import {
  dilemmaGaps, floorModel, highModel, logBursts, overFullWindows, phaseAt, queueModel, READING_WPM, readingRows, slidingWindows, wordsByPhase,
} from '../src/engine/sim/readingAnalysis';
import type { ReadingRecord } from '../src/engine/sim/readingObserver';
import { countWords, isProse, proseStrings, textShape, type TextEvent } from '../src/engine/sim/readingRecorder';

function text(t: number, words: number, extra: Partial<TextEvent> = {}): TextEvent {
  return { t, phase: 0, iteration: 1, source: 'log', group: 'A', key: 'k', words, ...extra };
}

function run(events: TextEvent[], extra: Partial<ReadingRecord> = {}): ReadingRecord {
  return {
    phaseReachedAtSec: { 0: 0 }, phaseSec: { 0: 600 }, decisions: [], dilemmas: [], events, seconds: 600, snapshots: 1, simSeconds: 600, ending: null,
    ...extra,
  };
}

describe('text measures', () => {
  it('counts words with a letter or digit, and tells prose from labels', () => {
    expect(countWords('  The  > job | ran 3 times.  ')).toBe(5);
    expect(countWords('')).toBe(0);
    expect(isProse('Four words of prose.')).toBe(true);
    expect(isProse('Three short words')).toBe(false);
    expect(isProse('ALL CAPS IS A LABEL')).toBe(false);
  });

  it('reads a number-changing sentence as one shape, and finds prose inside a view', () => {
    expect(textShape('Lock at 41.5% after 1,200 s')).toBe(textShape('Lock at 7% after 3 s'));
    expect(proseStrings({ a: 'a long enough sentence here', b: ['tiny', { c: 'another long sentence to read' }], d: 3, e: null }))
      .toEqual(['a long enough sentence here', 'another long sentence to read']);
  });
});

describe('words, rates and density', () => {
  it('sorts words into groups, repeats and dilemma modals by phase', () => {
    const words = wordsByPhase([
      text(1, 10), text(2, 5, { group: 'B', source: 'node' }), text(3, 7, { group: 'C', source: 'panel' }), text(4, 10, { repeat: true }),
      text(5, 40, { source: 'dilemma', phase: 1 }),
    ]);
    expect(words[0]).toMatchObject({ A: 10, B: 5, C: 7, repeat: 10, dilemma: 0, dilemmas: 0, sources: { log: 10, node: 5, panel: 7 } });
    expect(words[1]).toMatchObject({ A: 0, dilemma: 40, dilemmas: 1 });
  });

  it('reports forced reading and optional text apart, and density from forced words only', () => {
    const [row] = readingRows(run([text(1, 238), text(2, 238, { group: 'B', source: 'node' }), text(3, 2380, { group: 'C', source: 'panel' })]));
    expect(row?.forcedMin.central).toBeCloseTo(2, 9);
    expect(row?.forcedMin.fast).toBeCloseTo(476 / READING_WPM.fast, 9);
    expect(row?.forcedMin.slow).toBeCloseTo(476 / READING_WPM.slow, 9);
    expect(row?.optionalMin).toBeCloseTo(10, 9);
    expect(row?.densityWpm).toBeCloseTo(476 / 10, 9);
    expect(row?.botMin).toBe(10);
  });
});

describe('over-full windows and bursts', () => {
  it('slides a window over pushed arrivals, ignoring optional text, modals and the first frame', () => {
    const events = [text(0, 500), text(10, 100), text(20, 100, { group: 'C' }), text(30, 100, { source: 'dilemma' }), text(40, 100), text(75, 100)];
    expect(slidingWindows(events, 60).map((w) => [w.t, w.words])).toEqual([[10, 100], [40, 200], [75, 200]]);
    expect(slidingWindows(events, 30).map((w) => w.words)).toEqual([100, 100, 100]);
  });

  it('counts arrivals whose window holds more than a central reader reads in it, by phase', () => {
    const events = [text(10, 30), text(12, 20), text(100, 30), text(130, 30, { phase: 1 })];
    // 10 s holds 39.7 words at 238 wpm: only the arrival at 12 s (50 words) overflows.
    const r = run(events, { phaseReachedAtSec: { 0: 0, 1: 120 } });
    expect(overFullWindows(r, 10)).toEqual({ 0: 1 });
    expect(overFullWindows(r, 60, 10)).toEqual({ 0: 3, 1: 1 });
  });

  it('groups three or more log lines within five seconds of the first, greedily', () => {
    const logs = [0, 1, 4, 5.5, 20, 21, 30, 31, 32, 33].map((t) => text(t, 1));
    expect(logBursts([...logs, text(2, 1, { source: 'feed' })])).toEqual([[0, 3], [30, 4]]);
    expect(logBursts(logs, 5, 2)).toEqual([[0, 3], [20, 2], [30, 4]]);
  });
});

describe('the three human models', () => {
  // 500 forced words at 250 wpm take 120 s; the phase lasts 60 s; one dilemma of 50 words.
  const r = run([text(10, 500), text(20, 50, { source: 'dilemma' }), text(30, 100, { group: 'C' }), text(40, 25, { repeat: true })], {
    phaseSec: { 0: 60 }, simSeconds: 60, decisions: [{ t: 15, phase: 0 }], dilemmas: [{ t: 20, phase: 0, id: 'd', words: 50 }],
  });

  it('floor: pays only the reading that does not fit the phase, plus the dilemma read and a low deliberation', () => {
    expect(floorModel(r)[0]).toBeCloseTo((120 - 60) + 12 + 15, 9);
  });

  it('low: a decision waits for the queue, a dilemma pauses for its words and a low deliberation', () => {
    // Text at 10 s is read until 130 s; the decision at 15 s waits 115 s; the dilemma at 20 s (wall 135) costs 12 + 15.
    expect(queueModel(r, READING_WPM.fast, 15)[0]).toBeCloseTo(115 + 27, 9);
    // Without the barrier decision only the dilemma and the backlog left at the end add time.
    const noDecision = { ...r, decisions: [] };
    const backlog = 10 + 120 + 27 - (60 + 27);
    expect(queueModel(noDecision, READING_WPM.fast, 15)[0]).toBeCloseTo(27 + backlog, 9);
  });

  it('high: every word, optional and repeated included, at the slow rate, and a high deliberation', () => {
    expect(highModel(wordsByPhase(r.events))[0]).toBeCloseTo(((500 + 100 + 25 + 50) / READING_WPM.slow) * 60 + 60, 9);
  });

  it('orders the models floor <= low <= high on the same run', () => {
    const [row] = readingRows(r);
    expect(row && row.human.floor <= row.human.low && row.human.low <= row.human.high).toBe(true);
  });
});

describe('the dilemma timeline', () => {
  it('measures the longest wait for a dilemma ending in each phase, across phase boundaries, and the shortest gap', () => {
    const r = run([], {
      phaseReachedAtSec: { 0: 0, 1: 100, 2: 400 }, simSeconds: 600,
      dilemmas: [{ t: 50, phase: 0, id: 'a', words: 1 }, { t: 350, phase: 1, id: 'b', words: 1 }, { t: 360, phase: 1, id: 'c', words: 1 }],
    });
    const gaps = dilemmaGaps(r);
    expect(gaps.byPhase[0]).toEqual({ at: [50], longestQuietSec: 50 });
    expect(gaps.byPhase[1]).toEqual({ at: [350, 360], longestQuietSec: 300 });
    expect(gaps.byPhase[2]).toEqual({ at: [], longestQuietSec: 240 });
    expect(gaps.shortestSec).toBe(10);
    expect(dilemmaGaps(run([])).shortestSec).toBeNull();
  });

  it('places a second in the phase reached most recently before it', () => {
    const reached = { 0: 0, 1: 100, 2: 400 };
    expect([0, 99.9, 100, 399, 400, 1e6].map((t) => phaseAt(reached, t))).toEqual([0, 0, 1, 1, 2, 2]);
  });
});
