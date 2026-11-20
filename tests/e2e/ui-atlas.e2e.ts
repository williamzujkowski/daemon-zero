/**
 * The stage atlas (#341, map #327): every P1 row of the stage inventory at the phone (390x844) and desktop
 * (1440x900) projects, on a paused clock, held to the voted hard gates (axe, 44 px targets, at most three content
 * font sizes, every contract timely item in the first viewport, disabled and inactive text at 3:1, every contract
 * item present) and to the committed partial ARIA baseline. A failure the UI has today is recorded in KNOWN_GAPS and
 * asserted to still fail; anything else fails the run with stage, viewport, item, rule, numbers and gallery anchor.
 * Evidence per cell goes to test-results/ui-atlas/ (gitignored): see docs/TESTING.md, "Stage atlas".
 */
import { metricsProblems } from './audit/metrics';
import { checkAria } from './atlas/ariaCheck';
import { attachRecord, readLive, runCell } from './atlas/cell';
import { formatFailure } from './atlas/gates';
import { describeGap, KNOWN_GAPS, reconcile } from './atlas/knownGaps';
import { STAGES, tableProblems } from './atlas/stages';
import { expect, test } from './helpers';

// Scramble and decrypt effects honour reduced motion, so the frozen frame is the settled text.
test.use({ reducedMotion: 'reduce' });

test('the stage table is sound, and every recorded gap names one of its rows', () => {
  expect(tableProblems(STAGES)).toEqual([]);
  const ids = new Set(STAGES.map((row) => row.id));
  expect(KNOWN_GAPS.filter((gap) => !ids.has(gap.stage)).map(describeGap)).toEqual([]);
});

for (const [order, row] of STAGES.entries()) {
  test(`atlas ${row.id}`, async ({ page }, info) => {
    test.skip(row.phoneOnly === true && info.project.name !== 'phone', 'only the phone tier renders this surface');
    const { metrics, record, contract } = await runCell(page, row, order, 'gate');
    const { unexpected, known, fixed } = reconcile(record.failures, KNOWN_GAPS, row.id, record.viewport);
    record.knownGaps = known.map(formatFailure);
    await checkAria(page, contract, record);
    await readLive(page, record);
    await attachRecord(record);
    expect(metricsProblems(metrics)).toEqual([]);
    expect(unexpected.map(formatFailure), 'hard-gate failures not recorded in KNOWN_GAPS').toEqual([]);
    expect(fixed.map(describeGap), 'recorded gaps this cell no longer shows: remove them from KNOWN_GAPS').toEqual([]);
  });
}
