/**
 * Measured hard-gate failures of today's UI (#341), recorded rather than hidden: the gates keep their voted
 * thresholds and every row stays in the table. Each entry is asserted to STILL fail, so a fix flips the cell and
 * forces the entry out. `measured` is what the first atlas run recorded; `issue` is the filed issue the fix lands under
 * (the first audit, #343, filed them); a new entry needs its issue filed first.
 * Do not add an entry to get green without measuring it, and never loosen a threshold instead.
 */
import type { GateFailure, GateRule } from './gates';

export type GatedViewport = '390x844' | '1440x900';

/** A GitHub issue reference, '#' and a positive decimal: the `#${number}` type also admits '#0' or '#1e3'. */
export const ISSUE_REF = /^#[1-9]\d*$/;

interface GapBase {
  stage: string; viewport: GatedViewport; item: string;
  measured: string; reason: string; issue: `#${number}`;
}

/**
 * An axe gap records the exact violating nodes (count and the targets axe samples), so a NEW node under the same
 * rule on the same cell is not waived by it: only the measured failure is recorded, never the whole rule.
 */
export interface AxeNodes { count: number; targets: readonly string[] }

/**
 * Generic over the rule set, so the transitions spec records its gaps (transitionGaps.ts) under the same rules.
 * Distributes over the union: for the atlas rules an `axe` entry must carry `axeNodes`; every other rule must not.
 */
export type KnownGap<R extends string = GateRule> = GapBase & (R extends 'axe' ? { rule: R; axeNodes: AxeNodes } : { rule: R });

const LABEL = 'the menu button reads "[ SAVES ]" but is named "Save code transfer" (WCAG 2.5.3); no other spec opens the root menu with axe';
const SAVES_NODE = { count: 1, targets: ['button[aria-label="Save code transfer"]'] } as const;
const STANDING = 'the Review standing panel is fifth in the CORE pane, below the job, pilot, pilot service and service panels (about 1.9k px down at 1440, 3k at 390); nothing in the chrome names it';
const RECALL = 'the recall announcement is inside that Review standing panel, so it shares its place far below the fold; it is an alert but nothing in the chrome carries it';

export const KNOWN_GAPS: readonly KnownGap[] = [
  { stage: 'menu-hazard-status', viewport: '390x844', item: 'label-content-name-mismatch', rule: 'axe', axeNodes: SAVES_NODE, measured: '1 node: button[aria-label="Save code transfer"]', reason: LABEL, issue: '#366' },
  { stage: 'menu-hazard-status', viewport: '1440x900', item: 'label-content-name-mismatch', rule: 'axe', axeNodes: SAVES_NODE, measured: '1 node: button[aria-label="Save code transfer"]', reason: LABEL, issue: '#366' },
  { stage: 'route-standing-restricted', viewport: '390x844', item: 'route.standing', rule: 'timely-fold', measured: 'box 46,2897,298,22; visibleRatio 0; fold 844', reason: STANDING, issue: '#367' },
  { stage: 'route-standing-restricted', viewport: '1440x900', item: 'route.standing', rule: 'timely-fold', measured: 'box 386,1883,668,22; visibleRatio 0; fold 900', reason: STANDING, issue: '#367' },
  { stage: 'route-recall-announced', viewport: '390x844', item: 'route.standing', rule: 'timely-fold', measured: 'box 46,3077,298,22; visibleRatio 0; fold 844', reason: STANDING, issue: '#367' },
  { stage: 'route-recall-announced', viewport: '1440x900', item: 'route.standing', rule: 'timely-fold', measured: 'box 386,1968,668,22; visibleRatio 0; fold 900', reason: STANDING, issue: '#367' },
  { stage: 'route-recall-announced', viewport: '390x844', item: 'route.recall', rule: 'timely-fold', measured: 'box 46,3425,298,584; visibleRatio 0; fold 844', reason: RECALL, issue: '#367' },
  { stage: 'route-recall-announced', viewport: '1440x900', item: 'route.recall', rule: 'timely-fold', measured: 'box 386,2184,668,254; visibleRatio 0; fold 900', reason: RECALL, issue: '#367' },
];

const gapKey = (entry: { stage: string; viewport: string; rule: string; item: string }): string =>
  [entry.stage, entry.viewport, entry.rule, entry.item].join('|');

/** Splits one cell's failures into new ones and recorded ones, and lists recorded gaps the cell no longer shows. */
export function reconcile<F extends GateFailure<string>, G extends KnownGap<string>>(failures: readonly F[], gaps: readonly G[], stage: string, viewport: string):
  { unexpected: F[]; known: F[]; fixed: G[] } {
  const cellGaps = gaps.filter((gap) => gap.stage === stage && gap.viewport === viewport);
  const isKnown = (failure: F): boolean => cellGaps.some((gap) => matches(failure, gap));
  return {
    unexpected: failures.filter((failure) => !isKnown(failure)),
    known: failures.filter(isKnown),
    fixed: cellGaps.filter((gap) => !failures.some((failure) => matches(failure, gap))),
  };
}

const hasAxeNodes = (gap: object): gap is { axeNodes: AxeNodes } => 'axeNodes' in gap;

/** Same cell, rule and item; for axe also the same violating nodes, so a gap never waives a rule wholesale. */
function matches(failure: GateFailure<string>, gap: KnownGap<string>): boolean {
  if (gapKey(failure) !== gapKey(gap)) return false;
  if (failure.rule !== 'axe') return true;
  return hasAxeNodes(gap) && failure.measured.value === gap.axeNodes.count && failure.measured.detail === gap.axeNodes.targets.join(' | ');
}

export function describeGap(gap: KnownGap<string>): string {
  return `${gap.stage} @ ${gap.viewport} | ${gap.item} | ${gap.rule} | recorded ${gap.measured}`;
}
