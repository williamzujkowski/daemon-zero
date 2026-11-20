/** The stage atlas's pure rules (#336, #340, #341): each hard gate and its exclusions, the failure line, the
 *  known-gap reconciliation, the reported Hick and Cowan flags and partial ARIA templates. */
import { describe, expect, it } from 'vitest';
import { countMetrics, elementMetric, type AuditMetrics, type RawElement } from './e2e/audit/metrics';
import { expectedTemplate, parseBaseline, renderBaseline, templateLine } from './e2e/atlas/ariaTemplate';
import type { ItemMeasure } from './e2e/atlas/contractCheck';
import { cowanFlags, formatFailure, gateFailures, hickJumps, reported } from './e2e/atlas/gates';
import { KNOWN_GAPS, reconcile, type KnownGap } from './e2e/atlas/knownGaps';
import { isStageId } from './e2e/atlas/types';
import { summarize } from './e2e/audit/atlasCard';

const VIEWPORT = { width: 390, height: 844 };
const raw = (over: Partial<RawElement> = {}): RawElement => ({
  kind: 'interactive', role: 'button', name: 'GO', testId: 'go', rect: { x: 10, y: 10, width: 100, height: 44 },
  clips: [], overflowX: 0, overflowY: 0, excluded: null, disabled: false, inactive: false, textContrast: null, ...over,
});

function metrics(elements: RawElement[], contentFontSizes = [12, 14], violations: AuditMetrics['axe']['violations'] = []): AuditMetrics {
  const measured = elements.map((element) => elementMetric(element, VIEWPORT, false));
  return {
    cell: { stage: 'p0-cold-start', fixture: 'fixture:tick-0', project: 'phone', viewport: VIEWPORT },
    wallMs: { boot: 1, audit: 1, total: 2 }, axe: { violations, contrastIncomplete: [], violationCount: violations.length },
    aria: { lines: 3 }, page: { overflowX: 0, truncatedText: [] }, counts: countMetrics(measured, contentFontSizes),
    fontSizes: [...new Set(contentFontSizes)], contentFontSizes, dialogOpen: false, elements: measured,
  };
}

const measure = (over: Partial<ItemMeasure> = {}): ItemMeasure => ({
  key: 'hud.cycles', kind: 'timely', locate: 'test id res-cycles', fallback: true, found: true,
  box: { x: 0, y: 70, width: 100, height: 20 }, visibleRatio: 1, fold: 844, inFirstViewport: true, rank: 30, aria: "- 'text'", ...over,
});

const cell = (m: AuditMetrics, items: ItemMeasure[] = []) => ({ stage: 'p0-cold-start', viewport: '390x844', metrics: m, items });

