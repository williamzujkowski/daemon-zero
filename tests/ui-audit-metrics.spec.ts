/** The UI audit's pure rules (#338): first-viewport clipping, hit-test points, target size, truncation, counts,
 *  the well-formedness check the spike asserts, and the gallery's escaping and order. */
import { describe, expect, it } from 'vitest';
import { renderGallery, type GalleryCard } from './e2e/audit/gallery';
import {
  countMetrics, distinctSizes, elementMetric, intersect, metricsProblems, probePoint, truncatedText, visiblePart, visibleRatio,
  type AuditMetrics, type RawElement,
} from './e2e/audit/metrics';

const VIEWPORT = { width: 390, height: 844 };
const raw = (over: Partial<RawElement> = {}): RawElement => ({
  kind: 'interactive', role: 'button', name: 'GO', testId: 'go', rect: { x: 10, y: 10, width: 100, height: 44 },
  clips: [], overflowX: 0, overflowY: 0, ...over,
});

function metrics(over: Partial<AuditMetrics> = {}): AuditMetrics {
  const elements = [elementMetric(raw(), VIEWPORT, false), elementMetric(raw({ kind: 'heading', role: 'heading' }), VIEWPORT, false)];
  return {
    cell: { stage: 'opening', fixture: 'tick-0', project: 'phone', viewport: VIEWPORT },
    wallMs: { boot: 200, audit: 150, total: 350 },
    axe: { violations: [], contrastIncomplete: [], violationCount: 0 },
    aria: { lines: 4 }, page: { overflowX: 0, truncatedText: [] },
    counts: countMetrics(elements, [12, 14]), fontSizes: [12, 14], elements, ...over,
  };
}

describe('first viewport', () => {
  it('intersects rects and returns an empty rect when they do not meet', () => {
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 5, height: 5 }).width).toBe(0);
  });

  it('clips by the window and by every pane the element scrolls in', () => {
    const rect = { x: 0, y: 800, width: 100, height: 88 };
    // Half below the window.
    expect(visibleRatio(rect, [], VIEWPORT)).toBe(0.5);
    // The phone's primary scroll ends at the tab bar (y 800): the same element is then not visible at all.
    const primary = { x: 0, y: 60, width: 390, height: 740 };
    expect(visibleRatio(rect, [primary], VIEWPORT)).toBe(0);
    expect(visiblePart({ x: 0, y: 700, width: 100, height: 200 }, [primary], VIEWPORT)).toEqual({ x: 0, y: 700, width: 100, height: 100 });
  });

  it('treats a zero-area element as not visible rather than dividing by zero', () => {
    expect(visibleRatio({ x: 0, y: 0, width: 0, height: 10 }, [], VIEWPORT)).toBe(0);
  });

  it('probes the centre of the visible part, and nothing when none is visible', () => {
    expect(probePoint({ x: 0, y: 800, width: 100, height: 88 }, [], VIEWPORT)).toEqual({ x: 50, y: 822 });
    expect(probePoint({ x: 0, y: 900, width: 100, height: 44 }, [], VIEWPORT)).toBeNull();
  });
});

describe('element metric', () => {
  it('flags a control under 44px on its shorter side, never a heading', () => {
    expect(elementMetric(raw({ rect: { x: 0, y: 0, width: 120, height: 43.5 } }), VIEWPORT, false).underTarget).toBe(true);
    expect(elementMetric(raw(), VIEWPORT, false).underTarget).toBe(false);
    expect(elementMetric(raw({ kind: 'heading', rect: { x: 0, y: 0, width: 120, height: 22 } }), VIEWPORT, false).underTarget).toBe(false);
  });

  it('calls a box truncated only past one pixel of rounding', () => {
    expect(elementMetric(raw({ overflowX: 1 }), VIEWPORT, false).truncated).toEqual({ x: false, y: false });
    expect(elementMetric(raw({ overflowX: 2, overflowY: 30 }), VIEWPORT, false).truncated).toEqual({ x: true, y: true });
  });

  it('counts an element as in the first viewport only when it is fully visible', () => {
    expect(elementMetric(raw(), VIEWPORT, false).inFirstViewport).toBe(true);
    const half = elementMetric(raw({ rect: { x: 0, y: 822, width: 100, height: 44 } }), VIEWPORT, false);
    expect(half.visibleRatio).toBe(0.5);
    expect(half.inFirstViewport).toBe(false);
  });
});

