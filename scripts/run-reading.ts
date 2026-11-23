/**
 * Reading report: `make sim-reading` (#540). Plays the careful bot under legacy and campaign rules through the reading
 * observer and prints, per phase, the words a player is shown, reading time, density, over-full windows, log bursts,
 * the dilemma timeline and three modelled human times. Report only: never part of `verify`, never a gate.
 *
 *   --every-second   re-read the standing surfaces every second, not only on change (slower; the reference)
 */
import { CONTENT } from '../src/content';
import { activateCampaignRules } from '../src/engine/campaign';
import { createInitialState, type GameState } from '../src/engine/state';
import { SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { STEALTH_POLICY } from '../src/engine/sim/policy';
import {
  BURST, DELIBERATION_SEC, dilemmaGaps, logBursts, overFullWindows, phaseAt, READING_WPM, readingRows, WINDOW_WIDTHS_SEC, type ReadingRow,
} from '../src/engine/sim/readingAnalysis';
import { observeReading, type ReadingRecord } from '../src/engine/sim/readingObserver';

const everySecond = process.argv.includes('--every-second');
const f1 = (value: number): string => value.toFixed(1);
const min = (sec: number): string => f1(sec / 60);

function admitted(): GameState {
  const result = activateCampaignRules(createInitialState(CONTENT), CONTENT);
  if (!result.ok) throw new Error(`campaign rules did not activate: ${result.reason}`);
  return result.state;
}

function phaseTable(rows: ReadingRow[]): void {
  const { central, fast, slow } = READING_WPM;
  console.log(`| Phase | Bot min | Decisions | Words A / B / C / repeats | Dilemmas (words) | Forced read min ${String(central)} (${String(fast)}-${String(slow)}) | ` +
    `Optional C min ${String(central)} | Forced density wpm (A+B) | Human floor / low / high min |`);
  console.log('|---|---|---|---|---|---|---|---|---|');
  const sum = (pick: (row: ReadingRow) => number): number => rows.reduce((acc, row) => acc + pick(row), 0);
  for (const r of rows) {
    const w = r.words;
    console.log(`| ${String(r.phase)} | ${f1(r.botMin)} | ${String(r.decisions)} | ${String(w.A)} / ${String(w.B)} / ${String(w.C)} / ${String(w.repeat)} | ` +
      `${String(w.dilemmas)} (${String(w.dilemma)}) | ${f1(r.forcedMin.central)} (${f1(r.forcedMin.fast)}-${f1(r.forcedMin.slow)}) | ${f1(r.optionalMin)} | ` +
      `${f1(r.densityWpm)} | ${f1(r.human.floor)} / ${f1(r.human.low)} / ${f1(r.human.high)} |`);
  }
  console.log(`| all | ${f1(sum((r) => r.botMin))} | ${String(sum((r) => r.decisions))} | ${String(sum((r) => r.words.A))} / ${String(sum((r) => r.words.B))} / ` +
    `${String(sum((r) => r.words.C))} / ${String(sum((r) => r.words.repeat))} | ${String(sum((r) => r.words.dilemmas))} (${String(sum((r) => r.words.dilemma))}) | ` +
    `${f1(sum((r) => r.forcedMin.central))} (${f1(sum((r) => r.forcedMin.fast))}-${f1(sum((r) => r.forcedMin.slow))}) | ${f1(sum((r) => r.optionalMin))} | | ` +
    `${f1(sum((r) => r.human.floor))} / ${f1(sum((r) => r.human.low))} / ${f1(sum((r) => r.human.high))} |`);
}

function pacingTable(run: ReadingRecord, rows: ReadingRow[]): void {
  const windows = WINDOW_WIDTHS_SEC.map((width) => overFullWindows(run, width));
  const bursts: Record<number, number> = {};
  for (const [t] of logBursts(run.events)) { const p = phaseAt(run.phaseReachedAtSec, t); bursts[p] = (bursts[p] ?? 0) + 1; }
  const gaps = dilemmaGaps(run);
  const caps = WINDOW_WIDTHS_SEC.map((width) => `${String(width)} s (> ${String(Math.round((READING_WPM.central * width) / 60))} w)`);
  console.log(`\n| Phase | Over-full windows ${caps.join(' / ')} | Log bursts | Dilemmas at (min) | Longest wait for a dilemma (min) |`);
  console.log('|---|---|---|---|---|');
  for (const { phase } of rows) {
    const counts = windows.map((byPhase) => String(byPhase[phase] ?? 0)).join(' / ');
    const g = gaps.byPhase[phase];
    console.log(`| ${String(phase)} | ${counts} | ${String(bursts[phase] ?? 0)} | ${g?.at.map(min).join(', ') ?? ''} | ${g === undefined ? '-' : min(g.longestQuietSec)} |`);
  }
  const totals = windows.map((byPhase) => String(Object.values(byPhase).reduce((a, b) => a + b, 0))).join(' / ');
  console.log(`| all | ${totals} | ${String(Object.values(bursts).reduce((a, b) => a + b, 0))} | ` +
    `${String(run.dilemmas.length)} dilemmas | shortest gap ${gaps.shortestSec === null ? '-' : min(gaps.shortestSec)} |`);
}

function report(label: string, start: GameState): void {
  const began = performance.now();
  const observer = observeReading(STEALTH_POLICY, CONTENT, everySecond);
  const sim = runPolicySim(CONTENT, observer.policy, { maxSimSec: SIM_BUDGET_SEC, initialState: start });
  const run = observer.finish(sim.finalState);
  const wall = (performance.now() - began) / 1000;
  const rows = readingRows(run);
  console.log(`\n### STEALTH, ${label}: ${f1(run.simSeconds)} s, ending ${String(run.ending)}, wipes ${String(sim.wipes)}`);
  console.log(`(${String(run.events.length)} texts; surfaces read in ${String(run.snapshots)} of ${String(run.seconds + 1)} seconds; ${f1(wall)} s wall)\n`);
  phaseTable(rows);
  pacingTable(run, rows);
}

const started = performance.now();
console.log('Reading report (modelled, not timed). Forced = groups A (pushed story) and B (decision prose); optional = C (folds and panels).');
console.log(`Rates ${String(READING_WPM.central)} wpm central, ${String(READING_WPM.slow)}-${String(READING_WPM.fast)} range (Brysbaert 2019). ` +
  `Dilemma deliberation ${String(DELIBERATION_SEC.low)} s low, ${String(DELIBERATION_SEC.high)} s high. ` +
  `A log burst is ${String(BURST.minLines)}+ lines within ${String(BURST.spanSec)} s.${everySecond ? ' Surfaces read every second.' : ''}`);
report('legacy rules', createInitialState(CONTENT));
report('campaign rules', admitted());
console.log(`\nreported in ${f1((performance.now() - started) / 1000)} s of wall time`);
