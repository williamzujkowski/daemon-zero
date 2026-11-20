/**
 * Pure half of the UI audit (#338): turns what the page reported (raw boxes, clip chains, scroll sizes,
 * hit tests, axe output) into the typed per-cell metrics the gallery and later gates read. No browser,
 * no Playwright, so every rule here is unit-tested in tests/ui-audit-metrics.spec.ts.
 */
import type { Finding } from '../axe';

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }

/** The repo's own target rule (docs/UI-SIZES.md) and the WCAG 2.5.8 floor below it. */
export const TARGET_MIN = 44;
export const WCAG_TARGET_MIN = 24;
/** "In the first viewport" means fully visible; sub-pixel layout rounding is not a miss. */
export const FULLY_VISIBLE = 0.99;
/** scrollWidth and clientWidth are integers that can disagree by one on fractional layouts. */
const TRUNCATION_SLACK = 1;

export type ElementKind = 'interactive' | 'heading';

/** One element as the page reported it, before any judgement. */
export interface RawElement {
  kind: ElementKind; role: string; name: string; testId: string | null; rect: Rect;
  /** Rects of every ancestor that clips (overflow not visible), nearest first: the panes it scrolls in. */
  clips: Rect[];
  /** Largest scroll-minus-client overflow on the element or a clipping descendant, per axis. */
  overflowX: number; overflowY: number;
}

/** A text run whose own box hides part of it (RN Web numberOfLines: ellipsis or line clamp), as measured. */
export interface ClippedText { testId: string | null; text: string; overflowX: number; overflowY: number }

export interface RawGeometry { viewport: Size; documentScrollWidth: number; elements: RawElement[]; fontSizes: number[]; clippedText: ClippedText[] }

export interface ContrastNode { target: string; reason: string; fgColor: string | null; bgColor: string | null; ratio: number | null }
export interface AxeReport { violations: Finding[]; contrastIncomplete: ContrastNode[] }

export interface ElementMetric {
  kind: ElementKind; role: string; name: string; testId: string | null; box: Rect;
  /** Share of the box visible at rest, inside the window and every clipping pane: 0..1. */
  visibleRatio: number; inFirstViewport: boolean;
  /** Whether another element takes the pointer at the centre of the visible part; null when none is visible. */
  occluded: boolean | null;
  minSide: number;
  /** Interactive only: under the repo's 44px rule. Always false for a heading. */
  underTarget: boolean;
  truncated: { x: boolean; y: boolean };
}

export interface AuditCounts {
  interactive: number; interactiveInFirstViewport: number; headings: number; headingsInFirstViewport: number;
  underTarget: number; underWcagTarget: number; occluded: number; truncated: number; truncatedText: number; distinctFontSizes: number;
}

export interface AuditCell { stage: string; fixture: string; ending?: boolean }

export interface AuditMetrics {
  cell: { stage: string; fixture: string; project: string; viewport: Size };
  /** Wall time per phase of this cell, in ms: boot to a ready, paused page; the audit itself; both. */
  wallMs: { boot: number; audit: number; total: number };
  axe: AxeReport & { violationCount: number };
  aria: { lines: number };
  /** overflowX: how far the document is wider than the window. truncatedText: every clipped text run, anywhere. */
  page: { overflowX: number; truncatedText: ClippedText[] };
  counts: AuditCounts;
  fontSizes: number[];
  elements: ElementMetric[];
}

export function area(rect: Rect): number { return Math.max(0, rect.width) * Math.max(0, rect.height); }

/** The overlap of two rects, or an empty rect at the first one's corner when they do not meet. */
export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : { x: a.x, y: a.y, width: 0, height: 0 };
}

/** What of `rect` the player sees without scrolling: clipped by the window and by every pane it sits in. */
export function visiblePart(rect: Rect, clips: readonly Rect[], viewport: Size): Rect {
  return [{ x: 0, y: 0, ...viewport }, ...clips].reduce(intersect, rect);
}

export function visibleRatio(rect: Rect, clips: readonly Rect[], viewport: Size): number {
  const whole = area(rect);
  return whole === 0 ? 0 : area(visiblePart(rect, clips, viewport)) / whole;
}