describe('counts', () => {
  it('reports distinct positive font sizes in order', () => {
    expect(distinctSizes([14, 12, 14, 0, Number.NaN, 10])).toEqual([10, 12, 14]);
  });

  it('keeps only clipped text past the rounding slack', () => {
    const runs = [{ testId: 'a', text: 'x', overflowX: 1, overflowY: 0 }, { testId: 'b', text: 'y', overflowX: 544, overflowY: 0 }];
    expect(truncatedText(runs).map((run) => run.testId)).toEqual(['b']);
  });

  it('counts by kind, size, occlusion and truncation', () => {
    const elements = [
      elementMetric(raw({ rect: { x: 0, y: 0, width: 20, height: 20 } }), VIEWPORT, true),
      elementMetric(raw({ rect: { x: 0, y: 900, width: 100, height: 44 } }), VIEWPORT, null),
      elementMetric(raw({ kind: 'heading', overflowY: 10 }), VIEWPORT, false),
    ];
    expect(countMetrics(elements, [12, 12, 14])).toEqual({
      interactive: 2, interactiveInFirstViewport: 1, headings: 1, headingsInFirstViewport: 1,
      underTarget: 1, underWcagTarget: 1, occluded: 1, truncated: 1, truncatedText: 0, distinctFontSizes: 2,
    });
  });
});

describe('metricsProblems', () => {
  it('accepts a well-formed result', () => {
    expect(metricsProblems(metrics())).toEqual([]);
  });

  it.each([
    ['empty aria snapshot', { aria: { lines: 0 } }],
    ['axe count disagrees with violations', { axe: { violations: [], contrastIncomplete: [], violationCount: 1 } }],
    ['font sizes disagree with their count', { fontSizes: [12] }],
    ['truncated text disagrees with its count', { page: { overflowX: 0, truncatedText: [{ testId: null, text: 't', overflowX: 9, overflowY: 0 }] } }],
    ['wall time audit not measured', { wallMs: { boot: 1, audit: Number.NaN, total: 1 } }],
    ['viewport not measured', { cell: { stage: 's', fixture: 'f', project: 'p', viewport: { width: 0, height: 844 } } }],
  ] as const)('reports %s', (problem, over) => {
    expect(metricsProblems(metrics(over as Partial<AuditMetrics>))).toContain(problem);
  });

  it('reports a page with no controls, counts that disagree, and a visible element never hit-tested', () => {
    const good = metrics();
    expect(metricsProblems(metrics({ elements: [], counts: countMetrics([], good.fontSizes) }))).toContain('no interactive element found');
    expect(metricsProblems(metrics({ elements: good.elements.slice(0, 1) }))).toContain('counts disagree with elements');
    const untested = [elementMetric(raw(), VIEWPORT, null), ...good.elements.slice(1)];
    expect(metricsProblems(metrics({ elements: untested }))).toContain('visible element not hit-tested: GO');
  });
});

describe('gallery', () => {
  const card = (stage: string, project: string): GalleryCard => {
    const base = metrics();
    return { metrics: { ...base, cell: { ...base.cell, stage, project } }, screenshotPng: Buffer.from('png'), aria: '- button "<GO>"', status: 'passed' };
  };

  it('escapes every test-supplied string and inlines the screenshot', () => {
    const html = renderGallery([card('<script>x</script>', 'phone')], '2026-11-19T00:00:00.000Z');
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&#60;script&#62;x');
    expect(html).toContain('- button &#34;&#60;GO&#62;&#34;');
    expect(html).toContain('src="data:image/png;base64,' + Buffer.from('png').toString('base64') + '"');
  });

  it('orders cards by stage, then project, so one stage reads side by side', () => {
    const html = renderGallery([card('phase-2-mid', 'phone'), card('ending', 'phone'), card('ending', 'desktop')], 'now');
    const order = [...html.matchAll(/<h2>([^<]+) <small>(\w+)/g)].map((match) => `${match[1] ?? ''}/${match[2] ?? ''}`);
    expect(order).toEqual(['ending/desktop', 'ending/phone', 'phase-2-mid/phone']);
  });
});
