/**
 * The transitions spec's rules (#339) as pure functions over one transition cell's measurements: C1 (the new item is
 * fully in view, or badged on its tab when its pane is not shown; announced; not truncated; one alert per condition
 * with a consistent role; focus kept), C2 (timely items, the primary action, the first card and the pointer target
 * stay put; an item whose window the trigger retires is gone) and B5 (the primary action moves no more than a few
 * px). Unit-tested in tests/ui-atlas-transitions.spec.ts.
 */
import type { Rect } from '../audit/metrics';
import type { Announcement, Observed } from './announce';
import type { ItemMeasure } from './contractCheck';
import { cellAnchor, type GateFailure } from './gates';

/** "A few px" (walk C2.1): sub-pixel layout and a border are not a jump; the walk measured 73 to 134 px. */
export const B5_TOLERANCE_PX = 4;
/** scrollWidth and clientWidth are integers that can disagree by one on fractional layouts (as in metrics.ts). */
const TRUNCATION_SLACK = 1;

export type TransitionRule =
  | 'new-in-view' | 'new-announced' | 'new-truncated' | 'focus-lost' | 'one-alert' | 'politeness'
  | 'timely-kept' | 'timely-retired' | 'primary-kept' | 'primary-shift' | 'pointer-target';

export type TransitionFailure = GateFailure<TransitionRule>;

/** What the control under the trigger's pointer is after the trigger. */
export interface PointerTarget { testId: string | null; interactive: boolean; enabled: boolean }

export interface TransitionInput {
  id: string; viewport: string; observed: Observed; tabsBefore: Readonly<Record<string, string>>;
  appear?: {
    item: ItemMeasure; inDialog: boolean; pane: string | null; paneShown: boolean; truncatedPx: number;
    announce?: RegExp; alerts?: RegExp; focus?: boolean | string;
  };
  /** The C2 set, measured after the trigger: timely items, extra items and the first card. */
  kept: readonly ItemMeasure[];
  /** Timely items the trigger retires on purpose, measured after it: each must be gone. */
  retired?: readonly ItemMeasure[];
  primary: { before: Rect | null; after: ItemMeasure | null; kept: boolean; steady: boolean };
  pointer?: { clicked: string; after: PointerTarget | null };
}

/** The larger of the horizontal and vertical move between two boxes, rounded; null when either is missing. */
export function displacement(before: Rect | null, after: Rect | null): number | null {
  if (before === null || after === null) return null;
  return Math.round(Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y)));
}

/** Tabs that were there before and whose name changed: the attention marker of TerminalTabs (#284). */
export function badgedTabs(before: Readonly<Record<string, string>>, after: Readonly<Record<string, string>>): string[] {
  return Object.keys(after).filter((id) => before[id] !== undefined && before[id] !== after[id]);
}

const spoken = (entry: Announcement): boolean => entry.kind === 'live' || entry.kind === 'dialog';
const quote = (entries: readonly Announcement[]): string =>
  entries.length === 0 ? 'nothing announced' : entries.slice(0, 3).map((entry) => `${entry.kind}${entry.role === null ? '' : ' ' + entry.role}: ${entry.text.slice(0, 60)}`).join(' | ');
/** role=alert is assertive by definition and role=status polite; an explicit aria-live that contradicts it is mixed. */
const mixed = (entry: Announcement): boolean =>
  (entry.role === 'alert' && entry.live === 'polite') || (entry.role === 'status' && entry.live === 'assertive');

type Fail = (item: string, rule: TransitionRule, measured: TransitionFailure['measured']) => TransitionFailure;

