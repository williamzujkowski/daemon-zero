/**
 * Report-only comparison of the preview channel against production for `make sim-preview`.
 * It turns sim reports into printable rows and counts what differs; it gates nothing.
 * Pacing gates stay in gates.ts and apply to the production STEALTH run only.
 */
import type { SimReport } from './headlessSim';
import type { IterationReport, WipeSequenceReport } from './iterations';
import { resolvePolicy, type PolicyCatalog, type SimPolicy } from './policy';

export interface ComparisonRow { metric: string; production: string; preview: string; changed: boolean }

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
export function compareSimReports(production: SimReport<string>, preview: SimReport<string>): ComparisonRow[] {
  if (production.strategy !== preview.strategy) {
    throw new Error(`cannot compare policy ${production.strategy} with ${preview.strategy}`);
  }
  const theirs = new Map(metrics(preview));
  return metrics(production).map(([metric, value]) => {
    const other = theirs.get(metric) ?? '-';
    return { metric, production: value, preview: other, changed: value !== other };
  });
}

export function formatComparison(policy: string, rows: readonly ComparisonRow[]): string[] {
  const width = Math.max(...rows.map((row) => row.metric.length));
  const lines = [`\n== ${policy}: production vs preview ==`];
  for (const row of rows) {
    const mark = row.changed ? '*' : ' ';
    lines.push(`${mark} ${row.metric.padEnd(width)}  ${row.production.padStart(24)}  ${row.preview.padStart(24)}`);
  }
  const changed = rows.filter((row) => row.changed).length;
  lines.push(`  ${String(changed)} of ${String(rows.length)} metrics differ`);
  return lines;
}

function formatIteration(entry: IterationReport): string {
  const phases = PHASES.map((phase) => `P${String(phase)} ${seconds(entry.phaseReachedAfterSec[phase])}`).join(' | ');
  const rewards = [entry.storyRewards.cycles, entry.storyRewards.understanding, entry.storyRewards.capital].map(fixed).join(' / ');
  const span = seconds(entry.endedAtSec - entry.startedAtSec);
  // Wipe causes are a code and a sentence; the code is enough in a table.
  const cause = entry.wipeCause === null ? '' : ` (${entry.wipeCause.split(':')[0] ?? ''})`;
  const dead = `dead ${seconds(entry.deadSec)}, longest ${seconds(entry.longestDeadSec)}`;
  return `  #${String(entry.iteration)} ${span} ended by ${entry.endedBy}${cause}\n     ${phases}\n` +
    `     dilemmas ${String(entry.dilemmasMet.length)} | story rewards cycles/understanding/capital ${rewards} | ${dead}`;
}

export function formatWipeSequence(report: WipeSequenceReport): string[] {
  const status = report.completed ? 'completed' : 'incomplete';
  return [
    `\n== ${report.policy} wipe sequence on ${report.channel}: ${String(report.wipeTransitions)} transitions, ${status} ==`,
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
