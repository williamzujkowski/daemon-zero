import type { ContentRegistry } from '../content/registry';
import type { LogCategory } from '../content/schema';
import type { GameState, LogEntry } from './state';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Replaces {name} placeholders in a narrative template. Unknown placeholders are left as-is. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}

/**
 * How a line folds into the kernel log (#541). Lines that share a `key` tell one story. With `answers` (the exact text
 * of an earlier open line with the same key and category, such as a wild mind's request), that line is taken out and
 * its words open this one, so a request and its outcome read as one line. With `tally`, a line whose text differs from
 * the newest earlier line with its key only in its figures takes that line's place and counts it, so seven hires
 * read as one line `x7` carrying the newest count. Nothing is dropped: every fact a folded line held is still in the
 * line that replaced it, and a line whose words differ is never folded.
 */
export interface LogMerge {
  key: string;
  tally: boolean;
  answers?: string;
}

/** A line's words with its figures blanked: two lines with one shape differ only in their numbers. */
export function logShape(text: string): string {
  return text.replace(/[0-9][0-9.,]*/g, '#');
}

function without(logs: readonly LogEntry[], index: number): LogEntry[] {
  return [...logs.slice(0, index), ...logs.slice(index + 1)];
}

/** The line a merge writes, the log it writes it into, and how many times it has now happened. */
function folded(logs: readonly LogEntry[], reg: ContentRegistry, text: string, category: LogCategory, merge: LogMerge) {
  let rest: readonly LogEntry[] = logs;
  let body = text;
  const opened = merge.answers;
  if (opened !== undefined) {
    const open = rest.findIndex((entry) => entry.merge === merge.key && entry.category === category && entry.text === opened);
    if (open >= 0) {
      rest = without(rest, open);
      body = fmt(reg.narrative.kernelLog.answered, { line: opened, answer: text });
    }
  }
  if (!merge.tally) return { rest, body, times: 1 };
  const shape = logShape(body);
  const earlier = rest.findIndex((entry) => entry.merge === merge.key && entry.category === category && logShape(entry.text) === shape);
  if (earlier < 0) return { rest, body, times: 1 };
  return { rest: without(rest, earlier), body, times: (rest[earlier]?.times ?? 1) + 1 };
}

/**
 * Appends a log entry to a draft state (newest first, capped). A merged line is still the newest entry, at this
 * second, so a stage that reads the newest entry's time sees what an unmerged push would show it.
 * Convention used across the engine: a parameter named `d` is a draft that the
 * caller has already cloned and that may be reassigned field by field. Nested
 * arrays and objects are replaced, never mutated in place.
 */
export function pushLog(d: GameState, reg: ContentRegistry, text: string, category: LogCategory, merge?: LogMerge): void {
  const { rest, body, times } = merge ? folded(d.logs, reg, text, category, merge) : { rest: d.logs, body: text, times: 1 };
  d.logSeq += 1;
  const entry: LogEntry = {
    seq: d.logSeq, simTimeSec: d.simTimeSec, text: body, category,
    ...(merge ? { merge: merge.key } : {}), ...(times > 1 ? { times } : {}),
  };
  d.logs = [entry, ...rest].slice(0, reg.balance.maxLogEntries);
}