function appearFailures(input: TransitionInput, fail: Fail): TransitionFailure[] {
  const { appear, observed, tabsBefore } = input;
  if (appear === undefined) return [];
  const { item } = appear;
  const badged = badgedTabs(tabsBefore, observed.tabs);
  const failures: TransitionFailure[] = [];
  if (appear.pane !== null && !appear.paneShown) {
    // Its pane is not on screen (a phone shows one): the pointer to it is a badge on that pane's tab.
    if (!badged.includes('tab-' + appear.pane)) failures.push(fail(item.key, 'new-in-view', { detail: `${appear.pane} is not shown and tab-${appear.pane} carries no badge` }));
  } else if (!item.found) failures.push(fail(item.key, 'new-in-view', { detail: 'missing after the trigger: ' + item.locate }));
  else if (!item.inFirstViewport) failures.push(fail(item.key, 'new-in-view', { box: item.box, visibleRatio: item.visibleRatio, fold: item.fold }));
  const live = observed.announcements.filter(spoken);
  const pattern = appear.announce;
  const heard = pattern !== undefined && live.some((entry) => pattern.test(entry.text));
  const focused = appear.inDialog && observed.focusInDialog;
  if (pattern !== undefined && !heard && badged.length === 0 && !focused) failures.push(fail(item.key, 'new-announced', { detail: quote(live) }));
  if (appear.truncatedPx > TRUNCATION_SLACK) failures.push(fail(item.key, 'new-truncated', { value: appear.truncatedPx, box: item.box }));
  if (appear.focus === true && observed.focus === null) failures.push(fail(item.key, 'focus-lost', { detail: 'focus is on the page body' }));
  if (typeof appear.focus === 'string' && observed.focus !== appear.focus) {
    failures.push(fail(item.key, 'focus-lost', { detail: `focus is on ${observed.focus ?? 'the page body'}, not ${appear.focus}` }));
  }
  return [...failures, ...alertFailures(input, fail)];
}

function alertFailures(input: TransitionInput, fail: Fail): TransitionFailure[] {
  const pattern = input.appear?.alerts;
  if (pattern === undefined) return [];
  const matching = input.observed.announcements.filter((entry) => entry.kind === 'live' && pattern.test(entry.text));
  const regions = [...new Set(matching.map((entry) => entry.testId ?? entry.text))];
  return [
    ...(regions.length > 1 ? [fail('alerts', 'one-alert', { value: regions.length, detail: regions.join(', ') })] : []),
    ...matching.filter(mixed).map((entry) => fail(entry.testId ?? 'alert', 'politeness', { detail: `role=${String(entry.role)} aria-live=${String(entry.live)}` })),
  ];
}

function keepFailures(input: TransitionInput, fail: Fail): TransitionFailure[] {
  const failures = input.kept.flatMap((item) => {
    if (!item.found) return [fail(item.key, 'timely-kept', { detail: 'missing after the trigger: ' + item.locate })];
    return item.inFirstViewport ? [] : [fail(item.key, 'timely-kept', { box: item.box, visibleRatio: item.visibleRatio, fold: item.fold })];
  });
  for (const item of input.retired ?? []) {
    if (item.found) failures.push(fail(item.key, 'timely-retired', { box: item.box, detail: 'still on screen after the trigger retired its window' }));
  }
  const { primary, pointer } = input;
  if (primary.kept && (primary.after === null || !primary.after.found || !primary.after.inFirstViewport)) {
    const after = primary.after;
    failures.push(fail('core.cycle', 'primary-kept', after?.found === true ? { box: after.box, visibleRatio: after.visibleRatio, fold: after.fold } : { detail: 'missing after the trigger' }));
  }
  const target = pointer?.after ?? null;
  if (pointer !== undefined && target !== null && target.interactive && target.enabled && target.testId !== pointer.clicked) {
    failures.push(fail(pointer.clicked, 'pointer-target', { detail: 'under the pointer now: ' + (target.testId ?? 'an unnamed control') }));
  }
  return failures;
}

function steadyFailures(input: TransitionInput, fail: Fail): TransitionFailure[] {
  const { primary } = input;
  if (!primary.steady) return [];
  const after = primary.after?.found === true ? primary.after.box : null;
  const moved = displacement(primary.before, after);
  if (moved === null) return [fail('core.cycle', 'primary-shift', { detail: primary.before === null ? 'not on screen before the trigger' : 'not on screen after the trigger' })];
  if (moved <= B5_TOLERANCE_PX) return [];
  return [fail('core.cycle', 'primary-shift', { box: after, value: moved, detail: `y ${String(Math.round(primary.before?.y ?? 0))} -> ${String(Math.round(after?.y ?? 0))}` })];
}

/** Every failure of one transition cell, in a stable order: C1, then C2, then B5. */
export function transitionFailures(input: TransitionInput): TransitionFailure[] {
  const anchor = cellAnchor(input.id, input.viewport);
  const fail: Fail = (item, rule, measured) => ({ stage: input.id, viewport: input.viewport, item, rule, measured, anchor });
  return [...appearFailures(input, fail), ...keepFailures(input, fail), ...steadyFailures(input, fail)];
}