/** The point a hit test should probe: the centre of the visible part, or null when nothing is visible. */
export function probePoint(rect: Rect, clips: readonly Rect[], viewport: Size): { x: number; y: number } | null {
  const part = visiblePart(rect, clips, viewport);
  return area(part) === 0 ? null : { x: part.x + part.width / 2, y: part.y + part.height / 2 };
}

export function elementMetric(raw: RawElement, viewport: Size, occluded: boolean | null): ElementMetric {
  const ratio = visibleRatio(raw.rect, raw.clips, viewport);
  const minSide = Math.min(raw.rect.width, raw.rect.height);
  return {
    kind: raw.kind, role: raw.role, name: raw.name, testId: raw.testId, box: raw.rect,
    visibleRatio: Math.round(ratio * 1000) / 1000, inFirstViewport: ratio >= FULLY_VISIBLE, occluded,
    minSide: Math.round(minSide * 10) / 10,
    underTarget: raw.kind === 'interactive' && minSide < TARGET_MIN,
    truncated: { x: raw.overflowX > TRUNCATION_SLACK, y: raw.overflowY > TRUNCATION_SLACK },
  };
}

export function distinctSizes(sizes: readonly number[]): number[] {
  return [...new Set(sizes.filter((size) => Number.isFinite(size) && size > 0))].sort((a, b) => a - b);
}

/** The clipped runs worth reporting: past the rounding slack on either axis. */
export function truncatedText(runs: readonly ClippedText[]): ClippedText[] {
  return runs.filter((run) => run.overflowX > TRUNCATION_SLACK || run.overflowY > TRUNCATION_SLACK);
}

export function countMetrics(elements: readonly ElementMetric[], fontSizes: readonly number[], clipped: readonly ClippedText[] = []): AuditCounts {
  const of = (kind: ElementKind) => elements.filter((element) => element.kind === kind);
  const interactive = of('interactive'), headings = of('heading');
  return {
    interactive: interactive.length,
    interactiveInFirstViewport: interactive.filter((element) => element.inFirstViewport).length,
    headings: headings.length,
    headingsInFirstViewport: headings.filter((element) => element.inFirstViewport).length,
    underTarget: interactive.filter((element) => element.underTarget).length,
    underWcagTarget: interactive.filter((element) => element.minSide < WCAG_TARGET_MIN).length,
    occluded: elements.filter((element) => element.occluded === true).length,
    truncated: elements.filter((element) => element.truncated.x || element.truncated.y).length,
    truncatedText: truncatedText(clipped).length,
    distinctFontSizes: distinctSizes(fontSizes).length,
  };
}

/** Everything that makes a metrics object unusable as evidence. Empty means the audit ran and measured. */
export function metricsProblems(metrics: AuditMetrics): string[] {
  const problems: string[] = [];
  const { viewport } = metrics.cell;
  if (!(viewport.width > 0 && viewport.height > 0)) problems.push('viewport not measured');
  if (metrics.aria.lines === 0) problems.push('empty aria snapshot');
  if (metrics.counts.interactive === 0) problems.push('no interactive element found');
  if (metrics.counts.interactive + metrics.counts.headings !== metrics.elements.length) problems.push('counts disagree with elements');
  if (metrics.axe.violationCount !== metrics.axe.violations.length) problems.push('axe count disagrees with violations');
  if (metrics.fontSizes.length !== metrics.counts.distinctFontSizes) problems.push('font sizes disagree with their count');
  if (metrics.page.truncatedText.length !== metrics.counts.truncatedText) problems.push('truncated text disagrees with its count');
  for (const [name, value] of Object.entries(metrics.wallMs)) if (!(Number.isFinite(value) && value >= 0)) problems.push('wall time ' + name + ' not measured');
  for (const element of metrics.elements) {
    if (!(element.visibleRatio >= 0 && element.visibleRatio <= 1)) problems.push('visible ratio out of range: ' + element.name);
    if (element.occluded === null && element.visibleRatio > 0) problems.push('visible element not hit-tested: ' + element.name);
  }
  return problems;
}
