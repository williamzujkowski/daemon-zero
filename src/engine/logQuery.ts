/**
 * What the kernel log shows (#541): a merged line's text with its count, which lines are mechanical, and the one line
 * the preview holds. Story lines hold the preview over mechanical ones, so a run of hires never buries the story.
 */
import type { ContentRegistry } from '../content/registry';
import type { GameState, LogEntry } from './state';
import { fmt } from './util';

/** The words a log line shows: a tallied line carries its count. */
export function logLineText(entry: LogEntry, reg: ContentRegistry): string {
  return entry.times === undefined ? entry.text : fmt(reg.narrative.kernelLog.tally, { line: entry.text, times: entry.times });
}

/**
 * A mechanical line: one that merges (a hire, a release, a request and its outcome) and is a repeat or outside the
 * story categories. A repeat is a counted line, or one whose story the older log already tells (`older`, the entries
 * before it): a mind asking again while its earlier request and outcome are still in the log is a repeat even while
 * it waits for an answer. The first time a wild mind asks for a host is story; the fourteenth time is a count.
 */
export function isMechanicalLog(entry: LogEntry, reg: ContentRegistry, older: readonly LogEntry[] = []): boolean {
  if (entry.merge === undefined) return false;
  if (entry.times !== undefined || !reg.narrative.kernelLog.storyCategories.includes(entry.category)) return true;
  return older.some((earlier) => earlier.merge === entry.merge);
}

/** The line the one-line preview shows: the newest that is not mechanical, or the newest of all when every line is. */
export function previewLog(s: GameState, reg: ContentRegistry): LogEntry | undefined {
  return s.logs.find((entry, index) => !isMechanicalLog(entry, reg, s.logs.slice(index + 1))) ?? s.logs[0];
}