describe('hard gates', () => {
  it('passes a clean cell', () => {
    expect(gateFailures(cell(metrics([raw()]), [measure()]))).toEqual([]);
  });

  it('fails a control under 44 px, but not one that is hidden or behind a dialog', () => {
    const small = { x: 0, y: 0, width: 40, height: 30 };
    const failures = gateFailures(cell(metrics([raw({ rect: small, testId: 'tiny' }), raw({ rect: small, excluded: 'hidden' }), raw({ rect: small, excluded: 'under-modal' })])));
    expect(failures.map((failure) => [failure.rule, failure.item, failure.measured.value])).toEqual([['target-size', 'tiny', 30]]);
  });

  it('fails more than three content font sizes, counting each size once', () => {
    expect(gateFailures(cell(metrics([raw()], [10, 12, 14, 14, 12])))).toEqual([]);
    const failures = gateFailures(cell(metrics([raw()], [10, 12, 14, 16])));
    expect(failures.map((failure) => [failure.rule, failure.measured.detail])).toEqual([['font-sizes', '10, 12, 14, 16']]);
  });

  it('fails every axe violation by rule id', () => {
    const violation = { id: 'label-content-name-mismatch', impact: 'serious', help: 'h', nodes: 1, sample: ['button'] };
    expect(gateFailures(cell(metrics([raw()], [12], [violation])))[0]).toMatchObject({ rule: 'axe', item: 'label-content-name-mismatch' });
  });

  it('fails a timely item not fully in the first viewport, and a missing item of any kind', () => {
    const items = [measure({ inFirstViewport: false, visibleRatio: 0.4, box: { x: 0, y: 820, width: 100, height: 40 } }),
      measure({ key: 'core.cycle', kind: 'primary', inFirstViewport: false }), measure({ key: 'chrome.status', kind: 'region', found: false, locate: 'region /x/' })];
    const failures = gateFailures(cell(metrics([raw()]), items));
    expect(failures.map((failure) => [failure.rule, failure.item])).toEqual([['contract-item', 'chrome.status'], ['timely-fold', 'hud.cycles']]);
  });

  it('fails disabled or inactive text under 3:1, but not text behind a dialog', () => {
    const failures = gateFailures(cell(metrics([raw({ disabled: true, textContrast: 2.5, testId: 'dim' }), raw({ inactive: true, textContrast: 3 }),
      raw({ disabled: true, textContrast: 1.2, excluded: 'under-modal' })])));
    expect(failures.map((failure) => [failure.rule, failure.item, failure.measured.value])).toEqual([['inactive-contrast', 'dim', 2.5]]);
  });

  it('formats a failure with the stage, viewport, item, rule, numbers and gallery anchor', () => {
    const [failure] = gateFailures(cell(metrics([raw()]), [measure({ inFirstViewport: false, visibleRatio: 0, fold: 799, box: { x: 46.4, y: 2897, width: 298, height: 22 } })]));
    expect(failure === undefined ? '' : formatFailure(failure))
      .toBe('p0-cold-start @ 390x844 | hud.cycles | timely-fold | box 46,2897,298,22; visibleRatio 0; fold 799 | gallery #p0-cold-start--390x844');
  });
});

