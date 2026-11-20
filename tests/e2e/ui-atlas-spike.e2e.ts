/**
 * Spike for the stage atlas (#338, map #327): the audit helper and its gallery over three existing fixtures,
 * the opening, a Phase 2 mid-game save and an ending, at the phone and desktop projects (390x844, 1440x900).
 *
 * It REPORTS: every figure goes to the metrics attachment, an annotation and the gallery
 * (test-results/ui-atlas/index.html). It asserts only that the audit ran and its metrics are well formed;
 * the per-stage contract and the real gates belong to a later ticket, on a typed manifest under tests/e2e/.
 */
import { audit, openAuditCell } from './audit/audit';
import { metricsProblems, type AuditCell } from './audit/metrics';
import { expect, test } from './helpers';

const CELLS: AuditCell[] = [
  { stage: 'opening', fixture: 'tick-0' },
  { stage: 'phase-2-mid', fixture: 'epistemic-ready-p2' },
  { stage: 'ending', fixture: 'ending-shipped', ending: true },
];

// Scramble and decrypt effects honour reduced motion, so the frozen frame is the settled text.
test.use({ reducedMotion: 'reduce' });

for (const cell of CELLS) {
  test(`ui audit ${cell.stage}`, async ({ page }) => {
    const bootMs = await openAuditCell(page, cell);
    const metrics = await audit(page, cell, bootMs);
    const { counts, axe, page: view, wallMs } = metrics;
    test.info().annotations.push({ type: 'ui-audit', description: JSON.stringify({ stage: cell.stage, wallMs,
      axeViolations: axe.violationCount, contrastIncomplete: axe.contrastIncomplete.length, overflowX: view.overflowX, ...counts }) });
    expect(metricsProblems(metrics)).toEqual([]);
  });
}
