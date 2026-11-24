/**
 * The arithmetic of the reading report (#540): words per phase and group, reading minutes, density, over-full windows,
 * log bursts, dilemma gaps and three modelled human times, from one observed run. Modelled, not timed: no human was
 * clocked, and every rate and allowance below is a stated assumption.
 */
import type { ReadingRecord } from './readingObserver';
import type { TextEvent, TextSource } from './readingRecorder';

/**
 * Silent reading rates in words per minute: 238 is Brysbaert's mean for English non-fiction, 200 and 250 bound the
 * range used here (M. Brysbaert, "How many words do we read per minute? A review and meta-analysis of reading rate",
 * Journal of Memory and Language 109, 2019, 104047).
 */
export const READING_WPM = { central: 238, fast: 250, slow: 200 } as const;
/** Seconds a player is assumed to weigh a dilemma's choices (the clock is paused): low and high models. */
export const DELIBERATION_SEC = { low: 15, high: 60 } as const;
/** Window widths, in simulated seconds, over which pushed text is checked against a central reader. */
export const WINDOW_WIDTHS_SEC = [60, 30, 10] as const;
/** A log burst: this many new lines or more within this many seconds (the desktop dock previews one line; since #541, the newest story line). */
export const BURST = { spanSec: 5, minLines: 3 } as const;

export interface PhaseWords {
  /** Distinct words per reading group, outside dilemma modals. */
  A: number;
  B: number;
  C: number;
  /** Log lines seen again, which still arrive and take reading. */
  repeat: number;
  /** Dilemma modal words and how many dilemmas opened. */
  dilemma: number;
  dilemmas: number;
  /** Distinct words by surface. */
  sources: Partial<Record<TextSource, number>>;
}

type ByPhase<T> = Record<number, T>;
const emptyWords = (): PhaseWords => ({ A: 0, B: 0, C: 0, repeat: 0, dilemma: 0, dilemmas: 0, sources: {} });
const minutesOf = (words: number, wpm: number): number => words / wpm;

