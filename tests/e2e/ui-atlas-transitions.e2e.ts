/**
 * The stage atlas's transitions (#339, wayfinder #341): each row of atlas/transitions.ts at the phone (390x844) and
 * desktop (1440x900) projects, on a paused clock. The before-state is an atlas stage (or a named fixture), the
 * trigger a real UI action or clock step, and an announcement observer is installed before it fires. Checked: C1
 * (the new item in view, or badged, and announced), C2 (the referenced stage's timely set stays in view) and B5
 * (EXECUTE does not move). A failure today's UI has is recorded in TRANSITION_GAPS and asserted to still fail.
 */
import { metricsProblems } from './audit/metrics';
import { audit } from './audit/audit';
import { formatFailure } from './atlas/gates';
import { describeGap, reconcile } from './atlas/knownGaps';
import { STAGES } from './atlas/stages';
import { TRANSITION_GAPS } from './atlas/transitionGaps';
import { attachTransition, beforeRow, runTransition } from './atlas/transitionRun';
import { TRANSITIONS } from './atlas/transitions';
import { checksOf } from './atlas/transitionTypes';
import { isStageId } from './atlas/types';
import { expect, test } from './helpers';

test.use({ reducedMotion: 'reduce' });

test('the transitions table is sound, references real stages, and every recorded gap names one of its rows', () => {
  const stages = new Set(STAGES.map((row) => row.id));
  const ids = TRANSITIONS.map((row) => row.id);
  expect(ids.filter((id) => !isStageId(id) || stages.has(id)), 'kebab-case ids that are not stage ids').toEqual([]);
  expect(ids.filter((id, index) => ids.indexOf(id) !== index), 'repeated ids').toEqual([]);
  const references = TRANSITIONS.flatMap((row) => [...('stage' in row.before ? [row.before.stage] : []), ...(row.keep?.stage === undefined ? [] : [row.keep.stage])]);
  expect(references.filter((id) => !stages.has(id)), 'references to stages the atlas does not hold').toEqual([]);
  expect(TRANSITIONS.filter((row) => checksOf(row).length === 0).map((row) => row.id), 'rows that check nothing').toEqual([]);
  expect(TRANSITION_GAPS.filter((gap) => !ids.includes(gap.stage)).map(describeGap)).toEqual([]);
  for (const row of TRANSITIONS) expect(() => beforeRow(row), row.id).not.toThrow();
});

for (const [order, row] of TRANSITIONS.entries()) {
  test(`transition ${row.id}`, async ({ page }) => {
    const size = page.viewportSize();
    const viewport = size === null ? 'unknown' : `${String(size.width)}x${String(size.height)}`;
    const record = await runTransition(page, row, order, viewport);
    const { unexpected, known, fixed } = reconcile(record.failures, TRANSITION_GAPS, row.id, viewport);
    await attachTransition(record, known, formatFailure);
    // The after-frame's gallery card: the audit reads the view at rest and asserts nothing.
    const metrics = await audit(page, { stage: row.id, fixture: `${record.before} -> ${record.trigger}` }, 0);
    expect(metricsProblems(metrics)).toEqual([]);
    expect(unexpected.map(formatFailure), 'transition failures not recorded in TRANSITION_GAPS').toEqual([]);
    expect(fixed.map(describeGap), 'recorded gaps this transition no longer shows: remove them from TRANSITION_GAPS').toEqual([]);
  });
}
