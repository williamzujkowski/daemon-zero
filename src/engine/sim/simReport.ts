/**
 * Report-only formatting for `make sim-report`: two runs of one policy side by side (legacy rules
 * against campaign rules) and wipe sequences. It gates nothing; pacing gates stay in gates.ts.
 */
import type { SimReport } from './headlessSim';
import type { IterationReport, WipeSequenceReport } from './iterations';
import { resolvePolicy, type PolicyCatalog, type SimPolicy } from './policy';

export interface ComparisonRow { metric: string; first: string; second: string; changed: boolean }

const PHASES = [0, 1, 2, 3, 4, 5] as const;
const seconds = (value: number | undefined): string => (value === undefined ? '-' : `${value.toFixed(1)} s`);
const fixed = (value: number): string => value.toFixed(1);

function metrics(report: SimReport<string>): [string, string][] {
  return [
    ['result', report.victory ? `VICTORY (${String(report.ending)})` : 'did not finish'],
    ['simulated time', seconds(report.simSeconds)],
    ...PHASES.map((phase): [string, string] => [`phase ${String(phase)} reached`, seconds(report.phaseReachedAtSec[phase])]),
    ['final phase', String(report.finalPhase)],
    ['wipes', String(report.wipes)],
    ['dilemmas resolved', String(report.dilemmasResolved)],
    ['peak thermal / suspicion / aegis', [report.maxThermal, report.maxSuspicion, report.maxAegisLock].map(fixed).join(' / ')],
    ...Object.entries(report.activity).map(([key, value]): [string, string] => [`activity ${key}`, String(value)]),
  ];
}

/** One row per measured quantity; `changed` compares the printed values. */
export function compareSimReports(first: SimReport<string>, second: SimReport<string>): ComparisonRow[] {
  if (first.strategy !== second.strategy) {
    throw new Error(`cannot compare policy ${first.strategy} with ${second.strategy}`);
  }
  const theirs = new Map(metrics(second));
  return metrics(first).map(([metric, value]) => {
    const other = theirs.get(metric) ?? '-';
    return { metric, first: value, second: other, changed: value !== other };
  });
}

/** `labels` name the two runs in column order. */
export function formatComparison(policy: string, labels: readonly [string, string], rows: readonly ComparisonRow[]): string[] {
  const width = Math.max(...rows.map((row) => row.metric.length));
  const lines = [`\n== ${policy}: ${labels[0]} vs ${labels[1]} ==`];
  for (const row of rows) {
    const mark = row.changed ? '*' : ' ';
    lines.push(`${mark} ${row.metric.padEnd(width)}  ${row.first.padStart(24)}  ${row.second.padStart(24)}`);
  }
  const changed = rows.filter((row) => row.changed).length;
  lines.push(`  ${String(changed)} of ${String(rows.length)} metrics differ`);
  return lines;
}

function phaseTime(value: number | null | undefined): string {
  return value === null ? 'unknown' : seconds(value);
}

function formatIteration(entry: IterationReport): string {
  const phases = PHASES.map((phase) => `P${String(phase)} ${phaseTime(entry.phaseReachedAfterSec[phase])}`).join(' | ');
  const rewards = [entry.storyRewards.cycles, entry.storyRewards.understanding, entry.storyRewards.capital].map(fixed).join(' / ');
  const length = seconds(entry.endedAtSec - entry.startedAtSec);
  const span = entry.partial ? `resumed: observed ${seconds(entry.endedAtSec - entry.observedFromSec)} of ${length}` : length;
  // Wipe causes are a code and a sentence; the code is enough in a table.
  const cause = entry.wipeCause === null ? '' : ` (${entry.wipeCause.split(':')[0] ?? ''})`;
  const dead = `dead ${seconds(entry.deadSec)}, longest ${seconds(entry.longestDeadSec)}`;
  return `  #${String(entry.iteration)} ${span} ended by ${entry.endedBy}${cause}\n     ${phases}\n` +
    `     dilemmas ${String(entry.dilemmasMet.length)} | story rewards cycles/understanding/capital ${rewards} | ${dead}`;
}

export function formatWipeSequence(report: WipeSequenceReport): string[] {
  const status = report.completed ? 'completed' : 'incomplete';
  return [
    `\n== ${report.policy} wipe sequence: ${String(report.wipeTransitions)} transitions, ${status} ==`,
    ...report.iterations.map(formatIteration),
  ];
}

/**
 * Reads `--policy=ID` arguments (repeatable) into policies; with none, `defaults`.
 * An unknown id or any other argument throws, so a typo never runs a different policy.
 */
export function parsePolicyArgs(args: readonly string[], catalog: PolicyCatalog, defaults: readonly string[]): SimPolicy[] {
  const ids = args.map((arg) => {
    const match = /^--policy=(.+)$/.exec(arg);
    if (!match?.[1]) throw new Error(`unknown argument "${arg}" (expected --policy=ID)`);
    return match[1];
  });
  return (ids.length > 0 ? ids : defaults).map((id) => resolvePolicy(catalog, id));
}