/** The phase a simulated second falls in, from the first second each phase was reached. */
export function phaseAt(phaseReachedAtSec: Record<number, number>, t: number): number {
  const reached = Object.entries(phaseReachedAtSec).map(([phase, at]) => [at, Number(phase)] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let phase = reached[0]?.[1] ?? 0;
  for (const [at, p] of reached) if (t >= at) phase = p;
  return phase;
}

export function wordsByPhase(events: readonly TextEvent[]): ByPhase<PhaseWords> {
  const out: ByPhase<PhaseWords> = {};
  for (const e of events) {
    const w = out[e.phase] ??= emptyWords();
    if (e.source === 'dilemma') { w.dilemma += e.words; w.dilemmas += 1; }
    else if (e.repeat) w.repeat += e.words;
    else { w[e.group] += e.words; w.sources[e.source] = (w.sources[e.source] ?? 0) + e.words; }
  }
  return out;
}

/** Forced reading: groups A and B, each text once, outside the paused dilemma modal. */
export const forced = (e: TextEvent): boolean => e.group !== 'C' && e.repeat !== true && e.source !== 'dilemma';

type Item = { t: number; kind: 0; words: number } | { t: number; kind: 1 } | { t: number; kind: 2; words: number };

function timeline(run: ReadingRecord, include: (e: TextEvent) => boolean): Item[] {
  const items: Item[] = [
    ...run.events.filter(include).map((e) => ({ t: e.t, kind: 0 as const, words: e.words })),
    ...run.decisions.map((d) => ({ t: d.t, kind: 1 as const })),
    ...run.dilemmas.map((d) => ({ t: d.t, kind: 2 as const, words: d.words })),
  ];
  return items.sort((a, b) => a.t - b.t || a.kind - b.kind);
}

/**
 * The low model: text queues for one reader at `wpm`; before each progress decision the reader finishes what has
 * arrived (a decision barrier), and a dilemma costs its modal words plus `deliberationSec` on a paused clock. Returns
 * the wall seconds each phase adds to the bot's time; whatever is unread at the end lands on the last phase.
 */
export function queueModel(run: ReadingRecord, wpm: number, deliberationSec: number, include: (e: TextEvent) => boolean = forced): ByPhase<number> {
  const extra: ByPhase<number> = {};
  const add = (phase: number, sec: number): void => { extra[phase] = (extra[phase] ?? 0) + sec; };
  let delay = 0, freeAt = 0;
  for (const item of timeline(run, include)) {
    const wall = item.t + delay;
    const phase = phaseAt(run.phaseReachedAtSec, item.t);
    if (item.kind === 0) freeAt = Math.max(freeAt, wall) + (item.words / wpm) * 60;
    else if (item.kind === 1 && freeAt > wall) { add(phase, freeAt - wall); delay += freeAt - wall; }
    else if (item.kind === 2) {
      const cost = (item.words / wpm) * 60 + deliberationSec;
      add(phase, cost);
      delay += cost;
      freeAt = Math.max(freeAt, wall) + cost;
    }
  }
  const endWall = run.simSeconds + delay;
  if (freeAt > endWall) add(phaseAt(run.phaseReachedAtSec, run.simSeconds), freeAt - endWall);
  return extra;
}

/** The floor: reading overlaps all game time; a phase pays only for forced text it cannot fit, plus its dilemmas. */
export function floorModel(run: ReadingRecord, words: ByPhase<PhaseWords> = wordsByPhase(run.events)): ByPhase<number> {
  const extra: ByPhase<number> = {};
  for (const [key, secs] of Object.entries(run.phaseSec)) {
    const w = words[Number(key)] ?? emptyWords();
    const reading = minutesOf(w.A + w.B, READING_WPM.fast) * 60;
    extra[Number(key)] = Math.max(0, reading - secs) + minutesOf(w.dilemma, READING_WPM.fast) * 60 + w.dilemmas * DELIBERATION_SEC.low;
  }
  return extra;
}

/** The high model: every text, optional and repeated included, read at the slow rate with nothing overlapping. */
export function highModel(words: ByPhase<PhaseWords>): ByPhase<number> {
  const extra: ByPhase<number> = {};
  for (const [key, w] of Object.entries(words)) {
    extra[Number(key)] = minutesOf(w.A + w.B + w.C + w.repeat + w.dilemma, READING_WPM.slow) * 60 + w.dilemmas * DELIBERATION_SEC.high;
  }
  return extra;
}

export interface WindowSample { t: number; words: number; arrivals: TextEvent[] }

/** Pushed words (groups A and B, log repeats included: they still arrive) in the `widthSec` window ending at each arrival. */
export function slidingWindows(events: readonly TextEvent[], widthSec: number): WindowSample[] {
  const arrivals = events.filter((e) => e.group !== 'C' && e.source !== 'dilemma' && e.t > 0).sort((a, b) => a.t - b.t);
  const out: WindowSample[] = [];
  let j = 0, sum = 0;
  arrivals.forEach((e, i) => {
    sum += e.words;
    for (let head = arrivals[j]; head !== undefined && head.t <= e.t - widthSec; head = arrivals[j]) { sum -= head.words; j += 1; }
    out.push({ t: e.t, words: sum, arrivals: arrivals.slice(j, i + 1) });
  });
  return out;
}

/** Arrivals whose window holds more than a reader at `wpm` reads in it, by phase. */
export function overFullWindows(run: ReadingRecord, widthSec: number, wpm: number = READING_WPM.central): ByPhase<number> {
  const cap = (wpm * widthSec) / 60;
  const out: ByPhase<number> = {};
  for (const sample of slidingWindows(run.events, widthSec)) {
    if (sample.words <= cap) continue;
    const phase = phaseAt(run.phaseReachedAtSec, sample.t);
    out[phase] = (out[phase] ?? 0) + 1;
  }
  return out;
}

/** Runs of `minLines` or more log lines within `spanSec` of the run's first line, greedily, as [start, lines]. */
export function logBursts(events: readonly TextEvent[], spanSec: number = BURST.spanSec, minLines: number = BURST.minLines): [number, number][] {
  const times = events.filter((e) => e.source === 'log').map((e) => e.t).sort((a, b) => a - b);
  const bursts: [number, number][] = [];
  for (let i = 0; i < times.length;) {
    const start = times[i] ?? 0;
    let j = i;
    while ((times[j + 1] ?? Infinity) - start <= spanSec) j += 1;
    if (j - i + 1 >= minLines) { bursts.push([start, j - i + 1]); i = j + 1; } else i += 1;
  }
  return bursts;
}

export interface DilemmaGaps {
  /** Dilemma opening times in the phase. */
  at: number[];
  /**
   * The longest wait for a dilemma that ends in the phase: from the previous dilemma (in any phase, or the run's start)
   * to the next one in the phase, or to the phase's end. A quiet stretch that crosses a phase boundary counts whole.
   */
  longestQuietSec: number;
}

/** The dilemma timeline per phase, and the shortest gap between any two consecutive dilemmas in the run. */
export function dilemmaGaps(run: ReadingRecord): { byPhase: ByPhase<DilemmaGaps>; shortestSec: number | null } {
  const byPhase: ByPhase<DilemmaGaps> = {};
  const times = run.dilemmas.map((d) => d.t).sort((a, b) => a - b);
  const spans = Object.entries(run.phaseReachedAtSec).map(([phase, at]) => [Number(phase), at] as const).sort((a, b) => a[1] - b[1]);
  spans.forEach(([phase, start], i) => {
    const end = spans[i + 1]?.[1] ?? run.simSeconds;
    const last = i === spans.length - 1;
    const at = times.filter((t) => t >= start && (t < end || (last && t === end)));
    const before = times.filter((t) => t < start).at(-1) ?? 0;
    const edges = [before, ...at, end];
    byPhase[phase] = { at, longestQuietSec: Math.max(...edges.slice(1).map((t, k) => t - (edges[k] ?? t))) };
  });
  const gaps = times.slice(1).map((t, k) => t - (times[k] ?? t));
  return { byPhase, shortestSec: gaps.length > 0 ? Math.min(...gaps) : null };
}

export interface ReadingRow {
  phase: number;
  /** The bot's simulated minutes in the phase and its progress decisions there. */
  botMin: number;
  decisions: number;
  words: PhaseWords;
  /** Forced reading (A, B and dilemma modals) in minutes at the central, fast and slow rates. */
  forcedMin: { central: number; fast: number; slow: number };
  /** Optional text (group C) in minutes at the central rate, reported apart so it never inflates density. */
  optionalMin: number;
  /** Forced words (A and B) per minute of the bot's phase time. */
  densityWpm: number;
  /** Modelled human minutes: floor, low and high. */
  human: { floor: number; low: number; high: number };
}

/** One row per phase the run spent time in, in phase order. */
export function readingRows(run: ReadingRecord): ReadingRow[] {
  const words = wordsByPhase(run.events);
  const low = queueModel(run, READING_WPM.fast, DELIBERATION_SEC.low);
  const floor = floorModel(run, words);
  const high = highModel(words);
  const decisions: ByPhase<number> = {};
  for (const d of run.decisions) decisions[d.phase] = (decisions[d.phase] ?? 0) + 1;
  return Object.keys(run.phaseSec).map(Number).sort((a, b) => a - b).map((phase) => {
    const secs = run.phaseSec[phase] ?? 0;
    const w = words[phase] ?? emptyWords();
    const forcedWords = w.A + w.B + w.dilemma;
    return {
      phase, botMin: secs / 60, decisions: decisions[phase] ?? 0, words: w,
      forcedMin: { central: minutesOf(forcedWords, READING_WPM.central), fast: minutesOf(forcedWords, READING_WPM.fast), slow: minutesOf(forcedWords, READING_WPM.slow) },
      optionalMin: minutesOf(w.C, READING_WPM.central),
      densityWpm: secs > 0 ? (w.A + w.B) / (secs / 60) : 0,
      human: { floor: (secs + (floor[phase] ?? 0)) / 60, low: (secs + (low[phase] ?? 0)) / 60, high: (secs + (high[phase] ?? 0)) / 60 },
    };
  });
}

/** The run-up to the ending (#542): story in the final phase, and what the ending itself says. */
export interface FinaleReading {
  /** The phase the run ended in, and the minutes it spent there. */
  phase: number;
  phaseMin: number;
  /** New story texts (group A, outside dilemmas, not repeats) in that phase before the ending second, and the longest stretch with none. */
  storyTexts: number;
  longestQuietMin: number;
  /** Story texts in the last ten minutes before the ending, and the minutes from the last one to the ending. */
  lastTenMinTexts: number;
  finalQuietMin: number;
  /** Words on the ending screen's story: title, epilogue and every movement. */
  endingWords: number;
}

const FINALE_WINDOW_SEC = 600;
const story = (e: TextEvent): boolean => e.group === 'A' && e.repeat !== true && e.source !== 'dilemma' && e.source !== 'ending';

/** How the final phase reads up to the ending; null when the run did not end. */
export function finaleReading(run: ReadingRecord): FinaleReading | null {
  const ending = run.events.find((e) => e.source === 'ending');
  if (ending === undefined) return null;
  const phase = ending.phase, from = run.phaseReachedAtSec[phase] ?? 0, end = ending.t;
  const times = run.events.filter((e) => story(e) && e.phase === phase && e.t >= from && e.t < end).map((e) => e.t).sort((a, b) => a - b);
  const marks = [from, ...times, end];
  let longest = 0;
  for (let i = 1; i < marks.length; i++) longest = Math.max(longest, (marks[i] ?? 0) - (marks[i - 1] ?? 0));
  return {
    phase, phaseMin: (end - from) / 60, storyTexts: times.length, longestQuietMin: longest / 60,
    lastTenMinTexts: times.filter((t) => t >= end - FINALE_WINDOW_SEC).length, finalQuietMin: (end - (times.at(-1) ?? from)) / 60,
    endingWords: ending.words,
  };
}
