/** Importing a checkpoint restores its screen without replaying live discoveries. */
import { makePhase1Fixtures } from '../../scripts/make-fixtures';
import { openSave, test, expect, boot, readSave } from './helpers';

const progressed = makePhase1Fixtures()['phase-1-widgets'];
if (!progressed) throw new Error('Missing import checkpoint');

test('same-iteration import establishes a fresh presentation baseline and keeps live time moving', async ({ page }) => {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(progressed);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  for (const id of ['phase-threshold', 'lineage-reveal', 'response-notice']) await expect(page.getByTestId(id)).toHaveCount(0);
  const imported = await readSave(page);
  expect(imported.iteration).toBe(1); expect(imported.currentPhase).toBe(1);
  await page.clock.runFor(5000);
  expect(Number((await readSave(page)).simTimeSec)).toBeCloseTo(Number(imported.simTimeSec) + 5);
  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  for (const id of ['phase-threshold', 'lineage-reveal', 'response-notice']) await expect(page.getByTestId(id)).toHaveCount(0);
});
