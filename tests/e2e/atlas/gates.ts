/**
 * The atlas gates (#336, #340) and reported metrics, as pure functions over one cell's measurements. Hard at
 * 390x844 and 1440x900: axe 0 violations; every interactive element at least 44x44 CSS px; at most 3 distinct
 * content font sizes; every contract timely item fully in the first viewport; disabled and inactive text at least
 * 3:1; and every contract item present. Hidden, inert and under-dialog elements are left out of the geometry and
 * visual gates and counted separately. Reported only: the Hick curve, Cowan groups, the largest-size count,
 * controls under a dialog and the role-less fallback count. Unit-tested in tests/ui-atlas-gates.spec.ts.
 */
import { TARGET_MIN, distinctSizes, type AuditMetrics, type Rect } from '../audit/metrics';
import type { ItemMeasure } from './contractCheck';

export const FONT_SIZE_MAX = 3;
export const INACTIVE_CONTRAST_MIN = 3;
/** The Hick flag: a stage-to-stage rise in enabled first-viewport actions above this is shown to the panel. */
export const HICK_JUMP_MAX = 3;
/** The Cowan flag: more live numbers than this in one labelled group is shown to the panel. */
export const COWAN_MAX = 4;

export type GateRule = 'axe' | 'target-size' | 'font-sizes' | 'timely-fold' | 'inactive-contrast' | 'contract-item';

/** One failure, generic over its rule set so the transitions spec (transitionCheck.ts) reports in the same shape. */
export interface GateFailure<R extends string = GateRule> {
  stage: string; viewport: string; item: string; rule: R;
  measured: { box?: Rect | null; visibleRatio?: number; fold?: number | null; value?: number | string; detail?: string };
  /** The gallery card's id: `#<stage>--<viewport>`. */
  anchor: string;
}

export interface CellInput { stage: string; viewport: string; metrics: AuditMetrics; items: readonly ItemMeasure[] }

export const cellAnchor = (stage: string, viewport: string): string => `${stage}--${viewport}`;

/** Every hard-gate failure in one cell, in a stable order. */
export function gateFailures(input: CellInput): GateFailure[] {
  const { stage, viewport, metrics, items } = input;
  const anchor = cellAnchor(stage, viewport);
  const fail = (item: string, rule: GateRule, measured: GateFailure['measured']): GateFailure => ({ stage, viewport, item, rule, measured, anchor });
  const gated = metrics.elements.filter((element) => element.excluded === null);
  const sizes = distinctSizes(metrics.contentFontSizes);
  return [
    ...metrics.axe.violations.map((violation) => fail(violation.id, 'axe', { value: violation.nodes, detail: violation.sample.join(' | ') })),
    ...gated.filter((element) => element.kind === 'interactive' && element.minSide < TARGET_MIN)
      .map((element) => fail(element.testId ?? element.name, 'target-size', { box: element.box, value: element.minSide })),
    ...(sizes.length > FONT_SIZE_MAX ? [fail('page', 'font-sizes', { value: sizes.length, detail: sizes.join(', ') })] : []),
    ...items.filter((item) => !item.found).map((item) => fail(item.key, 'contract-item', { detail: item.locate })),
    ...items.filter((item) => item.found && item.kind === 'timely' && !item.inFirstViewport)
      .map((item) => fail(item.key, 'timely-fold', { box: item.box, visibleRatio: item.visibleRatio, fold: item.fold })),
    ...gated.filter((element) => element.textContrast !== null && element.textContrast < INACTIVE_CONTRAST_MIN)
      .map((element) => fail(element.testId ?? element.name, 'inactive-contrast', { box: element.box, value: element.textContrast ?? 0 })),
  ];
}

/** One line a reviewer can act on: where, what, which rule, the numbers, and the gallery card. */
export function formatFailure(failure: GateFailure<string>): string {
  const { measured } = failure;
  const parts = [
    measured.box ? `box ${[measured.box.x, measured.box.y, measured.box.width, measured.box.height].map((v) => String(Math.round(v))).join(',')}` : '',
    measured.visibleRatio === undefined ? '' : `visibleRatio ${String(measured.visibleRatio)}`,
    measured.fold === undefined || measured.fold === null ? '' : `fold ${String(measured.fold)}`,
    measured.value === undefined ? '' : `value ${String(measured.value)}`,
    measured.detail === undefined ? '' : measured.detail,
  ].filter((part) => part !== '');
  return `${failure.stage} @ ${failure.viewport} | ${failure.item} | ${failure.rule} | ${parts.join('; ')} | gallery #${failure.anchor}`;
}

export interface Reported {
  /** Enabled controls fully in the first viewport, not hidden and not under a dialog (the Hick curve). */
  hick: number;
  /** Text runs at the largest content size. */
  largestSizeCount: number;
  /** Controls behind an open dialog, and controls hidden from assistive technology, left out of the gates. */
  underModal: number; hidden: number;
  /** Contract items found by a fallback locator rather than role and name. */
  roleLess: number;
  /** Timely items not fully in the first viewport (gated at 390x844 and 1440x900, reported elsewhere). */
  timelyOutsideFold: number;
}

export function reported(metrics: AuditMetrics, items: readonly ItemMeasure[]): Reported {
  const interactive = metrics.elements.filter((element) => element.kind === 'interactive');
  const largest = Math.max(0, ...metrics.contentFontSizes);
  return {
    hick: interactive.filter((element) => element.excluded === null && !element.disabled && element.inFirstViewport).length,
    largestSizeCount: metrics.contentFontSizes.filter((size) => size === largest).length,
    underModal: interactive.filter((element) => element.excluded === 'under-modal').length,
    hidden: interactive.filter((element) => element.excluded === 'hidden').length,
    roleLess: items.filter((item) => item.fallback).length,
    timelyOutsideFold: items.filter((item) => item.found && item.kind === 'timely' && !item.inFirstViewport).length,
  };
}

/** Stage-to-stage Hick jumps above the flag, in table order, for one viewport. */
export function hickJumps(curve: readonly { stage: string; hick: number }[]): { from: string; to: string; jump: number }[] {
  return curve.slice(1).flatMap((point, index) => {
    const previous = curve[index];
    const jump = previous === undefined ? 0 : point.hick - previous.hick;
    return previous !== undefined && jump > HICK_JUMP_MAX ? [{ from: previous.stage, to: point.stage, jump }] : [];
  });
}

/** Labelled groups holding more live numbers than the Cowan flag. */
export function cowanFlags(groups: readonly { group: string; live: number }[]): { group: string; live: number }[] {
  return groups.filter((entry) => entry.live > COWAN_MAX);
}