describe('known gaps', () => {
  const gap = (over: Partial<KnownGap> = {}): KnownGap => ({ stage: 'p0-cold-start', viewport: '390x844', item: 'hud.cycles', rule: 'timely-fold',
    measured: 'm', reason: 'r', issue: 'pending-audit', ...over });
  const failing = gateFailures(cell(metrics([raw()]), [measure({ inFirstViewport: false })]));

  it('separates recorded failures from new ones', () => {
    expect(reconcile(failing, [gap()], 'p0-cold-start', '390x844')).toMatchObject({ unexpected: [], fixed: [] });
    expect(reconcile(failing, [], 'p0-cold-start', '390x844').unexpected).toHaveLength(1);
  });

  it('reports a recorded gap the cell no longer shows, so a fix forces the entry out', () => {
    expect(reconcile([], [gap()], 'p0-cold-start', '390x844').fixed).toHaveLength(1);
    expect(reconcile([], [gap({ viewport: '1440x900' })], 'p0-cold-start', '390x844').fixed).toEqual([]);
  });

  it('holds only well-formed entries: kebab-case stages, gated viewports, no repeats, a reason each', () => {
    const seen = new Set(KNOWN_GAPS.map((entry) => [entry.stage, entry.viewport, entry.rule, entry.item].join('|')));
    expect(seen.size).toBe(KNOWN_GAPS.length);
    for (const entry of KNOWN_GAPS) {
      expect(isStageId(entry.stage)).toBe(true);
      expect(['390x844', '1440x900']).toContain(entry.viewport);
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });
});

describe('reported metrics', () => {
  it('counts enabled first-viewport controls, largest-size runs, controls left out and fallbacks', () => {
    const m = metrics([raw(), raw({ disabled: true }), raw({ rect: { x: 0, y: 900, width: 100, height: 44 } }), raw({ excluded: 'under-modal' }), raw({ excluded: 'hidden' })], [12, 14, 14]);
    expect(reported(m, [measure(), measure({ key: 'b', fallback: false, inFirstViewport: false })])).toEqual({
      hick: 1, largestSizeCount: 2, underModal: 1, hidden: 1, roleLess: 1, timelyOutsideFold: 1,
    });
  });

  it('flags a Hick jump above 3 between consecutive stages, and a Cowan group above 4', () => {
    expect(hickJumps([{ stage: 'a', hick: 2 }, { stage: 'b', hick: 5 }, { stage: 'c', hick: 9 }])).toEqual([{ from: 'b', to: 'c', jump: 4 }]);
    expect(cowanFlags([{ group: 'strip', live: 5 }, { group: 'pane', live: 4 }])).toEqual([{ group: 'strip', live: 5 }]);
  });

  it('summarises a run per viewport in table order', () => {
    const record = (stage: string, order: number, hick: number) => ({ order, stage, viewport: '390x844', project: 'phone', mode: 'gate' as const, source: 's', why: 'w',
      tags: [], surfaces: [], top: null, items: [], failures: [], knownGaps: [],
      reported: { hick, largestSizeCount: 0, underModal: 0, hidden: 0, roleLess: 0, timelyOutsideFold: 0, cowan: [], cowanFlags: [{ group: 'g', live: 6 }] } });
    const summary = summarize([record('late', 1, 9), record('early', 0, 1)]);
    expect(summary.hickJumps).toEqual([{ viewport: '390x844', from: 'early', to: 'late', jump: 8 }]);
    expect(summary.cowanFlags).toHaveLength(2);
  });
});

describe('partial ARIA templates', () => {
  it('keeps role, name and meaningful states, and drops content and layout', () => {
    expect(templateLine('- button "[ MENU ] Game menu" [expanded]: "[ MENU ]"')).toBe("- 'button \"[ MENU ] Game menu\" [expanded]'");
    expect(templateLine('- dialog "Game menu":\n  - heading "GAME MENU" [level=1]')).toBe("- 'dialog \"Game menu\"'");
    expect(templateLine('- heading "X" [level=2] [box=1,2,3,4]')).toBe("- 'heading \"X\" [level=2]'");
  });

  it('turns numbers into patterns and undoes YAML quoting', () => {
    expect(templateLine("- 'meter \"Thermal: 54.9 °C\"': 54.9 °C")).toBe("- 'meter /^Thermal: \\d[\\d.,]* °C$/'");
    expect(templateLine("- 'button \"Take the Cryo-Bank''s Power\"'")).toBe("- 'button \"Take the Cryo-Bank''s Power\"'");
    expect(templateLine('- button "[ PROC 1,520 ] Manage"')).toBe("- 'button /^\\[ PROC \\d[\\d.,]* \\] Manage$/'");
  });

  it('pins nothing for a role-less readout, which has no node of its own', () => {
    expect(templateLine('- text: CYC 18')).toBeNull();
  });

  it('refuses what it cannot read', () => {
    expect(templateLine('')).toBeNull();
    expect(templateLine('- Button "x"')).toBeNull();
  });

  it('merges agreeing projects into one line and keeps disagreeing ones apart', () => {
    const lines = [
      { stage: 's', item: 'a', project: 'phone', template: 't1' }, { stage: 's', item: 'a', project: 'desktop', template: 't1' },
      { stage: 's', item: 'b', project: 'phone', template: 'p' }, { stage: 's', item: 'b', project: 'desktop', template: 'd' },
      { stage: 's', item: 'c', project: 'phone', template: 'only' },
    ];
    const text = renderBaseline(lines, ['desktop', 'phone'], '# header\n');
    expect(text).toBe('# header\ns a * t1\ns b desktop d\ns b phone p\ns c phone only\n');
    const parsed = parseBaseline(text);
    expect(expectedTemplate(parsed, 's', 'a', 'phone')).toBe('t1');
    expect(expectedTemplate(parsed, 's', 'b', 'desktop')).toBe('d');
    expect(expectedTemplate(parsed, 's', 'c', 'desktop')).toBeUndefined();
  });
});
