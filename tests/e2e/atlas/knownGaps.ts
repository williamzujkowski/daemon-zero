/**
 * Measured hard-gate failures of today's UI (#341), recorded rather than hidden: the gates keep their voted
 * thresholds and every row stays in the table. Each entry is asserted to STILL fail, so a fix flips the cell and
 * forces the entry out. `measured` is what the first atlas run recorded; `issue` is filled in by the audit ticket.
 * Do not add an entry to get green without measuring it, and never loosen a threshold instead.
 */
import type { GateFailure, GateRule } from './gates';

export type GatedViewport = '390x844' | '1440x900';

export interface KnownGap {
  stage: string; viewport: GatedViewport; item: string; rule: GateRule;
  measured: string; reason: string; issue: 'pending-audit' | `#${number}`;
}

const LABEL = 'the menu button reads "[ SAVES ]" but is named "Save code transfer" (WCAG 2.5.3); no other spec opens the root menu with axe';
const STANDING = 'the Review standing panel is fifth in the CORE pane, below the job, pilot, pilot service and service panels (about 1.9k px down at 1440, 3k at 390); nothing in the chrome names it';
const RECALL = 'the recall announcement is inside that Review standing panel, so it shares its place far below the fold; it is an alert but nothing in the chrome carries it';

export const KNOWN_GAPS: readonly KnownGap[] = [
  { stage: 'menu-hazard-status', viewport: '390x844', item: 'label-content-name-mismatch', rule: 'axe', measured: '1 node: button[aria-label="Save code transfer"]', reason: LABEL, issue: 'pending-audit' },
  { stage: 'menu-hazard-status', viewport: '1440x900', item: 'label-content-name-mismatch', rule: 'axe', measured: '1 node: button[aria-label="Save code transfer"]', reason: LABEL, issue: 'pending-audit' },
  { stage: 'route-standing-restricted', viewport: '390x844', item: 'route.standing', rule: 'timely-fold', measured: 'box 46,2897,298,22; visibleRatio 0; fold 844', reason: STANDING, issue: 'pending-audit' },
  { stage: 'route-standing-restricted', viewport: '1440x900', item: 'route.standing', rule: 'timely-fold', measured: 'box 386,1883,668,22; visibleRatio 0; fold 900', reason: STANDING, issue: 'pending-audit' },
  { stage: 'route-recall-announced', viewport: '390x844', item: 'route.standing', rule: 'timely-fold', measured: 'box 46,3077,298,22; visibleRatio 0; fold 844', reason: STANDING, issue: 'pending-audit' },
  { stage: 'route-recall-announced', viewport: '1440x900', item: 'route.standing', rule: 'timely-fold', measured: 'box 386,1968,668,22; visibleRatio 0; fold 900', reason: STANDING, issue: 'pending-audit' },
  { stage: 'route-recall-announced', viewport: '390x844', item: 'route.recall', rule: 'timely-fold', measured: 'box 46,3425,298,584; visibleRatio 0; fold 844', reason: RECALL, issue: 'pending-audit' },
  { stage: 'route-recall-announced', viewport: '1440x900', item: 'route.recall', rule: 'timely-fold', measured: 'box 386,2184,668,254; visibleRatio 0; fold 900', reason: RECALL, issue: 'pending-audit' },
];

const gapKey = (entry: { stage: string; viewport: string; rule: string; item: string }): string =>
  [entry.stage, entry.viewport, entry.rule, entry.item].join('|');

/** Splits one cell's failures into new ones and recorded ones, and lists recorded gaps the cell no longer shows. */
export function reconcile(failures: readonly GateFailure[], gaps: readonly KnownGap[], stage: string, viewport: string):
  { unexpected: GateFailure[]; known: GateFailure[]; fixed: KnownGap[] } {
  const recorded = new Set(gaps.filter((gap) => gap.stage === stage && gap.viewport === viewport).map(gapKey));
  const seen = new Set(failures.map(gapKey));
  return {
    unexpected: failures.filter((failure) => !recorded.has(gapKey(failure))),
    known: failures.filter((failure) => recorded.has(gapKey(failure))),
    fixed: gaps.filter((gap) => gap.stage === stage && gap.viewport === viewport && !seen.has(gapKey(gap))),
  };
}

export function describeGap(gap: KnownGap): string {
  return `${gap.stage} @ ${gap.viewport} | ${gap.item} | ${gap.rule} | recorded ${gap.measured}`;
}
